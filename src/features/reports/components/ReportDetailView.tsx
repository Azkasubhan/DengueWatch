import Image from "next/image";
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

export function ReportFacts({
  images,
  report,
}: {
  images: ReportImage[];
  report: ReportDetail;
}) {
  return (
    <>
      <div
        className={`mt-7 grid gap-3 sm:grid-cols-3 ${images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
      >
        {images.map((image, index) => (
          <Image
            unoptimized
            loading={index === 0 ? "eager" : "lazy"}
            key={image.id}
            src={image.url}
            alt={`Foto laporan ${index + 1}`}
            width={image.width}
            height={image.height}
            className="aspect-square w-full rounded-[var(--radius-control)] border border-[var(--border)] object-cover"
          />
        ))}
      </div>
      <dl className="mt-8 grid gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
        <div>
          <dt className="text-sm font-semibold">Kategori</dt>
          <dd className="mt-1">{reportCategoryLabels[report.category]}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold">Deskripsi</dt>
          <dd className="mt-1 whitespace-pre-wrap break-words">
            {report.description}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-semibold">Dikirim</dt>
          <dd className="mt-1">{formatJakarta(report.submittedAt)} WIB</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold">Lokasi privat</dt>
          <dd className="mt-1">
            {report.latitude != null && report.longitude != null
              ? `${report.latitude}, ${report.longitude}`
              : "Titik lokasi tidak diberikan"}
            {report.locationNote ? (
              <span className="mt-1 block break-words">
                Petunjuk lokasi: {report.locationNote}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>
    </>
  );
}

export function ReportTimeline({ events }: { events: ReportEvent[] }) {
  return (
    <section aria-labelledby="report-history-title" className="mt-8">
      <h2 id="report-history-title" className="text-2xl font-bold">
        Riwayat laporan
      </h2>
      <ol className="mt-5 border-l-2 border-[var(--border)] pl-5">
        {events.map((event) => (
          <li key={event.id} className="pb-6">
            <p className="font-semibold">
              {reportEventLabels[event.eventType] ?? "Pembaruan laporan"}
            </p>
            {event.reason ? (
              <p className="mt-1 whitespace-pre-wrap break-words">
                {event.reason}
              </p>
            ) : null}
            <p className="mt-1 text-sm text-[var(--muted-foreground)]">
              {formatJakarta(event.createdAt)} WIB
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
