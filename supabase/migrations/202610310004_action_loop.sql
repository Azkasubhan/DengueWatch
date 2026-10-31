begin;

-- PRD 8.2 task states; there is deliberately no draft state.
create type public.task_status as enum (
  'assigned', 'in_progress', 'awaiting_review', 'completed', 'reopened', 'cancelled'
);
create type public.task_evidence_review_status as enum ('pending', 'approved', 'revision_required');

create table public.action_tasks (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  area_id uuid not null references public.areas(id),
  title varchar(140) not null,
  description varchar(1000) not null,
  assigned_to uuid not null references public.profiles(id),
  created_by uuid not null references public.profiles(id),
  status public.task_status not null default 'assigned',
  is_mandatory boolean not null default true,
  due_at timestamptz,
  completed_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint action_task_title check (char_length(btrim(title)) between 5 and 140 and title !~ '[[:cntrl:]]'),
  constraint action_task_description check (
    char_length(btrim(description)) between 10 and 1000 and description !~ '[[:cntrl:]]'
  ),
  constraint action_task_due check (due_at is null or due_at >= created_at),
  -- completed_at is set only by an approved evidence review (AC-41).
  constraint action_task_completion check ((status = 'completed') = (completed_at is not null))
);
create index idx_action_tasks_assigned_status on public.action_tasks (assigned_to, status);
create index idx_action_tasks_report on public.action_tasks (report_id);
create index idx_action_tasks_area_status on public.action_tasks (area_id, status, created_at desc);

create table public.task_events (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.action_tasks(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type text not null,
  old_status public.task_status,
  new_status public.task_status not null,
  reason varchar(500),
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  constraint task_event_transition check (coalesce(
    case event_type
      when 'task_created' then
        old_status is null and new_status = 'assigned' and reason is null
      when 'task_started' then
        old_status in ('assigned', 'reopened') and new_status = 'in_progress' and reason is null
      when 'task_evidence_submitted' then
        old_status = 'in_progress' and new_status = 'awaiting_review' and reason is null
        and jsonb_typeof(metadata -> 'evidenceId') = 'string'
      when 'task_evidence_approved' then
        old_status = 'awaiting_review' and new_status = 'completed'
        and (reason is null or char_length(btrim(reason)) between 10 and 500)
        and jsonb_typeof(metadata -> 'evidenceId') = 'string'
      when 'task_revision_requested' then
        old_status = 'awaiting_review' and new_status = 'in_progress'
        and char_length(btrim(reason)) between 10 and 500
        and jsonb_typeof(metadata -> 'evidenceId') = 'string'
      when 'task_cancelled' then
        old_status in ('assigned', 'in_progress', 'awaiting_review', 'reopened')
        and new_status = 'cancelled' and char_length(btrim(reason)) between 10 and 500
      when 'task_reopened' then
        old_status = 'completed' and new_status = 'reopened'
        and char_length(btrim(reason)) between 10 and 500
    end, false))
);
create index idx_task_events_task_created on public.task_events (task_id, created_at desc);

create table public.task_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.action_tasks(id) on delete cascade,
  submitted_by uuid not null references public.profiles(id),
  upload_id uuid not null unique references public.report_uploads(id),
  storage_path text not null unique,
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  description varchar(500) not null,
  review_status public.task_evidence_review_status not null default 'pending',
  reviewed_by uuid references public.profiles(id),
  review_reason varchar(500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint task_evidence_description check (
    char_length(btrim(description)) between 10 and 500 and description !~ '[[:cntrl:]]'
  ),
  constraint task_evidence_review_state check (
    (review_status = 'pending' and reviewed_by is null and reviewed_at is null and review_reason is null)
    or (review_status = 'approved' and reviewed_by is not null and reviewed_at is not null)
    or (review_status = 'revision_required' and reviewed_by is not null and reviewed_at is not null
      and char_length(btrim(review_reason)) between 10 and 500)
  ),
  -- The person who submitted evidence can never be the one who approves it.
  constraint task_evidence_independent_review check (reviewed_by is null or reviewed_by <> submitted_by)
);
create unique index idx_task_evidence_one_pending on public.task_evidence (task_id)
  where review_status = 'pending';

create table public.action_task_idempotency (
  user_id uuid not null references public.profiles(id),
  idempotency_key varchar(128) not null,
  request_payload jsonb not null,
  task_id uuid not null unique references public.action_tasks(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, idempotency_key)
);

-- ActionLoop report transitions from PRD 8.1.
alter table public.report_events drop constraint report_events_event_type_check;
alter table public.report_events add constraint report_events_event_type_check check (
  event_type in (
    'report_created', 'report_verified', 'report_information_requested',
    'report_rejected', 'report_marked_duplicate', 'report_information_added',
    'report_action_started', 'report_resolved', 'report_reopened'
  )
);
alter table public.report_events add constraint report_action_event check (coalesce(
  case event_type
    when 'report_action_started' then
      old_status = 'verified' and new_status = 'in_action' and reason is null
      and jsonb_typeof(metadata -> 'taskId') = 'string'
    when 'report_resolved' then
      old_status = 'in_action' and new_status = 'resolved' and reason is null
      and jsonb_typeof(metadata -> 'taskId') = 'string'
    when 'report_reopened' then
      old_status = 'resolved' and new_status = 'in_action'
      and char_length(btrim(reason)) between 10 and 500
      and jsonb_typeof(metadata -> 'taskId') = 'string'
    else true
  end, false));

create function private.prevent_task_audit_mutation()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_catalog.pg_trigger_depth() > 1 then
    return old;
  end if;
  raise exception 'task audit is append only' using errcode = 'P0409';
end;
$$;
create trigger task_events_append_only
before update or delete on public.task_events
for each row execute function private.prevent_task_audit_mutation();

-- Evidence rows may only move once from pending to a review outcome.
create function private.guard_task_evidence_update()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    if pg_catalog.pg_trigger_depth() > 1 then
      return old;
    end if;
  elsif old.review_status = 'pending' and new.review_status <> 'pending'
    and (new.task_id, new.submitted_by, new.upload_id, new.storage_path, new.description,
      new.created_at) is not distinct from (old.task_id, old.submitted_by, old.upload_id,
      old.storage_path, old.description, old.created_at) then
    return new;
  end if;
  raise exception 'task evidence is append only' using errcode = 'P0409';
end;
$$;
create trigger task_evidence_guard
before update or delete on public.task_evidence
for each row execute function private.guard_task_evidence_update();

create function private.can_read_task(requested_task_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.action_tasks as task
    where task.id = requested_task_id
      and (
        (select private.has_role_area_access(task.area_id, 'cadre'::public.app_role))
        or (select private.has_role_area_access(task.area_id, 'manager'::public.app_role))
      )
  )
$$;
revoke execute on function private.can_read_task(uuid) from public, anon;
grant execute on function private.can_read_task(uuid) to authenticated;

create function private.is_area_cadre(p_profile_id uuid, p_area_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles as profile
    join public.area_memberships as membership on membership.profile_id = profile.id
    where profile.id = p_profile_id and profile.role = 'cadre'
      and membership.area_id = p_area_id
      and membership.membership_type = 'assigned_cadre'
      and membership.verified_at is not null
  )
$$;
revoke execute on function private.is_area_cadre(uuid, uuid) from public, anon, authenticated;

alter table public.action_tasks enable row level security;
alter table public.action_tasks force row level security;
alter table public.task_events enable row level security;
alter table public.task_events force row level security;
alter table public.task_evidence enable row level security;
alter table public.task_evidence force row level security;
alter table public.action_task_idempotency enable row level security;
alter table public.action_task_idempotency force row level security;

-- Cadres and managers of the area read tasks; managers never get a write path.
create policy action_tasks_select_authorized on public.action_tasks
for select to authenticated using (private.can_read_task(id));
create policy task_events_select_authorized on public.task_events
for select to authenticated using (private.can_read_task(task_id));
create policy task_evidence_select_authorized on public.task_evidence
for select to authenticated using (private.can_read_task(task_id));
create policy task_evidence_photos_read_authorized on storage.objects
for select to authenticated using (
  bucket_id = 'report-photos'
  and exists (
    select 1 from public.task_evidence as evidence
    where evidence.storage_path = name
      and private.can_read_task(evidence.task_id)
  )
);

revoke all on public.action_tasks, public.task_events, public.task_evidence,
  public.action_task_idempotency from public, anon, authenticated, service_role;
grant select on public.action_tasks, public.task_events, public.task_evidence
  to authenticated, service_role;

-- Locks the report before the task so concurrent ActionLoop mutations serialize per report.
create function private.lock_area_task(p_task_id uuid)
returns public.action_tasks
language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.action_tasks%rowtype;
begin
  select * into v_task from public.action_tasks as t
  where t.id = p_task_id
    and private.has_role_area_access(t.area_id, 'cadre'::public.app_role);
  if not found then
    raise exception 'task not found' using errcode = 'P0404';
  end if;
  perform 1 from public.reports as r where r.id = v_task.report_id for update of r;
  select * into v_task from public.action_tasks as t where t.id = p_task_id for update of t;
  return v_task;
end;
$$;
revoke execute on function private.lock_area_task(uuid) from public, anon, authenticated;

create function private.require_cadre_actor()
returns uuid
language plpgsql stable security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'P0401';
  end if;
  if private.current_profile_role() is distinct from 'cadre'::public.app_role then
    raise exception 'action not permitted' using errcode = 'P0403';
  end if;
  return auth.uid();
end;
$$;
revoke execute on function private.require_cadre_actor() from public, anon, authenticated;

create function private.valid_action_reason(p_reason text)
returns boolean
language sql immutable set search_path = ''
as $$
  select p_reason is not null and char_length(btrim(p_reason)) between 10 and 500
    and btrim(p_reason) !~ '[[:cntrl:]]'
$$;
revoke execute on function private.valid_action_reason(text) from public, anon, authenticated;

-- Resolves an in_action report only when at least one mandatory active task exists
-- and every mandatory active task is completed; an empty set never resolves.
create function private.refresh_report_resolution(p_report_id uuid, p_task_id uuid, p_actor uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_report public.reports%rowtype;
begin
  select * into v_report from public.reports as r where r.id = p_report_id for update of r;
  if v_report.status <> 'in_action'
    or not exists (select 1 from public.action_tasks as t
      where t.report_id = p_report_id and t.is_mandatory and t.status <> 'cancelled')
    or exists (select 1 from public.action_tasks as t
      where t.report_id = p_report_id and t.is_mandatory
        and t.status not in ('completed', 'cancelled')) then
    return;
  end if;
  update public.reports as r
  set status = 'resolved', resolved_at = now(), version = r.version + 1, updated_at = now()
  where r.id = p_report_id;
  insert into public.report_events (report_id, actor_id, event_type, old_status, new_status, metadata)
  values (p_report_id, p_actor, 'report_resolved', 'in_action', 'resolved',
    pg_catalog.jsonb_build_object('taskId', p_task_id, 'version', v_report.version + 1));
end;
$$;
revoke execute on function private.refresh_report_resolution(uuid, uuid, uuid)
  from public, anon, authenticated;

create function public.create_action_task(
  p_report_id uuid,
  p_title text,
  p_description text,
  p_assigned_to uuid,
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
  v_user uuid := private.require_cadre_actor();
  v_title text := btrim(p_title);
  v_description text := btrim(p_description);
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
  if p_assigned_to is null or p_is_mandatory is null then
    raise exception 'invalid task assignment' using errcode = 'P0422';
  end if;
  if p_due_at is not null and (p_due_at <= now() or p_due_at > now() + interval '366 days') then
    raise exception 'invalid due date' using errcode = 'P0422';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{8,128}$' then
    raise exception 'invalid idempotency key' using errcode = 'P0422';
  end if;

  v_payload := pg_catalog.jsonb_build_object('reportId', p_report_id, 'title', v_title,
    'description', v_description, 'assignedTo', p_assigned_to, 'dueAt', p_due_at,
    'isMandatory', p_is_mandatory);
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
        and private.has_role_area_access(t.area_id, 'cadre'::public.app_role);
    if not found then
      raise exception 'report not found' using errcode = 'P0404';
    end if;
    return;
  end if;

  select * into v_report from public.reports as r
  where r.id = p_report_id
    and private.has_role_area_access(r.area_id, 'cadre'::public.app_role)
  for update of r;
  if not found then
    raise exception 'report not found' using errcode = 'P0404';
  end if;
  if v_report.status not in ('verified', 'in_action') then
    raise exception 'invalid report transition' using errcode = 'P0422';
  end if;
  -- MVP assignees are verified cadres of the report area (PRD 6.3).
  if not private.is_area_cadre(p_assigned_to, v_report.area_id) then
    raise exception 'invalid task assignee' using errcode = 'P0422';
  end if;

  insert into public.action_tasks (report_id, area_id, title, description, assigned_to,
    created_by, is_mandatory, due_at)
  values (v_report.id, v_report.area_id, v_title, v_description, p_assigned_to, v_user,
    p_is_mandatory, p_due_at)
  returning action_tasks.id into v_task_id;
  insert into public.task_events (task_id, actor_id, event_type, new_status, metadata)
  values (v_task_id, v_user, 'task_created', 'assigned',
    pg_catalog.jsonb_build_object('assignedTo', p_assigned_to, 'isMandatory', p_is_mandatory));
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

create function public.start_action_task(p_task_id uuid, p_expected_version integer)
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
  v_task := private.lock_area_task(p_task_id);
  if v_task.assigned_to <> v_user then
    raise exception 'task not assigned to user' using errcode = 'P0403';
  end if;
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

create function public.submit_task_evidence(
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
  v_task := private.lock_area_task(p_task_id);
  if v_task.assigned_to <> v_user then
    raise exception 'task not assigned to user' using errcode = 'P0403';
  end if;
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

create function public.review_task_evidence(
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
  v_user uuid := private.require_cadre_actor();
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
  v_task := private.lock_area_task(p_task_id);
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

create function public.cancel_action_task(
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
  v_user uuid := private.require_cadre_actor();
  v_task public.action_tasks%rowtype;
begin
  if not private.valid_action_reason(p_reason) then
    raise exception 'invalid cancel reason' using errcode = 'P0422';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid expected version' using errcode = 'P0422';
  end if;
  v_task := private.lock_area_task(p_task_id);
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

create function public.reopen_action_task(
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
  v_user uuid := private.require_cadre_actor();
  v_task public.action_tasks%rowtype;
  v_report public.reports%rowtype;
begin
  if not private.valid_action_reason(p_reason) then
    raise exception 'invalid reopen reason' using errcode = 'P0422';
  end if;
  if p_expected_version is null or p_expected_version < 1 then
    raise exception 'invalid expected version' using errcode = 'P0422';
  end if;
  v_task := private.lock_area_task(p_task_id);
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

revoke execute on function public.create_action_task(uuid, text, text, uuid, timestamptz, boolean, text)
  from public, anon, service_role;
revoke execute on function public.start_action_task(uuid, integer) from public, anon, service_role;
revoke execute on function public.submit_task_evidence(uuid, uuid, text, integer)
  from public, anon, service_role;
revoke execute on function public.review_task_evidence(uuid, text, text, integer)
  from public, anon, service_role;
revoke execute on function public.cancel_action_task(uuid, text, integer) from public, anon, service_role;
revoke execute on function public.reopen_action_task(uuid, text, integer) from public, anon, service_role;
grant execute on function public.create_action_task(uuid, text, text, uuid, timestamptz, boolean, text)
  to authenticated;
grant execute on function public.start_action_task(uuid, integer) to authenticated;
grant execute on function public.submit_task_evidence(uuid, uuid, text, integer) to authenticated;
grant execute on function public.review_task_evidence(uuid, text, text, integer) to authenticated;
grant execute on function public.cancel_action_task(uuid, text, integer) to authenticated;
grant execute on function public.reopen_action_task(uuid, text, integer) to authenticated;

commit;
