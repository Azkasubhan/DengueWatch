begin;

create extension if not exists pgtap with schema extensions;
select plan(52);

select has_table('public', 'reports', 'reports exists');
select has_table('public', 'report_images', 'report images exist');
select has_table('public', 'report_events', 'report events exist');
select has_table('public', 'report_uploads', 'temporary upload ledger exists');
select has_table('public', 'report_idempotency', 'idempotency ledger exists');
select hasnt_table('public', 'report_upload_attempts', 'upload attempt ledger is removed with the quota (T31)');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.report_uploads'::regclass), 'upload leases still force RLS');
select ok(not has_table_privilege('authenticated', 'public.report_uploads', 'INSERT, UPDATE, DELETE'), 'user cannot write upload leases directly');
select ok((select not public from storage.buckets where id = 'report-photos'), 'report bucket is private');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.reports'::regclass), 'reports force RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.report_images'::regclass), 'image metadata forces RLS');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.report_events'::regclass), 'event history forces RLS');
select ok(not has_table_privilege('anon', 'public.reports', 'SELECT'), 'anonymous cannot read reports');
select ok(not has_table_privilege('authenticated', 'public.reports', 'INSERT, UPDATE, DELETE'), 'authenticated has no direct report writes');
select ok(not has_table_privilege('authenticated', 'public.report_events', 'INSERT, UPDATE, DELETE'), 'events are append only for users');
select ok(not has_table_privilege('authenticated', 'public.report_uploads', 'SELECT, INSERT, UPDATE, DELETE'), 'upload ledger is server only');
select ok(has_function_privilege('authenticated', 'public.create_environmental_report(uuid,public.report_category,text,text,text,numeric,numeric,text,uuid[],text)', 'EXECUTE'), 'authenticated can call create RPC');
select ok(not has_function_privilege('anon', 'public.create_environmental_report(uuid,public.report_category,text,text,text,numeric,numeric,text,uuid[],text)', 'EXECUTE'), 'anonymous cannot call create RPC');
select ok((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc where oid = 'public.create_environmental_report(uuid,public.report_category,text,text,text,numeric,numeric,text,uuid[],text)'::regprocedure), 'create RPC is definer with empty search path');
select ok((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc where oid = 'private.can_read_report(uuid)'::regprocedure), 'read helper is definer with empty search path');

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"M3 Test"}'::jsonb, now(), now()
from (values
  ('31000000-0000-4000-8000-000000000001'::uuid, 'm3-resident-a@example.test'),
  ('31000000-0000-4000-8000-000000000002'::uuid, 'm3-resident-b@example.test'),
  ('31000000-0000-4000-8000-000000000003'::uuid, 'm3-cadre-a@example.test'),
  ('31000000-0000-4000-8000-000000000004'::uuid, 'm3-cadre-b@example.test'),
  ('31000000-0000-4000-8000-000000000005'::uuid, 'm3-manager@example.test')
) as fixtures(id,email);

update public.profiles set role = 'cadre' where id in ('31000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000004');
update public.profiles set role = 'manager' where id = '31000000-0000-4000-8000-000000000005';
insert into public.areas (id,code,name,is_demo) values
  ('32000000-0000-4000-8000-000000000001','M3-T-A','M3 Test Area A',true),
  ('32000000-0000-4000-8000-000000000002','M3-T-B','M3 Test Area B',true);
insert into public.area_memberships (profile_id,area_id,membership_type,verified_at) values
  ('31000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','resident',now()),
  ('31000000-0000-4000-8000-000000000002','32000000-0000-4000-8000-000000000002','resident',now()),
  ('31000000-0000-4000-8000-000000000003','32000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('31000000-0000-4000-8000-000000000004','32000000-0000-4000-8000-000000000002','assigned_cadre',now()),
  ('31000000-0000-4000-8000-000000000005','32000000-0000-4000-8000-000000000001','manager',now());

insert into public.report_uploads (id,created_by,storage_path,mime_type,byte_size,width,height,uploaded_at) values
  ('33000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001/33000000-0000-4000-8000-000000000001.webp','image/webp',128,16,16,now()),
  ('33000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000002','31000000-0000-4000-8000-000000000002/33000000-0000-4000-8000-000000000002.webp','image/webp',128,16,16,now());
insert into public.report_uploads (id,created_by,storage_path,mime_type,byte_size,width,height) values
  ('33000000-0000-4000-8000-000000000003','31000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000001/33000000-0000-4000-8000-000000000003.webp','image/webp',128,16,16);
delete from public.report_uploads where id = '33000000-0000-4000-8000-000000000003';
select ok(not exists (select 1 from pg_trigger where tgname = 'report_upload_quota_before_insert'),'upload quota trigger is removed (T31)');
insert into public.report_uploads (id,created_by,storage_path,mime_type,byte_size,width,height)
select ('34000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
  '31000000-0000-4000-8000-000000000002'::uuid,
  '31000000-0000-4000-8000-000000000002/34000000-0000-4000-8000-' || lpad(i::text,12,'0') || '.webp',
  'image/webp',128,16,16 from generate_series(1,29) as i;
select is((select count(*) from public.report_uploads where created_by = '31000000-0000-4000-8000-000000000002'),30::bigint,'thirty uploads in one hour are stored');
select lives_ok($$ insert into public.report_uploads (id,created_by,storage_path,mime_type,byte_size,width,height)
  values ('34000000-0000-4000-8000-000000000030','31000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000002/34000000-0000-4000-8000-000000000030.webp','image/webp',128,16,16) $$,
  'thirty-first upload in one hour is accepted (T31)');
insert into storage.objects (bucket_id,name,owner_id) values
  ('report-photos','31000000-0000-4000-8000-000000000001/33000000-0000-4000-8000-000000000001.webp','31000000-0000-4000-8000-000000000001'),
  ('report-photos','31000000-0000-4000-8000-000000000002/33000000-0000-4000-8000-000000000002.webp','31000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;

select lives_ok($$ select * from public.create_environmental_report(
  '32000000-0000-4000-8000-000000000001','water_container',
  'Wadah air terlihat di area bersama setelah hujan.','Wadah air terbuka, genangan','Tutup wadah dan kuras seminggu sekali.',null,null,null,
  array['33000000-0000-4000-8000-000000000001'::uuid],'m3-create-key-a') $$,
  'resident creates own report in verified area');
select lives_ok($$ select * from public.create_environmental_report(
  '32000000-0000-4000-8000-000000000001','water_container',
  'Wadah air terlihat di area bersama setelah hujan.','Wadah air terbuka, genangan','Tutup wadah dan kuras seminggu sekali.',null,null,null,
  array['33000000-0000-4000-8000-000000000001'::uuid],'m3-create-key-a') $$,
  'retry with same key returns existing report');
select is((select count(*) from public.reports),1::bigint,'idempotent retry creates one report');
select is((select visible_objects||' | '||prevention_advice from public.reports),
  'Wadah air terbuka, genangan | Tutup wadah dan kuras seminggu sekali.','observation fields are stored (T29)');
select throws_ok($$ select * from public.create_environmental_report(
  '32000000-0000-4000-8000-000000000001','water_container',
  'Wadah air terlihat di area bersama setelah hujan.',null,'Tutup wadah dan kuras seminggu sekali.',null,null,null,
  array['33000000-0000-4000-8000-000000000001'::uuid],'m3-no-visible') $$,
  'P0422','invalid visible objects','visible objects are required');
select throws_ok($$ select * from public.create_environmental_report(
  '32000000-0000-4000-8000-000000000001','water_container',
  'Wadah air terlihat di area bersama setelah hujan.','Wadah air terbuka','Tutup.',null,null,null,
  array['33000000-0000-4000-8000-000000000001'::uuid],'m3-short-advice') $$,
  'P0422','invalid prevention advice','prevention advice needs at least 10 characters');
select is((select count(*) from public.report_images),1::bigint,'successful report has exactly one image');
select is((select count(*) from public.report_events where event_type='report_created' and actor_id=auth.uid()),1::bigint,'created event has authenticated actor');
select results_eq($$ select status::text from public.reports $$,$$ values ('pending_verification'::text) $$,'initial report status is pending verification');
select throws_ok($$ select * from public.create_environmental_report(
  '32000000-0000-4000-8000-000000000002','water_container',
  'Wadah air terlihat di area bersama setelah hujan.','Wadah air terbuka, genangan','Tutup wadah dan kuras seminggu sekali.',null,null,null,
  array['33000000-0000-4000-8000-000000000001'::uuid],'m3-create-key-b') $$,
  'P0403','area access denied','resident cannot create in another area');
select throws_ok($$ select * from public.create_environmental_report(
  '32000000-0000-4000-8000-000000000001','water_container',
  'Deskripsi berbeda untuk kunci yang sama.','Wadah air terbuka, genangan','Tutup wadah dan kuras seminggu sekali.',null,null,null,
  array['33000000-0000-4000-8000-000000000001'::uuid],'m3-create-key-a') $$,
  'P0409','idempotency conflict','key reuse with different payload conflicts');
select throws_ok($$ select * from public.create_environmental_report(
  '32000000-0000-4000-8000-000000000001','water_container',
  'Wadah air terlihat di area bersama setelah hujan.','Wadah air terbuka, genangan','Tutup wadah dan kuras seminggu sekali.',null,null,null,
  array[]::uuid[],'m3-no-photo') $$,
  'P0422','invalid upload references','report without photo is rejected');
select throws_ok($$ select * from public.create_environmental_report(
  '32000000-0000-4000-8000-000000000001','water_container',
  'Wadah air terlihat di area bersama setelah hujan.','Wadah air terbuka, genangan','Tutup wadah dan kuras seminggu sekali.',null,null,null,
  array['33000000-0000-4000-8000-000000000002'::uuid],'m3-other-photo') $$,
  'P0409','upload references unavailable','resident cannot consume another users upload');
select is((select count(*) from storage.objects where bucket_id='report-photos'),1::bigint,'resident sees only linked authorized photo');
select throws_ok($$ insert into public.reports (public_reference,reporter_id,area_id,category,description)
  values ('DW-FORGED','31000000-0000-4000-8000-000000000002','32000000-0000-4000-8000-000000000001','other','Forged reporter data here') $$,
  '42501','permission denied for table reports','resident cannot forge reporter via direct insert');
select throws_ok($$ update public.reports set status='verified' $$,
  '42501','permission denied for table reports','resident cannot change status');
select throws_ok($$ delete from public.report_events $$,
  '42501','permission denied for table report_events','resident cannot delete audit history');

reset role;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.reports),0::bigint,'other resident cannot read report');
select is((select count(*) from public.report_images),0::bigint,'other resident cannot read image metadata');
select is((select count(*) from public.report_events),0::bigint,'other resident cannot read timeline');
select is((select count(*) from storage.objects where bucket_id='report-photos'),0::bigint,'other resident cannot read private storage object');

reset role;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.reports),0::bigint,'area cadre without a task cannot read report');
select is((select count(*) from storage.objects where bucket_id='report-photos'),0::bigint,'area cadre without a task cannot read photo');

-- T27: a cadre reads a report only through a task assigned to them.
reset role;
insert into public.action_tasks (id,report_id,area_id,title,description,created_by)
select '34000000-0000-4000-8000-000000000001', r.id, r.area_id, 'Kuras wadah air',
  'Kuras dan tutup wadah air di area bersama.', '31000000-0000-4000-8000-000000000005'
from public.reports as r where r.reporter_id = '31000000-0000-4000-8000-000000000001' limit 1;
insert into public.action_task_assignees (task_id,profile_id) values
  ('34000000-0000-4000-8000-000000000001','31000000-0000-4000-8000-000000000003');
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.reports),1::bigint,'assigned cadre can read task report');
select is((select count(*) from storage.objects where bucket_id='report-photos'),1::bigint,'assigned cadre can read task report photo');

reset role;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.reports),0::bigint,'other area cadre cannot read report');
select is((select count(*) from storage.objects where bucket_id='report-photos'),0::bigint,'other area cadre cannot read photo');

reset role;
select set_config('request.jwt.claims','{"sub":"31000000-0000-4000-8000-000000000005","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.reports),1::bigint,'manager can read managed area report');
select throws_ok($$ update public.reports set status='verified' $$,
  '42501','permission denied for table reports','manager cannot verify report');

select * from finish();
rollback;
