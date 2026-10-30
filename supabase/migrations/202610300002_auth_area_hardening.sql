begin;

create function private.expected_membership_type(requested_role public.app_role)
returns public.area_membership_type
language sql
immutable
security invoker
set search_path = ''
as $$
  select case requested_role
    when 'resident'::public.app_role then 'resident'::public.area_membership_type
    when 'cadre'::public.app_role then 'assigned_cadre'::public.area_membership_type
    when 'manager'::public.app_role then 'manager'::public.area_membership_type
  end
$$;

create function private.enforce_profile_role_invariants()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role is not distinct from old.role then
    return new;
  end if;

  -- SECURITY DEFINER changes current_user to the function owner. Use the
  -- request claims instead so an authenticated caller cannot be mistaken for
  -- the trusted migration/admin role.
  if (select auth.uid()) is not null
    or coalesce((select auth.role()), '') in ('anon', 'authenticated') then
    raise exception 'profile role changes require a trusted administrative process'
      using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.area_memberships as membership
    where membership.profile_id = new.id
      and membership.membership_type is distinct from private.expected_membership_type(new.role)
  ) then
    raise exception 'remove incompatible area memberships before changing profile role'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger profiles_enforce_role_invariants
before update of role on public.profiles
for each row execute function private.enforce_profile_role_invariants();

create function private.enforce_membership_role_match()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_role public.app_role;
begin
  select profile.role
  into profile_role
  from public.profiles as profile
  where profile.id = new.profile_id;

  if profile_role is null then
    raise exception 'membership profile does not exist'
      using errcode = '23503';
  end if;

  if new.membership_type is distinct from private.expected_membership_type(profile_role) then
    raise exception 'membership type does not match profile role'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger memberships_enforce_role_match
before insert or update of profile_id, membership_type on public.area_memberships
for each row execute function private.enforce_membership_role_match();

create function private.has_role_area_access(
  requested_area_id uuid,
  requested_role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles as profile
    join public.area_memberships as membership
      on membership.profile_id = profile.id
    where profile.id = (select auth.uid())
      and profile.role = requested_role
      and membership.area_id = requested_area_id
      and membership.membership_type = private.expected_membership_type(requested_role)
      and membership.verified_at is not null
  )
$$;

drop policy areas_select_for_verified_members on public.areas;
create policy areas_select_for_verified_role_members
on public.areas
for select
to authenticated
using (
  (select private.has_role_area_access(
    id,
    (select private.current_profile_role())
  ))
);

revoke execute on all functions in schema private from public, anon;
alter default privileges in schema private revoke execute on functions from public;

revoke execute on function private.has_verified_area_membership(uuid, public.area_membership_type)
  from authenticated;

grant usage on schema private to authenticated;
grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.has_role_area_access(uuid, public.app_role)
  to authenticated;

alter table public.profiles force row level security;
alter table public.areas force row level security;
alter table public.area_memberships force row level security;

commit;

