begin;

-- Review events follow PRD 8.1; each type is pinned to its only legal transition.
alter table public.report_events drop constraint report_events_event_type_check;
alter table public.report_events add constraint report_events_event_type_check check (
  event_type in (
    'report_created', 'report_verified', 'report_information_requested',
    'report_rejected', 'report_marked_duplicate', 'report_information_added'
  )
);
alter table public.report_events add constraint report_review_event check (coalesce(
  case event_type
    when 'report_verified' then
      old_status = 'pending_verification' and new_status = 'verified'
      and (reason is null or char_length(btrim(reason)) between 10 and 500)
    when 'report_information_requested' then
      old_status = 'pending_verification' and new_status = 'needs_information'
      and char_length(btrim(reason)) between 10 and 500
    when 'report_rejected' then
      old_status = 'pending_verification' and new_status = 'rejected'
      and char_length(btrim(reason)) between 10 and 500
    when 'report_marked_duplicate' then
      old_status = 'pending_verification' and new_status = 'duplicate'
      and char_length(btrim(reason)) between 10 and 500
      and jsonb_typeof(metadata -> 'duplicateOfReportId') = 'string'
    when 'report_information_added' then
      old_status = 'needs_information' and new_status = 'pending_verification'
      and char_length(btrim(reason)) between 10 and 500
    else true
  end, false));

-- Audit rows are append-only for every role; only a cascading report delete may remove them.
create function private.prevent_report_event_mutation()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_catalog.pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'report events are append only' using errcode = 'P0409';
end;
$$;
create trigger report_events_append_only
before update or delete on public.report_events
for each row execute function private.prevent_report_event_mutation();

create function public.review_report(
  p_report_id uuid,
  p_decision text,
  p_reason text,
  p_expected_version integer,
  p_duplicate_of_report_id uuid default null
)
returns table (report_id uuid, status public.report_status, version integer, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_reason text := nullif(btrim(p_reason), '');
  v_report public.reports%rowtype;
  v_target public.reports%rowtype;
  v_new_status public.report_status;
  v_event_type text;
  v_metadata jsonb;
  v_updated_at timestamptz;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'P0401';
  end if;
  -- Managers and residents never review, even inside their own area.
  if private.current_profile_role() is distinct from 'cadre'::public.app_role then
    raise exception 'review not permitted' using errcode = 'P0403';
  end if;
  if p_decision is null
    or p_decision not in ('verify', 'request_information', 'reject', 'mark_duplicate') then
    raise exception 'invalid review decision' using errcode = 'P0422';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid expected version' using errcode = 'P0422';
  end if;
  if (v_reason is null and p_decision <> 'verify')
    or (v_reason is not null and (char_length(v_reason) not between 10 and 500
      or v_reason ~ '[[:cntrl:]]')) then
    raise exception 'invalid review reason' using errcode = 'P0422';
  end if;
  if (p_decision = 'mark_duplicate') <> (p_duplicate_of_report_id is not null) then
    raise exception 'invalid duplicate reference' using errcode = 'P0422';
  end if;

  -- Out-of-scope reports look missing so area membership cannot be probed.
  select * into v_report from public.reports as r
  where r.id = p_report_id
    and private.has_role_area_access(r.area_id, 'cadre'::public.app_role)
  for update of r;
  if not found then
    raise exception 'report not found' using errcode = 'P0404';
  end if;
  if v_report.version <> p_expected_version then
    raise exception 'stale report version' using errcode = 'P0409';
  end if;
  if v_report.status <> 'pending_verification' then
    raise exception 'invalid report transition' using errcode = 'P0422';
  end if;

  if p_decision = 'mark_duplicate' then
    if p_duplicate_of_report_id = v_report.id then
      raise exception 'invalid duplicate target' using errcode = 'P0422';
    end if;
    select * into v_target from public.reports as t
    where t.id = p_duplicate_of_report_id
    for share of t;
    -- The target must be an earlier, still-canonical report in the same area.
    if not found or v_target.area_id <> v_report.area_id
      or v_target.status in ('rejected', 'duplicate')
      or (v_target.submitted_at, v_target.id) >= (v_report.submitted_at, v_report.id) then
      raise exception 'invalid duplicate target' using errcode = 'P0422';
    end if;
  end if;

  v_new_status := case p_decision
    when 'verify' then 'verified'
    when 'request_information' then 'needs_information'
    when 'reject' then 'rejected'
    else 'duplicate'
  end::public.report_status;
  v_event_type := case p_decision
    when 'verify' then 'report_verified'
    when 'request_information' then 'report_information_requested'
    when 'reject' then 'report_rejected'
    else 'report_marked_duplicate'
  end;
  v_metadata := pg_catalog.jsonb_build_object('decision', p_decision,
    'version', p_expected_version + 1);
  if p_decision = 'mark_duplicate' then
    v_metadata := v_metadata || pg_catalog.jsonb_build_object('duplicateOfReportId', v_target.id);
  end if;

  update public.reports as r
  set status = v_new_status,
    version = r.version + 1,
    duplicate_of_report_id = case when p_decision = 'mark_duplicate'
      then v_target.id else r.duplicate_of_report_id end,
    updated_at = now()
  where r.id = v_report.id and r.version = p_expected_version
  returning r.updated_at into v_updated_at;
  if not found then
    raise exception 'stale report version' using errcode = 'P0409';
  end if;
  insert into public.report_events (report_id, actor_id, event_type, old_status,
    new_status, reason, metadata)
  values (v_report.id, v_user, v_event_type, v_report.status, v_new_status,
    v_reason, v_metadata);

  return query select v_report.id, v_new_status, p_expected_version + 1, v_updated_at;
end;
$$;
revoke execute on function public.review_report(uuid, text, text, integer, uuid)
  from public, anon, service_role;
grant execute on function public.review_report(uuid, text, text, integer, uuid) to authenticated;

create function public.add_report_information(
  p_report_id uuid,
  p_note text,
  p_expected_version integer
)
returns table (report_id uuid, status public.report_status, version integer, updated_at timestamptz)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := auth.uid();
  v_note text := btrim(p_note);
  v_report public.reports%rowtype;
  v_updated_at timestamptz;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'P0401';
  end if;
  if private.current_profile_role() is distinct from 'resident'::public.app_role then
    raise exception 'information update not permitted' using errcode = 'P0403';
  end if;
  if v_note is null or char_length(v_note) not between 10 and 500 or v_note ~ '[[:cntrl:]]' then
    raise exception 'invalid information note' using errcode = 'P0422';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid expected version' using errcode = 'P0422';
  end if;

  select * into v_report from public.reports as r
  where r.id = p_report_id and r.reporter_id = v_user
    and private.has_role_area_access(r.area_id, 'resident'::public.app_role)
  for update of r;
  if not found then
    raise exception 'report not found' using errcode = 'P0404';
  end if;
  if v_report.version <> p_expected_version then
    raise exception 'stale report version' using errcode = 'P0409';
  end if;
  if v_report.status <> 'needs_information' then
    raise exception 'invalid report transition' using errcode = 'P0422';
  end if;

  update public.reports as r
  set status = 'pending_verification', version = r.version + 1, updated_at = now()
  where r.id = v_report.id and r.version = p_expected_version
  returning r.updated_at into v_updated_at;
  if not found then
    raise exception 'stale report version' using errcode = 'P0409';
  end if;
  insert into public.report_events (report_id, actor_id, event_type, old_status,
    new_status, reason, metadata)
  values (v_report.id, v_user, 'report_information_added', 'needs_information',
    'pending_verification', v_note,
    pg_catalog.jsonb_build_object('version', p_expected_version + 1));

  return query select v_report.id, 'pending_verification'::public.report_status,
    p_expected_version + 1, v_updated_at;
end;
$$;
revoke execute on function public.add_report_information(uuid, text, integer)
  from public, anon, service_role;
grant execute on function public.add_report_information(uuid, text, integer) to authenticated;

-- Cadres read only the suggestion fields; ai_analyses RLS stays owner-only.
create function public.get_report_ai_suggestions(p_report_id uuid)
returns table (
  analysis_id uuid,
  suggested_category public.report_category,
  visible_objects text[],
  draft_description text,
  suggested_precaution text,
  limitations text,
  analyzed_at timestamptz
)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'P0401';
  end if;
  if private.current_profile_role() is distinct from 'cadre'::public.app_role then
    raise exception 'suggestion access not permitted' using errcode = 'P0403';
  end if;
  if not exists (select 1 from public.reports as r
    where r.id = p_report_id
      and private.has_role_area_access(r.area_id, 'cadre'::public.app_role)) then
    raise exception 'report not found' using errcode = 'P0404';
  end if;

  return query
  select a.id,
    (a.result_json ->> 'suggestedCategory')::public.report_category,
    array(select left(o.value, 80)
      from jsonb_array_elements_text(a.result_json -> 'visibleObjects') with ordinality as o(value, n)
      order by o.n limit 6),
    left(a.result_json ->> 'draftDescription', 500),
    left(a.result_json ->> 'suggestedPrecaution', 300),
    left(a.result_json ->> 'limitations', 300),
    a.completed_at
  from public.ai_analyses as a
  join public.reports as r on r.id = a.report_id
  where a.report_id = p_report_id
    and a.status = 'success'
    and a.area_id = r.area_id
    and a.request_user_id = r.reporter_id
    and a.result_json -> 'requiresHumanVerification' = 'true'::jsonb
    and a.result_json ->> 'suggestedCategory'
      = any(enum_range(null::public.report_category)::text[])
    and jsonb_typeof(a.result_json -> 'visibleObjects') = 'array'
  order by a.completed_at desc, a.id
  limit 3;
end;
$$;
revoke execute on function public.get_report_ai_suggestions(uuid) from public, anon, service_role;
grant execute on function public.get_report_ai_suggestions(uuid) to authenticated;

commit;
