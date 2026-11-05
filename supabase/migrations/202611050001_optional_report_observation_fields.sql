-- Make report observation fields (visible_objects & prevention_advice) optional
-- in create_environmental_report so resident submissions do not require manual
-- or AI-prefilled prevention advice or duplicate observation text.

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
returns table (
  id uuid,
  public_reference varchar,
  status public.report_status,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_description text := btrim(p_description);
  v_visible text := nullif(btrim(p_visible_objects), '');
  v_advice text := nullif(btrim(p_prevention_advice), '');
  v_note text := nullif(btrim(p_location_note), '');
  v_key text := btrim(p_idempotency_key);
  v_upload_ids uuid[];
  v_payload_hash text;
  v_existing public.report_idempotency%rowtype;
  v_report public.reports%rowtype;
  v_upload_count integer;
begin
  if v_user_id is null then
    raise exception 'authentication required' using errcode = 'P0401';
  end if;
  if p_area_id is null or not private.has_verified_area_membership(p_area_id, 'resident') then
    raise exception 'area access denied' using errcode = 'P0403';
  end if;
  if v_description is null or char_length(v_description) not between 10 and 1000 or v_description ~ '[[:cntrl:]]' then
    raise exception 'invalid description' using errcode = 'P0422';
  end if;
  if v_visible is not null and (char_length(v_visible) not between 5 and 500 or v_visible ~ '[[:cntrl:]]') then
    raise exception 'invalid visible objects' using errcode = 'P0422';
  end if;
  if v_advice is not null and (char_length(v_advice) not between 10 and 500 or v_advice ~ '[[:cntrl:]]') then
    raise exception 'invalid prevention advice' using errcode = 'P0422';
  end if;
  if (p_latitude is null) <> (p_longitude is null)
     or (p_latitude is not null and p_latitude not between -90 and 90)
     or (p_longitude is not null and p_longitude not between -180 and 180) then
    raise exception 'invalid coordinates' using errcode = 'P0422';
  end if;
  if v_note is not null and (char_length(v_note) > 250 or v_note ~ '[[:cntrl:]]') then
    raise exception 'invalid location note' using errcode = 'P0422';
  end if;
  if v_key is null or char_length(v_key) not between 8 and 128 or v_key !~ '^[A-Za-z0-9_-]+$' then
    raise exception 'invalid idempotency key' using errcode = 'P0422';
  end if;
  if coalesce(array_length(p_upload_ids, 1), 0) not between 1 and 3 then
    raise exception 'invalid upload references' using errcode = 'P0422';
  end if;
  select array_agg(upload_id order by upload_id) into v_upload_ids
  from (select distinct unnest(p_upload_ids) as upload_id) as deduped;
  if array_length(v_upload_ids, 1) <> array_length(p_upload_ids, 1) or v_upload_ids @> array[null::uuid] then
    raise exception 'invalid upload references' using errcode = 'P0422';
  end if;

  v_payload_hash := encode(extensions.digest(concat_ws('|',
    p_area_id::text, p_category::text, v_description, coalesce(v_visible, ''), coalesce(v_advice, ''),
    coalesce(round(p_latitude::numeric, 6)::text, ''), coalesce(round(p_longitude::numeric, 6)::text, ''),
    coalesce(v_note, ''), array_to_string(v_upload_ids, ',')
  ), 'sha256'), 'hex');

  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text || ':' || v_key, 0));
  select * into v_existing from public.report_idempotency
  where actor_id = v_user_id and idempotency_key = v_key;
  if found then
    if v_existing.payload_hash <> v_payload_hash then
      raise exception 'idempotency conflict' using errcode = 'P0409';
    end if;
    return query select r.id, r.public_reference, r.status, r.submitted_at
      from public.reports as r where r.id = v_existing.report_id;
    return;
  end if;

  select count(*) into v_upload_count
  from public.report_uploads as u
  join storage.objects as o on o.bucket_id = 'report-photos' and o.name = u.storage_path
  where u.id = any(p_upload_ids)
    and u.created_by = v_user_id
    and u.uploaded_at is not null
    and u.consumed_at is null
    and u.expires_at > now();
  if v_upload_count <> array_length(p_upload_ids, 1) then
    raise exception 'upload references unavailable' using errcode = 'P0409';
  end if;

  insert into public.reports (
    public_reference, reporter_id, area_id, category, description,
    visible_objects, prevention_advice, status,
    latitude, longitude, location_note, is_demo
  ) values (
    private.next_report_reference(), v_user_id, p_area_id, p_category, v_description,
    v_visible, v_advice, 'pending_verification',
    p_latitude::numeric(9, 6), p_longitude::numeric(9, 6), v_note,
    (select a.is_demo from public.areas as a where a.id = p_area_id)
  ) returning * into v_report;

  update public.report_uploads set consumed_at = now(), report_id = v_report.id where id = any(p_upload_ids);
  insert into public.report_images (report_id, storage_path, mime_type, byte_size, width, height)
  select v_report.id, u.storage_path, u.mime_type, u.byte_size, u.width, u.height
  from unnest(p_upload_ids) with ordinality as ord(upload_id, position)
  join public.report_uploads as u on u.id = ord.upload_id
  order by ord.position;

  insert into public.report_events (report_id, actor_id, actor_role, event_type, old_status, new_status)
  values (v_report.id, v_user_id, 'resident', 'report_created', null, v_report.status);
  insert into public.report_idempotency (actor_id, idempotency_key, payload_hash, report_id)
  values (v_user_id, v_key, v_payload_hash, v_report.id);

  return query select v_report.id, v_report.public_reference, v_report.status, v_report.submitted_at;
end;
$$;

