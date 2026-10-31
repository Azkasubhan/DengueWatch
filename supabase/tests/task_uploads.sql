begin;

create extension if not exists pgtap with schema extensions;
select plan(17);

select ok((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc
  where oid = 'public.reserve_task_evidence_upload(uuid,integer,integer,integer)'::regprocedure),
  'evidence reservation is definer with empty search path');
select ok(has_function_privilege('authenticated','public.reserve_task_evidence_upload(uuid,integer,integer,integer)','EXECUTE')
  and not has_function_privilege('anon','public.reserve_task_evidence_upload(uuid,integer,integer,integer)','EXECUTE')
  and not has_function_privilege('service_role','public.reserve_task_evidence_upload(uuid,integer,integer,integer)','EXECUTE'),
  'only authenticated users reserve evidence uploads');

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"M6 Upload Test"}'::jsonb, now(), now()
from (values
  ('65000000-0000-4000-8000-000000000001'::uuid, 'm6u-resident@example.test'),
  ('65000000-0000-4000-8000-000000000002'::uuid, 'm6u-cadre-a1@example.test'),
  ('65000000-0000-4000-8000-000000000003'::uuid, 'm6u-cadre-a2@example.test'),
  ('65000000-0000-4000-8000-000000000004'::uuid, 'm6u-cadre-b@example.test'),
  ('65000000-0000-4000-8000-000000000005'::uuid, 'm6u-manager@example.test')
) as fixtures(id,email);
update public.profiles set role = 'cadre' where id in ('65000000-0000-4000-8000-000000000002','65000000-0000-4000-8000-000000000003','65000000-0000-4000-8000-000000000004');
update public.profiles set role = 'manager' where id = '65000000-0000-4000-8000-000000000005';
insert into public.areas (id,code,name,is_demo) values
  ('66000000-0000-4000-8000-000000000001','M6U-T-A','M6 Upload Area A',true),
  ('66000000-0000-4000-8000-000000000002','M6U-T-B','M6 Upload Area B',true);
insert into public.area_memberships (profile_id,area_id,membership_type,verified_at) values
  ('65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','resident',now()),
  ('65000000-0000-4000-8000-000000000002','66000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('65000000-0000-4000-8000-000000000003','66000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('65000000-0000-4000-8000-000000000004','66000000-0000-4000-8000-000000000002','assigned_cadre',now()),
  ('65000000-0000-4000-8000-000000000005','66000000-0000-4000-8000-000000000001','manager',now());
insert into public.reports (id,public_reference,reporter_id,area_id,category,description,is_demo,status,version) values
  ('67000000-0000-4000-8000-000000000001','M6U-T-000001','65000000-0000-4000-8000-000000000001','66000000-0000-4000-8000-000000000001','water_container','Wadah terbuka berisi air di pos uji.',true,'verified',2);

create temp table upload_ids (name text primary key, id uuid, path text);
grant all on upload_ids to authenticated;

select set_config('request.jwt.claims','{"sub":"65000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into upload_ids select 'task-a', task_id, null from public.create_action_task('67000000-0000-4000-8000-000000000001',
  'Kuras wadah pos','Kuras dan tutup wadah air di pos warga.','65000000-0000-4000-8000-000000000002', null, true, 'm6u-task-a');
insert into upload_ids select 'task-b', task_id, null from public.create_action_task('67000000-0000-4000-8000-000000000001',
  'Tutup wadah pos','Tutup wadah cadangan air di pos warga.','65000000-0000-4000-8000-000000000002', null, true, 'm6u-task-b');
select throws_ok($$ select * from public.reserve_task_evidence_upload((select id from upload_ids where name='task-a'),128,16,16) $$,
  'P0422','invalid task transition','assigned task cannot receive evidence uploads yet');
select lives_ok($$ select * from public.start_action_task((select id from upload_ids where name='task-a'),1) $$,'task a started');
select lives_ok($$ select * from public.start_action_task((select id from upload_ids where name='task-b'),1) $$,'task b started');
insert into upload_ids select 'lease-a', upload_id, storage_path
  from public.reserve_task_evidence_upload((select id from upload_ids where name='task-a'),128,16,16);
select matches((select path from upload_ids where name='lease-a'),
  '^65000000-0000-4000-8000-000000000002/[0-9a-f-]{36}\.webp$','lease path is scoped to the assignee');
select throws_ok($$ select * from public.reserve_task_evidence_upload((select id from upload_ids where name='task-a'),0,16,16) $$,
  '23514',null,'invalid image metadata is rejected by lease constraints');

reset role;
select results_eq($$ select purpose, task_id from public.report_uploads where id = (select id from upload_ids where name='lease-a') $$,
  $$ select 'task_evidence'::text, (select id from upload_ids where name='task-a') $$,'lease is bound to its task');
update public.report_uploads set uploaded_at = now() where id = (select id from upload_ids where name='lease-a');
insert into storage.objects (bucket_id,name,owner_id) values
  ('report-photos',(select path from upload_ids where name='lease-a'),'65000000-0000-4000-8000-000000000002');
insert into public.report_uploads (id,created_by,storage_path,mime_type,byte_size,width,height,uploaded_at) values
  ('68000000-0000-4000-8000-000000000001','65000000-0000-4000-8000-000000000002',
   '65000000-0000-4000-8000-000000000002/68000000-0000-4000-8000-000000000001.webp','image/webp',128,16,16,now());
insert into storage.objects (bucket_id,name,owner_id) values
  ('report-photos','65000000-0000-4000-8000-000000000002/68000000-0000-4000-8000-000000000001.webp','65000000-0000-4000-8000-000000000002');

-- Other actors cannot reserve evidence leases.
select set_config('request.jwt.claims','{"sub":"65000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.reserve_task_evidence_upload((select id from upload_ids where name='task-a'),128,16,16) $$,
  'P0403','task not assigned to user','non-assignee cannot reserve evidence upload');
reset role;
select set_config('request.jwt.claims','{"sub":"65000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.reserve_task_evidence_upload((select id from upload_ids where name='task-a'),128,16,16) $$,
  'P0404','task not found','other-area cadre cannot reserve evidence upload');
reset role;
select set_config('request.jwt.claims','{"sub":"65000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.reserve_task_evidence_upload((select id from upload_ids where name='task-a'),128,16,16) $$,
  'P0403','action not permitted','manager cannot reserve evidence upload');
reset role;
select set_config('request.jwt.claims','{"sub":"65000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.reserve_task_evidence_upload((select id from upload_ids where name='task-a'),128,16,16) $$,
  'P0403','action not permitted','resident cannot reserve evidence upload');

-- Purpose and task binding are enforced when evidence is submitted.
reset role;
select set_config('request.jwt.claims','{"sub":"65000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.submit_task_evidence((select id from upload_ids where name='task-b'),
  (select id from upload_ids where name='lease-a'),'Wadah sudah dikuras dan ditutup.',2) $$,
  'P0409','upload references unavailable','lease for task a cannot be replayed on task b');
select throws_ok($$ select * from public.submit_task_evidence((select id from upload_ids where name='task-a'),
  '68000000-0000-4000-8000-000000000001','Wadah sudah dikuras dan ditutup.',2) $$,
  'P0409','upload references unavailable','report-purpose upload cannot be evidence');
select is((select status::text from public.submit_task_evidence((select id from upload_ids where name='task-a'),
  (select id from upload_ids where name='lease-a'),'Wadah sudah dikuras dan ditutup.',2)),
  'awaiting_review','bound lease is accepted for its own task');

-- Evidence leases cannot become report photos.
insert into upload_ids select 'lease-b', upload_id, storage_path
  from public.reserve_task_evidence_upload((select id from upload_ids where name='task-b'),128,16,16);
reset role;
select throws_ok($$ insert into public.report_images (report_id,upload_id,storage_path,mime_type,byte_size,width,height,created_by)
  values ('67000000-0000-4000-8000-000000000001',(select id from upload_ids where name='lease-b'),
    (select path from upload_ids where name='lease-b'),'image/webp',128,16,16,'65000000-0000-4000-8000-000000000002') $$,
  'P0409','upload references unavailable','evidence lease cannot be attached to a report');
select throws_ok($$ update public.report_uploads set task_id = null where id = (select id from upload_ids where name='lease-b') $$,
  '23514',null,'evidence lease cannot lose its task binding');

select * from finish();
rollback;
