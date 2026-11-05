"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Compass,
  ExternalLink,
  Flame,
  Info,
  Layers,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import { StatusBadge, reportStatusTone } from "@/components/ui/StatusBadge";
import type { MapReportPoint } from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportStatusLabels,
  type ReportStatus,
} from "@/features/reports/validation";

const DEFAULT_CENTER = { lat: -6.2, lon: 106.816666 };
const VIEW_W = 840;
const VIEW_H = 440;

function lonToWorldX(lon: number, zoom: number): number {
  return ((lon + 180) / 360) * 256 * Math.pow(2, zoom);
}

function latToWorldY(lat: number, zoom: number): number {
  const rad = (lat * Math.PI) / 180;
  const n = Math.PI - Math.log(Math.tan(Math.PI / 4 + rad / 2));
  return (n / (2 * Math.PI)) * 256 * Math.pow(2, zoom);
}

function statusDotClass(status: ReportStatus): string {
  switch (status) {
    case "pending_verification":
    case "needs_information":
      return "bg-[var(--warning)] ring-white";
    case "verified":
    case "in_action":
      return "bg-[var(--info)] ring-white";
    case "resolved":
      return "bg-[var(--primary)] ring-white";
    case "rejected":
    case "duplicate":
      return "bg-[var(--muted-foreground)] ring-white";
  }
}

function formatDateWib(iso: string): string {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Jakarta",
  }).format(new Date(iso));
}

export function FindingsMap({
  reports,
  missingCoordinatesCount,
  compact = false,
}: {
  reports: MapReportPoint[];
  missingCoordinatesCount: number;
  compact?: boolean;
}) {
  const validDensityReports = useMemo(
    () =>
      reports.filter(
        (r) => r.status !== "rejected" && r.status !== "duplicate",
      ),
    [reports],
  );

  // Default to points view when data is sparse (< 3 points) or always allow toggle
  const [mode, setMode] = useState<"points" | "heatmap">("points");
  const [selectedId, setSelectedId] = useState<string | null>(
    reports[0]?.id ?? null,
  );
  const [tileError, setTileError] = useState(false);

  const initialBounds = useMemo(() => {
    if (!reports.length) {
      return {
        lat: DEFAULT_CENTER.lat,
        lon: DEFAULT_CENTER.lon,
        zoom: 13,
      };
    }
    const lats = reports.map((r) => r.latitude);
    const lons = reports.map((r) => r.longitude);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLon = Math.min(...lons);
    const maxLon = Math.max(...lons);
    const centerLat = (minLat + maxLat) / 2;
    const centerLon = (minLon + maxLon) / 2;
    const span = Math.max(maxLat - minLat, maxLon - minLon);
    let zoom = 15;
    if (span > 0.2) zoom = 11;
    else if (span > 0.08) zoom = 12;
    else if (span > 0.03) zoom = 13;
    else if (span > 0.01) zoom = 14;
    return { lat: centerLat, lon: centerLon, zoom };
  }, [reports]);

  const [zoom, setZoom] = useState<number>(initialBounds.zoom);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });

  const centerWorldX = lonToWorldX(initialBounds.lon, zoom) + panOffset.x;
  const centerWorldY = latToWorldY(initialBounds.lat, zoom) + panOffset.y;

  const tileTemplate =
    process.env.NEXT_PUBLIC_MAP_TILE_URL ??
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  const tiles = useMemo(() => {
    const maxTileIndex = Math.pow(2, zoom) - 1;
    const minTx = Math.floor((centerWorldX - VIEW_W / 2) / 256);
    const maxTx = Math.floor((centerWorldX + VIEW_W / 2) / 256);
    const minTy = Math.floor((centerWorldY - VIEW_H / 2) / 256);
    const maxTy = Math.floor((centerWorldY + VIEW_H / 2) / 256);

    const list: Array<{
      key: string;
      url: string;
      left: number;
      top: number;
    }> = [];

    for (let tx = minTx; tx <= maxTx; tx += 1) {
      for (let ty = minTy; ty <= maxTy; ty += 1) {
        if (ty < 0 || ty > maxTileIndex) continue;
        const wrappedTx =
          ((tx % (maxTileIndex + 1)) + (maxTileIndex + 1)) % (maxTileIndex + 1);
        const url = tileTemplate
          .replace("{z}", String(zoom))
          .replace("{x}", String(wrappedTx))
          .replace("{y}", String(ty));
        list.push({
          key: `${zoom}-${tx}-${ty}`,
          url,
          left: Math.round(VIEW_W / 2 + (tx * 256 - centerWorldX)),
          top: Math.round(VIEW_H / 2 + (ty * 256 - centerWorldY)),
        });
      }
    }
    return list;
  }, [centerWorldX, centerWorldY, tileTemplate, zoom]);

  const projectedPoints = useMemo(() => {
    return reports.map((report) => {
      const wx = lonToWorldX(report.longitude, zoom);
      const wy = latToWorldY(report.latitude, zoom);
      return {
        ...report,
        x: VIEW_W / 2 + (wx - centerWorldX),
        y: VIEW_H / 2 + (wy - centerWorldY),
      };
    });
  }, [centerWorldX, centerWorldY, reports, zoom]);

  // Spatial clustering for heatmap cells (grid of 64px in viewport)
  const densityClusters = useMemo(() => {
    const source = projectedPoints.filter(
      (p) => p.status !== "rejected" && p.status !== "duplicate",
    );
    const cells = new Map<
      string,
      { x: number; y: number; count: number; items: typeof source }
    >();
    const cellSize = 68;
    for (const pt of source) {
      const gx = Math.floor(pt.x / cellSize);
      const gy = Math.floor(pt.y / cellSize);
      const key = `${gx}:${gy}`;
      const existing = cells.get(key);
      if (!existing) {
        cells.set(key, {
          x: pt.x,
          y: pt.y,
          count: 1,
          items: [pt],
        });
      } else {
        const nextCount = existing.count + 1;
        existing.x = (existing.x * existing.count + pt.x) / nextCount;
        existing.y = (existing.y * existing.count + pt.y) / nextCount;
        existing.count = nextCount;
        existing.items.push(pt);
      }
    }
    return Array.from(cells.values());
  }, [projectedPoints]);

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? reports[0] ?? null,
    [reports, selectedId],
  );

  return (
    <div className="grid gap-4">
      {/* Control Bar: Mode Toggle + Coverage Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Mode tampilan peta temuan"
            className="inline-flex rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-1"
          >
            <button
              type="button"
              onClick={() => setMode("points")}
              aria-pressed={mode === "points"}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
                mode === "points"
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : "text-[var(--foreground)] hover:bg-[var(--surface)]"
              }`}
            >
              <MapPin aria-hidden="true" className="size-3.5" />
              Titik temuan ({reports.length})
            </button>
            <button
              type="button"
              onClick={() => setMode("heatmap")}
              aria-pressed={mode === "heatmap"}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 py-1 text-xs font-semibold transition ${
                mode === "heatmap"
                  ? "bg-[var(--primary)] text-white shadow-xs"
                  : "text-[var(--foreground)] hover:bg-[var(--surface)]"
              }`}
            >
              <Flame aria-hidden="true" className="size-3.5" />
              Kepadatan laporan ({validDensityReports.length})
            </button>
          </div>

          {mode === "heatmap" && validDensityReports.length < 3 ? (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-[var(--info-subtle)] px-2.5 py-1 text-xs font-medium text-[var(--info)]">
              <Info aria-hidden="true" className="size-3.5 shrink-0" />
              Jumlah titik masih sedikit ({validDensityReports.length} laporan
              valid); kepadatan dihitung dari laporan yang tersedia.
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <Compass
              aria-hidden="true"
              className="size-3.5 text-[var(--primary)]"
            />
            {reports.length} bertitik GPS
          </span>
          {missingCoordinatesCount > 0 ? (
            <span className="rounded bg-[var(--warning-subtle)] px-2 py-0.5 font-semibold text-[var(--warning)]">
              {missingCoordinatesCount} laporan tanpa koordinat GPS
            </span>
          ) : (
            <span>Semua laporan memiliki koordinat GPS</span>
          )}
        </div>
      </div>

      {/* Main Map + Side Detail Panel */}
      <div
        className={`grid gap-4 ${
          compact ? "lg:grid-cols-1" : "lg:grid-cols-12 lg:items-start"
        }`}
      >
        <div className={compact ? "" : "lg:col-span-8"}>
          <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--sand)]">
            {/* Viewport container */}
            <div
              className={`relative w-full overflow-hidden select-none ${
                compact ? "h-72 sm:h-80" : "h-80 sm:h-[420px]"
              }`}
            >
              {/* Basemap Layer */}
              {!tileError ? (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0"
                >
                  {tiles.map((tile) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={tile.key}
                      src={tile.url}
                      alt=""
                      width={256}
                      height={256}
                      onError={() => setTileError(true)}
                      style={{
                        left: `${(tile.left / VIEW_W) * 100}%`,
                        top: `${(tile.top / VIEW_H) * 100}%`,
                        width: `${(256 / VIEW_W) * 100 + 0.2}%`,
                        height: `${(256 / VIEW_H) * 100 + 0.2}%`,
                      }}
                      className="absolute max-w-none object-cover opacity-90"
                    />
                  ))}
                </div>
              ) : (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-[var(--sand)] opacity-80"
                  style={{
                    backgroundImage:
                      "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
                    backgroundSize: "40px 40px",
                  }}
                />
              )}

              {/* Empty state overlay if no coordinates */}
              {reports.length === 0 ? (
                <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[var(--surface)]/85 p-6 text-center backdrop-blur-xs">
                  <Layers
                    aria-hidden="true"
                    className="size-8 text-[var(--muted-foreground)]"
                  />
                  <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
                    Belum ada titik laporan berkoordinat GPS pada filter ini
                  </p>
                  <p className="mt-1 max-w-md text-xs text-[var(--muted-foreground)]">
                    {missingCoordinatesCount > 0
                      ? `Terdapat ${missingCoordinatesCount} laporan pada filter ini, namun pelapor tidak menyertakan titik koordinat GPS.`
                      : "Titik temuan akan muncul secara otomatis ketika warga mengirim laporan disertai lokasi GPS."}
                  </p>
                </div>
              ) : null}

              {/* Heatmap Layer */}
              {mode === "heatmap" && reports.length > 0 ? (
                <div className="absolute inset-0 z-10">
                  {densityClusters.map((cluster, idx) => {
                    const leftPct = (cluster.x / VIEW_W) * 100;
                    const topPct = (cluster.y / VIEW_H) * 100;
                    if (
                      leftPct < -10 ||
                      leftPct > 110 ||
                      topPct < -10 ||
                      topPct > 110
                    ) {
                      return null;
                    }
                    const radiusPx = Math.min(120, 56 + cluster.count * 16);
                    const gradient =
                      cluster.count >= 4
                        ? "radial-gradient(circle, rgba(220, 38, 38, 0.68) 0%, rgba(245, 158, 11, 0.42) 50%, rgba(16, 185, 129, 0) 100%)"
                        : cluster.count >= 2
                          ? "radial-gradient(circle, rgba(245, 158, 11, 0.65) 0%, rgba(20, 184, 166, 0.35) 55%, rgba(20, 184, 166, 0) 100%)"
                          : "radial-gradient(circle, rgba(13, 148, 136, 0.58) 0%, rgba(16, 185, 129, 0.25) 55%, rgba(16, 185, 129, 0) 100%)";

                    const firstItem = cluster.items[0]!;
                    return (
                      <button
                        key={`cluster-${idx}`}
                        type="button"
                        onClick={() => setSelectedId(firstItem.id)}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${radiusPx}px`,
                          height: `${radiusPx}px`,
                          background: gradient,
                        }}
                        aria-label={`Kepadatan ${cluster.count} laporan di sekitar ${firstItem.publicReference}`}
                        className="absolute -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-[var(--primary)] flex"
                      >
                        <span className="rounded-full bg-[var(--surface)]/95 px-2 py-0.5 text-[11px] font-bold text-[var(--foreground)] shadow-xs">
                          {cluster.count} laporan
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/* Point Markers Layer */}
              {mode === "points" && reports.length > 0 ? (
                <div className="absolute inset-0 z-10">
                  {projectedPoints.map((point) => {
                    const leftPct = (point.x / VIEW_W) * 100;
                    const topPct = (point.y / VIEW_H) * 100;
                    if (
                      leftPct < -5 ||
                      leftPct > 105 ||
                      topPct < -5 ||
                      topPct > 105
                    ) {
                      return null;
                    }
                    const isSelected = selectedReport?.id === point.id;
                    return (
                      <button
                        key={point.id}
                        type="button"
                        onClick={() => setSelectedId(point.id)}
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                        }}
                        aria-label={`Pilih temuan ${point.publicReference} (${reportCategoryLabels[point.category]})`}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${
                          isSelected ? "z-20 scale-125" : "z-10 hover:scale-110"
                        }`}
                      >
                        <span
                          className={`flex size-7 items-center justify-center rounded-full ring-2 shadow-md ${statusDotClass(
                            point.status,
                          )}`}
                        >
                          <MapPin
                            aria-hidden="true"
                            className="size-3.5 text-white"
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/* Map Controls (Zoom & Reset Pan) */}
              <div className="absolute top-3 right-3 z-20 flex flex-col gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]/95 p-1 shadow-xs">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(17, z + 1))}
                  aria-label="Perbesar peta"
                  className="grid size-8 place-items-center rounded text-[var(--foreground)] hover:bg-[var(--sand)]"
                >
                  <Plus aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(10, z - 1))}
                  aria-label="Perkecil peta"
                  className="grid size-8 place-items-center rounded text-[var(--foreground)] hover:bg-[var(--sand)]"
                >
                  <Minus aria-hidden="true" className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(initialBounds.zoom);
                    setPanOffset({ x: 0, y: 0 });
                  }}
                  aria-label="Atur ulang posisi peta"
                  className="grid size-8 place-items-center rounded text-[var(--foreground)] hover:bg-[var(--sand)]"
                >
                  <RotateCcw aria-hidden="true" className="size-3.5" />
                </button>
              </div>

              {/* Pan Nudge Controls for keyboard/accessible navigation */}
              <div className="absolute bottom-3 left-3 z-20 flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]/95 px-2 py-1 text-[11px] font-medium text-[var(--muted-foreground)] shadow-xs">
                <button
                  type="button"
                  onClick={() => setPanOffset((p) => ({ ...p, x: p.x - 100 }))}
                  className="px-1.5 py-0.5 hover:text-[var(--foreground)]"
                  aria-label="Geser peta ke barat"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setPanOffset((p) => ({ ...p, y: p.y - 80 }))}
                  className="px-1.5 py-0.5 hover:text-[var(--foreground)]"
                  aria-label="Geser peta ke utara"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => setPanOffset((p) => ({ ...p, y: p.y + 80 }))}
                  className="px-1.5 py-0.5 hover:text-[var(--foreground)]"
                  aria-label="Geser peta ke selatan"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setPanOffset((p) => ({ ...p, x: p.x + 100 }))}
                  className="px-1.5 py-0.5 hover:text-[var(--foreground)]"
                  aria-label="Geser peta ke timur"
                >
                  →
                </button>
              </div>

              {/* Provider Attribution (Required by OSM License) */}
              <div className="absolute right-2 bottom-2 z-20 rounded bg-[var(--surface)]/90 px-2 py-0.5 text-[10px] text-[var(--muted-foreground)] shadow-2xs">
                {tileError ? (
                  <span>Mode kanvas koordinat lokal (peta dasar luring)</span>
                ) : (
                  <>
                    Peta dasar ©{" "}
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold underline"
                    >
                      OpenStreetMap contributors
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Legend & Data Representation Honesty Note */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs">
              {mode === "points" ? (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-[var(--foreground)]">
                    Legenda status laporan:
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[var(--warning)]" />
                    Perlu pemeriksaan / info
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[var(--info)]" />
                    Terverifikasi / Ditangani
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[var(--primary)]" />
                    Selesai
                  </span>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold text-[var(--foreground)]">
                    Kepadatan laporan lingkungan (satuan: laporan valid):
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[var(--primary)]" />
                    1 laporan
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[var(--warning)]" />
                    2–3 laporan
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="size-2.5 rounded-full bg-[var(--danger)]" />
                    ≥ 4 laporan berdekatan
                  </span>
                </div>
              )}
              <span className="text-[11px] text-[var(--muted-foreground)]">
                Menampilkan titik laporan lingkungan warga (bukan kasus medis
                DBD). Laporan ditolak & duplikat dikecualikan dari kepadatan.
              </span>
            </div>
          </div>
        </div>

        {/* Selected Point Detail Panel */}
        {!compact ? (
          <div className="lg:col-span-4">
            <section
              aria-labelledby="selected-point-heading"
              className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
            >
              <h2
                id="selected-point-heading"
                className="text-sm font-bold text-[var(--foreground)]"
              >
                Detail Titik Temuan Terpilih
              </h2>
              {!selectedReport ? (
                <p className="mt-3 text-xs text-[var(--muted-foreground)]">
                  Pilih salah satu titik pada peta untuk melihat detail laporan
                  dan tautan penugasannya.
                </p>
              ) : (
                <div className="mt-3 grid gap-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="rounded bg-[var(--sand)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--foreground)]">
                      {selectedReport.publicReference}
                    </span>
                    <StatusBadge tone={reportStatusTone[selectedReport.status]}>
                      {reportStatusLabels[selectedReport.status]}
                    </StatusBadge>
                  </div>

                  <div>
                    <p className="text-sm font-bold text-[var(--foreground)]">
                      {reportCategoryLabels[selectedReport.category]}
                    </p>
                    <p className="mt-1 line-clamp-3 text-xs text-[var(--muted-foreground)]">
                      {selectedReport.description}
                    </p>
                  </div>

                  <dl className="grid gap-2 rounded-[var(--radius-control)] bg-[var(--background)] p-3 text-xs">
                    <div>
                      <dt className="font-semibold text-[var(--foreground)]">
                        Catatan lokasi
                      </dt>
                      <dd className="mt-0.5 text-[var(--muted-foreground)]">
                        {selectedReport.locationNote ||
                          "Tidak ada catatan lokasi tertulis"}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[var(--foreground)]">
                        Koordinat tercatat
                      </dt>
                      <dd className="mt-0.5 font-mono text-[var(--muted-foreground)]">
                        {selectedReport.latitude.toFixed(5)},{" "}
                        {selectedReport.longitude.toFixed(5)}
                      </dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-[var(--foreground)]">
                        Waktu masuk
                      </dt>
                      <dd className="mt-0.5 text-[var(--muted-foreground)]">
                        {formatDateWib(selectedReport.submittedAt)} WIB
                      </dd>
                    </div>
                  </dl>

                  <div className="grid gap-2 pt-1">
                    <Link
                      href={`/pengelola/verifikasi/${selectedReport.id}`}
                      className="inline-flex min-h-10 items-center justify-between rounded-[var(--radius-control)] bg-[var(--primary)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--primary-hover)]"
                    >
                      <span>Buka detail & verifikasi laporan</span>
                      <ArrowRight aria-hidden="true" className="size-4" />
                    </Link>

                    {selectedReport.tasks.map((task) => (
                      <Link
                        key={task.id}
                        href={`/pengelola/tugas/${task.id}`}
                        className="inline-flex min-h-10 items-center justify-between rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3.5 py-2 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--primary)]"
                      >
                        <span className="truncate"> Tugas: {task.title}</span>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 shrink-0"
                        />
                      </Link>
                    ))}

                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${selectedReport.latitude},${selectedReport.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline"
                    >
                      Buka titik di Google Maps
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  </div>
                </div>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
