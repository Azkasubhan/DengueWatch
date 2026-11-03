import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StatusBadge, reportStatusTone } from "@/components/ui/StatusBadge";
import type { ReportSummary } from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportStatusLabels,
} from "@/features/reports/validation";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

export function ReportListItem({
  report,
  href,
}: {
  report: ReportSummary;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-start gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 transition-colors hover:border-[var(--control-border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm font-semibold text-[var(--muted-foreground)]">
            {report.publicReference}
          </span>
          <StatusBadge tone={reportStatusTone[report.status]}>
            {reportStatusLabels[report.status]}
          </StatusBadge>
        </div>
        <p className="mt-2 font-semibold">
          {reportCategoryLabels[report.category]}
        </p>
        <p className="mt-1 line-clamp-2 break-words text-[var(--muted-foreground)]">
          {report.description}
        </p>
        <p className="mt-3 text-sm text-[var(--muted-foreground)]">
          {dateFormat.format(new Date(report.submittedAt))}
          {report.isDemo ? " · Data simulasi" : ""}
        </p>
      </div>
      <ChevronRight
        aria-hidden="true"
        className="mt-1 size-5 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5"
      />
    </Link>
  );
}
