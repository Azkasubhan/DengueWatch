import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Clock,
  MapPin,
  RefreshCw,
} from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { DailyTrendChart } from "@/features/analytics/components/DailyTrendChart";
import {
  getManagerDailyTrend,
  getManagerOperationalOverview,
  getManagerSummary,
} from "@/features/analytics/data";
import {
  jakartaToday,
  summaryQuerySchema,
} from "@/features/analytics/validation";
import { FindingsMap } from "@/features/map/components/FindingsMap";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { listMapReports } from "@/features/reports/data";
import {
  reportCategories,
  reportCategoryLabels,
  type ReportCategory,
  type ReportStatus,
} from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";
import { cleanSimulationText } from "@/lib/format/text";

export const dynamic = "force-dynamic";

const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const formatDate = (date: string) =>
  formatJakarta(`${date}T00:00:00+07:00`, false);

// Durations are rounded to 0.1 hour in SQL; 0 means under six minutes.
const hours = (value: number | null) =>
  value === null
    ? "Belum tersedia"
    : value === 0
      ? "< 0,1 jam"
      : `${number.format(value)} jam`;

function shiftWibDate(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

const VALID_REPORT_STATUSES: ReportStatus[] = [
  "pending_verification",
  "needs_information",
  "verified",
  "in_action",
  "resolved",
];

const OPEN_REPORT_STATUSES: ReportStatus[] = [
  "pending_verification",
  "needs_information",
  "verified",
  "in_action",
];

function resolveMapStatusPreset(preset?: string): {
  key: "valid" | "open" | "resolved";
  statuses: ReportStatus[];
} {
  if (preset === "open") {
    return { key: "open", statuses: OPEN_REPORT_STATUSES };
  }
  if (preset === "resolved") {
    return { key: "resolved", statuses: ["resolved"] };
  }
  return { key: "valid", statuses: VALID_REPORT_STATUSES };
}

function withAreaParam(baseHref: string, areaId?: string): string {
  if (!areaId) return baseHref;
  const sep = baseHref.includes("?") ? "&" : "?";
  return `${baseHref}${sep}areaId=${encodeURIComponent(areaId)}`;
}

function buildSummaryUrl(params: {
  areaId?: string;
  from?: string;
  to?: string;
  mapStatus?: string;
  mapCategory?: string;
  mode?: string;
}): string {
  const qs = new URLSearchParams();
  if (params.areaId) qs.set("areaId", params.areaId);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.mapStatus && params.mapStatus !== "valid") {
    qs.set("mapStatus", params.mapStatus);
  }
  if (params.mapCategory) qs.set("mapCategory", params.mapCategory);
  if (params.mode === "heatmap") qs.set("mode", "heatmap");
  const str = qs.toString();
  return str ? `/pengelola/ringkasan?${str}` : "/pengelola/ringkasan";
}

export default async function ManagerSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{
    logout?: string;
    areaId?: string;
    from?: string;
    to?: string;
    mapStatus?: string;
    mapCategory?: string;
    mode?: string;
  }>;
}) {
  const { logout, mapStatus, mapCategory, mode, ...periodAndAreaFilters } =
    await searchParams;
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
    Object.entries(periodAndAreaFilters).filter(
      ([, value]) => typeof value === "string" && value.trim(),
    ),
  );
  const parsed =
    decision.kind === "allowed" ? summaryQuerySchema().safeParse(values) : null;
  const selectedAreaId =
    values.areaId && areas.some((a) => a.id === values.areaId)
      ? values.areaId
      : undefined;
  const selectedArea = selectedAreaId
    ? areas.find((a) => a.id === selectedAreaId)
    : areas.length === 1
      ? areas[0]
      : undefined;

  const mapStatusInfo = resolveMapStatusPreset(mapStatus);
  const selectedMapCategory = reportCategories.includes(
    mapCategory as ReportCategory,
  )
    ? (mapCategory as ReportCategory)
    : undefined;
  const initialMapMode = mode === "heatmap" ? "heatmap" : "points";

  const todayWib = jakartaToday();
  const from7Days = shiftWibDate(todayWib, -6);
  const from30Days = shiftWibDate(todayWib, -29);

  const activeFrom = parsed?.success
    ? parsed.data.from
    : (values.from ?? from30Days);
  const activeTo = parsed?.success ? parsed.data.to : (values.to ?? todayWib);
  const isPreset7Days = activeFrom === from7Days && activeTo === todayWib;
  const isPreset30Days = activeFrom === from30Days && activeTo === todayWib;

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
            status: mapStatusInfo.statuses,
            category: selectedMapCategory,
          }),
        ])
      : [
          null,
          { data: null, error: null },
          { data: null, error: null },
          { data: null, error: null },
        ];

  const data = summary?.data ?? null;
  const operational = operationalResult.data;
  const trendPoints = trendResult.data ?? [];
  const mapData = mapResult.data ?? {
    points: [],
    missingCoordinatesCount: 0,
    totalMatching: 0,
    withCoordinatesCount: 0,
    withCoordinatesTotal: 0,
    isTruncated: false,
    pointLimit: 300,
  };

  const lastUpdatedIso = data?.asOf ?? operational?.asOf ?? null;

  const currentUrl = buildSummaryUrl({
    areaId: selectedAreaId,
    from: activeFrom,
    to: activeTo,
    mapStatus: mapStatusInfo.key,
    mapCategory: selectedMapCategory,
    mode: initialMapMode,
  });

  const fullMapParams = new URLSearchParams();
  if (selectedAreaId) fullMapParams.set("areaId", selectedAreaId);
  if (parsed?.success) {
    fullMapParams.set("submittedFrom", parsed.data.from);
    fullMapParams.set("submittedTo", parsed.data.to);
  }
  fullMapParams.set("mapStatus", mapStatusInfo.key);
  if (selectedMapCategory) fullMapParams.set("category", selectedMapCategory);
  const fullMapHref = `/pengelola/peta?${fullMapParams.toString()}`;

  return (
    <AppShell
      area={selectedArea ?? areas[0]}
      displayName={result.context.displayName}
      role="manager"
    >
      {logout === "failed" ? (
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
          {/* 1. HEADER RINGKAS */}
          <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3.5">
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
                  Dasbor wilayah
                </h1>
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)] sm:text-sm">
                Pantau temuan dan tindak lanjut di wilayah Anda.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {areas.length > 1 ? (
                <form
                  action="/pengelola/ringkasan"
                  method="get"
                  className="flex items-center gap-2"
                >
                  <input type="hidden" name="from" value={activeFrom} />
                  <input type="hidden" name="to" value={activeTo} />
                  {mapStatusInfo.key !== "valid" ? (
                    <input
                      type="hidden"
                      name="mapStatus"
                      value={mapStatusInfo.key}
                    />
                  ) : null}
                  {selectedMapCategory ? (
                    <input
                      type="hidden"
                      name="mapCategory"
                      value={selectedMapCategory}
                    />
                  ) : null}
                  <div className="w-48">
                    <CustomSelect
                      id="header-area-select"
                      name="areaId"
                      defaultValue={selectedAreaId ?? ""}
                      size="sm"
                      ariaLabel="Pilih wilayah kelola"
                      options={[
                        {
                          value: "",
                          label: `Semua wilayah (${areas.length} wilayah)`,
                        },
                        ...areas.map((area) => ({
                          value: area.id,
                          label: cleanSimulationText(area.name),
                        })),
                      ]}
                    />
                  </div>
                  <Button type="submit" size="sm" className="min-h-9 px-3.5">
                    Pilih
                  </Button>
                </form>
              ) : null}

              {lastUpdatedIso ? (
                <span className="text-xs text-[var(--muted-foreground)]">
                  Diperbarui {formatJakarta(lastUpdatedIso)} WIB
                </span>
              ) : null}

              <Link
                href={currentUrl}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]"
              >
                <RefreshCw
                  aria-hidden="true"
                  className="size-3.5 text-[var(--primary)]"
                />
                Perbarui
              </Link>
            </div>
          </header>

          {/* 2. PETA TEMUAN DI PALING ATAS (Full-Width, Tanpa Card Bersarang) */}
          <section
            aria-labelledby="map-section-heading"
            className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-2xs"
          >
            {/* Header & Toolbar Filter Peta + Periode */}
            <div className="border-b border-[var(--border)] bg-[var(--background)] px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2
                    id="map-section-heading"
                    className="text-base font-bold text-[var(--foreground)]"
                  >
                    Peta temuan
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Periode memengaruhi peta, grafik, dan statistik periode.
                    Antrean operasional tetap mencakup seluruh pekerjaan
                    terbuka.
                  </p>
                </div>

                {/* Pilihan periode cepat: 7 hari & 30 hari */}
                <div
                  role="group"
                  aria-label="Pilihan periode cepat"
                  className="inline-flex items-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs"
                >
                  <Link
                    href={buildSummaryUrl({
                      areaId: selectedAreaId,
                      from: from7Days,
                      to: todayWib,
                      mapStatus: mapStatusInfo.key,
                      mapCategory: selectedMapCategory,
                      mode: initialMapMode,
                    })}
                    className={`rounded-md px-2.5 py-1 font-semibold transition ${
                      isPreset7Days
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--foreground)] hover:bg-[var(--background)]"
                    }`}
                  >
                    7 hari
                  </Link>
                  <Link
                    href={buildSummaryUrl({
                      areaId: selectedAreaId,
                      from: from30Days,
                      to: todayWib,
                      mapStatus: mapStatusInfo.key,
                      mapCategory: selectedMapCategory,
                      mode: initialMapMode,
                    })}
                    className={`rounded-md px-2.5 py-1 font-semibold transition ${
                      isPreset30Days
                        ? "bg-[var(--primary)] text-white"
                        : "text-[var(--foreground)] hover:bg-[var(--background)]"
                    }`}
                  >
                    30 hari
                  </Link>
                </div>
              </div>

              <form
                action="/pengelola/ringkasan"
                method="get"
                aria-label="Filter peta dan periode dasbor"
                className="mt-3 flex flex-wrap items-end gap-2.5"
              >
                {selectedAreaId ? (
                  <input type="hidden" name="areaId" value={selectedAreaId} />
                ) : null}
                {initialMapMode === "heatmap" ? (
                  <input type="hidden" name="mode" value="heatmap" />
                ) : null}

                <div className="grid gap-1">
                  <label
                    htmlFor="from"
                    className="text-[11px] font-semibold text-[var(--foreground)]"
                  >
                    Dari tanggal
                  </label>
                  <CustomDatePicker
                    id="from"
                    name="from"
                    defaultValue={activeFrom}
                    size="sm"
                    className="w-36"
                  />
                </div>

                <div className="grid gap-1">
                  <label
                    htmlFor="to"
                    className="text-[11px] font-semibold text-[var(--foreground)]"
                  >
                    Sampai tanggal
                  </label>
                  <CustomDatePicker
                    id="to"
                    name="to"
                    defaultValue={activeTo}
                    size="sm"
                    className="w-36"
                  />
                </div>

                <div className="grid gap-1">
                  <label
                    htmlFor="mapStatus"
                    className="text-[11px] font-semibold text-[var(--foreground)]"
                  >
                    Status di peta
                  </label>
                  <CustomSelect
                    id="mapStatus"
                    name="mapStatus"
                    defaultValue={mapStatusInfo.key}
                    size="sm"
                    className="w-44"
                    options={[
                      { value: "valid", label: "Semua temuan valid" },
                      { value: "open", label: "Belum tuntas" },
                      { value: "resolved", label: "Selesai" },
                    ]}
                  />
                </div>

                <div className="grid gap-1">
                  <label
                    htmlFor="mapCategory"
                    className="text-[11px] font-semibold text-[var(--foreground)]"
                  >
                    Kategori
                  </label>
                  <CustomSelect
                    id="mapCategory"
                    name="mapCategory"
                    defaultValue={selectedMapCategory ?? ""}
                    size="sm"
                    className="w-44"
                    options={[
                      { value: "", label: "Semua kategori" },
                      ...Object.entries(reportCategoryLabels).map(
                        ([value, label]) => ({
                          value,
                          label,
                        }),
                      ),
                    ]}
                  />
                </div>

                <Button type="submit" size="sm" className="min-h-9 px-3.5">
                  Terapkan
                </Button>
              </form>

              {!parsed?.success ? (
                <p
                  role="alert"
                  className="mt-2.5 rounded-md border border-[var(--danger)] bg-[var(--danger-subtle)] px-3 py-1.5 text-xs font-semibold text-[var(--danger)]"
                >
                  Rentang tanggal tidak valid. Gunakan rentang yang benar
                  (maksimal 366 hari).
                </p>
              ) : null}
            </div>

            {/* Area Peta atau Pesan Error Peta (Kegagalan peta tidak menghilangkan antrean operasional) */}
            {mapResult.error ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 bg-[var(--danger-subtle)] p-4 text-xs text-[var(--danger)]"
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
                  Peta temuan belum dapat dimuat saat ini. Antrean operasional
                  tetap dapat diakses di bawah.
                </span>
                <Link
                  href={currentUrl}
                  className="font-semibold text-[var(--primary)] underline underline-offset-2"
                >
                  Coba muat ulang peta
                </Link>
              </div>
            ) : (
              <FindingsMap
                reports={mapData.points}
                missingCoordinatesCount={mapData.missingCoordinatesCount}
                totalMatching={mapData.totalMatching}
                withCoordinatesTotal={mapData.withCoordinatesTotal}
                isTruncated={mapData.isTruncated}
                pointLimit={mapData.pointLimit}
                areaId={selectedAreaId}
                initialMode={initialMapMode}
                variant="dashboard"
                fullMapHref={fullMapHref}
              />
            )}
          </section>

          {/* 3. EMPAT INDIKATOR OPERASIONAL DI BAWAH PETA */}
          <section aria-labelledby="operational-indicators-heading">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <h2
                  id="operational-indicators-heading"
                  className="text-sm font-bold text-[var(--foreground)]"
                >
                  Indikator operasional
                </h2>
                <span className="text-xs text-[var(--muted-foreground)]">
                  Pekerjaan terbuka saat ini; tidak dibatasi periode
                  peta/grafik.
                </span>
              </div>

              {operational && operational.needsInformationCount > 0 ? (
                <Link
                  href={withAreaParam(
                    "/pengelola/verifikasi?status=needs_information",
                    selectedAreaId,
                  )}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs font-medium text-[var(--muted-foreground)] transition hover:border-[var(--primary)] hover:text-[var(--foreground)]"
                >
                  <span>
                    Menunggu jawaban warga:{" "}
                    <strong className="text-[var(--foreground)]">
                      {operational.needsInformationCount} laporan
                    </strong>
                  </span>
                  <ArrowRight aria-hidden="true" className="size-3" />
                </Link>
              ) : null}
            </div>

            {operationalResult.error || !operational ? (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4 text-xs text-[var(--danger)]"
              >
                <span className="flex items-center gap-1.5 font-semibold">
                  <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
                  Indikator operasional belum dapat dimuat. Kegagalan query
                  tidak ditampilkan sebagai nol laporan.
                </span>
                <Link
                  href={currentUrl}
                  className="font-semibold text-[var(--primary)] underline underline-offset-2"
                >
                  Muat ulang indikator
                </Link>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                  href={withAreaParam(
                    "/pengelola/verifikasi?status=pending_verification",
                    selectedAreaId,
                  )}
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Perlu verifikasi
                  </p>
                  <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {operational.pendingVerificationCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Laporan baru menunggu keputusan
                  </p>
                </Link>

                <Link
                  href={withAreaParam(
                    "/pengelola/verifikasi?tab=needs_task",
                    selectedAreaId,
                  )}
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Perlu penugasan
                  </p>
                  <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {operational.verifiedWithoutTaskCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Terverifikasi tanpa tugas wajib aktif
                  </p>
                </Link>

                <Link
                  href={withAreaParam(
                    "/pengelola/tugas?due=overdue",
                    selectedAreaId,
                  )}
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Tugas terlambat
                  </p>
                  <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {operational.overdueTasksCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Melewati tenggat penyelesaian
                  </p>
                </Link>

                <Link
                  href={withAreaParam(
                    "/pengelola/tugas?needsReview=1",
                    selectedAreaId,
                  )}
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs font-semibold text-[var(--muted-foreground)]">
                    Bukti perlu ditinjau
                  </p>
                  <p className="mt-1.5 text-3xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {operational.pendingEvidenceSubmissionsCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {operational.tasksWithPendingEvidenceCount > 0
                      ? `Bukti aktif pada ${operational.tasksWithPendingEvidenceCount} tugas`
                      : "Belum ada bukti menunggu tinjauan"}
                  </p>
                </Link>
              </div>
            )}
          </section>

          {/* 4. DAFTAR TINDAK LANJUT (Full-width operational queue) */}
          <section
            aria-labelledby="followup-list-heading"
            className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs sm:p-5"
          >
            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] pb-3">
              <div>
                <h2
                  id="followup-list-heading"
                  className="text-base font-bold text-[var(--foreground)]"
                >
                  Perlu ditindaklanjuti
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  Diurutkan berdasarkan tenggat terlewati, bukti kader tertua,
                  dan waktu tunggu laporan.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <Link
                  href={withAreaParam("/pengelola/verifikasi", selectedAreaId)}
                  className="font-semibold text-[var(--primary)] hover:underline"
                >
                  Semua verifikasi →
                </Link>
                <Link
                  href={withAreaParam("/pengelola/tugas", selectedAreaId)}
                  className="font-semibold text-[var(--primary)] hover:underline"
                >
                  Semua tugas →
                </Link>
              </div>
            </div>

            {operationalResult.error || !operational ? (
              <div
                role="alert"
                className="mt-3 rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-3.5 text-xs text-[var(--danger)]"
              >
                <p className="font-semibold">
                  Daftar tindak lanjut belum dapat dimuat.
                </p>
                <Link
                  href={currentUrl}
                  className="mt-1.5 inline-flex font-semibold text-[var(--primary)] underline underline-offset-2"
                >
                  Coba lagi
                </Link>
              </div>
            ) : operational.urgentItems.length === 0 ? (
              <div className="mt-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-4 py-6 text-center">
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  Tidak ada pekerjaan terbuka yang menunggu tindakan
                </p>
                <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                  Seluruh laporan masuk, penugasan wajib, dan bukti kader pada
                  wilayah ini telah ditindaklanjuti.
                </p>
              </div>
            ) : (
              <>
                <ul className="mt-2 divide-y divide-[var(--border)]">
                  {operational.urgentItems.map((item) => {
                    const typeBadgeClass =
                      item.tone === "danger"
                        ? "bg-[var(--danger-subtle)] text-[var(--danger)]"
                        : item.tone === "warning"
                          ? "bg-[var(--warning-subtle)] text-[var(--warning)]"
                          : item.tone === "info"
                            ? "bg-[var(--info-subtle)] text-[var(--info)]"
                            : "border border-[var(--border)] bg-[var(--background)] text-[var(--foreground)]";

                    return (
                      <li
                        key={`${item.kind}-${item.id}`}
                        className="flex flex-col justify-between gap-2.5 py-3 first:pt-2 last:pb-0 sm:flex-row sm:items-center"
                      >
                        <div className="min-w-0 flex-1">
                          {/* Baris 1: Jenis tindakan + Judul/Kategori + Referensi */}
                          <div className="flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex shrink-0 items-center rounded px-2 py-0.5 text-[11px] font-bold ${typeBadgeClass}`}
                            >
                              {item.typeLabel}
                            </span>
                            <span className="truncate text-sm font-bold text-[var(--foreground)]">
                              {item.title}
                            </span>
                            <span className="font-mono text-xs font-semibold text-[var(--muted-foreground)]">
                              {item.reference}
                            </span>
                          </div>

                          {/* Baris 2: Lokasi singkat & Waktu tunggu/tenggat pada posisi konsisten */}
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
                            <span className="inline-flex max-w-64 items-center gap-1 truncate">
                              <MapPin
                                aria-hidden="true"
                                className="size-3.5 shrink-0"
                              />
                              <span className="truncate">
                                {item.locationLabel}
                              </span>
                            </span>
                            <span className="inline-flex items-center gap-1 font-medium text-[var(--foreground)]">
                              <Clock
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-[var(--muted-foreground)]"
                              />
                              {item.timeLabel}
                            </span>
                          </div>
                        </div>

                        <Link
                          href={withAreaParam(item.href, selectedAreaId)}
                          className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--background)] px-3 py-1.5 text-xs font-semibold text-[var(--primary)] transition hover:border-[var(--primary)] hover:bg-[var(--primary-subtle)]/40"
                        >
                          {item.actionLabel}
                          <ArrowRight aria-hidden="true" className="size-3.5" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>

                {operational.totalUrgentCount >
                operational.urgentItems.length ? (
                  <p className="mt-3 border-t border-[var(--border)] pt-2.5 text-xs text-[var(--muted-foreground)]">
                    Menampilkan 5 dari {operational.totalUrgentCount} pekerjaan
                    terbuka berdasarkan prioritas operasional.
                  </p>
                ) : null}
              </>
            )}
          </section>

          {/* 5. ANALITIK PERIODE: GRAFIK & STATISTIK BERDAMPINGAN (Tanpa Gap) */}
          <div className="grid gap-5 lg:grid-cols-12 lg:items-stretch">
            {/* Kolom Kiri (6/12): Grafik Laporan masuk dan selesai */}
            <div className="flex flex-col lg:col-span-6">
              <DailyTrendChart
                points={trendPoints}
                from={activeFrom}
                to={activeTo}
                hasError={!parsed?.success || Boolean(trendResult.error)}
                retryHref={currentUrl}
              />
            </div>

            {/* Kolom Kanan (6/12): Statistik Periode */}
            <section
              aria-labelledby="period-stats-heading"
              className="flex flex-col justify-between rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs sm:p-5 lg:col-span-6"
            >
              <div>
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] pb-3">
                  <div>
                    <h2
                      id="period-stats-heading"
                      className="text-base font-bold text-[var(--foreground)]"
                    >
                      Statistik periode
                    </h2>
                    <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                      Kohort laporan {formatDate(activeFrom)} –{" "}
                      {formatDate(activeTo)} WIB.
                    </p>
                  </div>
                </div>

                {!parsed?.success || !data ? (
                  <div
                    role="alert"
                    className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-3.5 text-xs text-[var(--danger)]"
                  >
                    <span className="font-semibold">
                      Statistik periode belum dapat dimuat.
                    </span>
                    <Link
                      href={currentUrl}
                      className="font-semibold text-[var(--primary)] underline underline-offset-2"
                    >
                      Muat ulang statistik
                    </Link>
                  </div>
                ) : (
                  <>
                    <dl className="mt-3.5 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-3.5">
                        <dt className="text-xs font-semibold text-[var(--muted-foreground)]">
                          Laporan masuk
                        </dt>
                        <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                          {number.format(data.reportsTotal)}
                        </dd>
                        <dd className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                          Dikirim pada periode ini
                        </dd>
                      </div>

                      <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-3.5">
                        <dt className="text-xs font-semibold text-[var(--muted-foreground)]">
                          Laporan selesai
                        </dt>
                        <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                          {number.format(data.resolved)}
                        </dd>
                        <dd className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                          Laporan periode ini yang tuntas
                        </dd>
                      </div>

                      <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-3.5">
                        <dt className="text-xs font-semibold text-[var(--muted-foreground)]">
                          Tingkat penyelesaian
                        </dt>
                        <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                          {data.completionRate === null
                            ? "Belum dapat dihitung"
                            : `${number.format(data.completionRate)}%`}
                        </dd>
                        <dd className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                          {data.completionEligible === 0
                            ? "0 laporan tervalidasi"
                            : `${number.format(data.resolved)}/${number.format(data.completionEligible)} laporan valid`}
                        </dd>
                      </div>

                      <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-3.5">
                        <dt className="text-xs font-semibold text-[var(--muted-foreground)]">
                          Median waktu penyelesaian
                        </dt>
                        <dd className="mt-1 text-2xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                          {hours(data.medianHoursToResolution)}
                        </dd>
                        <dd className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                          Sejak verifikasi hingga selesai
                        </dd>
                      </div>
                    </dl>

                    {/* Metrik kohort lainnya */}
                    <details className="mt-3.5 border-t border-[var(--border)] pt-2.5 text-xs">
                      <summary className="cursor-pointer font-semibold text-[var(--primary)] hover:underline">
                        Lihat statistik lengkap periode ini
                      </summary>
                      <dl className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
                        <div className="rounded-[var(--radius-control)] bg-[var(--background)] p-2.5">
                          <dt className="font-semibold text-[var(--muted-foreground)]">
                            Menunggu pemeriksaan
                          </dt>
                          <dd className="mt-0.5 text-sm font-bold tabular-nums text-[var(--foreground)]">
                            {number.format(data.awaitingVerification)} laporan
                          </dd>
                        </div>
                        <div className="rounded-[var(--radius-control)] bg-[var(--background)] p-2.5">
                          <dt className="font-semibold text-[var(--muted-foreground)]">
                            Dalam penanganan
                          </dt>
                          <dd className="mt-0.5 text-sm font-bold tabular-nums text-[var(--foreground)]">
                            {number.format(data.inAction)} laporan
                          </dd>
                        </div>
                        <div className="rounded-[var(--radius-control)] bg-[var(--background)] p-2.5">
                          <dt className="font-semibold text-[var(--muted-foreground)]">
                            Tugas menunggu bukti
                          </dt>
                          <dd className="mt-0.5 text-sm font-bold tabular-nums text-[var(--foreground)]">
                            {number.format(data.tasksAwaitingReview)} tugas
                          </dd>
                        </div>
                        <div className="rounded-[var(--radius-control)] bg-[var(--background)] p-2.5">
                          <dt className="font-semibold text-[var(--muted-foreground)]">
                            Median waktu ke verifikasi
                          </dt>
                          <dd className="mt-0.5 text-sm font-bold tabular-nums text-[var(--foreground)]">
                            {hours(data.medianHoursToFirstReview)}
                          </dd>
                        </div>
                        <div className="col-span-full rounded-[var(--radius-control)] bg-[var(--background)] p-2.5">
                          <dt className="font-semibold text-[var(--muted-foreground)]">
                            Tidak diproses lanjut
                          </dt>
                          <dd className="mt-0.5 text-sm font-bold tabular-nums text-[var(--foreground)]">
                            {number.format(data.notActionable)} ditolak /
                            duplikat
                          </dd>
                        </div>
                      </dl>
                    </details>
                  </>
                )}
              </div>
            </section>
          </div>
        </div>
      )}
    </AppShell>
  );
}
