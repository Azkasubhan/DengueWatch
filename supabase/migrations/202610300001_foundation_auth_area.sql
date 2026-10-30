begin;

create schema if not exists private;
revoke all on schema private from public;

create type public.app_role as enum ('resident', 'cadre', 'manager');
create type public.area_membership_type as enum (
  'resident',
  'assigned_cadre',
  'manager'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name varchar(100) not null,
  role public.app_role not null default 'resident',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_display_name_length
    check (char_length(btrim(display_name)) between 2 and 100),
  constraint profiles_display_name_no_control_chars
    check (display_name !~ '[[:cntrl:]]')
);

create table public.areas (
  id uuid primary key default gen_random_uuid(),
  code varchar(32) not null unique,
  name varchar(120) not null,
  parent_id uuid references public.areas(id) on delete restrict,
  public_latitude numeric(9, 6),
  public_longitude numeric(9, 6),
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint areas_code_format check (code ~ '^[A-Z0-9][A-Z0-9_-]{1,31}$'),
  constraint areas_name_length check (char_length(btrim(name)) between 2 and 120),
  constraint areas_public_latitude_range
    check (public_latitude is null or public_latitude between -90 and 90),
  constraint areas_public_longitude_range
    check (public_longitude is null or public_longitude between -180 and 180),
  constraint areas_public_centroid_pair check (
    (public_latitude is null and public_longitude is null)
    or (public_latitude is not null and public_longitude is not null)
  )
);

create table public.area_memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid not null references public.areas(id) on delete cascade,
  membership_type public.area_membership_type not null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  unique (profile_id, area_id, membership_type)
);

create index idx_memberships_profile_area
  on public.area_memberships (profile_id, area_id);
create index idx_memberships_area_verified
  on public.area_memberships (area_id, membership_type)
  where verified_at is not null;

create function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

create trigger areas_set_updated_at
before update on public.areas
for each row execute function private.set_updated_at();

create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_name text;
begin
  requested_name := left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 100);

  if char_length(requested_name) < 2 or requested_name ~ '[[:cntrl:]]' then
    requested_name := 'Warga DengueWatch';
  end if;

  insert into public.profiles (id, display_name, role)
  values (new.id, requested_name, 'resident'::public.app_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

revoke execute on function private.handle_new_user() from public;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create function private.current_profile_role()
returns public.app_role
language sql
stable
security definer
set search_path = ''
as $$
  select p.role
  from public.profiles as p
  where p.id = (select auth.uid())
$$;

create function private.has_verified_area_membership(
  requested_area_id uuid,
  requested_membership_type public.area_membership_type default null
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.area_memberships as membership
    where membership.profile_id = (select auth.uid())
      and membership.area_id = requested_area_id
      and membership.verified_at is not null
      and (
        requested_membership_type is null
        or membership.membership_type = requested_membership_type
      )
  )
$$;

revoke execute on function private.current_profile_role() from public;
revoke execute on function private.has_verified_area_membership(uuid, public.area_membership_type)
  from public;
grant usage on schema private to authenticated;
grant execute on function private.current_profile_role() to authenticated;
grant execute on function private.has_verified_area_membership(uuid, public.area_membership_type)
  to authenticated;

alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.area_memberships enable row level security;

create policy profiles_select_own
on public.profiles
for select
to authenticated
using ((select auth.uid()) = id);

create policy profiles_update_own_safe_fields
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy memberships_select_own
on public.area_memberships
for select
to authenticated
using ((select auth.uid()) = profile_id);

create policy areas_select_for_verified_members
on public.areas
for select
to authenticated
using ((select private.has_verified_area_membership(id)));

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.areas from anon, authenticated;
revoke all on table public.area_memberships from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;
grant select on table public.areas to authenticated;
grant select on table public.area_memberships to authenticated;

commit;

