begin;

drop policy ai_analyses_owner_read on public.ai_analyses;
create policy ai_analyses_owner_read on public.ai_analyses
for select to authenticated using (
  request_user_id = (select auth.uid())
  and (select private.has_role_area_access(area_id, 'resident'::public.app_role))
);

create or replace function private.link_ai_analysis_to_report()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.ai_analyses as analysis
  set report_id = new.report_id
  where analysis.upload_id = new.upload_id and analysis.request_user_id = new.created_by
    and analysis.area_id = (select report.area_id from public.reports as report where report.id = new.report_id)
    and analysis.report_id is null;
  return new;
end;
$$;

commit;
