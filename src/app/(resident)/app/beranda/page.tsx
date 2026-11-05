import { redirect } from "next/navigation";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Droplets,
  FileText,
  Plus,
  Trash2,
} from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { AppShell } from "@/components/layout/AppShell";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  decidePortalAccess,
  getDefaultPortal,
  getVerifiedAreas,
} from "@/features/areas/access";
import { ReportListItem } from "@/features/reports/components/ReportListItem";
import {
  getResidentReportSummary,
  listReportRows,
} from "@/features/reports/data";
import { reportCategoryLabels } from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";
import { cleanSimulationText } from "@/lib/format/text";

export const dynamic = "force-dynamic";

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
  const [recent, summaryResult] =
    decision.kind === "allowed"
      ? await Promise.all([listReportRows(1, 6), getResidentReportSummary()])
      : [
          { data: null, error: null, count: 0 },
          { data: null, error: null },
        ];

  const displayName = cleanSimulationText(result.context.displayName);
  const summary = summaryResult.data;

  return (
    <AppShell
      area={area}
      displayName={result.context.displayName}
      role="resident"
    >
      {query.logout === "failed" ? (
        <div className="mb-5 max-w-2xl">
          <Alert variant="error">
            Sesi belum dapat diakhiri. Coba keluar kembali.
          </Alert>
        </div>
      ) : null}
      {decision.kind === "pending" ? (
        <PendingArea />
      ) : (
        <div className="grid gap-6">
          <PageHeader
            title={`Halo, ${displayName}`}
            description="Pantau tindak lanjut laporan Anda atau laporkan potensi tempat perkembangbiakan nyamuk di sekitar rumah."
            actions={
              <LinkButton href="/app/laporan/buat">
                <Plus aria-hidden="true" className="size-4" />
                Buat laporan
              </LinkButton>
            }
          />

          {/* 2. Ringkasan laporan pribadi dari seluruh laporan */}
          {summary ? (
            <section aria-label="Ringkasan laporan pribadi">
              <div className="grid gap-3 sm:grid-cols-3">
                <Link
                  href="/app/laporan?status=pending_verification"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Menunggu pemeriksaan
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.awaitingReview}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Sedang ditinjau pengelola wilayah
                  </p>
                </Link>

                <Link
                  href="/app/laporan?status=in_action"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Sedang ditangani
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.inAction}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Terverifikasi & ditindaklanjuti kader
                  </p>
                </Link>

                <Link
                  href="/app/laporan?status=resolved"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Selesai ditangani
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.resolved}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Bukti penanganan telah disetujui
                  </p>
                </Link>
              </div>
            </section>
          ) : null}

          {/* 3. Pemberitahuan laporan yang perlu dilengkapi, hanya jika ada */}
          {summary && summary.needsInformationCount > 0 ? (
            <section
              aria-labelledby="needs-info-banner"
              className="rounded-[var(--radius-card)] border border-[var(--warning)] bg-[var(--warning-subtle)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-5 shrink-0 text-[var(--warning)]"
                  />
                  <div>
                    <h2
                      id="needs-info-banner"
                      className="text-sm font-bold text-[var(--foreground)]"
                    >
                      {summary.needsInformationCount} laporan membutuhkan
                      informasi tambahan dari Anda
                    </h2>
                    <p className="mt-1 text-xs text-[var(--foreground)] opacity-90">
                      Pengelola wilayah memerlukan keterangan lanjutan sebelum
                      menugaskan kader ke lokasi.
                    </p>
                  </div>
                </div>
                <Link
                  href="/app/laporan?status=needs_information"
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] shadow-xs transition hover:bg-[var(--background)]"
                >
                  Lihat semua
                  <ArrowRight aria-hidden="true" className="size-3.5" />
                </Link>
              </div>
              <ul className="mt-3 grid gap-2">
                {summary.needsInformationReports.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/app/laporan/${item.id}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-sm transition hover:border-[var(--primary)]"
                    >
                      <span className="font-semibold text-[var(--foreground)]">
                        {reportCategoryLabels[item.category]}{" "}
                        <span className="font-mono text-xs font-normal text-[var(--muted-foreground)]">
                          ({item.publicReference})
                        </span>
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                        Lengkapi keterangan
                        <ArrowRight aria-hidden="true" className="size-3.5" />
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* 4. Daftar laporan terbaru */}
          <section aria-labelledby="recent-title">
            <div className="mb-3 flex items-center justify-between gap-4">
              <div>
                <h2 id="recent-title" className="text-lg font-bold">
                  Laporan terbaru
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Ringkasan status temuan lingkungan yang baru Anda kirimkan.
                </p>
              </div>
              {recent.data?.length ? (
                <Link
                  href="/app/laporan"
                  className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:underline"
                >
                  Lihat semua laporan
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
              ) : null}
            </div>
            {recent.error ? (
              <Alert variant="error">
                Laporan terbaru belum dapat dimuat. Muat ulang halaman ini.
              </Alert>
            ) : recent.data?.length ? (
              <ul className="grid gap-2.5">
                {recent.data.map((report) => (
                  <li key={report.id}>
                    <ReportListItem
                      href={`/app/laporan/${report.id}`}
                      report={report}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={FileText}
                title="Belum ada laporan"
                description="Temuan pertama Anda akan muncul di sini beserta status penanganannya."
              />
            )}
          </section>

          {/* 5. Panduan singkat kapan harus melapor */}
          <section
            aria-labelledby="guide-title"
            className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 id="guide-title" className="text-sm font-bold">
                  Panduan singkat: Kapan perlu membuat laporan?
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Laporkan kondisi lingkungan yang berpotensi menjadi tempat
                  perkembangbiakan nyamuk di area bersama.
                </p>
              </div>
            </div>
            <div className="mt-3.5 grid gap-3 sm:grid-cols-3">
              <div className="flex items-start gap-2.5 rounded-[var(--radius-control)] bg-[var(--background)] p-3">
                <Droplets
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-[var(--primary)]"
                />
                <div className="text-xs">
                  <p className="font-semibold text-[var(--foreground)]">
                    Wadah & penampungan terbuka
                  </p>
                  <p className="mt-0.5 text-[var(--muted-foreground)]">
                    Ember, drum, bak, atau ban bekas berisi air yang tidak
                    tertutup di fasilitas umum.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-[var(--radius-control)] bg-[var(--background)] p-3">
                <Clock
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-[var(--primary)]"
                />
                <div className="text-xs">
                  <p className="font-semibold text-[var(--foreground)]">
                    Genangan & saluran tersumbat
                  </p>
                  <p className="mt-0.5 text-[var(--muted-foreground)]">
                    Selokan mampet atau cekungan air yang tidak surut lebih dari
                    3 hari setelah hujan.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2.5 rounded-[var(--radius-control)] bg-[var(--background)] p-3">
                <Trash2
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-[var(--primary)]"
                />
                <div className="text-xs">
                  <p className="font-semibold text-[var(--foreground)]">
                    Tumpukan barang menampung air
                  </p>
                  <p className="mt-0.5 text-[var(--muted-foreground)]">
                    Botol, kaleng, atau sampah wadah di lahan kosong yang dapat
                    menampung air hujan.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </AppShell>
  );
}
