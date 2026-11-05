import Link from "next/link";
import { AlertCircle, BarChart3 } from "lucide-react";
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

function formatRangeLabel(firstDate: string, lastDate: string): string {
  if (firstDate === lastDate) return formatShortDate(firstDate);
  const [y1, m1, d1] = firstDate.split("-").map(Number);
  const [y2, m2, d2] = lastDate.split("-").map(Number);
  if (y1 === y2 && m1 === m2 && d1 && d2) {
    const endFormatted = formatShortDate(lastDate);
    const monthPart = endFormatted.split(" ").slice(1).join(" ");
    return `${d1}–${d2} ${monthPart}`;
  }
  return `${formatShortDate(firstDate)}–${formatShortDate(lastDate)}`;
}

function computeNiceEvenMax(rawMax: number): number {
  if (rawMax <= 2) return 2;
  if (rawMax <= 4) return 4;
  if (rawMax <= 6) return 6;
  if (rawMax <= 8) return 8;
  if (rawMax <= 10) return 10;
  return Math.ceil(rawMax / 4) * 4;
}

const PLOT_HEIGHT_PX = 148;

export function DailyTrendChart({
  points,
  from,
  to,
  hasError = false,
  retryHref = "/pengelola/ringkasan",
}: {
  points: DailyTrendPoint[];
  from: string;
  to: string;
  hasError?: boolean;
  retryHref?: string;
}) {
  if (hasError) {
    return (
      <section
        aria-labelledby="daily-trend-heading"
        className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
      >
        <h2
          id="daily-trend-heading"
          className="text-base font-bold text-[var(--foreground)]"
        >
          Laporan masuk dan selesai
        </h2>
        <div
          role="alert"
          className="mt-3 rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-3.5 text-xs text-[var(--danger)]"
        >
          <p className="flex items-center gap-1.5 font-semibold">
            <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
            Data grafik belum dapat dimuat.
          </p>
          <p className="mt-1 text-[var(--foreground)]">
            Kegagalan pemuatan tidak ditampilkan sebagai angka nol.
          </p>
          <Link
            href={retryHref}
            className="mt-2 inline-flex font-semibold text-[var(--primary)] underline underline-offset-2"
          >
            Muat ulang grafik
          </Link>
        </div>
      </section>
    );
  }

  const totalSubmitted = points.reduce((acc, p) => acc + p.submitted, 0);
  const totalResolved = points.reduce((acc, p) => acc + p.resolved, 0);

  const isDaily = points.length <= 14;
  const chunkSize = isDaily ? 1 : Math.ceil(points.length / 10);

  const displayPoints: Array<{
    key: string;
    shortLabel: string;
    fullLabel: string;
    submitted: number;
    resolved: number;
  }> = [];

  if (isDaily) {
    for (const p of points) {
      const label = formatShortDate(p.date);
      displayPoints.push({
        key: p.date,
        shortLabel: label,
        fullLabel: label,
        submitted: p.submitted,
        resolved: p.resolved,
      });
    }
  } else {
    for (let i = 0; i < points.length; i += chunkSize) {
      const slice = points.slice(i, i + chunkSize);
      const first = slice[0]!;
      const last = slice[slice.length - 1]!;
      const rangeLabel = formatRangeLabel(first.date, last.date);
      displayPoints.push({
        key: `${first.date}-${last.date}`,
        shortLabel: rangeLabel,
        fullLabel: `${formatShortDate(first.date)} – ${formatShortDate(last.date)}`,
        submitted: slice.reduce((acc, item) => acc + item.submitted, 0),
        resolved: slice.reduce((acc, item) => acc + item.resolved, 0),
      });
    }
  }

  const rawMax = Math.max(
    0,
    ...displayPoints.map((p) => Math.max(p.submitted, p.resolved)),
  );
  const chartMax = computeNiceEvenMax(rawMax);
  const midTick = chartMax / 2;

  const aggregationSubtitle = isDaily
    ? "Agregasi harian (WIB) · Berdasarkan tanggal kirim & tanggal selesai"
    : `Agregasi per rentang ${chunkSize} hari (WIB) · Berdasarkan tanggal kirim & tanggal selesai`;

  return (
    <section
      aria-labelledby="daily-trend-heading"
      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-[var(--border)] pb-3">
        <div>
          <h2
            id="daily-trend-heading"
            className="text-base font-bold text-[var(--foreground)]"
          >
            Laporan masuk dan selesai
          </h2>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {formatShortDate(from)} – {formatShortDate(to)} ·{" "}
            {aggregationSubtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-xs bg-[var(--primary)]"
            />
            Masuk ({totalSubmitted})
          </span>
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--foreground)]">
            <span
              aria-hidden="true"
              className="size-2.5 rounded-xs bg-[var(--info)]"
            />
            Selesai ({totalResolved})
          </span>
        </div>
      </div>

      {totalSubmitted === 0 && totalResolved === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart3
            aria-hidden="true"
            className="size-7 text-[var(--muted-foreground)] opacity-60"
          />
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            Tidak ada laporan masuk atau selesai pada rentang ini
          </p>
          <p className="mt-1 max-w-sm text-xs text-[var(--muted-foreground)]">
            Ubah rentang tanggal pada filter periode untuk melihat pergerakan
            pada periode lain.
          </p>
        </div>
      ) : (
        <div className="mt-4">
          <div
            role="img"
            aria-label={`Grafik laporan masuk dan selesai periode ${from} sampai ${to}: total ${totalSubmitted} masuk dan ${totalResolved} selesai.`}
            className="grid grid-cols-[2rem_1fr] gap-2"
          >
            {/* Sumbu Y dengan angka bulat */}
            <div
              aria-hidden="true"
              style={{ height: `${PLOT_HEIGHT_PX}px` }}
              className="flex flex-col justify-between text-right text-[11px] font-medium tabular-nums text-[var(--muted-foreground)]"
            >
              <span className="-translate-y-1.5">{chartMax}</span>
              <span className="-translate-y-1">{midTick}</span>
              <span className="translate-y-1">0</span>
            </div>

            {/* Area Plot + Sumbu X */}
            <div className="min-w-0">
              <div
                style={{ height: `${PLOT_HEIGHT_PX}px` }}
                className="relative flex items-end justify-between gap-1 border-b border-[var(--border)] px-1 sm:gap-1.5"
              >
                {/* Garis bantu horizontal pada chartMax dan midTick */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-[var(--border)]/80"
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-[var(--border)]/80"
                />

                {displayPoints.map((point) => {
                  // Proporsional murni: nilai 0 = 0px (tidak digambar sebagai batang positif)
                  const subHeightPx =
                    point.submitted > 0
                      ? Math.round(
                          (point.submitted / chartMax) * PLOT_HEIGHT_PX,
                        )
                      : 0;
                  const resHeightPx =
                    point.resolved > 0
                      ? Math.round((point.resolved / chartMax) * PLOT_HEIGHT_PX)
                      : 0;

                  return (
                    <div
                      key={point.key}
                      tabIndex={0}
                      aria-label={`${point.fullLabel}: ${point.submitted} laporan masuk, ${point.resolved} laporan selesai`}
                      title={`${point.fullLabel}: ${point.submitted} masuk, ${point.resolved} selesai`}
                      className="group relative flex h-full flex-1 items-end justify-center gap-0.5 rounded-t-xs focus-visible:outline-2 focus-visible:outline-[var(--primary)] sm:gap-1"
                    >
                      {/* Tooltip saat hover / focus */}
                      <div className="pointer-events-none invisible absolute -top-8 left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded bg-[var(--foreground)] px-2 py-0.5 text-[10px] font-semibold text-[var(--surface)] shadow-xs group-hover:visible group-focus-visible:visible">
                        {point.shortLabel}: {point.submitted} masuk ·{" "}
                        {point.resolved} selesai
                      </div>

                      <div
                        style={{ height: `${subHeightPx}px` }}
                        className="w-2 rounded-t-xs bg-[var(--primary)] transition-all sm:w-2.5"
                      />
                      <div
                        style={{ height: `${resHeightPx}px` }}
                        className="w-2 rounded-t-xs bg-[var(--info)] transition-all sm:w-2.5"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Label Sumbu X */}
              <div className="mt-1.5 flex items-start justify-between gap-1 px-1">
                {displayPoints.map((point, index) => {
                  const maxVisibleLabels = isDaily ? 7 : 5;
                  const step = Math.max(
                    1,
                    Math.ceil(displayPoints.length / maxVisibleLabels),
                  );
                  const showLabel =
                    displayPoints.length <= maxVisibleLabels ||
                    index === 0 ||
                    index === displayPoints.length - 1 ||
                    index % step === 0;

                  return (
                    <div
                      key={point.key}
                      className="flex-1 text-center text-[10px] leading-tight tabular-nums text-[var(--muted-foreground)]"
                    >
                      {showLabel ? (
                        <span className="inline-block truncate max-w-[4.5rem]">
                          {point.shortLabel}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <details className="mt-3 border-t border-[var(--border)] pt-2.5 text-xs">
            <summary className="cursor-pointer font-semibold text-[var(--primary)] hover:underline">
              Lihat rincian angka grafik ({displayPoints.length}{" "}
              {isDaily ? "hari" : "rentang tanggal"})
            </summary>
            <div className="mt-2 max-h-40 overflow-y-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-2">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted-foreground)]">
                    <th className="pb-1 font-semibold">
                      {isDaily ? "Tanggal (WIB)" : "Rentang Tanggal (WIB)"}
                    </th>
                    <th className="pb-1 text-right font-semibold">Masuk</th>
                    <th className="pb-1 text-right font-semibold">Selesai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]/60 tabular-nums">
                  {displayPoints.map((p) => (
                    <tr key={p.key}>
                      <td className="py-1 pr-2">{p.fullLabel}</td>
                      <td className="py-1 text-right font-medium">
                        {p.submitted}
                      </td>
                      <td className="py-1 text-right font-medium">
                        {p.resolved}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
