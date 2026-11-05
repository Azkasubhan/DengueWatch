import Link from "next/link";
import { ArrowRight, Clock3 } from "lucide-react";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  RowNumberCell,
  RowNumberHeader,
} from "@/components/ui/DataTable";
import { PhotoLightboxButton } from "@/components/ui/PhotoLightboxButton";
import { StatusBadge, reportStatusTone } from "@/components/ui/StatusBadge";
import type { ReportListRow, ReportSummary } from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportStatusLabels,
} from "@/features/reports/validation";
import { cleanSimulationText } from "@/lib/format/text";

const dateFormat = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

function waitingDays(report: { status: string; submittedAt: string }) {
  if (
    report.status !== "pending_verification" &&
    report.status !== "needs_information"
  ) {
    return 0;
  }
  return Math.max(
    0,
    Math.floor((Date.now() - Date.parse(report.submittedAt)) / 86_400_000),
  );
}

function getLocationLabel(report: ReportSummary & Partial<ReportListRow>) {
  if (report.locationNote && report.locationNote.trim()) {
    return cleanSimulationText(report.locationNote);
  }
  if (report.hasCoordinates) {
    return "Koordinat GPS tercatat";
  }
  return "Belum dicantumkan";
}

function getReportAction(
  report: ReportSummary & Partial<ReportListRow>,
  role: "resident" | "manager",
  baseHref: string,
): { label: string; href: string; isPrimary?: boolean } {
  if (role === "resident") {
    if (report.status === "needs_information") {
      return {
        label: "Lengkapi",
        href: `${baseHref}/${report.id}#tanggapan-warga`,
        isPrimary: true,
      };
    }
    return {
      label: "Periksa",
      href: `${baseHref}/${report.id}`,
      isPrimary: false,
    };
  }

  // Manager actions
  if (report.needsMandatoryTask) {
    return {
      label: "Buat tugas",
      href: `${baseHref}/${report.id}#buat-tugas`,
      isPrimary: true,
    };
  }
  return {
    label: "Periksa",
    href: `${baseHref}/${report.id}`,
    isPrimary: true,
  };
}

export function ReportTable({
  reports,
  role,
  baseHref,
  page = 1,
  pageSize = 10,
  areaNamesById,
  showAreaName = false,
}: {
  reports: Array<ReportSummary & Partial<ReportListRow>>;
  role: "resident" | "manager";
  baseHref: string;
  page?: number;
  pageSize?: number;
  areaNamesById?: Map<string, string>;
  showAreaName?: boolean;
}) {
  const caption =
    role === "resident"
      ? "Daftar laporan lingkungan warga"
      : "Daftar antrean verifikasi laporan lingkungan";

  return (
    <DataTableContainer>
      <DataTable caption={caption}>
        <DataTableHeader>
          <RowNumberHeader />
          <DataTableHeadCell className="min-w-[180px]">
            Laporan
          </DataTableHeadCell>
          <DataTableHeadCell className="hidden min-w-[150px] md:table-cell">
            Lokasi
          </DataTableHeadCell>
          <DataTableHeadCell className="hidden whitespace-nowrap md:table-cell">
            {role === "manager" ? "Dikirim / Menunggu" : "Dikirim"}
          </DataTableHeadCell>
          <DataTableHeadCell className="hidden whitespace-nowrap md:table-cell">
            Status
          </DataTableHeadCell>
          <DataTableHeadCell className="hidden whitespace-nowrap md:table-cell">
            Foto
          </DataTableHeadCell>
          <DataTableHeadCell className="w-[110px] whitespace-nowrap text-right pr-4 sm:pr-6">
            Tindakan
          </DataTableHeadCell>
        </DataTableHeader>

        <DataTableBody>
          {reports.map((report, index) => {
            const rowNumber = (page - 1) * pageSize + index + 1;
            const days = waitingDays(report);
            const locationText = getLocationLabel(report);
            const isLocationMissing = locationText === "Belum dicantumkan";
            const areaName = showAreaName
              ? areaNamesById?.get(report.areaId)
              : undefined;
            const action = getReportAction(report, role, baseHref);
            const photoCount = report.photoCount ?? 0;
            const submittedDate = dateFormat.format(
              new Date(report.submittedAt),
            );
            const cleanDescription = cleanSimulationText(report.description);

            return (
              <DataTableRow key={report.id}>
                {/* Kolom 1 (Paling Kiri): No. */}
                <RowNumberCell number={rowNumber} />

                {/* Kolom 2: Laporan (Kategori + 1 baris deskripsi dengan ellipsis) */}
                <DataTableCell className="max-w-[240px] sm:max-w-[280px]">
                  <div className="min-w-0">
                    <Link
                      href={`${baseHref}/${report.id}`}
                      title={reportCategoryLabels[report.category]}
                      className="block truncate font-bold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    >
                      {reportCategoryLabels[report.category]}
                      <span className="sr-only"> — {report.description}</span>
                    </Link>
                    <p
                      title={cleanDescription}
                      className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]"
                    >
                      {cleanDescription}
                    </p>

                    {/* Ringkasan & Pembuka Eksplisit pada Mobile (< md) */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 md:hidden">
                      <StatusBadge tone={reportStatusTone[report.status]}>
                        {reportStatusLabels[report.status]}
                      </StatusBadge>
                      {role === "manager" && report.needsMandatoryTask ? (
                        <span className="rounded bg-[var(--info-subtle)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--info)]">
                          Perlu penugasan
                        </span>
                      ) : null}
                      <span className="text-[11px] text-[var(--muted-foreground)]">
                        · {submittedDate}
                      </span>
                    </div>

                    <details className="mt-1.5 text-xs md:hidden">
                      <summary className="cursor-pointer font-semibold text-[var(--primary)] hover:underline">
                        Rincian lokasi & foto
                      </summary>
                      <dl className="mt-1.5 grid gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-2 text-xs">
                        <div className="flex justify-between gap-2">
                          <dt className="shrink-0 text-[var(--muted-foreground)]">
                            Lokasi:
                          </dt>
                          <dd className="min-w-0 truncate text-right font-medium text-[var(--foreground)]">
                            {locationText}
                            {areaName
                              ? ` (${cleanSimulationText(areaName)})`
                              : ""}
                          </dd>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <dt className="text-[var(--muted-foreground)]">
                            Foto:
                          </dt>
                          <dd>
                            <PhotoLightboxButton
                              count={photoCount}
                              fetchUrl={`/api/v1/reports/${report.id}/photos`}
                              labelType="foto"
                              title={`Foto Laporan · ${reportCategoryLabels[report.category]}`}
                              subtitle={`${reportCategoryLabels[report.category]} · ${locationText}`}
                            />
                          </dd>
                        </div>
                      </dl>
                    </details>
                  </div>
                </DataTableCell>

                {/* Kolom 3: Lokasi */}
                <DataTableCell className="hidden max-w-[200px] lg:max-w-[240px] md:table-cell">
                  <span
                    className={`block truncate text-xs ${
                      isLocationMissing
                        ? "italic text-[var(--muted-foreground)]"
                        : "font-medium text-[var(--foreground)]"
                    }`}
                    title={locationText}
                  >
                    {locationText}
                  </span>
                  {areaName ? (
                    <span
                      title={cleanSimulationText(areaName)}
                      className="mt-0.5 block truncate text-[11px] text-[var(--muted-foreground)]"
                    >
                      {cleanSimulationText(areaName)}
                    </span>
                  ) : null}
                </DataTableCell>

                {/* Kolom 4: Dikirim / Menunggu */}
                <DataTableCell className="hidden whitespace-nowrap md:table-cell">
                  <span className="block text-xs font-medium text-[var(--foreground)]">
                    {submittedDate}
                  </span>
                  {role === "manager" &&
                  report.status === "pending_verification" ? (
                    <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--warning)]">
                      <Clock3 aria-hidden="true" className="size-3 shrink-0" />
                      {days > 0 ? `Menunggu ${days} hari` : "Masuk hari ini"}
                    </span>
                  ) : role === "manager" &&
                    report.status === "needs_information" ? (
                    <span className="mt-0.5 block text-[11px] text-[var(--muted-foreground)]">
                      {days > 0
                        ? `Menunggu warga ${days} hari`
                        : "Diminta hari ini"}
                    </span>
                  ) : null}
                </DataTableCell>

                {/* Kolom 5: Status */}
                <DataTableCell className="hidden whitespace-nowrap md:table-cell">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge tone={reportStatusTone[report.status]}>
                      {reportStatusLabels[report.status]}
                    </StatusBadge>
                    {role === "manager" && report.needsMandatoryTask ? (
                      <span className="rounded bg-[var(--info-subtle)] px-1.5 py-0.5 text-[11px] font-semibold text-[var(--info)]">
                        Perlu penugasan
                      </span>
                    ) : null}
                  </div>
                </DataTableCell>

                {/* Kolom 6: Foto */}
                <DataTableCell className="hidden whitespace-nowrap md:table-cell">
                  <PhotoLightboxButton
                    count={photoCount}
                    fetchUrl={`/api/v1/reports/${report.id}/photos`}
                    labelType="foto"
                    title={`Foto Laporan · ${reportCategoryLabels[report.category]}`}
                    subtitle={`${reportCategoryLabels[report.category]} · ${locationText}`}
                  />
                </DataTableCell>

                {/* Kolom 7: Tindakan */}
                <DataTableCell className="w-[110px] whitespace-nowrap text-right pr-4 sm:pr-6">
                  <Link
                    href={action.href}
                    className={`inline-flex min-h-8 w-[92px] items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
                      action.isPrimary
                        ? "bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)] shadow-2xs"
                        : "border border-[var(--control-border)] bg-[var(--background)] text-[var(--foreground)] hover:border-[var(--primary)] hover:text-[var(--primary)]"
                    }`}
                  >
                    <span>{action.label}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0"
                    />
                  </Link>
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>
    </DataTableContainer>
  );
}
