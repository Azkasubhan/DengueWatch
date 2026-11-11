import Image from "next/image";
import { Check, MapPin, X } from "lucide-react";
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
  type ReportStatus,
} from "@/features/reports/validation";
import { cleanSimulationText } from "@/lib/format/text";

export function formatJakarta(value: string, withTime = true) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: withTime ? "long" : "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

// Photo gallery: when only one photo exists, it stretches cleanly to match its container height.
export function ReportPhotos({
  images,
  stretch = false,
}: {
  images: ReportImage[];
  stretch?: boolean;
}) {
  const validImages = (images ?? []).filter((img) => img.url && img.url.trim());
  const [first, ...rest] = validImages;
  if (!first) {
    return (
      <div
        className={`flex w-full flex-col items-center justify-center rounded-[var(--radius-control)] border border-dashed border-[var(--border)] bg-[var(--background)] p-6 text-center text-xs text-[var(--muted-foreground)] ${
          stretch ? "min-h-[260px] h-full" : "aspect-[4/3]"
        }`}
      >
        <p className="font-semibold text-[var(--foreground)]">
          Foto tidak tersedia
        </p>
        <p className="mt-1 text-[11px]">
          Lampiran foto belum diunggah atau tidak ditemukan di penyimpanan.
        </p>
      </div>
    );
  }

  if (stretch && rest.length === 0) {
    return (
      <div className="relative aspect-[4/3] w-full lg:min-h-[260px] overflow-hidden rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] lg:aspect-auto lg:h-full">
        <Image
          unoptimized
          loading="eager"
          src={first.url}
          alt="Foto laporan 1"
          width={first.width}
          height={first.height}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  const photo = (image: ReportImage, index: number, large: boolean) => (
    <Image
      unoptimized
      loading={index === 0 ? "eager" : "lazy"}
      key={image.id}
      src={image.url}
      alt={`Foto laporan ${index + 1}`}
      width={image.width}
      height={image.height}
      className={`w-full rounded-[var(--radius-control)] border border-[var(--border)] object-cover ${
        large ? "aspect-[4/3]" : "aspect-square"
      }`}
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

export function ReportFactsList({ report }: { report: ReportDetail }) {
  const cleanDescription = cleanSimulationText(report.description);
  const cleanLocation = report.locationNote
    ? cleanSimulationText(report.locationNote)
    : null;

  return (
    <div className="flex h-full flex-col justify-between divide-y divide-[var(--border)] text-sm">
      <dl className="grid grid-cols-2 gap-4 pb-4">
        <div>
          <dt className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            Kategori
          </dt>
          <dd className="mt-1 font-bold text-[var(--foreground)]">
            {reportCategoryLabels[report.category]}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
            Dikirim
          </dt>
          <dd className="mt-1 font-medium text-[var(--foreground)]">
            {formatJakarta(report.submittedAt)} WIB
          </dd>
        </div>
      </dl>

      <dl className="py-4">
        <dt className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          Keterangan temuan
        </dt>
        <dd className="mt-1.5 leading-relaxed whitespace-pre-wrap break-words text-[var(--foreground)]">
          {cleanDescription}
        </dd>
      </dl>

      {report.visibleObjects || report.preventionAdvice ? (
        <dl className="grid gap-4 py-4 sm:grid-cols-2">
          {report.visibleObjects ? (
            <div>
              <dt className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                Ringkasan objek pada foto
              </dt>
              <dd className="mt-1 break-words text-[var(--foreground)]">
                {report.visibleObjects}
              </dd>
            </div>
          ) : null}
          {report.preventionAdvice ? (
            <div>
              <dt className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
                Panduan pencegahan awal
              </dt>
              <dd className="mt-1 break-words text-[var(--foreground)]">
                {report.preventionAdvice}
              </dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <dl className="pt-4">
        <dt className="text-xs font-semibold tracking-wide text-[var(--muted-foreground)] uppercase">
          Lokasi
        </dt>
        <dd className="mt-1.5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium break-words text-[var(--foreground)]">
              {cleanLocation || "Pelapor tidak menulis petunjuk lokasi."}
            </p>
            {report.latitude != null && report.longitude != null ? (
              <p className="mt-0.5 font-mono text-xs tabular-nums text-[var(--muted-foreground)]">
                GPS: {report.latitude.toFixed(5)}, {report.longitude.toFixed(5)}
              </p>
            ) : (
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Titik GPS tidak diberikan.
              </p>
            )}
          </div>
          {report.latitude != null && report.longitude != null ? (
            <LinkButton
              href={`https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="sm"
            >
              <MapPin aria-hidden="true" size={14} />
              Buka di Google Maps
              <span className="sr-only">(tab baru)</span>
            </LinkButton>
          ) : null}
        </dd>
      </dl>
    </div>
  );
}

export function ReportFactsCard({ report }: { report: ReportDetail }) {
  return (
    <div className={cardClass}>
      <ReportFactsList report={report} />
    </div>
  );
}

// Unified card pairing photos on the left with structured facts on the right so there is never dead space below the photo.
export function ReportOverviewCard({
  report,
  images,
}: {
  report: ReportDetail;
  images: ReportImage[];
}) {
  return (
    <section
      aria-label="Rincian laporan dan foto temuan"
      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 shadow-2xs sm:p-6"
    >
      <div className="grid gap-6 lg:grid-cols-12 lg:items-stretch">
        <div className="flex flex-col lg:col-span-5">
          <ReportPhotos images={images} stretch />
        </div>
        <div className="flex flex-col lg:col-span-7">
          <ReportFactsList report={report} />
        </div>
      </div>
    </section>
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

const statusNotes: Record<ReportStatus, string> = {
  pending_verification:
    "Laporan telah diterima dan sedang dalam antrean pemeriksaan pengelola wilayah.",
  needs_information:
    "Pemeriksaan dijeda sementara. Pengelola wilayah membutuhkan keterangan tambahan dari Anda di bawah ini.",
  verified:
    "Laporan telah diverifikasi pengelola wilayah dan siap ditindaklanjuti kader.",
  in_action: "Kader wilayah sedang menindaklanjuti temuan ini di lapangan.",
  resolved:
    "Penanganan lapangan telah selesai dan bukti tindak lanjut telah disetujui pengelola wilayah.",
  rejected:
    "Laporan ditutup saat pemeriksaan karena belum memenuhi kriteria tindak lanjut lapangan. Lihat alasan pada riwayat laporan.",
  duplicate:
    "Laporan digabungkan karena temuan di lokasi yang sama sudah dilaporkan lebih dulu.",
};

export function ReportStatusOverview({
  status,
  events,
}: {
  status: ReportStatus;
  events: ReportEvent[];
}) {
  const latestEvent = events[events.length - 1];
  const isTerminalNonAction = status === "rejected" || status === "duplicate";

  const steps: Array<{
    key: string;
    title: string;
    subtitle: string;
    state: "done" | "current" | "warning" | "danger" | "upcoming";
  }> = isTerminalNonAction
    ? [
        {
          key: "submitted",
          title: "Dikirim",
          subtitle: "Laporan diterima",
          state: "done",
        },
        {
          key: "closed",
          title:
            status === "rejected"
              ? "Ditutup saat pemeriksaan"
              : "Digabungkan (Duplikat)",
          subtitle:
            status === "rejected"
              ? "Lihat alasan pada riwayat"
              : "Mengikuti laporan terdahulu",
          state: status === "rejected" ? "danger" : "current",
        },
      ]
    : [
        {
          key: "submitted",
          title: "Dikirim",
          subtitle: "Laporan tercatat",
          state: "done",
        },
        {
          key: "review",
          title: "Diperiksa",
          subtitle:
            status === "needs_information"
              ? "Perlu keterangan warga"
              : status === "pending_verification"
                ? "Dalam antrean pengelola"
                : "Telah diverifikasi",
          state:
            status === "needs_information"
              ? "warning"
              : status === "pending_verification"
                ? "current"
                : "done",
        },
        {
          key: "action",
          title: "Ditangani",
          subtitle:
            status === "resolved"
              ? "Tindak lanjut selesai"
              : status === "in_action"
                ? "Kader bertugas"
                : status === "verified"
                  ? "Menunggu penugasan"
                  : "Menunggu verifikasi",
          state:
            status === "resolved"
              ? "done"
              : status === "in_action" || status === "verified"
                ? "current"
                : "upcoming",
        },
        {
          key: "resolved",
          title: "Selesai",
          subtitle:
            status === "resolved" ? "Bukti disetujui" : "Menunggu penyelesaian",
          state: status === "resolved" ? "done" : "upcoming",
        },
      ];

  return (
    <section
      aria-label="Progres status laporan"
      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] px-4 py-4 shadow-2xs sm:px-6"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] pb-3">
        <p className="text-sm font-medium text-[var(--foreground)]">
          {statusNotes[status]}
        </p>
        {latestEvent ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            Diperbarui {formatJakarta(latestEvent.createdAt)} WIB
          </p>
        ) : null}
      </div>

      <ol
        className={`mt-5 grid w-full ${
          isTerminalNonAction ? "grid-cols-2" : "grid-cols-4"
        }`}
      >
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const circleClass =
            step.state === "done"
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : step.state === "current"
                ? "border-2 border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--primary)]"
                : step.state === "warning"
                  ? "border-2 border-[var(--warning)] bg-[var(--warning-subtle)] text-[var(--warning)]"
                  : step.state === "danger"
                    ? "border-2 border-[var(--danger)] bg-[var(--danger-subtle)] text-[var(--danger)]"
                    : "border border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]";

          const lineClass =
            step.state === "done"
              ? "bg-[var(--primary)]"
              : "bg-[var(--border)]";

          return (
            <li
              key={step.key}
              className="relative flex min-w-0 flex-col items-center px-2 text-center"
            >
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={`absolute top-3.5 left-1/2 h-0.5 w-full -translate-y-1/2 ${lineClass}`}
                />
              ) : null}
              <span
                aria-hidden="true"
                className={`relative z-10 inline-flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ring-4 ring-[var(--surface)] ${circleClass}`}
              >
                {step.state === "done" ? (
                  <Check className="size-3.5 stroke-[2.5]" />
                ) : step.state === "danger" ? (
                  <X className="size-3.5 stroke-[2.5]" />
                ) : (
                  index + 1
                )}
              </span>
              <p
                className={`mt-2 w-full truncate text-xs font-bold ${
                  step.state === "upcoming"
                    ? "text-[var(--muted-foreground)]"
                    : "text-[var(--foreground)]"
                }`}
              >
                {step.title}
              </p>
              <p className="mt-0.5 hidden w-full truncate text-[11px] text-[var(--muted-foreground)] sm:block">
                {step.subtitle}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
