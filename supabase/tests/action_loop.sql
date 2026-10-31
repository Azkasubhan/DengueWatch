begin;

create extension if not exists pgtap with schema extensions;
select plan(92);

-- Structure, grants, and RLS.
select has_table('public', 'action_tasks', 'action tasks exist');
select has_table('public', 'task_events', 'task events exist');
select has_table('public', 'task_evidence', 'task evidence exists');
select ok(not exists (select 1 from pg_enum where enumtypid = 'public.task_status'::regtype and enumlabel = 'draft'), 'task status has no draft state');
select ok((select bool_and(relrowsecurity and relforcerowsecurity) from pg_class
  where oid in ('public.action_tasks'::regclass,'public.task_events'::regclass,'public.task_evidence'::regclass,'public.action_task_idempotency'::regclass)),
  'ActionLoop tables force RLS');
select ok(not has_table_privilege('authenticated','public.action_tasks','INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated','public.task_events','INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated','public.task_evidence','INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated','public.action_task_idempotency','SELECT, INSERT, UPDATE, DELETE'),
  'ActionLoop writes only through RPC');
select ok(not has_table_privilege('service_role','public.action_tasks','INSERT, UPDATE, DELETE')
  and not has_table_privilege('service_role','public.task_evidence','INSERT, UPDATE, DELETE'),
  'service role cannot rewrite tasks or evidence');
select ok((select bool_and(prosecdef and proconfig @> array['search_path=""']::text[]) from pg_proc
  where oid in ('public.create_action_task(uuid,text,text,uuid,timestamptz,boolean,text)'::regprocedure,
    'public.start_action_task(uuid,integer)'::regprocedure,
    'public.submit_task_evidence(uuid,uuid,text,integer)'::regprocedure,
    'public.review_task_evidence(uuid,text,text,integer)'::regprocedure,
    'public.cancel_action_task(uuid,text,integer)'::regprocedure,
    'public.reopen_action_task(uuid,text,integer)'::regprocedure)),
  'ActionLoop RPCs are definer with empty search path');
select ok(not has_function_privilege('anon','public.create_action_task(uuid,text,text,uuid,timestamptz,boolean,text)','EXECUTE')
  and not has_function_privilege('anon','public.review_task_evidence(uuid,text,text,integer)','EXECUTE')
  and not has_function_privilege('service_role','public.review_task_evidence(uuid,text,text,integer)','EXECUTE')
  and has_function_privilege('authenticated','public.review_task_evidence(uuid,text,text,integer)','EXECUTE'),
  'only authenticated users can call ActionLoop RPCs');
select ok(not has_function_privilege('authenticated','private.lock_area_task(uuid)','EXECUTE')
  and not has_function_privilege('authenticated','private.refresh_report_resolution(uuid,uuid,uuid)','EXECUTE')
  and not has_function_privilege('authenticated','private.is_area_cadre(uuid,uuid)','EXECUTE'),
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
  ('61000000-0000-4000-8000-000000000006'::uuid, 'm6-cadre-pending@example.test')
) as fixtures(id,email);
update public.profiles set role = 'cadre' where id in ('61000000-0000-4000-8000-000000000002','61000000-0000-4000-8000-000000000003','61000000-0000-4000-8000-000000000004','61000000-0000-4000-8000-000000000006');
update public.profiles set role = 'manager' where id = '61000000-0000-4000-8000-000000000005';
insert into public.areas (id,code,name,is_demo) values
  ('62000000-0000-4000-8000-000000000001','M6-T-A','M6 Test Area A',true),
  ('62000000-0000-4000-8000-000000000002','M6-T-B','M6 Test Area B',true);
insert into public.area_memberships (profile_id,area_id,membership_type,verified_at) values
  ('61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','resident',now()),
  ('61000000-0000-4000-8000-000000000002','62000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('61000000-0000-4000-8000-000000000003','62000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('61000000-0000-4000-8000-000000000004','62000000-0000-4000-8000-000000000002','assigned_cadre',now()),
  ('61000000-0000-4000-8000-000000000005','62000000-0000-4000-8000-000000000001','manager',now()),
  ('61000000-0000-4000-8000-000000000006','62000000-0000-4000-8000-000000000001','assigned_cadre',null);
insert into public.reports (id,public_reference,reporter_id,area_id,category,description,is_demo,status,version) values
  ('63000000-0000-4000-8000-000000000001','M6-T-000001','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','water_container','Wadah terbuka berisi air di balai uji.',true,'verified',2),
  ('63000000-0000-4000-8000-000000000002','M6-T-000002','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','water_container','Laporan yang belum diverifikasi kader.',true,'pending_verification',1),
  ('63000000-0000-4000-8000-000000000003','M6-T-000003','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','discarded_tire','Ban bekas berisi air di lapangan uji.',true,'verified',2),
  ('63000000-0000-4000-8000-000000000004','M6-T-000004','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000001','clogged_drain','Saluran tersumbat di gang uji kecil.',true,'verified',2),
  ('63000000-0000-4000-8000-000000000005','M6-T-000005','61000000-0000-4000-8000-000000000001','62000000-0000-4000-8000-000000000002','other','Laporan area lain untuk uji lintas wilayah.',true,'verified',2);

-- Evidence uploads: u1-u5 and u7 by cadre A1, u6 by cadre A2; u7 has no stored file.
insert into public.report_uploads (id,created_by,storage_path,mime_type,byte_size,width,height,uploaded_at)
select ('64000000-0000-4000-8000-00000000000' || n)::uuid, owner,
  owner::text || '/64000000-0000-4000-8000-00000000000' || n || '.webp', 'image/webp', 128, 16, 16, now()
from (values (1,'61000000-0000-4000-8000-000000000002'::uuid),(2,'61000000-0000-4000-8000-000000000002'::uuid),
  (3,'61000000-0000-4000-8000-000000000002'::uuid),(4,'61000000-0000-4000-8000-000000000002'::uuid),
  (5,'61000000-0000-4000-8000-000000000002'::uuid),(6,'61000000-0000-4000-8000-000000000003'::uuid),
  (7,'61000000-0000-4000-8000-000000000002'::uuid)) as u(n, owner);
insert into storage.objects (bucket_id,name,owner_id)
select 'report-photos', storage_path, created_by from public.report_uploads
where id::text like '64000000-%' and id <> '64000000-0000-4000-8000-000000000007';

create temp table task_ids (name text primary key, task_id uuid, status public.task_status,
  version integer, report_status public.report_status, report_version integer);
grant all on task_ids to authenticated;

-- Creation, assignment, and idempotency.
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into task_ids select 't1', * from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000002',
  now() + interval '3 days', true, 'm6-key-task-1');
select is((select status::text||':'||version||':'||report_status||':'||report_version from task_ids where name='t1'),
  'assigned:1:in_action:3','first task is assigned and moves verified report to in_action');
select is((select task_id from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000002',
  (select due_at from public.action_tasks where id = (select task_id from task_ids where name='t1')), true, 'm6-key-task-1')),
  (select task_id from task_ids where name='t1'),'retry with the same key returns the same task');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Kuras wadah lain','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000002',
  null, true, 'm6-key-task-1') $$,'P0409','idempotency conflict','same key with another payload conflicts');
insert into task_ids select 't2', * from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Bersihkan talang','Bersihkan talang yang menampung air di balai.','61000000-0000-4000-8000-000000000003',
  null, true, 'm6-key-task-2');
insert into task_ids select 'opt', * from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Edukasi pengelola balai','Sampaikan edukasi PSN singkat kepada pengelola balai.','61000000-0000-4000-8000-000000000002',
  null, false, 'm6-key-task-3');
select is((select report_status::text||':'||report_version from task_ids where name='t2'),
  'in_action:3','additional tasks keep report in_action without another transition');
select is((select count(*) from public.action_tasks where report_id = '63000000-0000-4000-8000-000000000001'),
  3::bigint,'idempotent retry did not duplicate tasks');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000002',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000002',
  null, true, 'm6-key-task-pending') $$,'P0422','invalid report transition','unverified report cannot get tasks');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000001',
  null, true, 'm6-key-task-resident') $$,'P0422','invalid task assignee','resident cannot be assignee');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000004',
  null, true, 'm6-key-task-crossarea') $$,'P0422','invalid task assignee','other-area cadre cannot be assignee');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000006',
  null, true, 'm6-key-task-unverified') $$,'P0422','invalid task assignee','unverified cadre cannot be assignee');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kur','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000002',
  null, true, 'm6-key-task-title') $$,'P0422','invalid task title','short title rejected');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000002',
  now() - interval '1 day', true, 'm6-key-task-due') $$,'P0422','invalid due date','past due date rejected');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000002',
  null, true, 'bad key!') $$,'P0422','invalid idempotency key','invalid idempotency key rejected');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000005',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000004',
  null, true, 'm6-key-task-area-b') $$,'P0404','report not found','cross-area report is not found');
select throws_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t1'),2) $$,
  'P0409','stale task version','stale start conflicts');
select throws_ok($$ select * from public.submit_task_evidence((select task_id from task_ids where name='t1'),
  '64000000-0000-4000-8000-000000000001','Wadah sudah dikuras dan ditutup rapat.',1) $$,
  'P0422','invalid task transition','evidence requires in_progress task');

-- Manager monitors only; resident and other-area cadre are denied.
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Kuras wadah balai','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000002',
  null, true, 'm6-key-task-manager') $$,'P0403','action not permitted','manager cannot create tasks');
select throws_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t1'),1) $$,
  'P0403','action not permitted','manager cannot start tasks');
select throws_ok($$ select * from public.cancel_action_task((select task_id from task_ids where name='t1'),'Dibatalkan oleh manager uji.',1) $$,
  'P0403','action not permitted','manager cannot cancel tasks');
select is((select count(*) from public.action_tasks),3::bigint,'manager reads area tasks');

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
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t1'),'approve',null,1) $$,
  'P0404','task not found','other-area cadre cannot review');
select is((select count(*) from public.action_tasks),0::bigint,'other-area cadre reads no tasks');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t1'),1) $$,
  'P0403','task not assigned to user','only the assignee starts a task');

reset role;
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t1') where id = '64000000-0000-4000-8000-000000000001';
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t1') where id = '64000000-0000-4000-8000-000000000002';
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t1') where id = '64000000-0000-4000-8000-000000000007';
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t2') where id = '64000000-0000-4000-8000-000000000006';
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='opt') where id = '64000000-0000-4000-8000-000000000004';
-- Evidence submission and independent review of t1.
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
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t1'),'approve',null,3) $$,
  'P0403','self review not permitted','submitter cannot approve own evidence');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t1'),'request_revision',null,3) $$,
  'P0422','invalid review reason','revision requires a reason');
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t1'),'close',null,3) $$,
  'P0422','invalid evidence decision','unknown evidence decision rejected');
select is((select status::text||':'||version from public.review_task_evidence((select task_id from task_ids where name='t1'),
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
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t1'),'approve',null,4) $$,
  'P0409','stale task version','stale review conflicts');
select is((select status::text||':'||version||':'||report_status from public.review_task_evidence((select task_id from task_ids where name='t1'),'approve',null,5)),
  'completed:6:in_action','approval completes t1 but another mandatory task keeps report in_action');
select ok((select completed_at is not null from public.action_tasks where id = (select task_id from task_ids where name='t1')),
  'completed_at set only on approval');

-- t2 is assigned to cadre A2, so cadre A1 must review it.
select is((select status::text from public.start_action_task((select task_id from task_ids where name='t2'),1)),
  'in_progress','second assignee starts t2');
select is((select status::text from public.submit_task_evidence((select task_id from task_ids where name='t2'),
  '64000000-0000-4000-8000-000000000006','Talang sudah dibersihkan dari genangan.',2)),
  'awaiting_review','second assignee submits evidence');
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t2'),'approve',null,3) $$,
  'P0403','self review not permitted','second assignee cannot approve own evidence');
select is((select count(*) from storage.objects where name like '61000000-0000-4000-8000-000000000002/64000000-%'),
  2::bigint,'area cadre reads evidence photos through task scope');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select status::text||':'||report_status||':'||report_version from public.review_task_evidence((select task_id from task_ids where name='t2'),
  'approve','Talang terlihat bersih pada foto.',3)),
  'completed:resolved:4','last mandatory approval resolves report; optional task ignored');
select throws_ok($$ select * from public.create_action_task('63000000-0000-4000-8000-000000000001',
  'Kuras wadah baru','Kuras dan tutup wadah air di balai warga.','61000000-0000-4000-8000-000000000002',
  null, true, 'm6-key-task-resolved') $$,'P0422','invalid report transition','resolved report needs reopen before new tasks');

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
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='t2'),'approve',null,5) $$,
  'P0422','invalid task transition','reopened task cannot be approved without new evidence');

reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select status::text||':'||version from public.start_action_task((select task_id from task_ids where name='t2'),5)),
  'in_progress:6','assignee restarts reopened task');

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
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_task_evidence((select task_id from task_ids where name='opt'),'approve',null,3) $$,
  'P0422','evidence unavailable','deleted evidence file blocks approval');

-- Cancelled task: remaining completed mandatory work resolves the report.
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
insert into task_ids select 't3a', * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Balik ban bekas','Balik dan simpan ban bekas agar tidak menampung air.','61000000-0000-4000-8000-000000000002',
  null, true, 'm6-key-task-3a');
insert into task_ids select 't3b', * from public.create_action_task('63000000-0000-4000-8000-000000000003',
  'Angkut ban bekas','Koordinasikan pengangkutan ban bekas dari lapangan.','61000000-0000-4000-8000-000000000002',
  null, true, 'm6-key-task-3b');
reset role;
update public.report_uploads set purpose = 'task_evidence', task_id = (select task_id from task_ids where name='t3a') where id = '64000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select * from public.start_action_task((select task_id from task_ids where name='t3a'),1) $$,'t3a started');
select lives_ok($$ select * from public.submit_task_evidence((select task_id from task_ids where name='t3a'),
  '64000000-0000-4000-8000-000000000003','Ban sudah dibalik dan disimpan kering.',2) $$,'t3a evidence submitted');
reset role;
select set_config('request.jwt.claims','{"sub":"61000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select report_status::text from public.review_task_evidence((select task_id from task_ids where name='t3a'),'approve',null,3)),
  'in_action','assigned mandatory t3b keeps report open');
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
  'Bersihkan saluran','Bersihkan sampah daun dari saluran gang.','61000000-0000-4000-8000-000000000002',
  null, true, 'm6-key-task-4');
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
    ('task_created', null::text, 'assigned', '61000000-0000-4000-8000-000000000002'::uuid),
    ('task_started', 'assigned', 'in_progress', '61000000-0000-4000-8000-000000000002'::uuid),
    ('task_evidence_submitted', 'in_progress', 'awaiting_review', '61000000-0000-4000-8000-000000000002'::uuid),
    ('task_revision_requested', 'awaiting_review', 'in_progress', '61000000-0000-4000-8000-000000000003'::uuid),
    ('task_evidence_approved', 'awaiting_review', 'completed', '61000000-0000-4000-8000-000000000003'::uuid) $$,
  'task timeline records each transition and actor');
select is((select count(*) from public.task_events where task_id = (select task_id from task_ids where name='t1')
  and event_type = 'task_evidence_submitted'),2::bigint,'both evidence submissions are retained');
select results_eq($$ select review_status::text, reviewed_by from public.task_evidence
  where task_id = (select task_id from task_ids where name='t1') order by created_at, review_status $$,
  $$ values ('approved'::text,'61000000-0000-4000-8000-000000000003'::uuid),('revision_required'::text,'61000000-0000-4000-8000-000000000003'::uuid) $$,
  'evidence history keeps revision and approval');
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
