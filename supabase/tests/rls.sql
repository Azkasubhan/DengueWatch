begin;

create extension if not exists pgtap with schema extensions;
select plan(53);

select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'areas', 'areas table exists');
select has_table('public', 'area_memberships', 'memberships table exists');
select is(
  (select relrowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.areas'::regclass),
  true,
  'areas has RLS enabled'
);
select is(
  (select relrowsecurity from pg_class where oid = 'public.area_memberships'::regclass),
  true,
  'memberships has RLS enabled'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.profiles'::regclass),
  true,
  'profiles forces RLS for table owners without bypassrls'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.areas'::regclass),
  true,
  'areas forces RLS for table owners without bypassrls'
);
select is(
  (select relforcerowsecurity from pg_class where oid = 'public.area_memberships'::regclass),
  true,
  'memberships forces RLS for table owners without bypassrls'
);
select ok(
  not has_table_privilege('anon', 'public.profiles', 'SELECT'),
  'anonymous cannot select profiles'
);
select ok(
  not has_table_privilege('anon', 'public.areas', 'SELECT'),
  'anonymous cannot select areas'
);
select ok(
  not has_table_privilege('anon', 'public.area_memberships', 'SELECT'),
  'anonymous cannot select memberships'
);
select ok(
  has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE'),
  'authenticated user may update display name'
);
select ok(
  not has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE'),
  'authenticated user cannot update role'
);
select ok(
  not has_table_privilege('authenticated', 'public.area_memberships', 'INSERT'),
  'authenticated user cannot create memberships'
);
select ok(
  not has_column_privilege('authenticated', 'public.area_memberships', 'verified_at', 'UPDATE'),
  'authenticated user cannot approve a membership'
);
select ok(
  has_table_privilege('service_role', 'public.areas', 'SELECT, INSERT, UPDATE')
    and not has_table_privilege('service_role', 'public.areas', 'DELETE'),
  'service role has only the area operations required by the seed'
);
select ok(
  has_table_privilege('service_role', 'public.profiles', 'SELECT, UPDATE')
    and not has_table_privilege('service_role', 'public.profiles', 'INSERT, DELETE'),
  'service role can maintain seeded profiles without creating or deleting them directly'
);
select ok(
  has_table_privilege('service_role', 'public.area_memberships', 'SELECT, INSERT, UPDATE')
    and not has_table_privilege('service_role', 'public.area_memberships', 'DELETE'),
  'service role can maintain seeded memberships without deleting them'
);
select ok(
  not has_function_privilege('anon', 'private.current_profile_role()', 'EXECUTE'),
  'anonymous cannot execute the role helper'
);
select ok(
  not has_function_privilege(
    'anon',
    'private.has_role_area_access(uuid,public.app_role)',
    'EXECUTE'
  ),
  'anonymous cannot execute the role-area helper'
);
select ok(
  not has_function_privilege(
    'authenticated',
    'private.has_verified_area_membership(uuid,public.area_membership_type)',
    'EXECUTE'
  ),
  'authenticated cannot call the obsolete role-agnostic membership helper'
);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'resident-one@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Resident One"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'resident-two@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Resident Two"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'cadre-a@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Cadre A"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'cadre-b@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Cadre B"}',
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000005',
    'authenticated',
    'authenticated',
    'manager@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"display_name":"Manager"}',
    now(),
    now()
  );

select is(
  (select count(*) from public.profiles where role = 'resident'),
  5::bigint,
  'profile trigger provisions every new user as resident'
);

update public.profiles
set role = 'cadre'
where id in (
  '10000000-0000-0000-0000-000000000003',
  '10000000-0000-0000-0000-000000000004'
);
update public.profiles
set role = 'manager'
where id = '10000000-0000-0000-0000-000000000005';

insert into public.areas (id, code, name, is_demo)
values
  ('20000000-0000-0000-0000-000000000001', 'TEST-A', 'Test Area A', true),
  ('20000000-0000-0000-0000-000000000002', 'TEST-B', 'Test Area B', true);

select throws_ok(
  $$ insert into public.area_memberships (profile_id, area_id, membership_type, verified_at)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'assigned_cadre', now()) $$,
  '23514',
  'membership type does not match profile role',
  'database rejects a role-membership mismatch even for a privileged writer'
);

insert into public.area_memberships (
  profile_id,
  area_id,
  membership_type,
  verified_at
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'resident',
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'resident',
    null
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    'assigned_cadre',
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000002',
    'assigned_cadre',
    now()
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '20000000-0000-0000-0000-000000000001',
    'manager',
    now()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$ select id from public.profiles order by id $$,
  $$ values ('10000000-0000-0000-0000-000000000001'::uuid) $$,
  'resident can read only their own profile'
);
select results_eq(
  $$ select profile_id from public.area_memberships order by profile_id $$,
  $$ values ('10000000-0000-0000-0000-000000000001'::uuid) $$,
  'resident can read only their own memberships'
);
select results_eq(
  $$ select id from public.areas order by id $$,
  $$ values ('20000000-0000-0000-0000-000000000001'::uuid) $$,
  'resident can read only an area with verified membership'
);
select lives_ok(
  $$ update public.profiles set display_name = 'Resident Updated' where id = '10000000-0000-0000-0000-000000000001' $$,
  'resident can update their own safe profile field'
);
select results_eq(
  $$ update public.profiles set display_name = 'Forbidden Update' where id = '10000000-0000-0000-0000-000000000002' returning id $$,
  $$ select null::uuid where false $$,
  'resident cannot update another profile'
);
select results_eq(
  $$ select private.current_profile_role()::text $$,
  $$ values ('resident'::text) $$,
  'role helper returns only the current resident role'
);
select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000001',
    'resident'
  )),
  true,
  'resident has resident access to their verified area'
);
select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000001',
    'cadre'
  )),
  false,
  'resident cannot claim cadre access in the same area'
);
select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000002',
    'resident'
  )),
  false,
  'resident cannot access another area'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$ select id from public.profiles order by id $$,
  $$ values ('10000000-0000-0000-0000-000000000003'::uuid) $$,
  'cadre can read only their own profile'
);
select results_eq(
  $$ select id from public.areas order by id $$,
  $$ values ('20000000-0000-0000-0000-000000000001'::uuid) $$,
  'cadre can read only the assigned verified area'
);
select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000001',
    'cadre'
  )),
  true,
  'cadre has cadre access to the assigned area'
);
select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000001',
    'manager'
  )),
  false,
  'cadre cannot claim manager access'
);
select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000002',
    'cadre'
  )),
  false,
  'cadre cannot access another cadre area'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000002',
    'cadre'
  )),
  true,
  'second cadre has access to their own assigned area'
);
select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000001',
    'cadre'
  )),
  false,
  'second cadre cannot access the first cadre area'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$ select id from public.areas order by id $$,
  $$ values ('20000000-0000-0000-0000-000000000001'::uuid) $$,
  'manager can read only the assigned verified area'
);
select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000001',
    'manager'
  )),
  true,
  'manager has manager access to the assigned area'
);
select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000001',
    'cadre'
  )),
  false,
  'manager does not receive cadre authority'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select is(
  (select count(*) from public.areas),
  0::bigint,
  'unverified resident cannot read an operational area'
);
select is(
  (select private.has_role_area_access(
    '20000000-0000-0000-0000-000000000002',
    'resident'
  )),
  false,
  'unverified membership does not grant operational access'
);

reset role;

grant insert on public.area_memberships to authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_like(
  $$ insert into public.area_memberships (profile_id, area_id, membership_type, verified_at)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'resident', now()) $$,
  '%row-level security policy%area_memberships%',
  'RLS denies self-assignment even after an accidental INSERT grant'
);

reset role;
revoke insert on public.area_memberships from authenticated;

grant update (verified_at) on public.area_memberships to authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
set local role authenticated;

select results_eq(
  $$ update public.area_memberships set verified_at = now()
     where profile_id = '10000000-0000-0000-0000-000000000002'
     returning id $$,
  $$ select null::uuid where false $$,
  'RLS denies self-approval even after an accidental verified_at grant'
);

reset role;
revoke update (verified_at) on public.area_memberships from authenticated;

grant update (role) on public.profiles to authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
set local role authenticated;

select throws_ok(
  $$ update public.profiles set role = 'manager' where id = '10000000-0000-0000-0000-000000000001' $$,
  '42501',
  'profile role changes require a trusted administrative process',
  'role trigger blocks self-promotion even after an accidental broad grant'
);
select throws_ok(
  $$ insert into public.area_memberships (profile_id, area_id, membership_type, verified_at)
     values ('10000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'assigned_cadre', now()) $$,
  '42501',
  'permission denied for table area_memberships',
  'resident cannot assign themselves as cadre'
);
select throws_ok(
  $$ update public.area_memberships set verified_at = now() where profile_id = '10000000-0000-0000-0000-000000000001' $$,
  '42501',
  'permission denied for table area_memberships',
  'resident cannot approve their own membership'
);

reset role;
revoke update (role) on public.profiles from authenticated;

select ok(
  (
    select procedure.prosecdef
      and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=""']::text[]
    from pg_proc as procedure
    where procedure.oid = 'private.current_profile_role()'::regprocedure
  ),
  'role helper is SECURITY DEFINER with an empty search path'
);
select ok(
  (
    select procedure.prosecdef
      and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=""']::text[]
    from pg_proc as procedure
    where procedure.oid = 'private.has_verified_area_membership(uuid,public.area_membership_type)'::regprocedure
  ),
  'membership helper is SECURITY DEFINER with an empty search path'
);
select ok(
  (
    select procedure.prosecdef
      and coalesce(procedure.proconfig, array[]::text[]) @> array['search_path=""']::text[]
    from pg_proc as procedure
    where procedure.oid = 'private.has_role_area_access(uuid,public.app_role)'::regprocedure
  ),
  'role-area helper is SECURITY DEFINER with an empty search path'
);

select * from finish();
rollback;

