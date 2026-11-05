import { BarChart3 } from "lucide-react";
import type { DailyTrendPoint } from "@/features/analytics/data";

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return dateStr;
  const date = new Date(Date.UTC(y, m - 1, d, 5, 0, 0));
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function DailyTrendChart({
  points,
  from,
  to,
}: {
  points: DailyTrendPoint[];
  from: string;
  to: string;
}) {
  const totalSubmitted = points.reduce((acc, p) => acc + p.submitted, 0);
  const totalResolved = points.reduce((acc, p) => acc + p.resolved, 0);
  const maxVal = Math.max(
    4,
    ...points.map((p) => Math.max(p.submitted, p.resolved)),
  );

  // If the range is > 31 days, bucket into weeks or sample so bars stay readable.
  const displayPoints: Array<{
    key: string;
    label: string;
    submitted: number;
    resolved: number;
  }> = [];

  if (points.length <= 21) {
    for (const p of points) {
      displayPoints.push({
        key: p.date,
        label: formatShortDate(p.date),
        submitted: p.submitted,
        resolved: p.resolved,
      });
    }
  } else {
    const chunkSize = Math.ceil(points.length / 14);
    for (let i = 0; i < points.length; i += chunkSize) {
      const slice = points.slice(i, i + chunkSize);
      const first = slice[0]!;
      const last = slice[slice.length - 1]!;
      displayPoints.push({
        key: `${first.date}-${last.date}`,
        label: formatShortDate(first.date),
        submitted: slice.reduce((acc, item) => acc + item.submitted, 0),
        resolved: slice.reduce((acc, item) => acc + item.resolved, 0),
      });
    }
  }

  const chartMax = Math.max(
    4,
    ...displayPoints.map((p) => Math.max(p.submitted, p.resolved)),
  );

  return (
    <section
      aria-labelledby="daily-trend-heading"
      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3.5">
        <div>
          <h2 id="daily-trend-heading" className="text-base font-bold">
            Tren Harian Laporan Masuk & Selesai
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            Periode {formatShortDate(from)} – {formatShortDate(to)} (WIB) ·
            Satuan: laporan
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--foreground)]">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-xs bg-[var(--primary)]"
            />
            Masuk ({totalSubmitted} laporan)
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-[var(--foreground)]">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-xs bg-[var(--info)]"
            />
            Selesai ({totalResolved} laporan)
          </span>
        </div>
      </div>

      {totalSubmitted === 0 && totalResolved === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <BarChart3
            aria-hidden="true"
            className="size-8 text-[var(--muted-foreground)] opacity-60"
          />
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            Belum ada pergerakan laporan pada periode ini
          </p>
          <p className="mt-1 max-w-md text-xs text-[var(--muted-foreground)]">
            Grafik akan menampilkan jumlah laporan masuk (berdasarkan tanggal
            kirim) dan laporan selesai (berdasarkan tanggal tuntas) dalam satuan
            laporan.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <div
            className="grid h-44 grid-cols-7 items-end gap-1.5 pt-4 sm:flex sm:items-end sm:justify-between sm:gap-2"
            role="img"
            aria-label={`Grafik tren periode ${from} sampai ${to}: ${totalSubmitted} laporan masuk dan ${totalResolved} laporan selesai. Maksimum ${maxVal} laporan.`}
          >
            {displayPoints.map((point, index) => {
              const subHeight = Math.max(
                point.submitted > 0 ? 10 : 2,
                Math.round((point.submitted / chartMax) * 128),
              );
              const resHeight = Math.max(
                point.resolved > 0 ? 10 : 2,
                Math.round((point.resolved / chartMax) * 128),
              );
              const showLabel =
                displayPoints.length <= 10 ||
                index === 0 ||
                index === displayPoints.length - 1 ||
                index % Math.ceil(displayPoints.length / 6) === 0;

              return (
                <div
                  key={point.key}
                  className="group flex flex-1 flex-col items-center gap-1.5"
                  title={`${point.label}: ${point.submitted} masuk, ${point.resolved} selesai`}
                >
                  <div className="flex h-32 w-full items-end justify-center gap-0.5 sm:gap-1">
                    <div
                      style={{ height: `${subHeight}px` }}
                      className={`w-2 rounded-t-xs transition-all sm:w-2.5 ${
                        point.submitted > 0
                          ? "bg-[var(--primary)]"
                          : "bg-[var(--border)] opacity-50"
                      }`}
                    />
                    <div
                      style={{ height: `${resHeight}px` }}
                      className={`w-2 rounded-t-xs transition-all sm:w-2.5 ${
                        point.resolved > 0
                          ? "bg-[var(--info)]"
                          : "bg-[var(--border)] opacity-50"
                      }`}
                    />
                  </div>
                  <span className="h-4 text-[10px] tabular-nums text-[var(--muted-foreground)]">
                    {showLabel ? point.label : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
