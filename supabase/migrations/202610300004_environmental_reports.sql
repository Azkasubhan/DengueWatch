begin;

create type public.report_category as enum (
  'water_container', 'discarded_tire', 'clogged_drain', 'discarded_item', 'other'
);
create type public.report_status as enum (
  'pending_verification', 'verified', 'needs_information', 'rejected',
  'duplicate', 'in_action', 'resolved'
);

create sequence public.report_reference_seq;
revoke all on sequence public.report_reference_seq from public, anon, authenticated;

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  public_reference varchar(20) not null unique,
  reporter_id uuid not null references public.profiles(id),
  area_id uuid not null references public.areas(id),
  category public.report_category not null,
  description varchar(1000) not null,
  status public.report_status not null default 'pending_verification',
  latitude numeric(9,6),
  longitude numeric(9,6),
  location_note varchar(250),
  is_demo boolean not null default false,
  duplicate_of_report_id uuid references public.reports(id),
  version integer not null default 1 check (version > 0),
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint report_description_length check (char_length(btrim(description)) between 10 and 1000),
  constraint report_description_control check (description !~ '[[:cntrl:]]'),
  constraint report_coordinates_pair check ((latitude is null) = (longitude is null)),
  constraint report_latitude_range check (latitude between -90 and 90),
  constraint report_longitude_range check (longitude between -180 and 180),
  constraint report_location_note_length check (location_note is null or char_length(location_note) <= 250)
);
create index idx_reports_reporter_created on public.reports (reporter_id, created_at desc, id desc);
create index idx_reports_area_status_created on public.reports (area_id, status, created_at desc);

create table public.report_uploads (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  width integer not null check (width between 1 and 6000),
  height integer not null check (height between 1 and 6000),
  uploaded_at timestamptz,
  consumed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '1 hour'),
  created_at timestamptz not null default now(),
  constraint report_upload_pixels check (width::bigint * height::bigint <= 24000000),
  constraint report_upload_path check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$')
);
create index idx_report_uploads_cleanup on public.report_uploads (expires_at) where consumed_at is null;

create table public.report_images (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  upload_id uuid not null unique references public.report_uploads(id),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size between 1 and 5242880),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);
create index idx_report_images_report on public.report_images (report_id);

create table public.report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type text not null check (event_type = 'report_created'),
  old_status public.report_status,
  new_status public.report_status not null,
  reason varchar(500),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  constraint report_created_event check (
    event_type <> 'report_created' or
    (old_status is null and new_status = 'pending_verification' and reason is null)
  )
);
create index idx_report_events_report_created on public.report_events (report_id, created_at desc);

create table public.report_idempotency (
  user_id uuid not null references public.profiles(id),
  operation text not null check (operation = 'create_report'),
  idempotency_key varchar(128) not null,
  request_payload jsonb not null,
  report_id uuid not null unique references public.reports(id),
  created_at timestamptz not null default now(),
  primary key (user_id, operation, idempotency_key)
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('report-photos', 'report-photos', false, 5242880, array['image/webp']);

create function private.can_read_report(requested_report_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.reports as report
    where report.id = requested_report_id
      and (
        report.reporter_id = (select auth.uid())
        or (select private.has_role_area_access(report.area_id, 'cadre'::public.app_role))
        or (select private.has_role_area_access(report.area_id, 'manager'::public.app_role))
      )
  )
$$;
revoke execute on function private.can_read_report(uuid) from public, anon;
grant execute on function private.can_read_report(uuid) to authenticated;

alter table public.reports enable row level security;
alter table public.reports force row level security;
alter table public.report_uploads enable row level security;
alter table public.report_uploads force row level security;
alter table public.report_images enable row level security;
alter table public.report_images force row level security;
alter table public.report_events enable row level security;
alter table public.report_events force row level security;
alter table public.report_idempotency enable row level security;
alter table public.report_idempotency force row level security;

create policy reports_select_authorized on public.reports
for select to authenticated using (private.can_read_report(id));
create policy report_images_select_authorized on public.report_images
for select to authenticated using (private.can_read_report(report_id));
create policy report_events_select_authorized on public.report_events
for select to authenticated using (private.can_read_report(report_id));

create policy report_photos_read_authorized on storage.objects
for select to authenticated using (
  bucket_id = 'report-photos'
  and exists (
    select 1 from public.report_images as image
    where image.storage_path = name
      and private.can_read_report(image.report_id)
  )
);

revoke all on public.reports, public.report_uploads, public.report_images,
  public.report_events, public.report_idempotency from public, anon, authenticated, service_role;
grant select on public.reports, public.report_images, public.report_events to authenticated;
grant select on public.reports, public.report_images, public.report_events to service_role;
grant select, insert, update, delete on public.report_uploads to service_role;

create function public.create_environmental_report(
  p_area_id uuid,
  p_category public.report_category,
  p_description text,
  p_latitude numeric,
  p_longitude numeric,
  p_location_note text,
  p_upload_ids uuid[],
  p_idempotency_key text
)
returns table (id uuid, public_reference varchar, status public.report_status, submitted_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_payload jsonb;
  v_existing public.report_idempotency%rowtype;
  v_report_id uuid;
  v_reference varchar(20);
  v_submitted_at timestamptz;
  v_count integer;
  v_demo boolean;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'P0401';
  end if;
  -- The profile role, membership and area are checked at the data boundary.
  if not private.has_role_area_access(p_area_id, 'resident'::public.app_role) then
    raise exception 'area access denied' using errcode = 'P0403';
  end if;
  if p_description is null or char_length(btrim(p_description)) not between 10 and 1000
    or btrim(p_description) ~ '[[:cntrl:]]' then
    raise exception 'invalid description' using errcode = 'P0422';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
    or (p_latitude is not null and (p_latitude < -90 or p_latitude > 90))
    or (p_longitude is not null and (p_longitude < -180 or p_longitude > 180))
    or (p_location_note is not null and char_length(p_location_note) > 250) then
    raise exception 'invalid location' using errcode = 'P0422';
  end if;
  if p_upload_ids is null or cardinality(p_upload_ids) not between 1 and 3
    or (select count(distinct x) from unnest(p_upload_ids) as x) <> cardinality(p_upload_ids) then
    raise exception 'invalid upload references' using errcode = 'P0422';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{8,128}$' then
    raise exception 'invalid idempotency key' using errcode = 'P0422';
  end if;

  v_payload := pg_catalog.jsonb_build_object(
    'areaId', p_area_id, 'category', p_category, 'description', btrim(p_description),
    'latitude', p_latitude, 'longitude', p_longitude,
    'locationNote', nullif(btrim(p_location_note), ''), 'uploadIds', p_upload_ids
  );
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user::text || ':create_report:' || p_idempotency_key, 0));
  select * into v_existing from public.report_idempotency
  where user_id = v_user and operation = 'create_report' and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_payload <> v_payload then
      raise exception 'idempotency conflict' using errcode = 'P0409';
    end if;
    return query select r.id, r.public_reference, r.status, r.submitted_at
      from public.reports as r where r.id = v_existing.report_id;
    return;
  end if;

  if (select count(*) from public.reports as r
      where r.reporter_id = v_user and r.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'report rate limit' using errcode = 'P0429';
  end if;

  -- Lock each upload so two different keys cannot consume the same reference.
  select count(*) into v_count from (
    select u.id from public.report_uploads as u
    where u.id = any(p_upload_ids) and u.created_by = v_user
      and u.uploaded_at is not null and u.consumed_at is null
      and u.expires_at > now()
      and exists (select 1 from storage.objects as o
        where o.bucket_id = 'report-photos' and o.name = u.storage_path)
    for update of u
  ) as locked_uploads;
  if v_count <> cardinality(p_upload_ids) then
    raise exception 'upload references unavailable' using errcode = 'P0409';
  end if;

  select a.is_demo into v_demo from public.areas as a where a.id = p_area_id;
  v_reference := ('DW-' || to_char(now() at time zone 'UTC', 'YYYY') || '-' ||
    lpad(nextval('public.report_reference_seq'::regclass)::text, 6, '0'))::varchar(20);
  insert into public.reports (public_reference, reporter_id, area_id, category,
    description, latitude, longitude, location_note, is_demo)
  values (v_reference, v_user, p_area_id, p_category, btrim(p_description),
    p_latitude, p_longitude, nullif(btrim(p_location_note), ''), v_demo)
  returning reports.id, reports.submitted_at into v_report_id, v_submitted_at;

  insert into public.report_images (report_id, upload_id, storage_path,
    mime_type, byte_size, width, height, created_by)
  select v_report_id, u.id, u.storage_path, u.mime_type, u.byte_size,
    u.width, u.height, v_user
  from public.report_uploads as u where u.id = any(p_upload_ids);
  update public.report_uploads set consumed_at = now() where report_uploads.id = any(p_upload_ids);
  insert into public.report_events (report_id, actor_id, event_type, new_status)
  values (v_report_id, v_user, 'report_created', 'pending_verification');
  insert into public.report_idempotency (user_id, operation, idempotency_key,
    request_payload, report_id)
  values (v_user, 'create_report', p_idempotency_key, v_payload, v_report_id);

  return query select v_report_id, v_reference, 'pending_verification'::public.report_status,
    v_submitted_at;
end;
$$;
revoke execute on function public.create_environmental_report(uuid, public.report_category,
  text, numeric, numeric, text, uuid[], text) from public, anon, service_role;
grant execute on function public.create_environmental_report(uuid, public.report_category,
  text, numeric, numeric, text, uuid[], text) to authenticated;

commit;
