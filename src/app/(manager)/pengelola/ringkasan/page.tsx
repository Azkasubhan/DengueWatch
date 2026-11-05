import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, MapPin } from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { DailyTrendChart } from "@/features/analytics/components/DailyTrendChart";
import {
  getManagerDailyTrend,
  getManagerOperationalOverview,
  getManagerSummary,
} from "@/features/analytics/data";
import { summaryQuerySchema } from "@/features/analytics/validation";
import { FindingsMap } from "@/features/map/components/FindingsMap";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { controlClass } from "@/features/reports/components/reportAction";
import { listMapReports } from "@/features/reports/data";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const formatDate = (date: string) =>
  formatJakarta(`${date}T00:00:00+07:00`, false);
// Durations are rounded to 0.1 hour in SQL; 0 means under six minutes.
const hours = (value: number | null) =>
  value === null
    ? "—"
    : value === 0
      ? "< 0,1 jam"
      : `${number.format(value)} jam`;

export default async function ManagerSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{
    logout?: string;
    areaId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { logout, ...filters } = await searchParams;
  const result = await getAccessContext();
  if (result.kind === "unauthenticated") {
    redirect("/login?next=/pengelola/ringkasan");
  }
  if (result.kind !== "authenticated") {
    return <ServiceUnavailable />;
  }

  const decision = decidePortalAccess(result.context, "manager");
  if (decision.kind === "forbidden") {
    redirect("/forbidden");
  }
  const areas = getVerifiedAreas(result.context, "manager");
  const values = Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => typeof value === "string" && value.trim(),
    ),
  );
  const parsed =
    decision.kind === "allowed" ? summaryQuerySchema().safeParse(values) : null;
  const selectedAreaId =
    values.areaId && areas.some((a) => a.id === values.areaId)
      ? values.areaId
      : undefined;

  const [summary, operationalResult, trendResult, mapResult] =
    decision.kind === "allowed"
      ? await Promise.all([
          parsed?.success
            ? getManagerSummary(parsed.data)
            : Promise.resolve(null),
          getManagerOperationalOverview(selectedAreaId ?? null),
          parsed?.success
            ? getManagerDailyTrend(parsed.data)
            : Promise.resolve({ data: null, error: null }),
          listMapReports({
            areaId: selectedAreaId,
            from: parsed?.success ? parsed.data.from : undefined,
            to: parsed?.success ? parsed.data.to : undefined,
          }),
        ])
      : [
          null,
          { data: null, error: null },
          { data: null, error: null },
          { data: null, error: null },
        ];

  const data = summary?.data;
  const operational = operationalResult.data;
  const trendPoints = trendResult.data ?? [];
  const mapData = mapResult.data ?? {
    points: [],
    missingCoordinatesCount: 0,
    totalMatching: 0,
    withCoordinatesCount: 0,
  };

  return (
    <AppShell
      area={areas[0]}
      displayName={result.context.displayName}
      role="manager"
    >
      {logout === "failed" ? (
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
            title="Ringkasan laporan wilayah"
            description="Pantau antrean operasional yang membutuhkan tindakan segera dan evaluasi statistik penanganan periode terpilih."
            actions={
              <Link
                href="/pengelola/peta"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]"
              >
                <MapPin
                  aria-hidden="true"
                  className="size-4 text-[var(--primary)]"
                />
                Peta temuan
              </Link>
            }
          />

          {/* BAGIAN 1: ANTREAN OPERASIONAL SAAT INI (Tidak tersembunyi oleh filter periode) */}
          {operational ? (
            <section
              aria-labelledby="operational-queue-heading"
              className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-3">
                <div>
                  <h2
                    id="operational-queue-heading"
                    className="text-base font-bold text-[var(--foreground)]"
                  >
                    Antrean Operasional Saat Ini
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Pekerjaan terbuka lintas periode yang memerlukan keputusan
                    atau penugasan pengelola sekarang.
                  </p>
                </div>
                <span className="rounded-full bg-[var(--primary-subtle)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">
                  Status langsung
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                  href="/pengelola/verifikasi?status=pending_verification"
                  className="group block rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Perlu diverifikasi
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {operational.pendingVerificationCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {operational.needsInformationCount > 0
                      ? `+ ${operational.needsInformationCount} tunggu info warga`
                      : "Menunggu keputusan Anda"}
                  </p>
                </Link>

                <Link
                  href="/pengelola/verifikasi?status=verified&tab=needs_task"
                  className="group block rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Belum ada tugas wajib aktif
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {operational.verifiedWithoutTaskCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Laporan terverifikasi perlu kader
                  </p>
                </Link>

                <Link
                  href="/pengelola/tugas?due=overdue"
                  className="group block rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Tugas melewati tenggat
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {operational.overdueTasksCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Penugasan aktif lewat batas waktu
                  </p>
                </Link>

                <Link
                  href="/pengelola/tugas?needsReview=1"
                  className="group block rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Bukti kader menunggu periksa
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {operational.pendingEvidenceSubmissionsCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Dari {operational.tasksWithPendingEvidenceCount} tugas aktif
                    berjalan
                  </p>
                </Link>
              </div>

              {/* Daftar "Perlu ditangani" */}
              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold tracking-wider text-[var(--muted-foreground)] uppercase">
                    Perlu ditangani segera
                  </h3>
                  <div className="flex gap-3 text-xs">
                    <Link
                      href="/pengelola/verifikasi"
                      className="font-semibold text-[var(--primary)] hover:underline"
                    >
                      Antrean verifikasi →
                    </Link>
                    <Link
                      href="/pengelola/tugas"
                      className="font-semibold text-[var(--primary)] hover:underline"
                    >
                      Tugas wilayah →
                    </Link>
                  </div>
                </div>

                {!operational.urgentItems.length ? (
                  <p className="rounded-[var(--radius-control)] bg-[var(--background)] px-3.5 py-3 text-xs text-[var(--muted-foreground)]">
                    Tidak ada antrean mendesak saat ini. Seluruh laporan masuk
                    dan bukti kader telah ditindaklanjuti.
                  </p>
                ) : (
                  <ul className="grid gap-2 sm:grid-cols-2">
                    {operational.urgentItems.map((item) => {
                      const badgeStyle =
                        item.tone === "danger"
                          ? "bg-[var(--danger-subtle)] text-[var(--danger)]"
                          : item.tone === "warning"
                            ? "bg-[var(--warning-subtle)] text-[var(--warning)]"
                            : "bg-[var(--info-subtle)] text-[var(--info)]";
                      return (
                        <li key={`${item.kind}-${item.id}`}>
                          <Link
                            href={item.href}
                            className="flex items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2.5 transition hover:border-[var(--primary)]"
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${badgeStyle}`}
                                >
                                  {item.ageLabel}
                                </span>
                                <span className="truncate text-xs font-bold text-[var(--foreground)]">
                                  {item.title}
                                </span>
                              </div>
                              <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
                                {item.subtitle}
                              </p>
                            </div>
                            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--primary)]">
                              {item.actionLabel}
                              <ArrowRight
                                aria-hidden="true"
                                className="size-3.5"
                              />
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>
          ) : null}

          {/* BAGIAN 2: FILTER PERIODE & WILAYAH */}
          <form
            action="/pengelola/ringkasan"
            method="get"
            aria-label="Filter ringkasan"
            className="grid gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
          >
            {areas.length > 1 ? (
              <div className="grid gap-1.5">
                <label htmlFor="areaId" className="text-xs font-semibold">
                  Wilayah
                </label>
                <select
                  id="areaId"
                  name="areaId"
                  defaultValue={values.areaId ?? ""}
                  className={controlClass}
                >
                  <option value="">Semua wilayah kelola</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid gap-1.5">
              <label htmlFor="from" className="text-xs font-semibold">
                Dikirim sejak
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={parsed?.success ? parsed.data.from : values.from}
                className={controlClass}
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="to" className="text-xs font-semibold">
                Dikirim sampai
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={parsed?.success ? parsed.data.to : values.to}
                className={controlClass}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="submit">Terapkan</Button>
              <Link
                href="/pengelola/ringkasan"
                className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                30 hari terakhir
              </Link>
            </div>
          </form>

          {!parsed?.success ? (
            <div
              role="alert"
              className="max-w-2xl rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
            >
              <p className="font-semibold text-[var(--danger)]">
                Filter tidak valid.
              </p>
              <p className="mt-1">
                Pilih rentang tanggal yang benar, maksimal 366 hari.
              </p>
            </div>
          ) : !data ? (
            <div
              role="alert"
              className="max-w-2xl rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
            >
              <p className="font-semibold text-[var(--danger)]">
                Ringkasan belum tersedia.
              </p>
              <Link
                href="/pengelola/ringkasan"
                className="mt-3 inline-flex min-h-11 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                Muat ulang ringkasan
              </Link>
            </div>
          ) : (
            <div className="grid gap-6">
              {/* Grafik Tren Harian & Pratinjau Peta Temuan */}
              <div className="grid gap-6 lg:grid-cols-12 lg:items-start">
                <div className="lg:col-span-6">
                  <DailyTrendChart
                    points={trendPoints}
                    from={data.from}
                    to={data.to}
                  />
                </div>
                <section
                  aria-labelledby="map-preview-heading"
                  className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 lg:col-span-6"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h2
                        id="map-preview-heading"
                        className="text-base font-bold"
                      >
                        Pratinjau Peta Temuan Lingkungan
                      </h2>
                      <p className="text-xs text-[var(--muted-foreground)]">
                        Sebaran titik koordinat laporan warga pada periode ini.
                      </p>
                    </div>
                    <Link
                      href="/pengelola/peta"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                    >
                      Buka peta penuh
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </div>
                  <FindingsMap
                    reports={mapData.points}
                    missingCoordinatesCount={mapData.missingCoordinatesCount}
                    compact
                  />
                </section>
              </div>

              {/* BAGIAN 3: STATISTIK PERIODE TERPILIH */}
              <section aria-labelledby="kpi-title">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 id="kpi-title" className="text-base font-bold">
                    Statistik Periode Terpilih
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Periode {formatDate(data.from)} – {formatDate(data.to)}{" "}
                    (WIB) · Diperbarui {formatJakarta(data.asOf)} WIB ·{" "}
                    {data.areaCount > 1
                      ? `${data.areaCount} wilayah kelola`
                      : "1 wilayah kelola"}
                  </p>
                </div>

                {data.reportsTotal === 0 ? (
                  <p className="mb-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4 text-sm">
                    Belum ada laporan pada periode ini.
                  </p>
                ) : null}

                <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    [
                      "Laporan masuk",
                      number.format(data.reportsTotal),
                      "Laporan lingkungan yang dikirim pada periode ini (satuan: laporan).",
                    ],
                    [
                      "Menunggu pemeriksaan",
                      number.format(data.awaitingVerification),
                      "Belum diverifikasi pengelola atau menunggu informasi tambahan warga.",
                    ],
                    [
                      "Dalam penanganan",
                      number.format(data.inAction),
                      "Terverifikasi tetapi belum tuntas, termasuk yang dibuka kembali.",
                    ],
                    [
                      "Selesai",
                      number.format(data.resolved),
                      "Semua tugas wajib aktif selesai dengan bukti yang disetujui pengelola.",
                    ],
                    [
                      "Tingkat penyelesaian",
                      data.completionRate === null
                        ? "—"
                        : `${number.format(data.completionRate)}%`,
                      data.completionEligible === 0
                        ? "Belum ada laporan tervalidasi pada periode ini."
                        : `${number.format(data.resolved)} dari ${number.format(data.completionEligible)} laporan tervalidasi. Laporan ditolak atau duplikat tidak dihitung.`,
                    ],
                    [
                      "Tugas menunggu periksa bukti",
                      number.format(data.tasksAwaitingReview),
                      "Tugas pada laporan periode ini dengan status menunggu pemeriksaan bukti.",
                    ],
                  ].map(([label, value, help]) => (
                    <div
                      key={label}
                      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
                    >
                      <dt className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                        {label}
                      </dt>
                      <dd className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                        {value}
                      </dd>
                      <dd className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {help}
                      </dd>
                    </div>
                  ))}
                </dl>

                <dl className="mt-4 grid gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-3">
                  <div>
                    <dt className="text-xs font-semibold text-[var(--muted-foreground)]">
                      Median waktu ke keputusan verifikasi
                    </dt>
                    <dd className="mt-1 text-sm font-bold">
                      {hours(data.medianHoursToFirstReview)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-[var(--muted-foreground)]">
                      Median verifikasi ke selesai
                    </dt>
                    <dd className="mt-1 text-sm font-bold">
                      {hours(data.medianHoursToResolution)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-[var(--muted-foreground)]">
                      Tidak diproses lanjut
                    </dt>
                    <dd className="mt-1 text-sm font-bold">
                      {number.format(data.notActionable)} laporan ditolak atau
                      duplikat
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          )}
        </div>
      )}
    </AppShell>
  );
}
