begin;

-- The link trigger, cadre suggestion reader, and 24-hour purge all look up analyses by report.
create index idx_ai_analyses_report on public.ai_analyses (report_id) where report_id is not null;

commit;
