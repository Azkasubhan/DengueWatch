-- T28: task due date is a required calendar date (end of day, Asia/Jakarta), every
-- new task is mandatory, and a task may go to any number of distinct area cadres.
-- Existing optional tasks keep their flag; resolution rules are unchanged.

drop function public.create_action_task(uuid, text, text, uuid[], timestamptz, boolean, text);
create function public.create_action_task(
  p_report_id uuid,
  p_title text,
  p_description text,
  p_assignees uuid[],
  p_due_date date,
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
  v_today date := (now() at time zone 'Asia/Jakarta')::date;
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
  -- At least one distinct cadre; the area-cadre check below bounds the list.
  if p_assignees is null or coalesce(cardinality(p_assignees), 0) < 1
    or array_position(p_assignees, null) is not null
    or (select count(distinct a) from unnest(p_assignees) as a) <> cardinality(p_assignees) then
    raise exception 'invalid task assignment' using errcode = 'P0422';
  end if;
  if p_due_date is null then
    raise exception 'invalid due date' using errcode = 'P0422';
  end if;
  if p_idempotency_key is null or p_idempotency_key !~ '^[A-Za-z0-9_-]{8,128}$' then
    raise exception 'invalid idempotency key' using errcode = 'P0422';
  end if;

  v_assignees := array(select a from unnest(p_assignees) as a order by a);
  v_payload := pg_catalog.jsonb_build_object('reportId', p_report_id, 'title', v_title,
    'description', v_description, 'assignees', pg_catalog.to_jsonb(v_assignees),
    'dueDate', p_due_date);
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
  -- Checked after the idempotency lookup so a retry after midnight still returns the task.
  if p_due_date < v_today or p_due_date > v_today + 366 then
    raise exception 'invalid due date' using errcode = 'P0422';
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
    true, (p_due_date + time '23:59:59') at time zone 'Asia/Jakarta')
  returning action_tasks.id into v_task_id;
  insert into public.action_task_assignees (task_id, profile_id)
  select v_task_id, a from unnest(v_assignees) as a;
  insert into public.task_events (task_id, actor_id, event_type, new_status, metadata)
  values (v_task_id, v_user, 'task_created', 'assigned',
    pg_catalog.jsonb_build_object('assignees', pg_catalog.to_jsonb(v_assignees),
      'dueDate', p_due_date));
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

revoke execute on function public.create_action_task(uuid, text, text, uuid[], date, text)
  from public, anon, service_role;
grant execute on function public.create_action_task(uuid, text, text, uuid[], date, text)
  to authenticated;
