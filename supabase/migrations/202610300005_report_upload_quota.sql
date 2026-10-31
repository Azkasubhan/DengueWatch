begin;

create function private.enforce_report_upload_quota()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('report_upload:' || new.created_by::text, 0)
  );
  if (select count(*) from public.report_uploads as upload
      where upload.created_by = new.created_by
        and upload.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'upload rate limit' using errcode = 'P0429';
  end if;
  return new;
end;
$$;

create trigger report_upload_quota_before_insert
before insert on public.report_uploads
for each row execute function private.enforce_report_upload_quota();

revoke execute on function private.enforce_report_upload_quota() from public, anon, authenticated;

commit;
