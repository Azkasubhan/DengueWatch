begin;

-- Upload leases carry a purpose so report photos and task evidence never cross over.
alter table public.report_uploads
  add column purpose text not null default 'report'
    check (purpose in ('report', 'task_evidence')),
  add column task_id uuid references public.action_tasks(id) on delete cascade,
  add constraint report_upload_task_purpose check ((purpose = 'task_evidence') = (task_id is not null));
create index idx_report_uploads_task on public.report_uploads (task_id) where task_id is not null;

create function private.enforce_report_image_upload_purpose()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.report_uploads as u
    where u.id = new.upload_id and u.purpose = 'report') then
    raise exception 'upload references unavailable' using errcode = 'P0409';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_report_image_upload_purpose() from public, anon, authenticated;
create trigger report_images_upload_purpose
before insert on public.report_images
for each row execute function private.enforce_report_image_upload_purpose();

-- Evidence must use a lease reserved by the submitter for this exact task.
create function private.enforce_task_evidence_upload()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.report_uploads as u
    where u.id = new.upload_id and u.purpose = 'task_evidence'
      and u.task_id = new.task_id and u.created_by = new.submitted_by) then
    raise exception 'upload references unavailable' using errcode = 'P0409';
  end if;
  return new;
end;
$$;
revoke execute on function private.enforce_task_evidence_upload() from public, anon, authenticated;
create trigger task_evidence_upload_binding
before insert on public.task_evidence
for each row execute function private.enforce_task_evidence_upload();

-- Reserves an evidence lease only for the assignee of an in-progress task in their area.
create function public.reserve_task_evidence_upload(
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
    and private.has_role_area_access(t.area_id, 'cadre'::public.app_role);
  if not found then
    raise exception 'task not found' using errcode = 'P0404';
  end if;
  if v_task.assigned_to <> v_user then
    raise exception 'task not assigned to user' using errcode = 'P0403';
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
revoke execute on function public.reserve_task_evidence_upload(uuid, integer, integer, integer)
  from public, anon, service_role;
grant execute on function public.reserve_task_evidence_upload(uuid, integer, integer, integer)
  to authenticated;

commit;
