import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Copy,
  MapPin,
  XCircle,
} from "lucide-react";
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

export function formatJakarta(value: string, withTime = true) {
  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: withTime ? "long" : "medium",
    ...(withTime ? { timeStyle: "short" } : {}),
    timeZone: "Asia/Jakarta",
  }).format(new Date(value));
}

// Left column on report pages: first photo large, others as thumbnails.
export function ReportPhotos({ images }: { images: ReportImage[] }) {
  const validImages = (images ?? []).filter((img) => img.url && img.url.trim());
  const [first, ...rest] = validImages;
  if (!first) {
    return (
      <div className="flex aspect-[4/3] w-full flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center text-xs text-[var(--muted-foreground)]">
        <p className="font-semibold text-[var(--foreground)]">
          Foto tidak tersedia
        </p>
        <p className="mt-1 text-[11px]">
          Lampiran foto belum diunggah atau tidak ditemukan di penyimpanan.
        </p>
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
        <dt className="text-sm font-semibold">Keterangan temuan</dt>
        <dd className="mt-1 whitespace-pre-wrap break-words">
          {report.description}
        </dd>
      </div>
      {report.visibleObjects ? (
        <div className="sm:col-span-2">
          <dt className="text-sm font-semibold">Ringkasan objek pada foto</dt>
          <dd className="mt-1 break-words text-sm text-[var(--muted-foreground)]">
            {report.visibleObjects}
          </dd>
        </div>
      ) : null}
      {report.preventionAdvice ? (
        <div className="rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-3.5 sm:col-span-2">
          <dt className="text-xs font-semibold text-[var(--muted-foreground)]">
            Panduan pencegahan awal (informasi sistem/AI · bukan pengganti
            verifikasi petugas)
          </dt>
          <dd className="mt-1 break-words text-sm text-[var(--foreground)]">
            {report.preventionAdvice}
          </dd>
        </div>
      ) : null}
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

  const normalSteps: Array<{
    key: string;
    title: string;
    subtitle: string;
    state: "done" | "current" | "warning" | "upcoming";
  }> = [
    {
      key: "submitted",
      title: "1. Dikirim",
      subtitle: "Laporan tercatat",
      state: "done",
    },
    {
      key: "review",
      title: "2. Diperiksa",
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
      title: "3. Ditangani",
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
      title: "4. Selesai",
      subtitle:
        status === "resolved" ? "Bukti disetujui" : "Menunggu penyelesaian",
      state: status === "resolved" ? "done" : "upcoming",
    },
  ];

  return (
    <section
      aria-label="Progres status laporan"
      className="mb-6 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border)] pb-3.5">
        <div>
          <p className="text-xs font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
            Pembaruan terakhir
          </p>
          <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
            {statusNotes[status]}
          </p>
        </div>
        {latestEvent ? (
          <p className="text-xs text-[var(--muted-foreground)]">
            Diperbarui {formatJakarta(latestEvent.createdAt)} WIB
          </p>
        ) : null}
      </div>

      {isTerminalNonAction ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-3">
            <CheckCircle2
              aria-hidden="true"
              className="size-5 shrink-0 text-[var(--primary)]"
            />
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">
                1. Dikirim
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Laporan diterima sistem
              </p>
            </div>
          </div>
          <div
            className={`flex items-center gap-3 rounded-[var(--radius-control)] border p-3 ${
              status === "rejected"
                ? "border-[var(--danger)] bg-[var(--danger-subtle)]"
                : "border-[var(--info)] bg-[var(--info-subtle)]"
            }`}
          >
            {status === "rejected" ? (
              <XCircle
                aria-hidden="true"
                className="size-5 shrink-0 text-[var(--danger)]"
              />
            ) : (
              <Copy
                aria-hidden="true"
                className="size-5 shrink-0 text-[var(--info)]"
              />
            )}
            <div>
              <p className="text-sm font-bold text-[var(--foreground)]">
                {status === "rejected"
                  ? "2. Ditutup tanpa penugasan"
                  : "2. Digabungkan (Duplikat)"}
              </p>
              <p className="text-xs text-[var(--muted-foreground)]">
                {status === "rejected"
                  ? "Lihat catatan alasan pengelola pada riwayat"
                  : "Mengikuti penanganan laporan terdahulu"}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <ol className="mt-4 grid gap-2.5 sm:grid-cols-4">
          {normalSteps.map((step) => {
            const style =
              step.state === "done"
                ? "border-[var(--primary)] bg-[var(--primary-subtle)] text-[var(--foreground)]"
                : step.state === "warning"
                  ? "border-[var(--warning)] bg-[var(--warning-subtle)] text-[var(--foreground)]"
                  : step.state === "current"
                    ? "border-[var(--primary)] bg-[var(--surface)] text-[var(--foreground)] ring-1 ring-[var(--primary)]"
                    : "border-[var(--border)] bg-[var(--background)] text-[var(--muted-foreground)]";
            return (
              <li
                key={step.key}
                className={`flex items-start gap-2.5 rounded-[var(--radius-control)] border p-3 ${style}`}
              >
                {step.state === "done" ? (
                  <CheckCircle2
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-[var(--primary)]"
                  />
                ) : step.state === "warning" ? (
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0 text-[var(--warning)]"
                  />
                ) : (
                  <Clock
                    aria-hidden="true"
                    className="mt-0.5 size-4 shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold">{step.title}</p>
                  <p className="mt-0.5 text-xs opacity-85">{step.subtitle}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
