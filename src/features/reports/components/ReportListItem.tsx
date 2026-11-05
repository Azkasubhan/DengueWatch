import Image from "next/image";
import Link from "next/link";
import { ChevronRight, Clock3, ImageIcon, MapPin } from "lucide-react";
import { StatusBadge, reportStatusTone } from "@/components/ui/StatusBadge";
import type { ReportListRow, ReportSummary } from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportStatusLabels,
} from "@/features/reports/validation";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

function waitingDays(report: { status: string; submittedAt: string }) {
  if (report.status !== "pending_verification") return 0;
  return Math.max(
    0,
    Math.floor((Date.now() - Date.parse(report.submittedAt)) / 86_400_000),
  );
}

export function ReportListItem({
  report,
  href,
  areaName,
}: {
  report: ReportSummary & Partial<ReportListRow>;
  href: string;
  areaName?: string;
}) {
  const days = waitingDays(report);
  const locationLabel =
    report.locationNote ||
    (report.hasCoordinates ? "Koordinat GPS tercatat" : null);

  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 transition-colors hover:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] sm:flex-row sm:items-center sm:justify-between sm:p-4"
    >
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        {report.thumbnailUrl ? (
          <Image
            unoptimized
            src={report.thumbnailUrl}
            alt={`Foto ${reportCategoryLabels[report.category]}`}
            width={64}
            height={64}
            className="size-16 shrink-0 rounded-lg border border-[var(--border)] object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="grid size-16 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]"
          >
            <ImageIcon className="size-6" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
            <span className="font-bold text-[var(--foreground)] group-hover:text-[var(--primary)]">
              {reportCategoryLabels[report.category]}
            </span>
            <span className="text-xs font-semibold text-[var(--muted-foreground)]">
              {report.publicReference}
            </span>
          </div>

          <p className="mt-1 line-clamp-1 break-words text-sm text-[var(--muted-foreground)]">
            {report.description}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
            <span>{dateFormat.format(new Date(report.submittedAt))}</span>
            {locationLabel ? (
              <span className="inline-flex max-w-56 items-center gap-1 truncate">
                <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">{locationLabel}</span>
              </span>
            ) : null}
            {areaName ? <span>· {areaName}</span> : null}
            {report.status === "pending_verification" ? (
              <span className="inline-flex items-center gap-1 font-semibold text-[var(--warning)]">
                <Clock3 aria-hidden="true" className="size-3.5" />
                {days > 0 ? `Menunggu ${days} hari` : "Masuk hari ini"}
              </span>
            ) : null}
            {report.needsMandatoryTask ? (
              <span className="rounded bg-[var(--info-subtle)] px-1.5 py-0.5 font-semibold text-[var(--info)]">
                Perlu penugasan kader
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)]/60 pt-2.5 sm:border-t-0 sm:pt-0">
        <StatusBadge tone={reportStatusTone[report.status]}>
          {reportStatusLabels[report.status]}
        </StatusBadge>
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
          <span className="sm:sr-only">Lihat detail</span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
          />
        </span>
      </div>
    </Link>
  );
}
