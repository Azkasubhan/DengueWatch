begin;

create type public.ai_analysis_status as enum ('processing', 'success', 'rejected', 'timeout', 'error');

create table public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  request_user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid not null references public.areas(id),
  upload_id uuid references public.report_uploads(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  model_id varchar(100) not null check (char_length(model_id) between 1 and 100),
  input_hash char(64),
  result_json jsonb check (result_json is null or jsonb_typeof(result_json) = 'object'),
  status public.ai_analysis_status not null default 'processing',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  lease_expires_at timestamptz not null default (now() + interval '1 minute'),
  duration_ms integer check (duration_ms between 0 and 120000),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  error_code varchar(40),
  constraint ai_result_state check (
    (status = 'processing' and result_json is null and completed_at is null)
    or (status = 'success' and result_json is not null and completed_at is not null and error_code is null)
    or (status in ('rejected', 'timeout', 'error') and result_json is null and completed_at is not null)
  )
);
create index idx_ai_analyses_user_created on public.ai_analyses (request_user_id, created_at desc);
create index idx_ai_analyses_upload on public.ai_analyses (upload_id) where upload_id is not null;
create index idx_ai_analyses_retention on public.ai_analyses (created_at);

alter table public.ai_analyses enable row level security;
alter table public.ai_analyses force row level security;
create policy ai_analyses_owner_read on public.ai_analyses
for select to authenticated using (request_user_id = (select auth.uid()));
revoke all on public.ai_analyses from public, anon, authenticated, service_role;
grant select on public.ai_analyses to authenticated;
grant select, update, delete on public.ai_analyses to service_role;

create function public.reserve_ai_analysis(p_area_id uuid, p_upload_id uuid, p_model_id text)
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
revoke execute on function public.reserve_ai_analysis(uuid, uuid, text) from public, anon, service_role;
grant execute on function public.reserve_ai_analysis(uuid, uuid, text) to authenticated;

create function private.link_ai_analysis_to_report()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.ai_analyses as analysis
  set report_id = new.report_id
  where analysis.upload_id = new.upload_id and analysis.request_user_id = new.created_by
    and analysis.report_id is null;
  return new;
end;
$$;
create trigger link_ai_analysis_after_report_image
after insert on public.report_images
for each row execute function private.link_ai_analysis_to_report();
revoke execute on function private.link_ai_analysis_to_report() from public, anon, authenticated;

commit;
