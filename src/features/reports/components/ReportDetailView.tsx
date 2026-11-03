import Image from "next/image";
import { MapPin } from "lucide-react";
import { cardClass } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";
import { Timeline } from "@/components/ui/Timeline";
import type {
  ReportDetail,
  ReportEvent,
  ReportImage,
} from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportEventLabels,
} from "@/features/reports/validation";

export function formatJakarta(value: string, withTime = true) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: withTime ? "long" : "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

// Left column on report pages: first photo large, others as thumbnails.
export function ReportPhotos({ images }: { images: ReportImage[] }) {
  const [first, ...rest] = images;
  if (!first) return null;
  const photo = (image: ReportImage, index: number, large: boolean) => (
    <Image
      unoptimized
      loading={index === 0 ? "eager" : "lazy"}
      key={image.id}
      src={image.url}
      alt={`Foto laporan ${index + 1}`}
      width={image.width}
      height={image.height}
      className={`w-full rounded-[var(--radius-card)] border border-[var(--border)] object-cover ${large ? "aspect-[4/3]" : "aspect-square"}`}
    />
  );
  return (
    <div className="grid gap-3">
      {photo(first, 0, true)}
      {rest.length ? (
        <div className="grid grid-cols-2 gap-3">
          {rest.map((image, index) => photo(image, index + 1, false))}
        </div>
      ) : null}
    </div>
  );
}

export function ReportFactsCard({ report }: { report: ReportDetail }) {
  return (
    <dl className={`grid gap-5 sm:grid-cols-2 ${cardClass}`}>
      <div>
        <dt className="text-sm font-semibold">Kategori</dt>
        <dd className="mt-1">{reportCategoryLabels[report.category]}</dd>
      </div>
      <div>
        <dt className="text-sm font-semibold">Dikirim</dt>
        <dd className="mt-1">{formatJakarta(report.submittedAt)} WIB</dd>
      </div>
      <div className="sm:col-span-2">
        <dt className="text-sm font-semibold">Deskripsi</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words">
          {report.description}
        </dd>
      </div>
      <div className="rounded-[var(--radius-control)] bg-[var(--background)] p-4 sm:col-span-2">
        <dt className="text-sm font-semibold">Lokasi</dt>
        <dd className="mt-1 grid gap-3">
          <p className="break-words">
            {report.locationNote || "Pelapor tidak menulis petunjuk lokasi."}
          </p>
          {report.latitude != null && report.longitude != null ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
              <p className="text-sm text-[var(--muted-foreground)]">
                Titik GPS dari perangkat pelapor
                <span className="block tabular-nums text-[var(--foreground)]">
                  {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
                </span>
              </p>
              {/* Coordinates leave DengueWatch only when an authorized viewer opens the map themselves. */}
              <LinkButton
                href={`https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                variant="secondary"
              >
                <MapPin aria-hidden="true" size={16} />
                Buka di Google Maps
                <span className="sr-only">(tab baru)</span>
              </LinkButton>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted-foreground)]">
              Titik GPS tidak diberikan.
            </p>
          )}
        </dd>
      </div>
    </dl>
  );
}

export function ReportTimeline({ events }: { events: ReportEvent[] }) {
  return (
    <Timeline
      id="report-history-title"
      title="Riwayat laporan"
      items={events.map((event) => ({
        id: event.id,
        label: reportEventLabels[event.eventType] ?? "Pembaruan laporan",
        reason: event.reason,
        time: `${formatJakarta(event.createdAt)} WIB`,
      }))}
    />
  );
}
