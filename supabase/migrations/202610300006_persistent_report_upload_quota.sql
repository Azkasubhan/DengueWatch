begin;

create table public.report_upload_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index idx_report_upload_attempts_user_created
  on public.report_upload_attempts (user_id, created_at desc);

alter table public.report_upload_attempts enable row level security;
alter table public.report_upload_attempts force row level security;
revoke all on public.report_upload_attempts from public, anon, authenticated, service_role;

-- Count leases already issued before this forward-only migration.
insert into public.report_upload_attempts (user_id, created_at)
select created_by, created_at from public.report_uploads;

create or replace function private.enforce_report_upload_quota()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('report_upload:' || new.created_by::text, 0)
  );
  if (select count(*) from public.report_upload_attempts as attempt
      where attempt.user_id = new.created_by
        and attempt.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'upload rate limit' using errcode = 'P0429';
  end if;
  insert into public.report_upload_attempts (user_id) values (new.created_by);
  return new;
end;
$$;

commit;
