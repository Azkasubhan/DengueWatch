begin;

-- A report carries one AI suggestion: the latest successful one the resident saw.
-- Earlier attempts stay unlinked so they keep counting toward the rolling quota.
create or replace function private.link_ai_analysis_to_report()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.ai_analyses as analysis
  set report_id = new.report_id
  where analysis.id = (
      select candidate.id from public.ai_analyses as candidate
      where candidate.upload_id = new.upload_id and candidate.request_user_id = new.created_by
        and candidate.area_id = (select report.area_id from public.reports as report where report.id = new.report_id)
        and candidate.report_id is null and candidate.status = 'success'
      order by candidate.completed_at desc, candidate.id
      limit 1
    )
    and not exists (select 1 from public.ai_analyses as linked where linked.report_id = new.report_id);
  return new;
end;
$$;

-- Unlinked analyses older than the daily quota window no longer count toward any quota,
-- so each new request clears them for every account.
create or replace function public.reserve_ai_analysis(p_area_id uuid, p_upload_id uuid, p_model_id text)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
begin
  if v_user is null then
    raise exception 'authentication required' using errcode = 'P0401';
  end if;
  if not private.has_role_area_access(p_area_id, 'resident'::public.app_role) then
    raise exception 'area access denied' using errcode = 'P0403';
  end if;
  if p_model_id is null or char_length(p_model_id) not between 1 and 100 then
    raise exception 'invalid model' using errcode = 'P0422';
  end if;
  if not exists (
    select 1 from public.report_uploads as upload
    where upload.id = p_upload_id and upload.created_by = v_user
      and upload.mime_type = 'image/webp' and upload.uploaded_at is not null
      and upload.consumed_at is null and upload.expires_at > now()
      and exists (select 1 from storage.objects as object
        where object.bucket_id = 'report-photos' and object.name = upload.storage_path)
  ) then
    raise exception 'upload unavailable' using errcode = 'P0404';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ai_analysis:' || v_user::text, 0)
  );
  delete from public.ai_analyses as analysis
  where analysis.report_id is null and analysis.created_at <= now() - interval '1 day';
  if (select count(*) from public.ai_analyses as analysis
      where analysis.request_user_id = v_user
        and analysis.created_at > now() - interval '1 hour') >= 10
    or (select count(*) from public.ai_analyses as analysis
      where analysis.request_user_id = v_user
        and analysis.created_at > now() - interval '1 day') >= 30 then
    raise exception 'AI rate limit' using errcode = 'P0429';
  end if;
  if exists (select 1 from public.ai_analyses as analysis
      where analysis.request_user_id = v_user and analysis.status = 'processing'
        and analysis.lease_expires_at > now()) then
    raise exception 'AI request in progress' using errcode = 'P0409';
  end if;
  insert into public.ai_analyses (request_user_id, area_id, upload_id, model_id)
  values (v_user, p_area_id, p_upload_id, p_model_id) returning id into v_id;
  return v_id;
end;
$$;

-- Existing reports keep only their latest successful suggestion; the rest become purgeable.
update public.ai_analyses as analysis
set report_id = null
where analysis.report_id is not null
  and analysis.id is distinct from (
    select keep.id from public.ai_analyses as keep
    where keep.report_id = analysis.report_id and keep.status = 'success'
    order by keep.completed_at desc, keep.id
    limit 1
  );

commit;
