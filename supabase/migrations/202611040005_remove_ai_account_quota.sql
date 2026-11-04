-- T32: no per-account AI quota (formerly 10/hour, 30/day). Demo and real accounts
-- behave the same; the provider's own limits still surface as RATE_LIMIT, and one
-- active analysis per account plus the 1-day purge of unlinked analyses remain.

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
