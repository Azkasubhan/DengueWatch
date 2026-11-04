begin;

create extension if not exists pgtap with schema extensions;
select plan(124);

-- Structure, grants, and RLS.
select has_table('public', 'action_tasks', 'action tasks exist');
select has_table('public', 'task_events', 'task events exist');
select has_table('public', 'task_evidence', 'task evidence exists');
select has_table('public', 'action_task_assignees', 'task assignees exist');
select hasnt_column('public', 'action_tasks', 'assigned_to', 'single assignee column is gone (T27)');
select ok(not exists (select 1 from pg_enum where enumtypid = 'public.task_status'::regtype and enumlabel = 'draft'), 'task status has no draft state');
select ok((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class
  where oid in ('public.action_tasks'::regclass,'public.task_events'::regclass,'public.task_evidence'::regclass,
    'public.action_task_idempotency'::regclass,'public.action_task_assignees'::regclass)),
  'ActionLoop tables force RLS');
select ok(not has_table_privilege('authenticated','public.action_tasks','INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated','public.task_events','INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated','public.task_evidence','INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated','public.action_task_assignees','INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated','public.action_task_idempotency','SELECT, INSERT, UPDATE, DELETE'),
  'ActionLoop writes only through RPC');
select ok(not has_table_privilege('service_role','public.action_tasks','INSERT, UPDATE, DELETE')
  and not has_table_privilege('service_role','public.action_task_assignees','INSERT, UPDATE, DELETE')
  and not has_table_privilege('service_role','public.task_evidence','INSERT, UPDATE, DELETE'),
  'service role cannot rewrite tasks, assignees, or evidence');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']::text[]) from pg_proc
  where oid in ('public.create_action_task(uuid,text,text,uuid[],date,text)'::regprocedure,
    'public.start_action_task(uuid,integer)'::regprocedure,
    'public.submit_task_evidence(uuid,uuid,text,integer)'::regprocedure,
    'public.review_task_evidence(uuid,uuid,text,text,integer)'::regprocedure,
    'public.cancel_action_task(uuid,text,integer)'::regprocedure,
    'public.reopen_action_task(uuid,text,integer)'::regprocedure,
    'public.list_area_cadres(uuid)'::regprocedure,
    'public.list_task_assignees(uuid[])'::regprocedure)),
  'ActionLoop RPCs are definer with empty search path');
select ok(not has_function_privilege('anon','public.create_action_task(uuid,text,text,uuid[],date,text)','EXECUTE')
  and not has_function_privilege('anon','public.review_task_evidence(uuid,uuid,text,text,integer)','EXECUTE')
  and not has_function_privilege('anon','public.list_area_cadres(uuid)','EXECUTE')
  and not has_function_privilege('service_role','public.review_task_evidence(uuid,uuid,text,text,integer)','EXECUTE')
  and not has_function_privilege('service_role','public.list_area_cadres(uuid)','EXECUTE')
  and has_function_privilege('authenticated','public.review_task_evidence(uuid,uuid,text,text,integer)','EXECUTE')
  and has_function_privilege('authenticated','public.list_task_assignees(uuid[])','EXECUTE'),
  'only authenticated users can call ActionLoop RPCs');
select ok(not has_function_privilege('authenticated','private.lock_task(uuid,public.app_role)','EXECUTE')
  and not has_function_privilege('authenticated','private.refresh_report_resolution(uuid,uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','private.is_area_cadre(uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','private.is_task_assignee(uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','private.require_manager_actor()','EXECUTE'),
  'internal helpers are not callable by users');

-- Fixtures.
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"M6 Test"}'::jsonb, now(), now()
from (values
  ('61000000-0000-4000-8000-000000000001'::uuid, 'm6-resident@example.test'),
  ('61000000-0000-4000-8000-000000000002'::uuid, 'm6-cadre-a1@example.test'),
  ('61000000-0000-4000-8000-000000000003'::uuid, 'm6-cadre-a2@example.test'),
  ('61000000-0000-4000-8000-000000000004'::uuid, 'm6-cadre-b@example.test'),
  ('61000000-0000-4000-8000-000000000005'::uuid, 'm6-manager@example.test'),
  ('61000000-0000-4000-8000-000000000006'::uuid, 'm6-cadre-pending@example.test'),
  ('61000000-0000-4000-8000-000000000007'::uuid, 'm6-manager-b@example.test')
) as fixtures(id,email);
update public.profiles set role = 'cadre' where id in ('61000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000004','61000000-0000-4000-8000-000000000006');
update public.profiles set role = 'manager' where id in ('61000000-0000-4000-8000-000000000005','61000000-0000-4000-8000-000000000007');
insert into public.areas (id,code,name,is_demo) values
  ('62000000-0000-4000-8000-000000000001','M6-T-A','M6 Test Area A',true),
  ('62000000-0000-4000-8000-000000000002','M6-T-B','M6 Test Area B',true);
insert into public.area_memberships (profile_id,area_id,membership_type,verified_at) values
  ('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','resident',now()),
  ('61000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('61000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('61000000-0000-4000-8000-000000000004','62000000-0000-4000-8000-000000000002','assigned_cadre',now()),
  ('61000000-0000-4000-8000-000000000005','62000000-0000-4000-8000-000000000001','manager',now()),
  ('61000000-0000-4000-8000-000000000006','62000000-0000-4000-8000-000000000001','assigned_cadre',null),
  ('61000000-0000-4000-8000-000000000007','62000000-0000-4000-8000-000000000002','manager',now());
insert into public.reports (id,public_reference,reporter_id,area_id,category,description,is_demo,status,version) values
  ('63000000-0000-4000-8000-000000000001','M6-T-000001','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','water_container','Wadah terbuka berisi air di balai uji.',true,'verified',2),
  ('63000000-0000-4000-8000-000000000002','M6-T-000002','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','water_container','Laporan yang belum diverifikasi pengelola.',true,'pending_verification',1),
  ('63000000-0000-4000-8000-000000000003','M6-T-000003','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','discarded_tire','Ban bekas berisi air di lapangan uji.',true,'verified',2),
  ('63000000-0000-4000-8000-000000000004','M6-T-000004','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','clogged_drain','Saluran tersumbat di gang uji kecil.',true,'verified',2),
  ('63000000-0000-4000-8000-000000000005','M6-T-000005','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002','other','Laporan area lain untuk uji lintas wilayah.',true,'verified',2);

-- Evidence uploads: u1-u5 and u7 by cadre A1, u6, u8 and u9 by cadre A2; u7 has no stored file.
insert into public.report_uploads (id,created_by,storage_path,mime_type,byte_size,width,height,uploaded_at)
select ('64000000-0000-4000-8000-00000000000' || n)::uuid, owner,
  owner::text || '/64000000-0000-4000-8000-00000000000' || n || '.webp', 'image/webp', 128, 16, 16, now()
from (values (1,'61000000-0000-4000-8000-000000000002'::uuid),(2,'61000000-0000-4000-8000-000000000002'::uuid),
  (3,'61000000-0000-4000-8000-000000000002'::uuid),(4,'61000000-0000-4000-8000-000000000002'::uuid),
  (5,'61000000-0000-4000-8000-000000000002'::uuid),(6,'61000000-0000-4000-8000-000000000003'::uuid),
  (7,'61000000-0000-4000-8000-000000000002'::uuid),(8,'61000000-0000-4000-8000-000000000003'::uuid),
  (9,'61000000-0000-4000-8000-000000000003'::uuid)) as u(n, owner);
insert into storage.objects (bucket_id,name,owner_id)
select 'report-photos', storage_path, created_by from public.report_uploads
where id::text like '64000000-%' and id <> '64000000-0000-4000-8000-000000000007';

create temp table task_ids (name text primary key, task_id uuid, status public.task_status,
  version integer, report_status public.report_status, report_version integer);
grant all on task_ids to authenticated;

-- Creation and assignment by the area manager (T27), with idempotency.
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select results_eq($$ select display_name from public.list_area_cadres('62000000-0000-4000-8000-000000000001') $$,
  $$ values ('M6 Test'::text),('M6 Test'::text) $$,'manager lists the two verified cadres of the area');
select throws_ok($$ select * from public.list_area_cadres('62000000-0000-4000-8000-000000000002') $$,
  'P0404','area not found','manager cannot list cadres of another area');
insert into task_ids select 't1', * from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[], current_date + 3, 'm6-key-task-1');
select is((select status::text||':'||version||':'||report_status||':'||report_version from task_ids where name='t1'),
  'assigned:1:in_action:3','first task is assigned and moves verified report to in_action');
select is((select task_id from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[],
  current_date + 3, 'm6-key-task-1')),
  (select task_id from task_ids where name='t1'),'retry with the same key returns the same task');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Kuras wadah lain','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[],
  current_date + 3, 'm6-key-task-1') $$,'P0409','idempotency conflict','same key with another payload conflicts');
-- A retry after midnight returns the stored task although its due date has passed.
reset role;
update public.action_task_idempotency set request_payload = jsonb_set(request_payload, '{dueDate}', to_jsonb(current_date - 1))
  where idempotency_key = 'm6-key-task-1';
set local role authenticated;
select is((select task_id from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[],
  current_date - 1, 'm6-key-task-1')),
  (select task_id from task_ids where name='t1'),'retry after the due date passed still returns the stored task');
insert into task_ids select 't2', * from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Bersihkan talang','Bersihkan talang yang menampung air di balai.',array['61000000-0000-4000-8000-000000000003']::uuid[],
  current_date + 3, 'm6-key-task-2');
insert into task_ids select 'opt', * from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Edukasi pengelola balai','Sampaikan edukasi PSN singkat kepada pengelola balai.',array['61000000-0000-4000-8000-000000000002']::uuid[],
  current_date + 3, 'm6-key-task-3');
-- New tasks are always mandatory (T28); a legacy optional task is simulated directly.
reset role;
update public.action_tasks set is_mandatory = false where id = (select task_id from task_ids where name='opt');
set local role authenticated;
select is((select is_mandatory::text||':'||(due_at at time zone 'Asia/Jakarta')::text from public.action_tasks where id = (select task_id from task_ids where name='t1')),
  'true:'||(current_date + 3)::text||' 23:59:59','due date is stored as end of day WIB and the task is mandatory');
select is((select report_status::text||':'||report_version from task_ids where name='t2'),
  'in_action:3','additional tasks keep report in_action without another transition');
select is((select count(*) from public.action_tasks where report_id = '63000000-0000-4000-8000-000000000001'),
  3::bigint,'idempotent retry did not duplicate tasks');
select is((select metadata -> 'assignees' from public.task_events where task_id = (select task_id from task_ids where name='t1') and event_type = 'task_created'),
  '["61000000-0000-4000-8000-000000000002"]'::jsonb,'creation event records the assignees');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000002',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[], current_date + 3, 'm6-key-task-pending') $$,'P0422','invalid report transition','unverified report cannot get tasks');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000001']::uuid[], current_date + 3, 'm6-key-task-resident') $$,'P0422','invalid task assignee','resident cannot be assignee');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000004']::uuid[], current_date + 3, 'm6-key-task-crossarea') $$,'P0422','invalid task assignee','other-area cadre cannot be assignee');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000006']::uuid[], current_date + 3, 'm6-key-task-unverified') $$,'P0422','invalid task assignee','unverified cadre cannot be assignee');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000004']::uuid[], current_date + 3, 'm6-key-task-mixed') $$,'P0422','invalid task assignee','one invalid assignee rejects the whole task');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array[]::uuid[], current_date + 3, 'm6-key-task-empty') $$,'P0422','invalid task assignment','a task needs at least one cadre');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000002']::uuid[], current_date + 3, 'm6-key-task-dup') $$,'P0422','invalid task assignment','duplicate assignees rejected');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',null, current_date + 3, 'm6-key-task-null') $$,'P0422','invalid task assignment','missing assignees rejected');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kur','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[], current_date + 3, 'm6-key-task-title') $$,'P0422','invalid task title','short title rejected');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[], current_date - 2, 'm6-key-task-due') $$,'P0422','invalid due date','past due date rejected');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[], null, 'm6-key-task-nodue') $$,'P0422','invalid due date','due date is required');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[], current_date + 400, 'm6-key-task-far') $$,'P0422','invalid due date','due date beyond a year rejected');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003']::uuid[]
    || array(select gen_random_uuid() from generate_series(1, 9)), current_date + 3, 'm6-key-task-many') $$,'P0422','invalid task assignee','assignee count has no fixed cap; each id is still checked');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[], current_date + 3, 'bad key!') $$,'P0422','invalid idempotency key','invalid idempotency key rejected');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000005',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000004']::uuid[], current_date + 3, 'm6-key-task-area-b') $$,'P0404','report not found','cross-area report is not found');
select throws_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t1'),1) $$,
  'P0403','action not permitted','manager cannot start tasks');
select is((select count(*) from public.action_tasks),3::bigint,'manager reads area tasks');
select results_eq($$ select display_name, is_me from public.list_task_assignees(array[(select task_id from task_ids where name='t1'),(select task_id from task_ids where name='t2')]) order by display_name $$,
  $$ values ('M6 Test'::text,false),('M6 Test'::text,false) $$,'manager reads assignee names');

-- Cadres cannot create, review, cancel, or reopen; they see only their own tasks.
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[], current_date + 3, 'm6-key-task-cadre') $$,'P0403','action not permitted','cadre cannot create tasks');
select throws_ok($$ select * from public.cancel_action_task((select task_id from task_ids where name='t1'),'Dibatalkan oleh kader uji.',1) $$,
  'P0403','action not permitted','cadre cannot cancel tasks');
select throws_ok($$ select * from public.list_area_cadres('62000000-0000-4000-8000-000000000001') $$,
  'P0403','action not permitted','cadre cannot list area cadres');
select is((select count(*) from public.action_tasks),2::bigint,'cadre A1 reads only tasks assigned to them');
select results_eq($$ select is_me from public.list_task_assignees(array[(select task_id from task_ids where name='t1'),(select task_id from task_ids where name='t2')]) $$,
  $$ values (true) $$,'assignee names stay scoped to readable tasks');
select throws_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t1'),2) $$,
  'P0409','stale task version','stale start conflicts');
select throws_ok($$ select * from public.submit_task_evidence((select task_id from task_ids where name='t1'),
  '64000000-0000-4000-8000-000000000001','Wadah sudah dikuras dan ditutup rapat.',1) $$,
  'P0422','invalid task transition','evidence requires in_progress task');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t1'),1) $$,
  'P0404','task not found','cadre outside the assignee list cannot see the task');
select is((select count(*) from public.action_tasks),1::bigint,'cadre A2 reads only their own task');
select is((select count(*) from public.reports where area_id = '62000000-0000-4000-8000-000000000001'),
  1::bigint,'cadre reads only reports behind their tasks');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t1'),1) $$,
  'P0403','action not permitted','resident cannot run ActionLoop');
select is((select count(*) from public.action_tasks),0::bigint,'resident cannot read tasks');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t1'),1) $$,
  'P0404','task not found','other-area cadre cannot see task');
select is((select count(*) from public.action_tasks),0::bigint,'other-area cadre reads no tasks');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t1'),(select id from public.task_evidence where task_id=(select task_id from task_ids where name='t1') and review_status='pending'),'approve',null,1) $$,
  'P0404','task not found','other-area manager cannot review');
select is((select count(*) from public.action_tasks),0::bigint,'other-area manager reads no tasks');

reset role;
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t1') where id = '64000000-0000-4000-8000-000000000001';
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t1') where id = '64000000-0000-4000-8000-000000000002';
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t1') where id = '64000000-0000-4000-8000-000000000007';
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t2') where id = '64000000-0000-4000-8000-000000000006';
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='opt') where id = '64000000-0000-4000-8000-000000000004';
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t2') where id = '64000000-0000-4000-8000-000000000009';
-- Evidence submission by the assignee and manager review of t1.
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select status::text||':'||version from public.start_action_task((select task_id from task_ids where name='t1'),1)),
  'in_progress:2','assignee starts task');
select throws_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t1'),2) $$,
  'P0422','invalid task transition','in_progress task cannot start again');
select throws_ok($$ select * from public.submit_task_evidence((select task_id from task_ids where name='t1'),
  '64000000-0000-4000-8000-000000000006','Wadah sudah dikuras dan ditutup rapat.',2) $$,
  'P0409','upload references unavailable','another user upload cannot be evidence');
select throws_ok($$ select * from public.submit_task_evidence((select task_id from task_ids where name='t1'),
  '64000000-0000-4000-8000-000000000007','Wadah sudah dikuras dan ditutup rapat.',2) $$,
  'P0409','upload references unavailable','upload without stored file cannot be evidence');
select throws_ok($$ select * from public.submit_task_evidence((select task_id from task_ids where name='t1'),
  '64000000-0000-4000-8000-000000000001','Selesai',2) $$,
  'P0422','invalid evidence description','short evidence note rejected');
select is((select status::text||':'||version from public.submit_task_evidence((select task_id from task_ids where name='t1'),
  '64000000-0000-4000-8000-000000000001','Wadah sudah dikuras dan ditutup rapat.',2)),
  'awaiting_review:3','evidence moves task to awaiting_review without completing it');
select is((select completed_at from public.action_tasks where id = (select task_id from task_ids where name='t1')),
  null,'submission does not set completed_at');
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t1'),(select id from public.task_evidence where task_id=(select task_id from task_ids where name='t1') and review_status='pending'),'approve',null,3) $$,
  'P0403','action not permitted','cadre cannot review evidence');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t1'),(select id from public.task_evidence where task_id=(select task_id from task_ids where name='t1') and review_status='pending'),'request_revision',null,3) $$,
  'P0422','invalid review reason','revision requires a reason');
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t1'),(select id from public.task_evidence where task_id=(select task_id from task_ids where name='t1') and review_status='pending'),'close',null,3) $$,
  'P0422','invalid evidence decision','unknown evidence decision rejected');
select is((select status::text||':'||version from public.review_task_evidence((select task_id from task_ids where name='t1'),(select id from public.task_evidence where task_id=(select task_id from task_ids where name='t1') and review_status='pending'),
  'request_revision','Foto belum memperlihatkan wadah tertutup.',3)),
  'in_progress:4','revision returns task to in_progress');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.submit_task_evidence((select task_id from task_ids where name='t1'),
  '64000000-0000-4000-8000-000000000001','Wadah sudah dikuras dan ditutup rapat.',4) $$,
  'P0409','upload references unavailable','consumed upload cannot be reused');
select is((select status::text||':'||version from public.submit_task_evidence((select task_id from task_ids where name='t1'),
  '64000000-0000-4000-8000-000000000002','Wadah sudah ditutup rapat, foto dari dekat.',4)),
  'awaiting_review:5','revised evidence resubmitted');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t1'),(select id from public.task_evidence where task_id=(select task_id from task_ids where name='t1') and review_status='pending'),'approve',null,4) $$,
  'P0409','stale task version','stale review conflicts');
select is((select status::text||':'||version||':'||report_status from public.review_task_evidence((select task_id from task_ids where name='t1'),(select id from public.task_evidence where task_id=(select task_id from task_ids where name='t1') and review_status='pending'),'approve',null,5)),
  'completed:6:in_action','approval completes t1 but another mandatory task keeps report in_action');
select ok((select completed_at is not null from public.action_tasks where id = (select task_id from task_ids where name='t1')),
  'completed_at set only on approval');

-- t2 belongs to cadre A2 only; evidence photos stay inside the task scope.
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select status::text from public.start_action_task((select task_id from task_ids where name='t2'),1)),
  'in_progress','second assignee starts t2');
select is((select status::text from public.submit_task_evidence((select task_id from task_ids where name='t2'),
  '64000000-0000-4000-8000-000000000006','Talang sudah dibersihkan dari genangan.',2)),
  'awaiting_review','second assignee submits evidence');
select is((select count(*) from storage.objects where name like '61000000-0000-4000-8000-000000000002/64000000-%'),
  0::bigint,'cadre cannot read evidence of tasks assigned to others');
select is((select count(*) from storage.objects where name like '61000000-0000-4000-8000-000000000003/64000000-%'),
  1::bigint,'cadre reads evidence of their own task');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select is((select status::text||':'||report_status||':'||report_version from public.review_task_evidence((select task_id from task_ids where name='t2'),(select id from public.task_evidence where task_id=(select task_id from task_ids where name='t2') and review_status='pending'),
  'approve','Talang terlihat bersih pada foto.',3)),
  'completed:resolved:4','last mandatory approval resolves report; optional task ignored');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Kuras wadah baru','Kuras dan tutup wadah air di balai warga.',array['61000000-0000-4000-8000-000000000002']::uuid[],
  current_date + 3, 'm6-key-task-resolved') $$,'P0422','invalid report transition','resolved report needs reopen before new tasks');

-- Reopen a completed mandatory task: report returns to in_action with the reason.
select throws_ok($$ select * from public.reopen_action_task((select task_id from task_ids where name='t2'),'Lagi',4) $$,
  'P0422','invalid reopen reason','reopen requires a reason');
select throws_ok($$ select * from public.reopen_action_task((select task_id from task_ids where name='opt'),'Masalah muncul lagi di balai.',1) $$,
  'P0422','invalid task transition','only completed tasks can reopen');
select is((select status::text||':'||report_status||':'||report_version from public.reopen_action_task((select task_id from task_ids where name='t2'),
  'Talang kembali tergenang setelah hujan.',4)),
  'reopened:in_action:5','reopen moves resolved report back to in_action');
select is((select completed_at from public.action_tasks where id = (select task_id from task_ids where name='t2')),
  null,'reopened task is no longer completed');
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t2'),(select id from public.task_evidence where task_id=(select task_id from task_ids where name='t2') and review_status='pending'),'approve',null,5) $$,
  'P0422','invalid task transition','reopened task cannot be approved without new evidence');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.reopen_action_task((select task_id from task_ids where name='t2'),'Dibuka kembali oleh kader.',5) $$,
  'P0403','action not permitted','cadre cannot reopen tasks');
select is((select status::text||':'||version from public.start_action_task((select task_id from task_ids where name='t2'),5)),
  'in_progress:6','assignee restarts reopened task');
select is((select evidence_round from public.action_tasks where id = (select task_id from task_ids where name='t2')),
  2,'reopen starts a new evidence round (T33)');
select is((select status::text||':'||version from public.submit_task_evidence((select task_id from task_ids where name='t2'),
  '64000000-0000-4000-8000-000000000009','Talang dibersihkan lagi setelah hujan.',6)),
  'awaiting_review:7','an approval from the previous round does not count; the cadre submits again');

-- Missing evidence file can never complete a task (AC-42).
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select * from public.start_action_task((select task_id from task_ids where name='opt'),1) $$,'optional task started');
select lives_ok($$ select * from public.submit_task_evidence((select task_id from task_ids where name='opt'),
  '64000000-0000-4000-8000-000000000004','Edukasi PSN sudah disampaikan ke pengelola.',2) $$,'optional evidence submitted');
reset role;
set local storage.allow_delete_query = 'true';
delete from storage.objects where name = '61000000-0000-4000-8000-000000000002/64000000-0000-4000-8000-000000000004.webp';
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='opt'),(select id from public.task_evidence where task_id=(select task_id from task_ids where name='opt') and review_status='pending'),'approve',null,3) $$,
  'P0422','evidence unavailable','deleted evidence file blocks approval');

-- A task shared by two cadres: either may start it, but each must submit evidence (T33).
insert into task_ids select 't3a', * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Balik ban bekas','Balik dan simpan ban bekas agar tidak menampung air.',array['61000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003']::uuid[],
  current_date + 3, 'm6-key-task-3a');
insert into task_ids select 't3b', * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Angkut ban bekas','Koordinasikan pengangkutan ban bekas dari lapangan.',array['61000000-0000-4000-8000-000000000002']::uuid[],
  current_date + 3, 'm6-key-task-3b');
select is((select count(*) from public.list_task_assignees(array[(select task_id from task_ids where name='t3a')])),2::bigint,'shared task lists both cadres');
reset role;
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t3a') where id = '64000000-0000-4000-8000-000000000003';
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t3a') where id = '64000000-0000-4000-8000-000000000008';
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t3a'),1) $$,'second cadre starts the shared task');
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select status::text||':'||version from public.submit_task_evidence((select task_id from task_ids where name='t3a'),
  '64000000-0000-4000-8000-000000000003','Ban sudah dibalik dan disimpan kering.',2)),
  'awaiting_review:3','first cadre submits evidence for the shared task');
select throws_ok($$ select * from public.submit_task_evidence((select task_id from task_ids where name='t3a'),
  '64000000-0000-4000-8000-000000000005','Ban sudah dibalik dan disimpan kering.',3) $$,
  'P0422','evidence already submitted','a cadre cannot submit twice while their evidence is pending');
select throws_ok($$ select * from public.reserve_task_evidence_upload((select task_id from task_ids where name='t3a'),128,16,16) $$,
  'P0422','evidence already submitted','no new upload lease while the cadre''s evidence is pending');
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select status::text||':'||version from public.submit_task_evidence((select task_id from task_ids where name='t3a'),
  '64000000-0000-4000-8000-000000000008','Ban di sisi lapangan sudah disimpan terbalik.',3)),
  'awaiting_review:4','second cadre still submits while the task awaits review');
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t3a'),
  (select id from public.task_evidence where upload_id='64000000-0000-4000-8000-000000000005'),'approve',null,4) $$,
  'P0422','evidence unavailable','review needs a pending evidence of this task');
select is((select status::text||':'||version||':'||report_status from public.review_task_evidence((select task_id from task_ids where name='t3a'),
  (select id from public.task_evidence where upload_id='64000000-0000-4000-8000-000000000003'),'approve',null,4)),
  'awaiting_review:5:in_action','one approval keeps the task open while another cadre is pending');
select is((select completed_at from public.action_tasks where id = (select task_id from task_ids where name='t3a')),
  null,'partial approval does not complete the task');
select is((select status::text||':'||version||':'||report_status from public.review_task_evidence((select task_id from task_ids where name='t3a'),
  (select id from public.task_evidence where upload_id='64000000-0000-4000-8000-000000000008'),'approve',null,5)),
  'completed:6:in_action','last cadre approval completes the task; assigned t3b keeps report open');
select is((select (metadata ->> 'remaining')::int from public.task_events where task_id = (select task_id from task_ids where name='t3a')
  and event_type = 'task_evidence_approved' and new_status = 'awaiting_review'),
  1,'partial approval records the remaining cadre count');

-- Cancelled task: remaining completed mandatory work resolves the report.
select throws_ok($$ select * from public.cancel_action_task((select task_id from task_ids where name='t3b'),null,1) $$,
  'P0422','invalid cancel reason','cancel requires a reason');
select is((select status::text||':'||report_status from public.cancel_action_task((select task_id from task_ids where name='t3b'),
  'Pengangkutan ditangani pengelola lapangan.',1)),
  'cancelled:resolved','cancelling the last open mandatory task resolves via completed work');
select throws_ok($$ select * from public.reopen_action_task((select task_id from task_ids where name='t3b'),'Dibuka kembali untuk uji.',2) $$,
  'P0422','invalid task transition','cancelled task cannot reopen');
select throws_ok($$ select * from public.cancel_action_task((select task_id from task_ids where name='t3b'),'Dibatalkan kedua kalinya.',2) $$,
  'P0422','invalid task transition','cancelled task cannot be cancelled again');

-- An empty active mandatory set never counts as resolved.
insert into task_ids select 't4', * from public.create_action_task('63000000-0000-4000-8000-000000000004',
  'Bersihkan saluran','Bersihkan sampah daun dari saluran gang.',array['61000000-0000-4000-8000-000000000002']::uuid[],
  current_date + 3, 'm6-key-task-4');
select is((select status::text||':'||report_status from public.cancel_action_task((select task_id from task_ids where name='t4'),
  'Saluran ternyata milik fasilitas lain.',1)),
  'cancelled:in_action','report with only cancelled tasks stays in_action');

reset role;
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t4') where id = '64000000-0000-4000-8000-000000000005';
-- Evidence and task visibility outside the area.
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'report-photos' and name like '61000000-%'),
  0::bigint,'other-area cadre cannot read evidence photos');
select is((select count(*) from public.task_evidence),0::bigint,'other-area cadre cannot read evidence rows');
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'report-photos' and name like '61000000-%'),
  0::bigint,'resident cannot read evidence photos');
select is((select count(*) from public.report_events where report_id = '63000000-0000-4000-8000-000000000001'
  and event_type in ('report_action_started','report_resolved','report_reopened')),
  3::bigint,'reporter sees ActionLoop report events');
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select ok((select count(*) from public.task_evidence) >= 4,'manager monitors area evidence');

-- Audit integrity.
reset role;
select set_eq($$ select event_type, old_status::text, new_status::text, actor_id from public.task_events
  where task_id = (select task_id from task_ids where name='t1') $$,
  $$ values
    ('task_created', null::text, 'assigned', '61000000-0000-4000-8000-000000000005'::uuid),
    ('task_started', 'assigned', 'in_progress', '61000000-0000-4000-8000-000000000002'::uuid),
    ('task_evidence_submitted', 'in_progress', 'awaiting_review', '61000000-0000-4000-8000-000000000002'::uuid),
    ('task_revision_requested', 'awaiting_review', 'in_progress', '61000000-0000-4000-8000-000000000005'::uuid),
    ('task_evidence_approved', 'awaiting_review', 'completed', '61000000-0000-4000-8000-000000000005'::uuid) $$,
  'task timeline records each transition and actor');
select is((select count(*) from public.task_events where task_id = (select task_id from task_ids where name='t1')
  and event_type = 'task_evidence_submitted'),2::bigint,'both evidence submissions are retained');
select results_eq($$ select review_status::text, reviewed_by from public.task_evidence
  where task_id = (select task_id from task_ids where name='t1') order by created_at, review_status $$,
  $$ values ('approved'::text,'61000000-0000-4000-8000-000000000005'::uuid),('revision_required'::text,'61000000-0000-4000-8000-000000000005'::uuid) $$,
  'evidence history keeps revision and approval by the manager');
select set_eq($$ select event_type, old_status::text, new_status::text, reason from public.report_events
  where report_id = '63000000-0000-4000-8000-000000000001' and event_type <> 'report_created' $$,
  $$ values ('report_action_started','verified','in_action',null::varchar),
    ('report_resolved','in_action','resolved',null::varchar),
    ('report_reopened','resolved','in_action','Talang kembali tergenang setelah hujan.'::varchar) $$,
  'report ActionLoop events follow PRD 8.1');
select is((select status::text||':'||version||':'||(resolved_at is null) from public.reports where id = '63000000-0000-4000-8000-000000000001'),
  'in_action:5:true','reopened report state is consistent');
select throws_ok($$ update public.task_events set reason = 'Diubah setelah kejadian.' $$,
  'P0409','task audit is append only','task events cannot be updated');
select throws_ok($$ delete from public.task_events $$,
  'P0409','task audit is append only','task events cannot be deleted directly');
select throws_ok($$ update public.task_evidence set reviewed_by = '61000000-0000-4000-8000-000000000005'
  where review_status = 'approved' $$,
  'P0409','task evidence is append only','reviewed evidence cannot be rewritten');
select throws_ok($$ insert into public.task_evidence (task_id,submitted_by,upload_id,storage_path,width,height,description,review_status,reviewed_by,reviewed_at)
  values ((select task_id from task_ids where name='t4'),'61000000-0000-4000-8000-000000000002','64000000-0000-4000-8000-000000000005',
    'x/self.webp',16,16,'Bukti yang ditinjau sendiri.','approved','61000000-0000-4000-8000-000000000002',now()) $$,
  '23514',null,'schema forbids self-approved evidence');
select throws_ok($$ update public.action_tasks set status = 'completed' where id = (select task_id from task_ids where name='t4') $$,
  '23514',null,'task cannot complete without completed_at from approval');
select throws_ok($$ insert into public.task_events (task_id,actor_id,event_type,old_status,new_status)
  values ((select task_id from task_ids where name='t4'),'61000000-0000-4000-8000-000000000002','task_evidence_approved','awaiting_review','completed') $$,
  '23514',null,'approval event requires evidence reference');
select throws_ok($$ insert into public.report_events (report_id,actor_id,event_type,old_status,new_status,metadata)
  values ('63000000-0000-4000-8000-000000000004','61000000-0000-4000-8000-000000000002','report_resolved','verified','resolved','{"taskId":"x"}') $$,
  '23514',null,'report closure event must follow in_action to resolved');
select lives_ok($$ delete from public.reports where id = '63000000-0000-4000-8000-000000000004' $$,
  'trusted report deletion cascades through tasks and audit');

select * from finish();
rollback;
