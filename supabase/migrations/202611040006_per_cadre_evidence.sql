begin;

-- T33: every assigned cadre submits their own evidence. Managers review each submission,
-- and a task completes only when every assignee has approved evidence in the current round.
-- A reopen starts a new round, so earlier approvals no longer count.

alter table public.action_tasks
  add column evidence_round integer not null default 1 check (evidence_round > 0);
alter table public.task_evidence
  add column evidence_round integer not null default 1 check (evidence_round > 0);

-- One pending submission per cadre instead of one per task.
drop index public.idx_task_evidence_one_pending;
create unique index idx_task_evidence_one_pending_per_cadre on public.task_evidence (task_id, submitted_by)
  where review_status = 'pending';

-- Other cadres may still submit while a task awaits review, and a review may leave the
-- task open until the remaining assignees are approved.
alter table public.task_events drop constraint task_event_transition;
alter table public.task_events add constraint task_event_transition check (coalesce(
  case event_type
    when 'task_created' then
      old_status is null and new_status = 'assigned' and reason is null
    when 'task_started' then
      old_status in ('assigned', 'reopened') and new_status = 'in_progress' and reason is null
    when 'task_evidence_submitted' then
      old_status in ('in_progress', 'awaiting_review') and new_status = 'awaiting_review'
      and reason is null and jsonb_typeof(metadata -> 'evidenceId') = 'string'
    when 'task_evidence_approved' then
      old_status = 'awaiting_review' and new_status in ('completed', 'awaiting_review', 'in_progress')
      and (reason is null or char_length(btrim(reason)) between 10 and 500)
      and jsonb_typeof(metadata -> 'evidenceId') = 'string'
    when 'task_revision_requested' then
      old_status = 'awaiting_review' and new_status in ('in_progress', 'awaiting_review')
      and char_length(btrim(reason)) between 10 and 500
      and jsonb_typeof(metadata -> 'evidenceId') = 'string'
    when 'task_cancelled' then
      old_status in ('assigned', 'in_progress', 'awaiting_review', 'reopened')
      and new_status = 'cancelled' and char_length(btrim(reason)) between 10 and 500
    when 'task_reopened' then
      old_status = 'completed' and new_status = 'reopened'
      and char_length(btrim(reason)) between 10 and 500
  end, false));

-- Evidence rows may only move once from pending to a review outcome; the round is fixed.
create or replace function private.guard_task_evidence_update()
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
      new.created_at, new.evidence_round) is not distinct from (old.task_id, old.submitted_by,
      old.upload_id, old.storage_path, old.description, old.created_at, old.evidence_round) then
    return new;
  end if;
  raise exception 'task evidence is append only' using errcode = 'P0409';
end;
$$;

-- True when the cadre already has pending or approved evidence in the task's current round.
create function private.has_active_evidence(p_task_id uuid, p_round integer, p_profile_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.task_evidence as e
    where e.task_id = p_task_id and e.evidence_round = p_round
      and e.submitted_by = p_profile_id and e.review_status in ('pending', 'approved')
  )
$$;
revoke execute on function private.has_active_evidence(uuid, integer, uuid)
  from public, anon, authenticated;

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
  if v_task.status not in ('in_progress', 'awaiting_review') then
    raise exception 'invalid task transition' using errcode = 'P0422';
  end if;
  if private.has_active_evidence(v_task.id, v_task.evidence_round, v_user) then
    raise exception 'evidence already submitted' using errcode = 'P0422';
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
    height, description, evidence_round)
  values (v_task.id, v_user, v_upload.id, v_upload.storage_path, v_upload.width,
    v_upload.height, v_description, v_task.evidence_round)
  returning task_evidence.id into v_evidence_id;
  update public.report_uploads as u set consumed_at = now() where u.id = v_upload.id;
  update public.action_tasks as t
  set status = 'awaiting_review', version = t.version + 1, updated_at = now()
  where t.id = v_task.id;
  insert into public.task_events (task_id, actor_id, event_type, old_status, new_status, metadata)
  values (v_task.id, v_user, 'task_evidence_submitted', v_task.status, 'awaiting_review',
    pg_catalog.jsonb_build_object('evidenceId', v_evidence_id, 'version', p_expected_version + 1));
  return query select t.id, t.status, t.version, r.status, r.version
    from public.action_tasks as t join public.reports as r on r.id = t.report_id
    where t.id = v_task.id;
end;
$$;

-- Managers review one cadre's evidence at a time; the independent-review CHECK still
-- forbids self review.
drop function public.review_task_evidence(uuid, text, text, integer);
create function public.review_task_evidence(
  p_task_id uuid,
  p_evidence_id uuid,
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
  v_next public.task_status;
  v_remaining integer;
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
  where e.id = p_evidence_id and e.task_id = v_task.id and e.review_status = 'pending'
    and e.evidence_round = v_task.evidence_round
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
  else
    update public.task_evidence as e
    set review_status = 'revision_required', reviewed_by = v_user, reviewed_at = now(),
      review_reason = v_reason
    where e.id = v_evidence.id;
  end if;

  select count(*) into v_remaining from public.action_task_assignees as a
  where a.task_id = v_task.id and not exists (select 1 from public.task_evidence as e
    where e.task_id = a.task_id and e.submitted_by = a.profile_id
      and e.evidence_round = v_task.evidence_round and e.review_status = 'approved');
  v_next := case
    when v_remaining = 0 then 'completed'
    when exists (select 1 from public.task_evidence as e
      where e.task_id = v_task.id and e.review_status = 'pending') then 'awaiting_review'
    else 'in_progress'
  end;

  update public.action_tasks as t
  set status = v_next, version = t.version + 1, updated_at = now(),
    completed_at = case when v_next = 'completed' then now() end
  where t.id = v_task.id;
  insert into public.task_events (task_id, actor_id, event_type, old_status, new_status,
    reason, metadata)
  values (v_task.id, v_user,
    case when p_decision = 'approve' then 'task_evidence_approved' else 'task_revision_requested' end,
    'awaiting_review', v_next, v_reason,
    pg_catalog.jsonb_build_object('evidenceId', v_evidence.id, 'remaining', v_remaining,
      'version', p_expected_version + 1));
  if v_next = 'completed' then
    perform private.refresh_report_resolution(v_task.report_id, v_task.id, v_user);
  end if;
  return query select t.id, t.status, t.version, r.status, r.version
    from public.action_tasks as t join public.reports as r on r.id = t.report_id
    where t.id = v_task.id;
end;
$$;

-- Reopening starts a new evidence round: every assignee submits again.
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
  set status = 'reopened', completed_at = null, evidence_round = t.evidence_round + 1,
    version = t.version + 1, updated_at = now()
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

-- Reserves an evidence lease only for an assignee who still owes evidence in this round.
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
  if v_task.status not in ('in_progress', 'awaiting_review') then
    raise exception 'invalid task transition' using errcode = 'P0422';
  end if;
  if private.has_active_evidence(v_task.id, v_task.evidence_round, v_user) then
    raise exception 'evidence already submitted' using errcode = 'P0422';
  end if;
  v_path := v_user::text || '/' || v_id::text || '.webp';
  insert into public.report_uploads (id, created_by, storage_path, mime_type, byte_size,
    width, height, purpose, task_id)
  values (v_id, v_user, v_path, 'image/webp', p_byte_size, p_width, p_height,
    'task_evidence', v_task.id);
  return query select v_id, v_path;
end;
$$;

-- Assignee ids are already readable through action_task_assignees; returning them lets the
-- server match each cadre to their evidence. The app never sends them to the browser.
drop function public.list_task_assignees(uuid[]);
create function public.list_task_assignees(p_task_ids uuid[])
returns table (task_id uuid, profile_id uuid, display_name text, is_me boolean)
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
  select a.task_id, a.profile_id, p.display_name::text, a.profile_id = auth.uid()
  from public.action_task_assignees as a
  join public.profiles as p on p.id = a.profile_id
  where a.task_id = any(p_task_ids) and private.can_read_task(a.task_id)
  order by a.task_id, p.display_name, p.id;
end;
$$;

revoke execute on function public.review_task_evidence(uuid, uuid, text, text, integer)
  from public, anon, service_role;
revoke execute on function public.list_task_assignees(uuid[]) from public, anon, service_role;
grant execute on function public.review_task_evidence(uuid, uuid, text, text, integer)
  to authenticated;
grant execute on function public.list_task_assignees(uuid[]) to authenticated;

commit;
