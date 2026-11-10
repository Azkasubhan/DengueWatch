import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { AppShell } from "@/components/layout/AppShell";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  RowNumberCell,
  RowNumberHeader,
} from "@/components/ui/DataTable";
import { LinkButton } from "@/components/ui/LinkButton";
import { StatusBadge, reportStatusTone } from "@/components/ui/StatusBadge";
import {
  decidePortalAccess,
  getDefaultPortal,
  getVerifiedAreas,
} from "@/features/areas/access";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { getResidentReportSummary } from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportEventLabels,
  reportStatusLabels,
} from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";
import { cleanSimulationText } from "@/lib/format/text";

export const dynamic = "force-dynamic";

const residentEventTitle: Record<string, string> = {
  report_created: "Laporan dikirim dan menunggu pemeriksaan",
  report_verified: "Laporan diverifikasi pengelola wilayah",
  report_information_requested: "Pengelola meminta keterangan tambahan",
  report_information_added: "Keterangan tambahan telah dikirim",
  report_action_started: "Penanganan lapangan dimulai kader",
  report_resolved: "Penanganan selesai dan bukti disetujui",
  report_reopened: "Penanganan dibuka kembali oleh pengelola",
  report_rejected: "Laporan ditutup saat pemeriksaan",
  report_marked_duplicate: "Laporan digabungkan dengan temuan sebelumnya",
};

export default async function ResidentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string; logout?: string }>;
}) {
  const query = await searchParams;
  const result = await getAccessContext();
  if (result.kind === "unauthenticated") {
    redirect("/login?next=/app/beranda");
  }
  if (result.kind !== "authenticated") {
    return <ServiceUnavailable />;
  }
  if (result.context.role !== "resident") {
    const portal = getDefaultPortal(result.context.role);
    const params = new URLSearchParams();
    if (query.auth) params.set("auth", query.auth);
    if (query.logout) params.set("logout", query.logout);
    const qs = params.toString();
    redirect(qs ? `${portal}?${qs}` : portal);
  }

  const decision = decidePortalAccess(result.context, "resident");
  const area = getVerifiedAreas(result.context, "resident")[0];
  const summaryResult =
    decision.kind === "allowed"
      ? await getResidentReportSummary()
      : { data: null, error: null };

  const displayName = cleanSimulationText(result.context.displayName);
  const summary = summaryResult.data;
  const needsInfoList = summary?.needsInformationReports ?? [];
  const hasReports = (summary?.total ?? 0) > 0;

  return (
    <AppShell
      area={area}
      displayName={result.context.displayName}
      role="resident"
    >
      {query.logout === "failed" ? (
        <div className="mb-4 max-w-2xl">
          <Alert variant="error">
            Sesi belum dapat diakhiri. Coba keluar kembali.
          </Alert>
        </div>
      ) : null}

      {decision.kind === "pending" ? (
        <PendingArea />
      ) : (
        <div className="grid gap-5">
          {/* A. Header ringkas */}
          <header className="border-b border-[var(--border)] pb-3.5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
              Halo, {displayName}
            </h1>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)] sm:text-sm">
              Laporkan temuan lingkungan dan pantau tindak lanjut di wilayah
              Anda.
            </p>
          </header>

          {/* B. Panel utama pelaporan (Tombol Buat laporan di kanan) */}
          <section
            aria-labelledby="primary-report-cta"
            className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs sm:p-5"
          >
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <h2
                  id="primary-report-cta"
                  className="text-base font-bold tracking-tight text-[var(--foreground)] sm:text-lg"
                >
                  Temukan kondisi lingkungan yang perlu diperiksa?
                </h2>
                <p className="mt-1 text-xs text-[var(--muted-foreground)] sm:text-sm">
                  Kirim foto dan keterangan singkat. Pengelola wilayah akan
                  memeriksa laporan Anda.
                </p>
              </div>

              <div className="shrink-0">
                <LinkButton href="/app/laporan/buat">
                  <Plus aria-hidden="true" className="size-4" />
                  Buat laporan
                </LinkButton>
              </div>
            </div>
          </section>

          {/* C. Ringkasan laporan Anda (Number-first stat cards) */}
          {summary ? (
            <section aria-labelledby="resident-summary-heading">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2
                  id="resident-summary-heading"
                  className="text-sm font-bold text-[var(--foreground)]"
                >
                  Ringkasan laporan Anda
                </h2>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                  href="/app/laporan"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Total laporan
                  </p>
                  <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.total}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Seluruh laporan yang dikirim
                  </p>
                </Link>

                <Link
                  href="/app/laporan?status=pending_verification"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Menunggu pemeriksaan
                  </p>
                  <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.awaitingReview}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Sedang ditinjau pengelola wilayah
                  </p>
                </Link>

                <Link
                  href="/app/laporan?status=in_action"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Sedang ditangani
                  </p>
                  <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.inAction}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Terverifikasi dan ditindaklanjuti kader
                  </p>
                </Link>

                <Link
                  href="/app/laporan?status=resolved"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Selesai ditangani
                  </p>
                  <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.resolved}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Penanganan lapangan tuntas
                  </p>
                </Link>
              </div>
            </section>
          ) : null}

          {/* D. Perlu tanggapan Anda (Hanya tampil jika ada needs_information) */}
          {needsInfoList.length > 0 ? (
            <section
              aria-labelledby="needs-info-banner"
              className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div>
                  <h2
                    id="needs-info-banner"
                    className="text-base font-bold text-[var(--foreground)]"
                  >
                    Perlu tanggapan Anda ({needsInfoList.length})
                  </h2>
                  <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                    Pengelola wilayah meminta keterangan tambahan pada laporan
                    berikut.
                  </p>
                </div>
                {needsInfoList.length > 1 ? (
                  <Link
                    href="/app/laporan?status=needs_information"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    Lihat semua ({needsInfoList.length})
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : null}
              </div>

              <div className="mt-3 w-full max-w-full overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]">
                <DataTable caption="Daftar laporan yang memerlukan keterangan tambahan">
                  <DataTableHeader>
                    <RowNumberHeader />
                    <DataTableHeadCell>Laporan</DataTableHeadCell>
                    <DataTableHeadCell className="hidden md:table-cell">
                      Permintaan pengelola
                    </DataTableHeadCell>
                    <DataTableHeadCell align="right">
                      Tindakan
                    </DataTableHeadCell>
                  </DataTableHeader>
                  <DataTableBody>
                    {needsInfoList.slice(0, 3).map((item, index) => {
                      const reasonText = item.requestReason
                        ? cleanSimulationText(item.requestReason)
                        : "Pengelola wilayah meminta keterangan tambahan untuk memverifikasi lokasi temuan ini.";
                      return (
                        <DataTableRow key={item.id}>
                          <RowNumberCell number={index + 1} />
                          <DataTableCell className="max-w-[180px] sm:max-w-[220px]">
                            <Link
                              href={`/app/laporan/${item.id}#tanggapan-warga`}
                              className="block max-w-[180px] truncate font-bold text-[var(--foreground)] hover:text-[var(--primary)] sm:max-w-[220px]"
                            >
                              {reportCategoryLabels[item.category]}
                            </Link>
                            <p
                              title={reasonText}
                              className="mt-0.5 block max-w-[180px] truncate text-xs text-[var(--muted-foreground)] sm:max-w-[220px] md:hidden"
                            >
                              {reasonText}
                            </p>
                          </DataTableCell>
                          <DataTableCell className="hidden max-w-[220px] sm:max-w-[260px] md:table-cell">
                            <span
                              title={reasonText}
                              className="block max-w-[220px] truncate text-xs text-[var(--foreground)] sm:max-w-[260px]"
                            >
                              {reasonText}
                            </span>
                          </DataTableCell>
                          <DataTableCell
                            align="right"
                            className="w-[108px] whitespace-nowrap pr-3"
                          >
                            <Link
                              href={`/app/laporan/${item.id}#tanggapan-warga`}
                              className="inline-flex min-h-8 w-[92px] items-center justify-center gap-1 rounded-[var(--radius-control)] bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[var(--primary-hover)]"
                            >
                              <span>Lengkapi</span>
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
              </div>
            </section>
          ) : null}

          {/* E. Kabar terbaru laporan Anda (Full-width) */}
          <section
            aria-labelledby="updates-title"
            className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
              <div>
                <h2
                  id="updates-title"
                  className="text-base font-bold text-[var(--foreground)]"
                >
                  Kabar terbaru laporan Anda
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  Pembaruan terkini dari pemeriksaan dan tindak lanjut lapangan.
                </p>
              </div>
              {hasReports ? (
                <Link
                  href="/app/laporan"
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                >
                  Semua laporan
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              ) : null}
            </div>

            {summaryResult.error ? (
              <div className="mt-4">
                <Alert variant="error">
                  Pembaruan laporan belum dapat dimuat. Muat ulang halaman ini.
                </Alert>
              </div>
            ) : !hasReports ? (
              <div className="mt-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-4 py-6 text-center">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Belum ada laporan yang dikirim
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Gunakan tombol Buat laporan di atas apabila Anda menemukan
                  kondisi lingkungan yang berpotensi menampung air.
                </p>
              </div>
            ) : summary?.recentEvents.length ? (
              <div className="mt-3 w-full max-w-full overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]">
                <DataTable caption="Daftar pembaruan terbaru laporan warga">
                  <DataTableHeader>
                    <RowNumberHeader />
                    <DataTableHeadCell>Pembaruan</DataTableHeadCell>
                    <DataTableHeadCell className="hidden md:table-cell">
                      Kategori
                    </DataTableHeadCell>
                    <DataTableHeadCell className="hidden lg:table-cell">
                      Waktu
                    </DataTableHeadCell>
                    <DataTableHeadCell className="hidden sm:table-cell">
                      Status
                    </DataTableHeadCell>
                    <DataTableHeadCell align="right">
                      Tindakan
                    </DataTableHeadCell>
                  </DataTableHeader>
                  <DataTableBody>
                    {summary.recentEvents.map((ev, index) => {
                      const eventLabel =
                        residentEventTitle[ev.eventType] ??
                        reportEventLabels[ev.eventType] ??
                        "Pembaruan laporan";
                      const reasonClean = ev.reason
                        ? cleanSimulationText(ev.reason)
                        : null;

                      return (
                        <DataTableRow key={ev.id}>
                          <RowNumberCell number={index + 1} />
                          <DataTableCell className="max-w-[200px] sm:max-w-[260px]">
                            <Link
                              href={`/app/laporan/${ev.reportId}`}
                              title={eventLabel}
                              className="block max-w-[200px] truncate font-bold text-[var(--foreground)] hover:text-[var(--primary)] sm:max-w-[260px]"
                            >
                              {eventLabel}
                            </Link>
                            {reasonClean ? (
                              <p
                                title={reasonClean}
                                className="mt-0.5 block max-w-[200px] truncate text-xs text-[var(--muted-foreground)] sm:max-w-[260px]"
                              >
                                Catatan: {reasonClean}
                              </p>
                            ) : (
                              <p className="mt-0.5 block max-w-[200px] truncate text-xs text-[var(--muted-foreground)] sm:max-w-[260px] md:hidden">
                                {reportCategoryLabels[ev.category]} ·{" "}
                                {formatJakarta(ev.createdAt)} WIB
                              </p>
                            )}
                          </DataTableCell>
                          <DataTableCell className="hidden whitespace-nowrap md:table-cell">
                            <span className="text-xs font-medium text-[var(--foreground)]">
                              {reportCategoryLabels[ev.category]}
                            </span>
                          </DataTableCell>
                          <DataTableCell className="hidden whitespace-nowrap lg:table-cell">
                            <span className="text-xs text-[var(--muted-foreground)]">
                              {formatJakarta(ev.createdAt)} WIB
                            </span>
                          </DataTableCell>
                          <DataTableCell className="hidden whitespace-nowrap sm:table-cell">
                            <StatusBadge
                              tone={reportStatusTone[ev.reportStatus]}
                            >
                              {reportStatusLabels[ev.reportStatus]}
                            </StatusBadge>
                          </DataTableCell>
                          <DataTableCell
                            align="right"
                            className="w-[108px] whitespace-nowrap pr-3"
                          >
                            <Link
                              href={`/app/laporan/${ev.reportId}`}
                              className="inline-flex min-h-8 w-[92px] items-center justify-center gap-1 rounded-[var(--radius-control)] bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-[var(--primary-hover)]"
                            >
                              <span>Periksa</span>
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
              </div>
            ) : (
              <p className="mt-4 text-xs text-[var(--muted-foreground)]">
                Semua laporan yang memerlukan tindakan Anda sudah ditampilkan di
                atas. Buka{" "}
                <Link
                  href="/app/laporan"
                  className="font-semibold text-[var(--primary)] hover:underline"
                >
                  Laporan saya
                </Link>{" "}
                untuk melihat arsip lengkap.
              </p>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
