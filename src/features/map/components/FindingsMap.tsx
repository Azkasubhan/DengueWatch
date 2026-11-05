"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Flame,
  Info,
  Layers,
  MapPin,
  Minus,
  Plus,
  RotateCcw,
  X,
} from "lucide-react";
import { StatusBadge, reportStatusTone } from "@/components/ui/StatusBadge";
import type { MapReportPoint } from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportStatusLabels,
  type ReportStatus,
} from "@/features/reports/validation";

const DEFAULT_CENTER = { lat: -6.2, lon: 106.816666 };

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

function primaryActionLabel(report: MapReportPoint): string {
  if (report.status === "pending_verification") return "Periksa laporan";
  if (report.status === "verified" && report.tasks.length === 0)
    return "Buat tugas";
  return "Detail laporan";
}

export function FindingsMap({
  reports,
  missingCoordinatesCount,
  totalMatching,
  withCoordinatesTotal,
  isTruncated = false,
  pointLimit = 300,
  areaId,
  initialMode = "points",
  variant = "dashboard",
  toolbarSlot,
  fullMapHref,
}: {
  reports: MapReportPoint[];
  missingCoordinatesCount: number;
  totalMatching?: number;
  withCoordinatesTotal?: number;
  isTruncated?: boolean;
  pointLimit?: number;
  areaId?: string;
  initialMode?: "points" | "heatmap";
  variant?: "dashboard" | "full";
  toolbarSlot?: ReactNode;
  fullMapHref?: string;
}) {
  const validDensityReports = useMemo(
    () =>
      reports.filter(
        (r) => r.status !== "rejected" && r.status !== "duplicate",
      ),
    [reports],
  );

  const [mode, setMode] = useState<"points" | "heatmap">(initialMode);
  const [selectedId, setSelectedId] = useState<string | null>(
    reports[0]?.id ?? null,
  );
  const [tileError, setTileError] = useState(false);

  const viewportRef = useRef<HTMLDivElement>(null);
  const [viewportSize, setViewportSize] = useState<{
    width: number;
    height: number;
  }>({
    width: 840,
    height: variant === "full" ? 420 : 360,
  });

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const updateSize = () => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        setViewportSize({
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        });
      }
    };
    updateSize();
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => updateSize());
      observer.observe(el);
      return () => observer.disconnect();
    }
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

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

  const viewW = viewportSize.width;
  const viewH = viewportSize.height;
  const centerWorldX = lonToWorldX(initialBounds.lon, zoom) + panOffset.x;
  const centerWorldY = latToWorldY(initialBounds.lat, zoom) + panOffset.y;

  const tileTemplate =
    process.env.NEXT_PUBLIC_MAP_TILE_URL ??
    "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

  const tiles = useMemo(() => {
    const maxTileIndex = Math.pow(2, zoom) - 1;
    const minTx = Math.floor((centerWorldX - viewW / 2) / 256);
    const maxTx = Math.floor((centerWorldX + viewW / 2) / 256);
    const minTy = Math.floor((centerWorldY - viewH / 2) / 256);
    const maxTy = Math.floor((centerWorldY + viewH / 2) / 256);

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
          left: Math.round(viewW / 2 + (tx * 256 - centerWorldX)),
          top: Math.round(viewH / 2 + (ty * 256 - centerWorldY)),
        });
      }
    }
    return list;
  }, [centerWorldX, centerWorldY, tileTemplate, viewH, viewW, zoom]);

  const projectedPoints = useMemo(() => {
    return reports.map((report) => {
      const wx = lonToWorldX(report.longitude, zoom);
      const wy = latToWorldY(report.latitude, zoom);
      return {
        ...report,
        x: Math.round(viewW / 2 + (wx - centerWorldX)),
        y: Math.round(viewH / 2 + (wy - centerWorldY)),
      };
    });
  }, [centerWorldX, centerWorldY, reports, viewH, viewW, zoom]);

  // Nearby point clustering in "points" mode (26px cell radius) so overlapping markers stay selectable
  const pointClusters = useMemo(() => {
    const cellSize = 26;
    const map = new Map<
      string,
      {
        key: string;
        x: number;
        y: number;
        items: typeof projectedPoints;
      }
    >();
    for (const pt of projectedPoints) {
      const gx = Math.floor(pt.x / cellSize);
      const gy = Math.floor(pt.y / cellSize);
      const key = `${gx}:${gy}`;
      const existing = map.get(key);
      if (!existing) {
        map.set(key, { key, x: pt.x, y: pt.y, items: [pt] });
      } else {
        const nextCount = existing.items.length + 1;
        existing.x = Math.round(
          (existing.x * existing.items.length + pt.x) / nextCount,
        );
        existing.y = Math.round(
          (existing.y * existing.items.length + pt.y) / nextCount,
        );
        existing.items.push(pt);
      }
    }
    return Array.from(map.values());
  }, [projectedPoints]);

  // Spatial clustering for heatmap cells (68px grid)
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
        existing.x = Math.round(
          (existing.x * existing.count + pt.x) / nextCount,
        );
        existing.y = Math.round(
          (existing.y * existing.count + pt.y) / nextCount,
        );
        existing.count = nextCount;
        existing.items.push(pt);
      }
    }
    return Array.from(cells.values());
  }, [projectedPoints]);

  const selectedReport = useMemo(
    () =>
      selectedId ? (reports.find((r) => r.id === selectedId) ?? null) : null,
    [reports, selectedId],
  );

  // Find if selectedReport belongs to a multi-item cluster so user can step through overlapping items
  const activeClusterItems = useMemo(() => {
    if (!selectedReport) return [];
    const list = mode === "points" ? pointClusters : densityClusters;
    const found = list.find((c) =>
      c.items.some((item) => item.id === selectedReport.id),
    );
    return found?.items ?? [selectedReport];
  }, [densityClusters, mode, pointClusters, selectedReport]);

  const activeClusterIndex = useMemo(() => {
    if (!selectedReport) return 0;
    const idx = activeClusterItems.findIndex((i) => i.id === selectedReport.id);
    return idx >= 0 ? idx : 0;
  }, [activeClusterItems, selectedReport]);

  const mappedTotal = withCoordinatesTotal ?? reports.length;
  const overallTotal = totalMatching ?? mappedTotal + missingCoordinatesCount;

  const computedFullMapHref = useMemo(() => {
    if (!fullMapHref) return null;
    const sep = fullMapHref.includes("?") ? "&" : "?";
    return `${fullMapHref}${sep}mode=${mode}`;
  }, [fullMapHref, mode]);

  const areaQuerySuffix = areaId ? `?areaId=${encodeURIComponent(areaId)}` : "";

  return (
    <div>
      {/* Integrated Toolbar: Optional Filter Slot + Mode Switcher + Full Map Link */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Mode tampilan peta"
            className="inline-flex rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-0.5"
          >
            <button
              type="button"
              onClick={() => setMode("points")}
              aria-pressed={mode === "points"}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                mode === "points"
                  ? "bg-[var(--primary)] text-white shadow-2xs"
                  : "text-[var(--foreground)] hover:bg-[var(--surface)]"
              }`}
            >
              <MapPin aria-hidden="true" className="size-3.5" />
              Titik ({reports.length})
            </button>
            <button
              type="button"
              onClick={() => setMode("heatmap")}
              aria-pressed={mode === "heatmap"}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                mode === "heatmap"
                  ? "bg-[var(--primary)] text-white shadow-2xs"
                  : "text-[var(--foreground)] hover:bg-[var(--surface)]"
              }`}
            >
              <Flame aria-hidden="true" className="size-3.5" />
              Kepadatan ({validDensityReports.length})
            </button>
          </div>

          {mode === "heatmap" && validDensityReports.length < 3 ? (
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--info-subtle)] px-2 py-1 text-[11px] font-medium text-[var(--info)]">
              <Info aria-hidden="true" className="size-3 shrink-0" />
              Titik valid sedikit ({validDensityReports.length}); kepadatan
              dihitung dari data yang tersedia.
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {toolbarSlot}
          {computedFullMapHref ? (
            <Link
              href={computedFullMapHref}
              className="inline-flex min-h-8 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)] transition hover:border-[var(--primary)]"
            >
              Buka peta penuh
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      {/* Map Viewport (340-400px on desktop, 260-300px on mobile) */}
      <div
        ref={viewportRef}
        className={`relative w-full overflow-hidden bg-[var(--sand)] select-none ${
          variant === "full"
            ? "h-[290px] sm:h-[420px]"
            : "h-[275px] sm:h-[365px]"
        }`}
      >
        {/* Basemap Layer: 1:1 256px Web Mercator tiles anchored to live viewportSize */}
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
                  left: `${tile.left}px`,
                  top: `${tile.top}px`,
                  width: "256px",
                  height: "256px",
                }}
                className="absolute max-w-none opacity-90"
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
              className="size-7 text-[var(--muted-foreground)]"
            />
            <p className="mt-2 text-sm font-bold text-[var(--foreground)]">
              Tidak ada titik berkoordinat GPS pada filter ini
            </p>
            <p className="mt-1 max-w-md text-xs text-[var(--muted-foreground)]">
              {missingCoordinatesCount > 0
                ? `${missingCoordinatesCount} laporan sesuai filter tidak menyertakan titik koordinat GPS (tetap tersedia di daftar verifikasi).`
                : "Belum ada laporan dengan koordinat GPS pada rentang dan filter yang dipilih."}
            </p>
          </div>
        ) : null}

        {/* Heatmap Layer */}
        {mode === "heatmap" && reports.length > 0 ? (
          <div className="absolute inset-0 z-10">
            {densityClusters.map((cluster, idx) => {
              if (
                cluster.x < -80 ||
                cluster.x > viewW + 80 ||
                cluster.y < -80 ||
                cluster.y > viewH + 80
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
                    left: `${cluster.x}px`,
                    top: `${cluster.y}px`,
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

        {/* Point Markers Layer (with automatic nearby clustering) */}
        {mode === "points" && reports.length > 0 ? (
          <div className="absolute inset-0 z-10">
            {pointClusters.map((cluster) => {
              if (
                cluster.x < -30 ||
                cluster.x > viewW + 30 ||
                cluster.y < -30 ||
                cluster.y > viewH + 30
              ) {
                return null;
              }
              const lead = cluster.items[0]!;
              const isSelected = cluster.items.some(
                (item) => item.id === selectedReport?.id,
              );
              const count = cluster.items.length;

              return (
                <button
                  key={cluster.key}
                  type="button"
                  onClick={() => setSelectedId(lead.id)}
                  style={{
                    left: `${cluster.x}px`,
                    top: `${cluster.y}px`,
                  }}
                  aria-label={
                    count > 1
                      ? `Pilih kelompok ${count} titik temuan di sekitar ${lead.publicReference}`
                      : `Pilih temuan ${lead.publicReference} (${reportCategoryLabels[lead.category]})`
                  }
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full transition-transform focus-visible:outline-2 focus-visible:outline-[var(--primary)] ${
                    isSelected ? "z-20 scale-125" : "z-10 hover:scale-110"
                  }`}
                >
                  <span
                    className={`relative flex size-7 items-center justify-center rounded-full ring-2 shadow-md ${statusDotClass(
                      lead.status,
                    )}`}
                  >
                    <MapPin
                      aria-hidden="true"
                      className="size-3.5 text-white"
                    />
                    {count > 1 ? (
                      <span className="absolute -top-1.5 -right-1.5 inline-flex min-w-4 items-center justify-center rounded-full bg-[var(--foreground)] px-1 text-[10px] font-bold text-[var(--surface)] ring-1 ring-white">
                        {count}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Desktop Floating Popover for Selected Point (Does not change page height!) */}
        {selectedReport ? (
          <aside
            aria-label="Detail titik terpilih"
            className=" hidden sm:block absolute top-3 left-3 z-30 w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)]/96 p-3.5 shadow-md backdrop-blur-xs"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-[var(--foreground)]">
                  {reportCategoryLabels[selectedReport.category]}
                </p>
                <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                  {selectedReport.locationNote ||
                    `${selectedReport.latitude.toFixed(5)}, ${selectedReport.longitude.toFixed(5)}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                aria-label="Tutup detail titik"
                className="rounded p-1 text-[var(--muted-foreground)] hover:bg-[var(--background)] hover:text-[var(--foreground)]"
              >
                <X aria-hidden="true" className="size-3.5" />
              </button>
            </div>

            {activeClusterItems.length > 1 ? (
              <div className="mt-2 flex items-center justify-between rounded-md bg-[var(--background)] px-2.5 py-1 text-[11px]">
                <span className="font-semibold text-[var(--foreground)]">
                  Titik berdekatan ({activeClusterIndex + 1}/
                  {activeClusterItems.length})
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const prev =
                        activeClusterItems[
                          (activeClusterIndex - 1 + activeClusterItems.length) %
                            activeClusterItems.length
                        ];
                      if (prev) setSelectedId(prev.id);
                    }}
                    aria-label="Titik sebelumnya"
                    className="rounded p-0.5 hover:bg-[var(--surface)]"
                  >
                    <ChevronLeft aria-hidden="true" className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next =
                        activeClusterItems[
                          (activeClusterIndex + 1) % activeClusterItems.length
                        ];
                      if (next) setSelectedId(next.id);
                    }}
                    aria-label="Titik berikutnya"
                    className="rounded p-0.5 hover:bg-[var(--surface)]"
                  >
                    <ChevronRight aria-hidden="true" className="size-3.5" />
                  </button>
                </div>
              </div>
            ) : null}

            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5">
              <StatusBadge tone={reportStatusTone[selectedReport.status]}>
                {reportStatusLabels[selectedReport.status]}
              </StatusBadge>
              <div className="flex items-center gap-2">
                {selectedReport.tasks[0] ? (
                  <Link
                    href={`/pengelola/tugas/${selectedReport.tasks[0].id}${areaQuerySuffix}`}
                    className="inline-flex min-h-8 items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1 text-xs font-semibold text-[var(--foreground)] hover:border-[var(--primary)]"
                  >
                    Lihat tugas
                  </Link>
                ) : null}
                <Link
                  href={`/pengelola/verifikasi/${selectedReport.id}${areaQuerySuffix}`}
                  className="inline-flex min-h-8 items-center gap-1 rounded-[var(--radius-control)] bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-white hover:bg-[var(--primary-hover)]"
                >
                  {primaryActionLabel(selectedReport)}
                  <ArrowRight aria-hidden="true" className="size-3" />
                </Link>
              </div>
            </div>
          </aside>
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
        <div className="absolute bottom-2.5 left-3 z-20 flex items-center gap-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]/95 px-2 py-0.5 text-[11px] font-medium text-[var(--muted-foreground)] shadow-xs">
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
        <div className="absolute right-2.5 bottom-2.5 z-20 rounded bg-[var(--surface)]/90 px-2 py-0.5 text-[10px] text-[var(--muted-foreground)] shadow-2xs">
          {tileError ? (
            <span>Kanvas koordinat lokal (peta dasar luring)</span>
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

      {/* Mobile Detail Bar Below Map (Zero horizontal overflow, compact height) */}
      {selectedReport ? (
        <div className="border-t border-[var(--border)] bg-[var(--background)] p-3 sm:hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="truncate text-xs font-bold text-[var(--foreground)]">
                  {reportCategoryLabels[selectedReport.category]}
                </span>
                <StatusBadge tone={reportStatusTone[selectedReport.status]}>
                  {reportStatusLabels[selectedReport.status]}
                </StatusBadge>
              </div>
              <p className="mt-1 truncate text-xs text-[var(--muted-foreground)]">
                {selectedReport.locationNote ||
                  `${selectedReport.latitude.toFixed(5)}, ${selectedReport.longitude.toFixed(5)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              aria-label="Tutup detail titik"
              className="rounded p-1 text-[var(--muted-foreground)]"
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>

          {activeClusterItems.length > 1 ? (
            <div className="mt-2 flex items-center justify-between rounded bg-[var(--surface)] px-2.5 py-1 text-xs">
              <span>
                Titik berdekatan ({activeClusterIndex + 1}/
                {activeClusterItems.length})
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next =
                      activeClusterItems[
                        (activeClusterIndex + 1) % activeClusterItems.length
                      ];
                    if (next) setSelectedId(next.id);
                  }}
                  className="font-semibold text-[var(--primary)]"
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          ) : null}

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Link
              href={`/pengelola/verifikasi/${selectedReport.id}${areaQuerySuffix}`}
              className="inline-flex min-h-9 flex-1 items-center justify-center gap-1 rounded-[var(--radius-control)] bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white"
            >
              {primaryActionLabel(selectedReport)}
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
            {selectedReport.tasks[0] ? (
              <Link
                href={`/pengelola/tugas/${selectedReport.tasks[0].id}${areaQuerySuffix}`}
                className="inline-flex min-h-9 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)]"
              >
                Lihat tugas
              </Link>
            ) : null}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${selectedReport.latitude},${selectedReport.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-9 items-center justify-center gap-1 px-2 text-xs font-semibold text-[var(--primary)]"
            >
              Google Maps
              <ExternalLink aria-hidden="true" className="size-3" />
            </a>
          </div>
        </div>
      ) : null}

      {/* Compact Footer: Legend & Data Coverage */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-xs">
        {mode === "points" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-[var(--foreground)]">
              Legenda:
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[var(--warning)]" />
              Perlu verifikasi / info
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
              Kepadatan laporan lingkungan valid:
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[var(--primary)]" />1
              laporan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[var(--warning)]" />
              2–3 laporan
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-[var(--danger)]" />≥ 4
              laporan
            </span>
            <span className="text-[11px] text-[var(--muted-foreground)]">
              (Ditolak & duplikat dikecualikan)
            </span>
          </div>
        )}

        <div className="text-xs text-[var(--muted-foreground)]">
          {isTruncated ? (
            <span>
              Menampilkan{" "}
              <strong className="text-[var(--foreground)]">
                {reports.length}
              </strong>{" "}
              titik terbaru (batas {pointLimit}) dari{" "}
              <strong className="text-[var(--foreground)]">
                {mappedTotal}
              </strong>{" "}
              laporan berkoordinat ·{" "}
              <strong className="text-[var(--foreground)]">
                {missingCoordinatesCount}
              </strong>{" "}
              belum memiliki koordinat.
            </span>
          ) : (
            <span>
              <strong className="text-[var(--foreground)]">
                {mappedTotal}
              </strong>{" "}
              dari{" "}
              <strong className="text-[var(--foreground)]">
                {overallTotal}
              </strong>{" "}
              laporan dapat dipetakan ·{" "}
              <strong className="text-[var(--foreground)]">
                {missingCoordinatesCount}
              </strong>{" "}
              belum memiliki koordinat.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
