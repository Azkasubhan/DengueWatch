-- Repairs create_environmental_report after 202611050001. That rewrite referenced objects
-- that do not exist (private.next_report_reference, report_idempotency.actor_id/payload_hash,
-- report_events.actor_role, report_uploads.report_id) and omitted NOT NULL columns of
-- report_images, so every call failed at run time. It also dropped the upload row lock and
-- the role-aware area check.
--
-- This restores the 202611040003 body (role-aware access, `for update` upload lock,
-- report_idempotency/report_events columns) while keeping visible_objects and
-- prevention_advice optional as intended by 202611050001. Parameter defaults match
-- 202611050001 so `create or replace` succeeds.

create or replace function public.create_environmental_report(
  p_area_id uuid,
  p_category public.report_category,
  p_description text,
  p_visible_objects text default null,
  p_prevention_advice text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_location_note text default null,
  p_upload_ids uuid[] default array[]::uuid[],
  p_idempotency_key text default null
)
returns table (id uuid, public_reference varchar, status public.report_status, submitted_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_visible text := nullif(btrim(p_visible_objects), '');
  v_advice text := nullif(btrim(p_prevention_advice), '');
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
  if v_visible is not null and (char_length(v_visible) not between 5 and 500
    or v_visible ~ '[[:cntrl:]]') then
    raise exception 'invalid visible objects' using errcode = 'P0422';
  end if;
  if v_advice is not null and (char_length(v_advice) not between 10 and 500
    or v_advice ~ '[[:cntrl:]]') then
    raise exception 'invalid prevention advice' using errcode = 'P0422';
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
    'visibleObjects', v_visible, 'preventionAdvice', v_advice,
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
    description, visible_objects, prevention_advice, latitude, longitude, location_note, is_demo)
  values (v_reference, v_user, p_area_id, p_category, btrim(p_description),
    v_visible, v_advice,
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
  text, text, text, numeric, numeric, text, uuid[], text) from public, anon, service_role;
grant execute on function public.create_environmental_report(uuid, public.report_category,
  text, text, text, numeric, numeric, text, uuid[], text) to authenticated;
