begin;

create extension if not exists pgtap with schema extensions;
select plan(24);

select ok((select not prosecdef and proconfig @> array['search_path=""']::text[]
  from pg_proc where oid = 'public.get_manager_report_summary(uuid,date,date)'::regprocedure),
  'summary runs as invoker so RLS still applies');
select ok(has_function_privilege('authenticated','public.get_manager_report_summary(uuid,date,date)','EXECUTE')
  and not has_function_privilege('anon','public.get_manager_report_summary(uuid,date,date)','EXECUTE')
  and not has_function_privilege('service_role','public.get_manager_report_summary(uuid,date,date)','EXECUTE'),
  'only authenticated users call the summary');
select ok(not exists (select 1 from pg_proc as p, unnest(p.proargnames) as name
  where p.oid = 'public.get_manager_report_summary(uuid,date,date)'::regprocedure
    and name ~ '(latitude|longitude|reporter|actor|photo|storage|email|name)'),
  'summary payload has no identity, photo, or location columns');

-- Fixtures.
insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"M7 Test"}'::jsonb, now(), now()
from (values
  ('71000000-0000-4000-8000-000000000001'::uuid, 'm7-resident@example.test'),
  ('71000000-0000-4000-8000-000000000002'::uuid, 'm7-cadre-a1@example.test'),
  ('71000000-0000-4000-8000-000000000003'::uuid, 'm7-cadre-a2@example.test'),
  ('71000000-0000-4000-8000-000000000004'::uuid, 'm7-manager-a@example.test'),
  ('71000000-0000-4000-8000-000000000005'::uuid, 'm7-manager-b@example.test'),
  ('71000000-0000-4000-8000-000000000006'::uuid, 'm7-manager-pending@example.test')
) as fixtures(id,email);
update public.profiles set role = 'cadre' where id in ('71000000-0000-4000-8000-000000000002','71000000-0000-4000-8000-000000000003');
update public.profiles set role = 'manager' where id in ('71000000-0000-4000-8000-000000000004','71000000-0000-4000-8000-000000000005','71000000-0000-4000-8000-000000000006');
insert into public.areas (id,code,name,is_demo) values
  ('72000000-0000-4000-8000-000000000001','M7-T-A','M7 Test Area A',true),
  ('72000000-0000-4000-8000-000000000002','M7-T-B','M7 Test Area B',false);
insert into public.area_memberships (profile_id,area_id,membership_type,verified_at) values
  ('71000000-0000-4000-8000-000000000001','72000000-0000-4000-8000-000000000001','resident',now()),
  ('71000000-0000-4000-8000-000000000002','72000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('71000000-0000-4000-8000-000000000003','72000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('71000000-0000-4000-8000-000000000004','72000000-0000-4000-8000-000000000001','manager',now()),
  ('71000000-0000-4000-8000-000000000005','72000000-0000-4000-8000-000000000002','manager',now()),
  ('71000000-0000-4000-8000-000000000006','72000000-0000-4000-8000-000000000001','manager',null);

-- Area A, October 2026 WIB: 8 reports in cohort; a9 is 23:59:59 WIB on 30 Sept.
insert into public.reports (id,public_reference,reporter_id,area_id,category,description,is_demo,status,version,submitted_at,resolved_at)
select id::uuid, ref, '71000000-0000-4000-8000-000000000001'::uuid, area::uuid, 'water_container',
  'Laporan analitik uji untuk ringkasan.', true, status::public.report_status, 2, submitted::timestamptz, resolved::timestamptz
from (values
  ('73000000-0000-4000-8000-000000000001','M7-T-000001','72000000-0000-4000-8000-000000000001','pending_verification','2026-10-10T03:00:00Z',null),
  ('73000000-0000-4000-8000-000000000002','M7-T-000002','72000000-0000-4000-8000-000000000001','needs_information','2026-10-11T03:00:00Z',null),
  ('73000000-0000-4000-8000-000000000003','M7-T-000003','72000000-0000-4000-8000-000000000001','verified','2026-10-12T03:00:00Z',null),
  ('73000000-0000-4000-8000-000000000004','M7-T-000004','72000000-0000-4000-8000-000000000001','in_action','2026-10-13T03:00:00Z',null),
  ('73000000-0000-4000-8000-000000000005','M7-T-000005','72000000-0000-4000-8000-000000000001','resolved','2026-10-14T03:00:00Z','2026-10-14T15:00:00Z'),
  ('73000000-0000-4000-8000-000000000006','M7-T-000006','72000000-0000-4000-8000-000000000001','rejected','2026-10-15T03:00:00Z',null),
  ('73000000-0000-4000-8000-000000000007','M7-T-000007','72000000-0000-4000-8000-000000000001','duplicate','2026-10-16T03:00:00Z',null),
  ('73000000-0000-4000-8000-000000000008','M7-T-000008','72000000-0000-4000-8000-000000000001','resolved','2026-09-30T17:00:00Z','2026-10-01T15:00:00Z'),
  ('73000000-0000-4000-8000-000000000009','M7-T-000009','72000000-0000-4000-8000-000000000001','pending_verification','2026-09-30T16:59:59Z',null),
  ('73000000-0000-4000-8000-000000000010','M7-T-000010','72000000-0000-4000-8000-000000000002','resolved','2026-10-10T03:00:00Z','2026-10-10T10:00:00Z')
) as r(id, ref, area, status, submitted, resolved);

-- First decision delays (hours): a2=1, a3=2, a4=2, a5=2, a6=3, a7=4, a8=2 -> median 2.
-- Verified -> resolved: a5=10, a8=20 -> median 15.
insert into public.report_events (report_id,actor_id,event_type,old_status,new_status,reason,metadata,created_at)
select r.id, '71000000-0000-4000-8000-000000000002', e.event_type, 'pending_verification', e.new_status::public.report_status,
  e.reason, e.metadata::jsonb, r.submitted_at + make_interval(hours => e.hours)
from public.reports as r join (values
  ('73000000-0000-4000-8000-000000000002','report_information_requested','needs_information','Mohon kirim foto lebih jelas.','{}',1),
  ('73000000-0000-4000-8000-000000000003','report_verified','verified',null,'{}',2),
  ('73000000-0000-4000-8000-000000000004','report_verified','verified',null,'{}',2),
  ('73000000-0000-4000-8000-000000000005','report_verified','verified',null,'{}',2),
  ('73000000-0000-4000-8000-000000000006','report_rejected','rejected','Lokasi di luar area bersama.','{}',3),
  ('73000000-0000-4000-8000-000000000007','report_marked_duplicate','duplicate','Sama dengan laporan sebelumnya.','{"duplicateOfReportId":"73000000-0000-4000-8000-000000000001"}',4),
  ('73000000-0000-4000-8000-000000000008','report_verified','verified',null,'{}',2),
  ('73000000-0000-4000-8000-000000000010','report_verified','verified',null,'{}',2)
) as e(report_id, event_type, new_status, reason, metadata, hours) on r.id = e.report_id::uuid;
insert into public.action_tasks (id,report_id,area_id,title,description,created_by,status)
values ('74000000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000004','72000000-0000-4000-8000-000000000001','Kuras wadah uji',
  'Tugas uji yang menunggu pemeriksaan bukti.','71000000-0000-4000-8000-000000000002','awaiting_review');
insert into public.action_task_assignees (task_id,profile_id)
values ('74000000-0000-4000-8000-000000000001','71000000-0000-4000-8000-000000000002');

create temp table summary_ids (name text primary key, id uuid, path text);
grant all on summary_ids to authenticated;

-- Role and scope.
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.get_manager_report_summary(null,'2026-10-01','2026-10-31') $$,
  'P0403','analytics not permitted','cadre cannot read manager analytics');
reset role;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.get_manager_report_summary(null,'2026-10-01','2026-10-31') $$,
  'P0403','analytics not permitted','resident cannot read manager analytics');
reset role;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.get_manager_report_summary(null,'2026-10-01','2026-10-31') $$,
  'P0403','analytics not permitted','unverified manager membership gets no analytics');

reset role;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.get_manager_report_summary('72000000-0000-4000-8000-000000000002','2026-10-01','2026-10-31') $$,
  'P0404','area not found','manager cannot request another area');
select throws_ok($$ select * from public.get_manager_report_summary(null,'2026-10-31','2026-10-01') $$,
  'P0422','invalid date range','reversed range rejected');
select throws_ok($$ select * from public.get_manager_report_summary(null,'2025-01-01','2026-10-31') $$,
  'P0422','invalid date range','range above 366 days rejected');
select throws_ok($$ select * from public.get_manager_report_summary(null,null,'2026-10-31') $$,
  'P0422','invalid date range','missing date rejected');

-- Deterministic October cohort for area A.
select results_eq($$ select reports_total, awaiting_verification, in_action, resolved, not_actionable,
    completion_eligible, completion_rate, tasks_awaiting_review, area_count, is_demo
  from public.get_manager_report_summary(null,'2026-10-01','2026-10-31') $$,
  $$ values (8, 2, 2, 2, 2, 4, 50.0::numeric, 1, 1, true) $$,
  'October KPIs follow the documented status buckets');
select results_eq($$ select median_hours_to_first_review, median_hours_to_resolution
  from public.get_manager_report_summary('72000000-0000-4000-8000-000000000001','2026-10-01','2026-10-31') $$,
  $$ values (2.0::numeric, 15.0::numeric) $$,
  'median durations use first decision and verified-to-resolved');
select results_eq($$ select period_start, period_end
  from public.get_manager_report_summary(null,'2026-10-01','2026-10-31') $$,
  $$ values ('2026-09-30T17:00:00Z'::timestamptz, '2026-10-31T17:00:00Z'::timestamptz) $$,
  'period boundaries are WIB calendar days');
select results_eq($$ select reports_total, awaiting_verification, completion_eligible, completion_rate,
    median_hours_to_first_review, median_hours_to_resolution
  from public.get_manager_report_summary(null,'2026-09-01','2026-09-30') $$,
  $$ values (1, 1, 0, null::numeric, null::numeric, null::numeric) $$,
  'zero denominator yields null rate instead of a fabricated value');
select results_eq($$ select reports_total from public.get_manager_report_summary(null,'2026-11-01','2026-11-30') $$,
  $$ values (0) $$,'empty period returns zero counts');

reset role;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select results_eq($$ select reports_total, resolved, completion_rate, is_demo
  from public.get_manager_report_summary(null,'2026-10-01','2026-10-31') $$,
  $$ values (1, 1, 100.0::numeric, false) $$,
  'manager B sees only area B and a non-demo label');

-- AC-70 through the real ActionLoop RPCs on verified report a3 (T27: manager assigns and reviews).
reset role;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
insert into summary_ids select 'task', task_id, null from public.create_action_task('73000000-0000-4000-8000-000000000003',
  'Kuras wadah analitik','Kuras dan tutup wadah untuk uji ringkasan.',array['71000000-0000-4000-8000-000000000002'::uuid], current_date + 3, 'm7-key-task-1');
reset role;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select * from public.start_action_task((select id from summary_ids where name='task'),1) $$,'task started');
insert into summary_ids select 'lease', upload_id, storage_path
  from public.reserve_task_evidence_upload((select id from summary_ids where name='task'),128,16,16);
reset role;
update public.report_uploads set uploaded_at = now() where id = (select id from summary_ids where name='lease');
insert into storage.objects (bucket_id,name,owner_id)
values ('report-photos',(select path from summary_ids where name='lease'),'71000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select * from public.submit_task_evidence((select id from summary_ids where name='task'),
  (select id from summary_ids where name='lease'),'Wadah sudah dikuras dan ditutup.',2) $$,'evidence submitted');
reset role;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select report_status::text from public.review_task_evidence((select id from summary_ids where name='task'),(select id from public.task_evidence where task_id=(select id from summary_ids where name='task')),'approve',null,3)),
  'resolved','manager approval resolves report a3');

reset role;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select results_eq($$ select in_action, resolved, completion_rate, tasks_awaiting_review
  from public.get_manager_report_summary(null,'2026-10-01','2026-10-31') $$,
  $$ values (1, 3, 75.0::numeric, 1) $$,'resolution moves the report into the completed bucket');

reset role;
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select report_status::text from public.reopen_action_task((select id from summary_ids where name='task'),
  'Wadah kembali terisi air setelah hujan.',4)),'in_action','reopen returns report a3 to in_action');
-- Edge case: cancelling the only mandatory task after reopen must not resolve the report.
select is((select status::text||':'||report_status from public.cancel_action_task((select id from summary_ids where name='task'),
  'Wadah dipindahkan sehingga tugas tidak relevan.',5)),'cancelled:in_action',
  'cancelling every mandatory task after reopen leaves the report unresolved');

reset role;
select is((select status::text || ':' || (resolved_at is null) from public.reports where id = '73000000-0000-4000-8000-000000000003'),
  'in_action:true','report a3 has no resolution without an approved active mandatory task');
select set_config('request.jwt.claims','{"sub":"71000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select results_eq($$ select in_action, resolved, completion_rate
  from public.get_manager_report_summary(null,'2026-10-01','2026-10-31') $$,
  $$ values (2, 2, 50.0::numeric) $$,'reopen and cancellation are reflected after refetch');

select * from finish();
rollback;
