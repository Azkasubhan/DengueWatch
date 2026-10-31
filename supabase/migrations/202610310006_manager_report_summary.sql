begin;

-- Deterministic manager KPIs (PRD 18.1). Runs as the caller, so existing RLS still bounds
-- every row it reads; it returns aggregates only, never identities, photos, or coordinates.
--
-- Cohort: reports submitted in [p_from, p_to] as WIB calendar days, in the caller's verified
-- manager areas. Statuses are a snapshot at as_of.
--   awaiting_verification = pending_verification + needs_information
--   in_action             = verified + in_action (validated, not resolved; reopened lands here)
--   resolved              = resolved (all mandatory active tasks approved)
--   not_actionable        = rejected + duplicate (excluded from completion)
--   completion_rate       = resolved / (in_action + resolved); null when the denominator is 0
--   median_hours_to_first_review = submitted -> first cadre decision event
--   median_hours_to_resolution   = first report_verified -> current resolved_at
create function public.get_manager_report_summary(p_area_id uuid, p_from date, p_to date)
returns table (
  as_of timestamptz,
  period_start timestamptz,
  period_end timestamptz,
  area_count integer,
  is_demo boolean,
  reports_total integer,
  awaiting_verification integer,
  in_action integer,
  resolved integer,
  not_actionable integer,
  completion_eligible integer,
  completion_rate numeric,
  median_hours_to_first_review numeric,
  median_hours_to_resolution numeric,
  tasks_awaiting_review integer
)
language plpgsql stable security invoker set search_path = ''
as $$
#variable_conflict use_column
declare
  v_areas uuid[];
  v_start timestamptz;
  v_end timestamptz;
begin
  if auth.uid() is null then
    raise exception 'authentication required' using errcode = 'P0401';
  end if;
  if private.current_profile_role() is distinct from 'manager'::public.app_role then
    raise exception 'analytics not permitted' using errcode = 'P0403';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 365 then
    raise exception 'invalid date range' using errcode = 'P0422';
  end if;
  select array_agg(m.area_id) into v_areas
  from public.area_memberships as m
  where m.profile_id = auth.uid() and m.membership_type = 'manager'
    and m.verified_at is not null
    and (p_area_id is null or m.area_id = p_area_id);
  if v_areas is null then
    if p_area_id is null then
      raise exception 'analytics not permitted' using errcode = 'P0403';
    end if;
    raise exception 'area not found' using errcode = 'P0404';
  end if;
  v_start := p_from::timestamp at time zone 'Asia/Jakarta';
  v_end := (p_to + 1)::timestamp at time zone 'Asia/Jakarta';

  return query
  with cohort as (
    select r.id, r.status, r.submitted_at, r.resolved_at
    from public.reports as r
    where r.area_id = any(v_areas) and r.submitted_at >= v_start and r.submitted_at < v_end
  ), counts as (
    select
      count(*)::integer as total,
      (count(*) filter (where c.status in ('pending_verification', 'needs_information')))::integer as awaiting,
      (count(*) filter (where c.status in ('verified', 'in_action')))::integer as acting,
      (count(*) filter (where c.status = 'resolved'))::integer as done,
      (count(*) filter (where c.status in ('rejected', 'duplicate')))::integer as excluded
    from cohort as c
  ), first_review as (
    select e.report_id, min(e.created_at) as reviewed_at
    from public.report_events as e
    join cohort as c on c.id = e.report_id
    where e.event_type in ('report_verified', 'report_information_requested',
      'report_rejected', 'report_marked_duplicate')
    group by e.report_id
  ), first_verified as (
    select e.report_id, min(e.created_at) as verified_at
    from public.report_events as e
    join cohort as c on c.id = e.report_id
    where e.event_type = 'report_verified'
    group by e.report_id
  )
  select
    now(),
    v_start,
    v_end,
    cardinality(v_areas),
    coalesce((select bool_and(a.is_demo) from public.areas as a where a.id = any(v_areas)), false),
    k.total,
    k.awaiting,
    k.acting,
    k.done,
    k.excluded,
    k.acting + k.done,
    case when k.acting + k.done = 0 then null
      else round(k.done::numeric * 100 / (k.acting + k.done), 1) end,
    (select round((percentile_cont(0.5) within group (
        order by extract(epoch from f.reviewed_at - c.submitted_at)::double precision) / 3600)::numeric, 1)
      from first_review as f join cohort as c on c.id = f.report_id
      where f.reviewed_at >= c.submitted_at),
    (select round((percentile_cont(0.5) within group (
        order by extract(epoch from c.resolved_at - v.verified_at)::double precision) / 3600)::numeric, 1)
      from first_verified as v join cohort as c on c.id = v.report_id
      where c.status = 'resolved' and c.resolved_at >= v.verified_at),
    (select count(*)::integer from public.action_tasks as t
      join cohort as c on c.id = t.report_id where t.status = 'awaiting_review')
  from counts as k;
end;
$$;
revoke execute on function public.get_manager_report_summary(uuid, date, date)
  from public, anon, service_role;
grant execute on function public.get_manager_report_summary(uuid, date, date) to authenticated;

commit;
