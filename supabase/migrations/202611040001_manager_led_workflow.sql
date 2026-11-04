begin;

-- T27: managers verify reports, assign one or more cadres per task, review evidence, and
-- cancel or reopen tasks. Cadres only see and work the tasks assigned to them.

create table public.action_task_assignees (
  task_id uuid not null references public.action_tasks(id) on delete cascade,
  profile_id uuid not null references public.profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (task_id, profile_id)
);
create index idx_action_task_assignees_profile on public.action_task_assignees (profile_id, task_id);

insert into public.action_task_assignees (task_id, profile_id, assigned_at)
select t.id, t.assigned_to, t.created_at from public.action_tasks as t;
alter table public.action_tasks drop column assigned_to;

create function private.is_task_assignee(p_task_id uuid, p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.action_task_assignees as a
    where a.task_id = p_task_id and a.profile_id = p_profile_id
  )
$$;
revoke execute on function private.is_task_assignee(uuid, uuid) from public, anon, authenticated;

create or replace function private.can_read_task(requested_task_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.action_tasks as task
    where task.id = requested_task_id
      and (
        (select private.has_role_area_access(task.area_id, 'manager'::public.app_role))
        or ((select private.has_role_area_access(task.area_id, 'cadre'::public.app_role))
          and private.is_task_assignee(task.id, (select auth.uid())))
      )
  )
$$;

-- Cadres read a report only through a task assigned to them.
create or replace function private.can_read_report(requested_report_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.reports as report
    where report.id = requested_report_id
      and (
        report.reporter_id = (select auth.uid())
        or (select private.has_role_area_access(report.area_id, 'manager'::public.app_role))
        or ((select private.has_role_area_access(report.area_id, 'cadre'::public.app_role))
          and exists (
            select 1 from public.action_tasks as task
            join public.action_task_assignees as a on a.task_id = task.id
            where task.report_id = report.id and a.profile_id = (select auth.uid())
          ))
      )
  )
$$;

alter table public.action_task_assignees enable row level security;
alter table public.action_task_assignees force row level security;
create policy action_task_assignees_select_authorized on public.action_task_assignees
for select to authenticated using (private.can_read_task(task_id));
revoke all on public.action_task_assignees from public, anon, authenticated, service_role;
grant select on public.action_task_assignees to authenticated, service_role;

create function private.require_manager_actor()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'P0401';
  end if;
  if private.current_profile_role() is distinct from 'manager'::public.app_role then
    raise exception 'action not permitted' using errcode = 'P0403';
  end if;
  return auth.uid();
end;
$$;
revoke execute on function private.require_manager_actor() from public, anon, authenticated;

-- Locks the report before the task so concurrent ActionLoop mutations serialize per report.
-- Out-of-scope tasks, including tasks not assigned to a cadre, look missing.
create function private.lock_task(p_task_id uuid, p_role public.app_role)
returns public.action_tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.action_tasks%rowtype;
begin
  select * into v_task from public.action_tasks as t
  where t.id = p_task_id
    and private.has_role_area_access(t.area_id, p_role)
    and (p_role <> 'cadre'::public.app_role or private.is_task_assignee(t.id, auth.uid()));
  if not found then
    raise exception 'task not found' using errcode = 'P0404';
  end if;
  perform 1 from public.reports as r where r.id = v_task.report_id for update of r;
  select * into v_task from public.action_tasks as t where t.id = p_task_id for update of t;
  return v_task;
end;
$$;
revoke execute on function private.lock_task(uuid, public.app_role) from public, anon, authenticated;

create or replace function public.review_report(
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
  -- Only managers review; cadres and residents never do, even inside their own area.
  if private.current_profile_role() is distinct from 'manager'::public.app_role then
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
    and private.has_role_area_access(r.area_id, 'manager'::public.app_role)
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

-- Managers read only the suggestion fields; ai_analyses RLS stays owner-only.
create or replace function public.get_report_ai_suggestions(p_report_id uuid)
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
  if private.current_profile_role() is distinct from 'manager'::public.app_role then
    raise exception 'suggestion access not permitted' using errcode = 'P0403';
  end if;
  if not exists (select 1 from public.reports as r
    where r.id = p_report_id
      and private.has_role_area_access(r.area_id, 'manager'::public.app_role)) then
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

drop function public.create_action_task(uuid, text, text, uuid, timestamptz, boolean, text);
create function public.create_action_task(
  p_report_id uuid,
  p_title text,
  p_description text,
  p_assignees uuid[],
  p_due_at timestamptz,
  p_is_mandatory boolean,
  p_idempotency_key text
)
returns table (task_id uuid, status public.task_status, version integer,
  report_status public.report_status, report_version integer)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := private.require_manager_actor();
  v_title text := btrim(p_title);
  v_description text := btrim(p_description);
  v_assignees uuid[];
  v_payload jsonb;
  v_existing public.action_task_idempotency%rowtype;
  v_report public.reports%rowtype;
  v_task_id uuid;
begin
  if v_title is null or char_length(v_title) not between 5 and 140 or v_title ~ '[[:cntrl:]]' then
    raise exception 'invalid task title' using errcode = 'P0422';
  end if;
  if v_description is null or char_length(v_description) not between 10 and 1000
    or v_description ~ '[[:cntrl:]]' then
    raise exception 'invalid task description' using errcode = 'P0422';
  end if;
  -- One to ten distinct cadres per task.
  if p_assignees is null or p_is_mandatory is null
    or coalesce(cardinality(p_assignees), 0) not between 1 and 10
    or array_position(p_assignees, null) is not null
    or (select count(distinct a) from unnest(p_assignees) as a) <> cardinality(p_assignees) then
    raise exception 'invalid task assignment' using errcode = 'P0422';
  end if;
  if p_due_at is not null and (p_due_at <= now() or p_due_at > now() + interval '366 days') then
    raise exception 'invalid due date' using errcode = 'P0422';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{8,128}$' then
    raise exception 'invalid idempotency key' using errcode = 'P0422';
  end if;

  v_assignees := array(select a from unnest(p_assignees) as a order by a);
  v_payload := pg_catalog.jsonb_build_object('reportId', p_report_id, 'title', v_title,
    'description', v_description, 'assignees', pg_catalog.to_jsonb(v_assignees),
    'dueAt', p_due_at, 'isMandatory', p_is_mandatory);
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user::text || ':create_task:' || p_idempotency_key, 0));
  select * into v_existing from public.action_task_idempotency as i
  where i.user_id = v_user and i.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_payload <> v_payload then
      raise exception 'idempotency conflict' using errcode = 'P0409';
    end if;
    return query select t.id, t.status, t.version, r.status, r.version
      from public.action_tasks as t join public.reports as r on r.id = t.report_id
      where t.id = v_existing.task_id
        and private.has_role_area_access(t.area_id, 'manager'::public.app_role);
    if not found then
      raise exception 'report not found' using errcode = 'P0404';
    end if;
    return;
  end if;

  select * into v_report from public.reports as r
  where r.id = p_report_id
    and private.has_role_area_access(r.area_id, 'manager'::public.app_role)
  for update of r;
  if not found then
    raise exception 'report not found' using errcode = 'P0404';
  end if;
  if v_report.status not in ('verified', 'in_action') then
    raise exception 'invalid report transition' using errcode = 'P0422';
  end if;
  -- Assignees are verified cadres of the report area.
  if exists (select 1 from unnest(v_assignees) as a
    where not private.is_area_cadre(a, v_report.area_id)) then
    raise exception 'invalid task assignee' using errcode = 'P0422';
  end if;

  insert into public.action_tasks (report_id, area_id, title, description,
    created_by, is_mandatory, due_at)
  values (v_report.id, v_report.area_id, v_title, v_description, v_user,
    p_is_mandatory, p_due_at)
  returning action_tasks.id into v_task_id;
  insert into public.action_task_assignees (task_id, profile_id)
  select v_task_id, a from unnest(v_assignees) as a;
  insert into public.task_events (task_id, actor_id, event_type, new_status, metadata)
  values (v_task_id, v_user, 'task_created', 'assigned',
    pg_catalog.jsonb_build_object('assignees', pg_catalog.to_jsonb(v_assignees),
      'isMandatory', p_is_mandatory));
  if v_report.status = 'verified' then
    update public.reports as r
    set status = 'in_action', version = r.version + 1, updated_at = now()
    where r.id = v_report.id;
    insert into public.report_events (report_id, actor_id, event_type, old_status, new_status, metadata)
    values (v_report.id, v_user, 'report_action_started', 'verified', 'in_action',
      pg_catalog.jsonb_build_object('taskId', v_task_id, 'version', v_report.version + 1));
  end if;
  insert into public.action_task_idempotency (user_id, idempotency_key, request_payload, task_id)
  values (v_user, p_idempotency_key, v_payload, v_task_id);

  return query select t.id, t.status, t.version, r.status, r.version
    from public.action_tasks as t join public.reports as r on r.id = t.report_id
    where t.id = v_task_id;
end;
$$;

-- Any assigned cadre may start the shared task.
create or replace function public.start_action_task(p_task_id uuid, p_expected_version integer)
returns table (task_id uuid, status public.task_status, version integer,
  report_status public.report_status, report_version integer)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := private.require_cadre_actor();
  v_task public.action_tasks%rowtype;
begin
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid expected version' using errcode = 'P0422';
  end if;
  v_task := private.lock_task(p_task_id, 'cadre');
  if v_task.version <> p_expected_version then
    raise exception 'stale task version' using errcode = 'P0409';
  end if;
  if v_task.status not in ('assigned', 'reopened') then
    raise exception 'invalid task transition' using errcode = 'P0422';
  end if;
  update public.action_tasks as t
  set status = 'in_progress', version = t.version + 1, updated_at = now()
  where t.id = v_task.id;
  insert into public.task_events (task_id, actor_id, event_type, old_status, new_status, metadata)
  values (v_task.id, v_user, 'task_started', v_task.status, 'in_progress',
    pg_catalog.jsonb_build_object('version', p_expected_version + 1));
  return query select t.id, t.status, t.version, r.status, r.version
    from public.action_tasks as t join public.reports as r on r.id = t.report_id
    where t.id = v_task.id;
end;
$$;

-- Any assigned cadre may submit evidence for the shared task.
create or replace function public.submit_task_evidence(
  p_task_id uuid,
  p_upload_id uuid,
  p_description text,
  p_expected_version integer
)
returns table (task_id uuid, status public.task_status, version integer,
  report_status public.report_status, report_version integer)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := private.require_cadre_actor();
  v_description text := btrim(p_description);
  v_task public.action_tasks%rowtype;
  v_upload public.report_uploads%rowtype;
  v_evidence_id uuid;
begin
  if v_description is null or char_length(v_description) not between 10 and 500
    or v_description ~ '[[:cntrl:]]' then
    raise exception 'invalid evidence description' using errcode = 'P0422';
  end if;
  if p_upload_id is null then
    raise exception 'invalid evidence upload' using errcode = 'P0422';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid expected version' using errcode = 'P0422';
  end if;
  v_task := private.lock_task(p_task_id, 'cadre');
  if v_task.version <> p_expected_version then
    raise exception 'stale task version' using errcode = 'P0409';
  end if;
  if v_task.status <> 'in_progress' then
    raise exception 'invalid task transition' using errcode = 'P0422';
  end if;

  -- Evidence reuses the private M3 upload lease owned by the submitter.
  select * into v_upload from public.report_uploads as u
  where u.id = p_upload_id and u.created_by = v_user
    and u.uploaded_at is not null and u.consumed_at is null and u.expires_at > now()
    and exists (select 1 from storage.objects as o
      where o.bucket_id = 'report-photos' and o.name = u.storage_path)
  for update of u;
  if not found then
    raise exception 'upload references unavailable' using errcode = 'P0409';
  end if;

  insert into public.task_evidence (task_id, submitted_by, upload_id, storage_path, width,
    height, description)
  values (v_task.id, v_user, v_upload.id, v_upload.storage_path, v_upload.width,
    v_upload.height, v_description)
  returning task_evidence.id into v_evidence_id;
  update public.report_uploads as u set consumed_at = now() where u.id = v_upload.id;
  update public.action_tasks as t
  set status = 'awaiting_review', version = t.version + 1, updated_at = now()
  where t.id = v_task.id;
  insert into public.task_events (task_id, actor_id, event_type, old_status, new_status, metadata)
  values (v_task.id, v_user, 'task_evidence_submitted', 'in_progress', 'awaiting_review',
    pg_catalog.jsonb_build_object('evidenceId', v_evidence_id, 'version', p_expected_version + 1));
  return query select t.id, t.status, t.version, r.status, r.version
    from public.action_tasks as t join public.reports as r on r.id = t.report_id
    where t.id = v_task.id;
end;
$$;

-- Managers review evidence; the independent-review CHECK still forbids self review.
create or replace function public.review_task_evidence(
  p_task_id uuid,
  p_decision text,
  p_reason text,
  p_expected_version integer
)
returns table (task_id uuid, status public.task_status, version integer,
  report_status public.report_status, report_version integer)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := private.require_manager_actor();
  v_reason text := nullif(btrim(p_reason), '');
  v_task public.action_tasks%rowtype;
  v_evidence public.task_evidence%rowtype;
begin
  if p_decision is null or p_decision not in ('approve', 'request_revision') then
    raise exception 'invalid evidence decision' using errcode = 'P0422';
  end if;
  if (p_decision = 'request_revision' or v_reason is not null)
    and not private.valid_action_reason(v_reason) then
    raise exception 'invalid review reason' using errcode = 'P0422';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid expected version' using errcode = 'P0422';
  end if;
  v_task := private.lock_task(p_task_id, 'manager');
  if v_task.version <> p_expected_version then
    raise exception 'stale task version' using errcode = 'P0409';
  end if;
  if v_task.status <> 'awaiting_review' then
    raise exception 'invalid task transition' using errcode = 'P0422';
  end if;
  select * into v_evidence from public.task_evidence as e
  where e.task_id = v_task.id and e.review_status = 'pending'
  for update of e;
  if not found then
    raise exception 'evidence unavailable' using errcode = 'P0422';
  end if;
  if v_evidence.submitted_by = v_user then
    raise exception 'self review not permitted' using errcode = 'P0403';
  end if;

  if p_decision = 'approve' then
    -- Missing evidence files can never complete a task (AC-42).
    if not exists (select 1 from storage.objects as o
      where o.bucket_id = 'report-photos' and o.name = v_evidence.storage_path) then
      raise exception 'evidence unavailable' using errcode = 'P0422';
    end if;
    update public.task_evidence as e
    set review_status = 'approved', reviewed_by = v_user, reviewed_at = now(),
      review_reason = v_reason
    where e.id = v_evidence.id;
    update public.action_tasks as t
    set status = 'completed', completed_at = now(), version = t.version + 1, updated_at = now()
    where t.id = v_task.id;
    insert into public.task_events (task_id, actor_id, event_type, old_status, new_status,
      reason, metadata)
    values (v_task.id, v_user, 'task_evidence_approved', 'awaiting_review', 'completed',
      v_reason, pg_catalog.jsonb_build_object('evidenceId', v_evidence.id,
        'version', p_expected_version + 1));
    perform private.refresh_report_resolution(v_task.report_id, v_task.id, v_user);
  else
    update public.task_evidence as e
    set review_status = 'revision_required', reviewed_by = v_user, reviewed_at = now(),
      review_reason = v_reason
    where e.id = v_evidence.id;
    update public.action_tasks as t
    set status = 'in_progress', version = t.version + 1, updated_at = now()
    where t.id = v_task.id;
    insert into public.task_events (task_id, actor_id, event_type, old_status, new_status,
      reason, metadata)
    values (v_task.id, v_user, 'task_revision_requested', 'awaiting_review', 'in_progress',
      v_reason, pg_catalog.jsonb_build_object('evidenceId', v_evidence.id,
        'version', p_expected_version + 1));
  end if;
  return query select t.id, t.status, t.version, r.status, r.version
    from public.action_tasks as t join public.reports as r on r.id = t.report_id
    where t.id = v_task.id;
end;
$$;

create or replace function public.cancel_action_task(
  p_task_id uuid,
  p_reason text,
  p_expected_version integer
)
returns table (task_id uuid, status public.task_status, version integer,
  report_status public.report_status, report_version integer)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := private.require_manager_actor();
  v_task public.action_tasks%rowtype;
begin
  if not private.valid_action_reason(p_reason) then
    raise exception 'invalid cancel reason' using errcode = 'P0422';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid expected version' using errcode = 'P0422';
  end if;
  v_task := private.lock_task(p_task_id, 'manager');
  if v_task.version <> p_expected_version then
    raise exception 'stale task version' using errcode = 'P0409';
  end if;
  if v_task.status not in ('assigned', 'in_progress', 'awaiting_review', 'reopened') then
    raise exception 'invalid task transition' using errcode = 'P0422';
  end if;
  update public.action_tasks as t
  set status = 'cancelled', version = t.version + 1, updated_at = now()
  where t.id = v_task.id;
  insert into public.task_events (task_id, actor_id, event_type, old_status, new_status,
    reason, metadata)
  values (v_task.id, v_user, 'task_cancelled', v_task.status, 'cancelled', btrim(p_reason),
    pg_catalog.jsonb_build_object('version', p_expected_version + 1));
  -- A cancelled task is no longer active; remaining mandatory work may now be complete.
  perform private.refresh_report_resolution(v_task.report_id, v_task.id, v_user);
  return query select t.id, t.status, t.version, r.status, r.version
    from public.action_tasks as t join public.reports as r on r.id = t.report_id
    where t.id = v_task.id;
end;
$$;

create or replace function public.reopen_action_task(
  p_task_id uuid,
  p_reason text,
  p_expected_version integer
)
returns table (task_id uuid, status public.task_status, version integer,
  report_status public.report_status, report_version integer)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := private.require_manager_actor();
  v_task public.action_tasks%rowtype;
  v_report public.reports%rowtype;
begin
  if not private.valid_action_reason(p_reason) then
    raise exception 'invalid reopen reason' using errcode = 'P0422';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid expected version' using errcode = 'P0422';
  end if;
  v_task := private.lock_task(p_task_id, 'manager');
  if v_task.version <> p_expected_version then
    raise exception 'stale task version' using errcode = 'P0409';
  end if;
  if v_task.status <> 'completed' then
    raise exception 'invalid task transition' using errcode = 'P0422';
  end if;
  update public.action_tasks as t
  set status = 'reopened', completed_at = null, version = t.version + 1, updated_at = now()
  where t.id = v_task.id;
  insert into public.task_events (task_id, actor_id, event_type, old_status, new_status,
    reason, metadata)
  values (v_task.id, v_user, 'task_reopened', 'completed', 'reopened', btrim(p_reason),
    pg_catalog.jsonb_build_object('version', p_expected_version + 1));
  select * into v_report from public.reports as r where r.id = v_task.report_id;
  -- Recurrence on a resolved report reopens it with the recorded reason (PRD 8.1).
  if v_task.is_mandatory and v_report.status = 'resolved' then
    update public.reports as r
    set status = 'in_action', resolved_at = null, version = r.version + 1, updated_at = now()
    where r.id = v_report.id;
    insert into public.report_events (report_id, actor_id, event_type, old_status, new_status,
      reason, metadata)
    values (v_report.id, v_user, 'report_reopened', 'resolved', 'in_action', btrim(p_reason),
      pg_catalog.jsonb_build_object('taskId', v_task.id, 'version', v_report.version + 1));
  end if;
  return query select t.id, t.status, t.version, r.status, r.version
    from public.action_tasks as t join public.reports as r on r.id = t.report_id
    where t.id = v_task.id;
end;
$$;

-- Reserves an evidence lease only for an assignee of an in-progress task in their area.
create or replace function public.reserve_task_evidence_upload(
  p_task_id uuid,
  p_byte_size integer,
  p_width integer,
  p_height integer
)
returns table (upload_id uuid, storage_path text)
language plpgsql security definer set search_path = ''
as $$
#variable_conflict use_column
declare
  v_user uuid := private.require_cadre_actor();
  v_task public.action_tasks%rowtype;
  v_id uuid := gen_random_uuid();
  v_path text;
begin
  select * into v_task from public.action_tasks as t
  where t.id = p_task_id
    and private.has_role_area_access(t.area_id, 'cadre'::public.app_role)
    and private.is_task_assignee(t.id, v_user);
  if not found then
    raise exception 'task not found' using errcode = 'P0404';
  end if;
  if v_task.status <> 'in_progress' then
    raise exception 'invalid task transition' using errcode = 'P0422';
  end if;
  v_path := v_user::text || '/' || v_id::text || '.webp';
  insert into public.report_uploads (id, created_by, storage_path, mime_type, byte_size,
    width, height, purpose, task_id)
  values (v_id, v_user, v_path, 'image/webp', p_byte_size, p_width, p_height,
    'task_evidence', v_task.id);
  return query select v_id, v_path;
end;
$$;

-- Managers pick assignees from the verified cadres of their own area.
create function public.list_area_cadres(p_area_id uuid)
returns table (profile_id uuid, display_name text)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  perform private.require_manager_actor();
  if not private.has_role_area_access(p_area_id, 'manager'::public.app_role) then
    raise exception 'area not found' using errcode = 'P0404';
  end if;
  return query
  select p.id, p.display_name::text
  from public.profiles as p
  join public.area_memberships as m on m.profile_id = p.id
  where p.role = 'cadre' and m.area_id = p_area_id
    and m.membership_type = 'assigned_cadre' and m.verified_at is not null
  order by p.display_name, p.id;
end;
$$;

-- Assignee names for readable tasks; profile ids stay server-side.
create function public.list_task_assignees(p_task_ids uuid[])
returns table (task_id uuid, display_name text, is_me boolean)
language plpgsql stable security definer set search_path = ''
as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'P0401';
  end if;
  if p_task_ids is null or coalesce(cardinality(p_task_ids), 0) > 100 then
    raise exception 'invalid task list' using errcode = 'P0422';
  end if;
  return query
  select a.task_id, p.display_name::text, a.profile_id = auth.uid()
  from public.action_task_assignees as a
  join public.profiles as p on p.id = a.profile_id
  where a.task_id = any(p_task_ids) and private.can_read_task(a.task_id)
  order by a.task_id, p.display_name, p.id;
end;
$$;

drop function private.lock_area_task(uuid);

revoke execute on function public.create_action_task(uuid, text, text, uuid[], timestamptz, boolean, text)
  from public, anon, service_role;
revoke execute on function public.list_area_cadres(uuid) from public, anon, service_role;
revoke execute on function public.list_task_assignees(uuid[]) from public, anon, service_role;
grant execute on function public.create_action_task(uuid, text, text, uuid[], timestamptz, boolean, text)
  to authenticated;
grant execute on function public.list_area_cadres(uuid) to authenticated;
grant execute on function public.list_task_assignees(uuid[]) to authenticated;

commit;
