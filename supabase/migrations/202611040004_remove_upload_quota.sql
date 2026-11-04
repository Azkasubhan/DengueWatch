-- T31: remove the 30 uploads per hour limit (T13/T14). Uploads still require an
-- authenticated owner, a validated private image, a short lease, and AI keeps its quota.

drop trigger report_upload_quota_before_insert on public.report_uploads;
drop function private.enforce_report_upload_quota();
-- The attempts ledger existed only for this quota.
drop table public.report_upload_attempts;
