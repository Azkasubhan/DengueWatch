begin;

create extension if not exists pgtap with schema extensions;
select plan(64);

select has_function('public', 'review_report', array['uuid','text','text','integer','uuid'], 'review RPC exists');
select has_function('public', 'add_report_information', array['uuid','text','integer'], 'add information RPC exists');
select has_function('public', 'get_report_ai_suggestions', array['uuid'], 'manager AI suggestion reader exists');
select ok((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc where oid = 'public.review_report(uuid,text,text,integer,uuid)'::regprocedure), 'review RPC is definer with empty search path');
select ok((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc where oid = 'public.add_report_information(uuid,text,integer)'::regprocedure), 'add information RPC is definer with empty search path');
select ok((select prosecdef and proconfig @> array['search_path=""']::text[] from pg_proc where oid = 'public.get_report_ai_suggestions(uuid)'::regprocedure), 'suggestion reader is definer with empty search path');
select ok(not has_function_privilege('anon', 'public.review_report(uuid,text,text,integer,uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.add_report_information(uuid,text,integer)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.get_report_ai_suggestions(uuid)', 'EXECUTE'), 'anonymous cannot call M5 functions');
select ok(not has_function_privilege('service_role', 'public.review_report(uuid,text,text,integer,uuid)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.add_report_information(uuid,text,integer)', 'EXECUTE')
  and not has_function_privilege('service_role', 'public.get_report_ai_suggestions(uuid)', 'EXECUTE'), 'service role cannot act without a user identity');
select ok(has_function_privilege('authenticated', 'public.review_report(uuid,text,text,integer,uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.add_report_information(uuid,text,integer)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.get_report_ai_suggestions(uuid)', 'EXECUTE'), 'authenticated can call M5 functions');
select ok(not has_table_privilege('authenticated', 'public.reports', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.report_events', 'INSERT, UPDATE, DELETE')
  and not has_table_privilege('authenticated', 'public.ai_analyses', 'UPDATE'), 'review state changes only through RPC');

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email, '', now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{"display_name":"M5 Test"}'::jsonb, now(), now()
from (values
  ('51000000-0000-4000-8000-000000000001'::uuid, 'm5-resident-a@example.test'),
  ('51000000-0000-4000-8000-000000000002'::uuid, 'm5-resident-b@example.test'),
  ('51000000-0000-4000-8000-000000000003'::uuid, 'm5-cadre-a1@example.test'),
  ('51000000-0000-4000-8000-000000000004'::uuid, 'm5-cadre-a2@example.test'),
  ('51000000-0000-4000-8000-000000000005'::uuid, 'm5-cadre-b@example.test'),
  ('51000000-0000-4000-8000-000000000006'::uuid, 'm5-manager-a@example.test'),
  ('51000000-0000-4000-8000-000000000007'::uuid, 'm5-manager-a2@example.test'),
  ('51000000-0000-4000-8000-000000000008'::uuid, 'm5-manager-b@example.test')
) as fixtures(id,email);

update public.profiles set role = 'cadre' where id in ('51000000-0000-4000-8000-000000000003','51000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000005');
update public.profiles set role = 'manager' where id in ('51000000-0000-4000-8000-000000000006','51000000-0000-4000-8000-000000000007','51000000-0000-4000-8000-000000000008');
insert into public.areas (id,code,name,is_demo) values
  ('52000000-0000-4000-8000-000000000001','M5-T-A','M5 Test Area A',true),
  ('52000000-0000-4000-8000-000000000002','M5-T-B','M5 Test Area B',true);
insert into public.area_memberships (profile_id,area_id,membership_type,verified_at) values
  ('51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','resident',now()),
  ('51000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002','resident',now()),
  ('51000000-0000-4000-8000-000000000003','52000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('51000000-0000-4000-8000-000000000004','52000000-0000-4000-8000-000000000001','assigned_cadre',now()),
  ('51000000-0000-4000-8000-000000000005','52000000-0000-4000-8000-000000000002','assigned_cadre',now()),
  ('51000000-0000-4000-8000-000000000006','52000000-0000-4000-8000-000000000001','manager',now()),
  ('51000000-0000-4000-8000-000000000007','52000000-0000-4000-8000-000000000001','manager',now()),
  ('51000000-0000-4000-8000-000000000008','52000000-0000-4000-8000-000000000002','manager',now());

insert into public.reports (id,public_reference,reporter_id,area_id,category,description,is_demo,submitted_at) values
  ('53000000-0000-4000-8000-000000000001','M5-T-000001','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','discarded_tire','Ban bekas menampung air di dekat pos ronda.',true,now() - interval '5 hours'),
  ('53000000-0000-4000-8000-000000000002','M5-T-000002','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','water_container','Ember terbuka berisi air di halaman balai.',true,now() - interval '4 hours'),
  ('53000000-0000-4000-8000-000000000003','M5-T-000003','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','discarded_tire','Ban bekas yang sama terlihat dari sisi jalan.',true,now() - interval '3 hours'),
  ('53000000-0000-4000-8000-000000000004','M5-T-000004','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','discarded_tire','Ban bekas lain di dekat pos ronda pagi ini.',true,now() - interval '1 hour'),
  ('53000000-0000-4000-8000-000000000005','M5-T-000005','51000000-0000-4000-8000-000000000002','52000000-0000-4000-8000-000000000002','clogged_drain','Saluran air tersumbat daun di area B.',true,now() - interval '6 hours'),
  ('53000000-0000-4000-8000-000000000007','M5-T-000007','51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','other','Laporan untuk uji penghapusan berantai.',true,now() - interval '2 hours');
insert into public.report_events (report_id,actor_id,event_type,new_status)
select id, reporter_id, 'report_created', 'pending_verification' from public.reports
where id::text like '53000000-%';

insert into public.ai_analyses (request_user_id,area_id,report_id,model_id,status,result_json,completed_at) values
  ('51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','gemini-test','success',
   '{"visibleObjects":["ban bekas","air tergenang"],"suggestedCategory":"discarded_tire","draftDescription":"Ban bekas tampak menampung air.","suggestedPrecaution":"Kosongkan air dan simpan ban terbalik.","requiresHumanVerification":true,"limitations":"Hanya berdasarkan satu foto.","internalNote":"must not leak"}'::jsonb, now()),
  ('51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','gemini-test','success',
   '{"visibleObjects":["benda"],"suggestedCategory":"bogus","draftDescription":"Tidak valid.","suggestedPrecaution":"-","requiresHumanVerification":true,"limitations":"-"}'::jsonb, now());
insert into public.ai_analyses (request_user_id,area_id,report_id,model_id,status,completed_at,error_code) values
  ('51000000-0000-4000-8000-000000000001','52000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001','gemini-test','error',now(),'PROVIDER_ERROR');

-- Resident, cadre, and out-of-area manager cannot review (T27: managers review).
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','verify',null,1) $$,
  'P0403','review not permitted','resident cannot review');
select throws_ok($$ select * from public.get_report_ai_suggestions('53000000-0000-4000-8000-000000000001') $$,
  'P0403','suggestion access not permitted','resident uses owner RLS, not manager reader');
select is((select count(*) from public.ai_analyses),3::bigint,'owner AI RLS is unchanged');

reset role;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','verify',null,1) $$,
  'P0403','review not permitted','cadre in area cannot review');
select throws_ok($$ select * from public.get_report_ai_suggestions('53000000-0000-4000-8000-000000000001') $$,
  'P0403','suggestion access not permitted','cadre cannot use manager AI reader');

reset role;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000008","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','verify',null,1) $$,
  'P0404','report not found','cross-area manager cannot review');
select throws_ok($$ select * from public.get_report_ai_suggestions('53000000-0000-4000-8000-000000000001') $$,
  'P0404','report not found','cross-area manager cannot read AI suggestion');

reset role;
select set_config('request.jwt.claims','{"role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','verify',null,1) $$,
  'P0401','authentication required','missing identity is rejected');

-- Input validation and the first valid decision.
reset role;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000099','verify',null,1) $$,
  'P0404','report not found','unknown report is not found');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','approve',null,1) $$,
  'P0422','invalid review decision','unknown decision rejected');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','reject',null,1) $$,
  'P0422','invalid review reason','reject requires reason');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','request_information','singkat',1) $$,
  'P0422','invalid review reason','reason shorter than ten characters rejected');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','verify',null,1,'53000000-0000-4000-8000-000000000002') $$,
  'P0422','invalid duplicate reference','duplicate target only allowed for mark_duplicate');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','verify',null,0) $$,
  'P0422','invalid expected version','expected version must be positive');
select is((select r.status::text || ':' || r.version from public.review_report('53000000-0000-4000-8000-000000000001','verify',null,1) as r),
  'verified:2','manager verifies pending report and version increments');
select is((select count(*) from public.ai_analyses),0::bigint,'manager still cannot read ai_analyses directly');
select is((select count(*) from public.get_report_ai_suggestions('53000000-0000-4000-8000-000000000001')),1::bigint,
  'reader returns only valid successful analyses');
select results_eq($$ select suggested_category::text, draft_description, suggested_precaution, limitations
  from public.get_report_ai_suggestions('53000000-0000-4000-8000-000000000001') $$,
  $$ values ('discarded_tire'::text,'Ban bekas tampak menampung air.'::text,'Kosongkan air dan simpan ban terbalik.'::text,'Hanya berdasarkan satu foto.'::text) $$,
  'reader returns sanitized suggestion fields');
select is((select visible_objects from public.get_report_ai_suggestions('53000000-0000-4000-8000-000000000001')),
  array['ban bekas','air tergenang'],'reader keeps visible objects in order');

-- A second manager acting on the old version loses (AC-31); terminal states stay terminal (AC-30).
reset role;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000007","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','reject','Foto tidak menunjukkan genangan air.',1) $$,
  'P0409','stale report version','stale version conflicts');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000001','reject','Foto tidak menunjukkan genangan air.',2) $$,
  'P0422','invalid report transition','verified report cannot be reviewed again');

reset role;
select is((select status::text || ':' || version from public.reports where id = '53000000-0000-4000-8000-000000000001'),
  'verified:2','losing request leaves report unchanged');
select is((select count(*) from public.report_events where report_id = '53000000-0000-4000-8000-000000000001'),
  2::bigint,'failed requests write no audit event');

-- Request information, resident response, then rejection.
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select is((select r.status::text || ':' || r.version from public.review_report('53000000-0000-4000-8000-000000000002','request_information','Mohon kirim foto dari jarak lebih dekat.',1) as r),
  'needs_information:2','manager requests information');
select throws_ok($$ select * from public.add_report_information('53000000-0000-4000-8000-000000000002','Foto tambahan sudah saya ambil dari dekat.',2) $$,
  'P0403','information update not permitted','manager cannot answer for resident');

reset role;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000002","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.add_report_information('53000000-0000-4000-8000-000000000002','Foto tambahan sudah saya ambil dari dekat.',2) $$,
  'P0404','report not found','other resident cannot add information');

reset role;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
select throws_ok($$ select * from public.add_report_information('53000000-0000-4000-8000-000000000002','Foto tambahan sudah saya ambil dari dekat.',1) $$,
  'P0409','stale report version','owner with stale version conflicts');
select throws_ok($$ select * from public.add_report_information('53000000-0000-4000-8000-000000000002','oke',2) $$,
  'P0422','invalid information note','short note rejected');
select throws_ok($$ select * from public.add_report_information('53000000-0000-4000-8000-000000000001','Foto tambahan sudah saya ambil dari dekat.',2) $$,
  'P0422','invalid report transition','owner cannot add information outside needs_information');
select is((select r.status::text || ':' || r.version from public.add_report_information('53000000-0000-4000-8000-000000000002','Foto tambahan sudah saya ambil dari dekat.',2) as r),
  'pending_verification:3','owner returns report to verification');
select throws_ok($$ select * from public.add_report_information('53000000-0000-4000-8000-000000000002','Foto tambahan sudah saya ambil dari dekat.',3) $$,
  'P0422','invalid report transition','information cannot be added twice');

reset role;
select set_config('request.jwt.claims','{"sub":"51000000-0000-4000-8000-000000000006","role":"authenticated"}',true);
set local role authenticated;
select is((select r.status::text || ':' || r.version from public.review_report('53000000-0000-4000-8000-000000000002','reject','Lokasi berada di luar fasilitas umum.',3) as r),
  'rejected:4','manager rejects after resubmission');

-- Duplicate target rules.
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000003','mark_duplicate','Objek sama dengan laporan sebelumnya.',1,'53000000-0000-4000-8000-000000000003') $$,
  'P0422','invalid duplicate target','report cannot duplicate itself');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000003','mark_duplicate','Objek sama dengan laporan sebelumnya.',1,'53000000-0000-4000-8000-000000000005') $$,
  'P0422','invalid duplicate target','cross-area duplicate target rejected');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000003','mark_duplicate','Objek sama dengan laporan sebelumnya.',1,'53000000-0000-4000-8000-000000000099') $$,
  'P0422','invalid duplicate target','unknown duplicate target rejected');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000003','mark_duplicate','Objek sama dengan laporan sebelumnya.',1,'53000000-0000-4000-8000-000000000002') $$,
  'P0422','invalid duplicate target','rejected report is not a duplicate target');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000003','mark_duplicate','Objek sama dengan laporan sebelumnya.',1,'53000000-0000-4000-8000-000000000004') $$,
  'P0422','invalid duplicate target','newer report is not a duplicate target');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000003','mark_duplicate','Objek sama dengan laporan sebelumnya.',1) $$,
  'P0422','invalid duplicate reference','mark_duplicate requires target');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000003','mark_duplicate',null,1,'53000000-0000-4000-8000-000000000001') $$,
  'P0422','invalid review reason','mark_duplicate requires reason');
select is((select r.status::text || ':' || r.version from public.review_report('53000000-0000-4000-8000-000000000003','mark_duplicate','Objek sama dengan laporan sebelumnya.',1,'53000000-0000-4000-8000-000000000001') as r),
  'duplicate:2','manager marks duplicate of earlier report');
select throws_ok($$ select * from public.review_report('53000000-0000-4000-8000-000000000004','mark_duplicate','Objek sama dengan laporan sebelumnya.',1,'53000000-0000-4000-8000-000000000003') $$,
  'P0422','invalid duplicate target','duplicate chains are rejected');

-- Audit integrity.
reset role;
select set_eq($$ select event_type, old_status::text, new_status::text, actor_id, reason from public.report_events
  where report_id = '53000000-0000-4000-8000-000000000002' $$,
  $$ values
    ('report_created', null::text, 'pending_verification', '51000000-0000-4000-8000-000000000001'::uuid, null::varchar),
    ('report_information_requested', 'pending_verification', 'needs_information', '51000000-0000-4000-8000-000000000006'::uuid, 'Mohon kirim foto dari jarak lebih dekat.'::varchar),
    ('report_information_added', 'needs_information', 'pending_verification', '51000000-0000-4000-8000-000000000001'::uuid, 'Foto tambahan sudah saya ambil dari dekat.'::varchar),
    ('report_rejected', 'pending_verification', 'rejected', '51000000-0000-4000-8000-000000000006'::uuid, 'Lokasi berada di luar fasilitas umum.'::varchar) $$,
  'every transition records actor, statuses, and reason');
select is((select metadata ->> 'duplicateOfReportId' from public.report_events
  where report_id = '53000000-0000-4000-8000-000000000003' and event_type = 'report_marked_duplicate'),
  '53000000-0000-4000-8000-000000000001','duplicate event records target');
select is((select duplicate_of_report_id from public.reports where id = '53000000-0000-4000-8000-000000000003'),
  '53000000-0000-4000-8000-000000000001'::uuid,'duplicate report links target');
select is((select status::text || ':' || version from public.reports where id = '53000000-0000-4000-8000-000000000004'),
  'pending_verification:1','rejected duplicate attempt leaves report unchanged');
select is((select metadata ->> 'version' from public.report_events
  where report_id = '53000000-0000-4000-8000-000000000001' and event_type = 'report_verified'),
  '2','review event records resulting version');
select throws_ok($$ update public.report_events set reason = 'Diubah setelah keputusan dibuat.' where report_id = '53000000-0000-4000-8000-000000000002' $$,
  'P0409','report events are append only','events cannot be updated even by owner');
select throws_ok($$ delete from public.report_events where report_id = '53000000-0000-4000-8000-000000000002' $$,
  'P0409','report events are append only','events cannot be deleted directly');
select throws_ok($$ insert into public.report_events (report_id,actor_id,event_type,old_status,new_status)
  values ('53000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000003','report_rejected','pending_verification','rejected') $$,
  '23514',null,'rejection event without reason is rejected');
select throws_ok($$ insert into public.report_events (report_id,actor_id,event_type,old_status,new_status)
  values ('53000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000003','report_verified','needs_information','verified') $$,
  '23514',null,'event type must match its legal transition');
select throws_ok($$ insert into public.report_events (report_id,actor_id,event_type,old_status,new_status,reason)
  values ('53000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000003','report_marked_duplicate','pending_verification','duplicate','Objek sama dengan laporan sebelumnya.') $$,
  '23514',null,'duplicate event requires target metadata');
select throws_ok($$ insert into public.report_events (report_id,actor_id,event_type,new_status)
  values ('53000000-0000-4000-8000-000000000004','51000000-0000-4000-8000-000000000003','report_resolved','resolved') $$,
  '23514',null,'unknown event type is rejected');
select lives_ok($$ delete from public.reports where id = '53000000-0000-4000-8000-000000000007' $$,
  'trusted report deletion still cascades to events');
select is((select count(*) from public.report_events where report_id = '53000000-0000-4000-8000-000000000007'),
  0::bigint,'cascade removed only the deleted report events');

select * from finish();
rollback;
