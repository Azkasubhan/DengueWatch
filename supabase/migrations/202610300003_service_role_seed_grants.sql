begin;

-- The local demo seed uses the server-only secret key. BYPASSRLS does not
-- replace PostgreSQL table privileges, so grant only the operations used by
-- the idempotent seed and deliberately omit DELETE.
grant select, insert, update on table public.areas to service_role;
grant select, update on table public.profiles to service_role;
grant select, insert, update on table public.area_memberships to service_role;

commit;
