begin;
create extension if not exists pgtap with schema extensions;
select plan(37);

select has_table('public', 'ai_analyses', 'AI analysis table exists');
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'public.ai_analyses'::regclass), 'AI table forces RLS');
select ok(not has_table_privilege('anon', 'public.ai_analyses', 'SELECT'), 'anonymous cannot read AI rows');
select ok(not has_table_privilege('authenticated', 'public.ai_analyses', 'INSERT, UPDATE, DELETE'), 'user cannot write AI rows directly');
select ok(has_table_privilege('authenticated', 'public.ai_analyses', 'SELECT'), 'user may read scoped AI rows');
select ok(has_function_privilege('authenticated', 'public.reserve_ai_analysis(uuid,uuid,text)', 'EXECUTE'), 'authenticated can reserve analysis');
select ok(not has_function_privilege('anon', 'public.reserve_ai_analysis(uuid,uuid,text)', 'EXECUTE'), 'anonymous cannot reserve analysis');
select ok(not has_function_privilege('service_role', 'public.reserve_ai_analysis(uuid,uuid,text)', 'EXECUTE'), 'service role cannot impersonate reserve RPC');
select ok((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc where oid = 'public.reserve_ai_analysis(uuid,uuid,text)'::regprocedure), 'reserve RPC has empty search path');
select ok((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc where oid = 'private.link_ai_analysis_to_report()'::regprocedure), 'link trigger has empty search path');
select has_index('public', 'ai_analyses', 'idx_ai_analyses_report', 'report lookup index exists');

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"M4 Test"}'::jsonb, now(), now()
from (values
  ('41000000-0000-4000-8000-000000000001'::uuid, 'm4-resident-a@example.test'),
  ('41000000-0000-4000-8000-000000000002'::uuid, 'm4-resident-b@example.test'),
  ('41000000-0000-4000-8000-000000000003'::uuid, 'm4-manager@example.test'),
  ('41000000-0000-4000-8000-000000000004'::uuid, 'm4-pending@example.test')
) as fixtures(id,email);
update public.profiles set role = 'manager' where id = '41000000-0000-4000-8000-000000000003';
insert into public.areas (id,code,name,is_demo) values
  ('42000000-0000-4000-8000-000000000001','M4-T-A','M4 Test Area A',true),
  ('42000000-0000-4000-8000-000000000002','M4-T-B','M4 Test Area B',true);
insert into public.area_memberships (profile_id,area_id,membership_type,verified_at) values
  ('41000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','resident',now()),
  ('41000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','resident',now()),
  ('41000000-0000-4000-8000-000000000003','42000000-0000-4000-8000-000000000001','manager',now()),
  ('41000000-0000-4000-8000-000000000004','42000000-0000-4000-8000-000000000001','resident',null);
insert into public.report_uploads (id,created_by,storage_path,mime_type,byte_size,width,height,uploaded_at,expires_at) values
  ('43000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001.webp','image/webp',128,16,16,now(),now()+interval '1 hour'),
  ('43000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002/43000000-0000-4000-8000-000000000002.webp','image/webp',128,16,16,now(),now()+interval '1 hour'),
  ('43000000-0000-4000-8000-000000000003','41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000003.webp','image/webp',128,16,16,now(),now()-interval '1 minute'),
  ('43000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000004.webp','image/webp',128,16,16,now(),now()+interval '1 hour');
insert into storage.objects (bucket_id,name,owner_id) values
  ('report-photos','41000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000001.webp','41000000-0000-4000-8000-000000000001'),
  ('report-photos','41000000-0000-4000-8000-000000000002/43000000-0000-4000-8000-000000000002.webp','41000000-0000-4000-8000-000000000002'),
  ('report-photos','41000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000003.webp','41000000-0000-4000-8000-000000000001'),
  ('report-photos','41000000-0000-4000-8000-000000000001/43000000-0000-4000-8000-000000000004.webp','41000000-0000-4000-8000-000000000001');

select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','gemini-test') $$, 'resident reserves own valid image');
select is((select count(*) from public.ai_analyses),1::bigint,'resident sees own analysis');
select throws_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','gemini-test') $$,
  'P0409','AI request in progress','concurrent request denied');
select throws_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000001','gemini-test') $$,
  'P0403','area access denied','cross-area request denied');
select throws_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000002','gemini-test') $$,
  'P0404','upload unavailable','other resident upload denied');
select throws_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000003','gemini-test') $$,
  'P0404','upload unavailable','expired upload denied');
select throws_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000099','gemini-test') $$,
  'P0404','upload unavailable','forged upload denied');
select throws_ok($$ update public.ai_analyses set status='success' $$,
  '42501','permission denied for table ai_analyses','resident cannot forge AI completion');

reset role;
update public.ai_analyses set status='success', result_json='{"requiresHumanVerification":true}'::jsonb, completed_at=now()
where request_user_id='41000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select * from public.create_environmental_report(
  '42000000-0000-4000-8000-000000000001','water_container','Wadah air tampak di area bersama untuk pemeriksaan.','Wadah air terbuka, genangan','Tutup wadah dan kuras seminggu sekali.',null,null,null,
  array['43000000-0000-4000-8000-000000000001'::uuid],'m4-link-report') $$, 'M3 report transaction works after AI');
select ok((select report_id is not null from public.ai_analyses limit 1), 'analysis linked to final report by image trigger');
select is((select status::text from public.reports limit 1),'pending_verification','AI did not alter report status');

reset role;
insert into public.ai_analyses (request_user_id,area_id,model_id,status,completed_at,error_code)
select '41000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','gemini-test','error',now(),'TEST'
from generate_series(1,9);
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000004','gemini-test') $$,
  'no hourly AI quota per account (T32)');
reset role;
update public.ai_analyses set status='error', completed_at=now(), error_code='TEST'
where request_user_id='41000000-0000-4000-8000-000000000001' and status='processing';
update public.ai_analyses set created_at=now()-interval '2 hours'
where request_user_id='41000000-0000-4000-8000-000000000001';
insert into public.ai_analyses (request_user_id,area_id,model_id,status,completed_at,error_code,created_at)
select '41000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','gemini-test','error',now(),'TEST',now()-interval '2 hours'
from generate_series(1,20);
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000004','gemini-test') $$,
  'no daily AI quota per account (T32)');

reset role;
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.ai_analyses),0::bigint,'other resident cannot read analysis');
reset role;
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.ai_analyses),0::bigint,'manager cannot read resident AI analysis');
select throws_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','gemini-test') $$,
  'P0403','area access denied','manager cannot request resident AI');
reset role;
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000004","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000003','gemini-test') $$,
  'P0403','area access denied','pending membership cannot request AI');

reset role;
insert into public.report_uploads (id,created_by,storage_path,mime_type,byte_size,width,height,uploaded_at,expires_at) values
  ('43000000-0000-4000-8000-000000000005','41000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002/43000000-0000-4000-8000-000000000005.webp','image/webp',128,16,16,now(),now()+interval '1 hour');
insert into storage.objects (bucket_id,name,owner_id) values
  ('report-photos','41000000-0000-4000-8000-000000000002/43000000-0000-4000-8000-000000000005.webp','41000000-0000-4000-8000-000000000002');
insert into public.ai_analyses (id,request_user_id,area_id,upload_id,model_id,status,result_json,completed_at,error_code) values
  ('44000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002','gemini-test','success','{"requiresHumanVerification":true}',now()-interval '2 minutes',null),
  ('44000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002','gemini-test','success','{"requiresHumanVerification":true}',now()-interval '1 minute',null),
  ('44000000-0000-4000-8000-000000000003','41000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002','gemini-test','error',null,now(),'TEST');
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select * from public.create_environmental_report(
  '42000000-0000-4000-8000-000000000002','water_container','Wadah air tampak di halaman belakang rumah warga.','Wadah air terbuka, genangan','Tutup wadah dan kuras seminggu sekali.',null,null,null,
  array['43000000-0000-4000-8000-000000000002'::uuid],'m4-single-suggestion') $$, 'report submits after repeated AI requests');
reset role;
select is((select array_agg(id) from public.ai_analyses where report_id is not null and request_user_id='41000000-0000-4000-8000-000000000002'),
  array['44000000-0000-4000-8000-000000000002'::uuid],'only the latest successful suggestion is linked to the report');

update public.ai_analyses set created_at=now()-interval '3 days' where id='44000000-0000-4000-8000-000000000002';
insert into public.ai_analyses (id,request_user_id,area_id,model_id,status,completed_at,error_code,created_at) values
  ('44000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','gemini-test','error',now(),'TEST',now()-interval '25 hours'),
  ('44000000-0000-4000-8000-000000000005','41000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','gemini-test','error',now(),'TEST',now()-interval '23 hours'),
  ('44000000-0000-4000-8000-000000000006','41000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','gemini-test','error',now(),'TEST',now()-interval '25 hours');
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select lives_ok($$ select public.reserve_ai_analysis('42000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000005','gemini-test') $$,
  'new request purges expired unlinked analyses');
reset role;
select ok(not exists (select 1 from public.ai_analyses where id='44000000-0000-4000-8000-000000000004'),
  'unlinked analysis older than the daily window is deleted');
select ok(not exists (select 1 from public.ai_analyses where id='44000000-0000-4000-8000-000000000006'),
  'expired unlinked analyses of other accounts are deleted too');
select ok(exists (select 1 from public.ai_analyses where id='44000000-0000-4000-8000-000000000005'),
  'unlinked analysis inside the daily window still counts toward quota');
select ok(exists (select 1 from public.ai_analyses where id='44000000-0000-4000-8000-000000000002'),
  'suggestion linked to a report is never purged');
select is((select count(*) from public.ai_analyses where id in ('44000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000003')),
  2::bigint,'superseded attempts stay until the daily window passes');

reset role;
delete from public.area_memberships
where profile_id='41000000-0000-4000-8000-000000000001' and area_id='42000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"41000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select is((select count(*) from public.ai_analyses),0::bigint,'revoked resident membership cannot read own old AI analysis');

select * from finish();
rollback;
