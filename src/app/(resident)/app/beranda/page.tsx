import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  FilePlus2,
  Plus,
  Sparkles,
} from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { AppShell } from "@/components/layout/AppShell";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { LinkButton } from "@/components/ui/LinkButton";
import {
  decidePortalAccess,
  getDefaultPortal,
  getVerifiedAreas,
} from "@/features/areas/access";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { getResidentReportSummary } from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportEventLabels,
} from "@/features/reports/validation";
import memotretTemuanImage from "@/features/landing/images/memotret-temuan.webp";
import waterContainerImage from "@/features/landing/images/water-container.webp";
import discardedTireImage from "@/features/landing/images/discarded-tire.webp";
import cloggedDrainImage from "@/features/landing/images/clogged-drain.webp";
import { getAccessContext } from "@/lib/auth/context";
import { cleanSimulationText } from "@/lib/format/text";

export const dynamic = "force-dynamic";

const residentEventTitle: Record<string, string> = {
  report_created: "Laporan dikirim dan menunggu pemeriksaan",
  report_verified: "Laporan diverifikasi pengelola wilayah",
  report_information_requested: "Pengelola meminta keterangan tambahan",
  report_information_added: "Keterangan tambahan telah dikirim",
  report_action_started: "Penanganan lapangan dimulai kader",
  report_resolved: "Penanganan selesai dan bukti disetujui",
  report_reopened: "Penanganan dibuka kembali oleh pengelola",
  report_rejected: "Laporan ditutup saat pemeriksaan",
  report_marked_duplicate: "Laporan digabungkan dengan temuan sebelumnya",
};

export default async function ResidentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ auth?: string; logout?: string }>;
}) {
  const query = await searchParams;
  const result = await getAccessContext();
  if (result.kind === "unauthenticated") {
    redirect("/login?next=/app/beranda");
  }
  if (result.kind !== "authenticated") {
    return <ServiceUnavailable />;
  }
  if (result.context.role !== "resident") {
    const portal = getDefaultPortal(result.context.role);
    const params = new URLSearchParams();
    if (query.auth) params.set("auth", query.auth);
    if (query.logout) params.set("logout", query.logout);
    const qs = params.toString();
    redirect(qs ? `${portal}?${qs}` : portal);
  }

  const decision = decidePortalAccess(result.context, "resident");
  const area = getVerifiedAreas(result.context, "resident")[0];
  const summaryResult =
    decision.kind === "allowed"
      ? await getResidentReportSummary()
      : { data: null, error: null };

  const displayName = cleanSimulationText(result.context.displayName);
  const summary = summaryResult.data;
  const needsInfoList = summary?.needsInformationReports ?? [];
  const hasReports = (summary?.total ?? 0) > 0;

  return (
    <AppShell
      area={area}
      displayName={result.context.displayName}
      role="resident"
    >
      {query.logout === "failed" ? (
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
          {/* A. Header ringkas */}
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3.5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
                Halo, {displayName}
              </h1>
            </div>
            <Link
              href="/app/laporan"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
            >
              Arsip laporan saya ({summary?.total ?? 0})
              <ArrowRight aria-hidden="true" className="size-3.5" />
            </Link>
          </header>

          {/* B. Perlu tanggapan Anda (Hanya tampil jika ada needs_information) */}
          {needsInfoList.length > 0 ? (
            <section
              aria-labelledby="needs-info-banner"
              className="rounded-[var(--radius-card)] border border-[var(--warning)] bg-[var(--surface)] p-4 shadow-2xs"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-[var(--warning-subtle)] text-[var(--warning)]">
                    <AlertTriangle aria-hidden="true" className="size-3.5" />
                  </span>
                  <h2
                    id="needs-info-banner"
                    className="text-sm font-bold text-[var(--foreground)]"
                  >
                    Perlu tanggapan Anda ({needsInfoList.length})
                  </h2>
                </div>
                {needsInfoList.length > 1 ? (
                  <Link
                    href="/app/laporan?status=needs_information"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    Lihat semua ({needsInfoList.length})
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : null}
              </div>

              <ul className="mt-3 grid gap-2.5">
                {needsInfoList.slice(0, 2).map((item) => (
                  <li
                    key={item.id}
                    className="flex flex-col justify-between gap-3 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--warning-subtle)]/40 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-[var(--foreground)]">
                          {reportCategoryLabels[item.category]}
                        </span>
                        <span className="font-mono text-xs font-semibold text-[var(--muted-foreground)]">
                          {item.publicReference}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--foreground)]">
                        {item.requestReason
                          ? `Permintaan pengelola: "${item.requestReason}"`
                          : "Pengelola wilayah meminta keterangan tambahan untuk memverifikasi lokasi temuan ini."}
                      </p>
                    </div>
                    <Link
                      href={`/app/laporan/${item.id}`}
                      className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--primary)] px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--primary-hover)]"
                    >
                      Lengkapi informasi
                      <ArrowRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* C. Panel utama pelaporan */}
          <section
            aria-labelledby="primary-report-cta"
            className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--primary)]/25 bg-[var(--surface)] shadow-xs"
          >
            <div className="grid items-center gap-4 p-4 sm:grid-cols-12 sm:p-5">
              <div className="sm:col-span-8 lg:col-span-9">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--primary-subtle)] px-2.5 py-0.5 text-xs font-semibold text-[var(--primary)]">
                  <Camera aria-hidden="true" className="size-3.5" />
                  Pelaporan Lingkungan Warga
                </span>
                <h2
                  id="primary-report-cta"
                  className="mt-2 text-lg font-bold tracking-tight text-[var(--foreground)] sm:text-xl"
                >
                  Temukan kondisi lingkungan yang perlu diperiksa?
                </h2>
                <p className="mt-1 max-w-xl text-sm text-[var(--muted-foreground)]">
                  Kirim foto dan keterangan singkat. Pengelola wilayah akan
                  memeriksa laporan Anda.
                </p>
                <div className="mt-3.5 flex flex-wrap items-center gap-3">
                  <LinkButton href="/app/laporan/buat">
                    <Plus aria-hidden="true" className="size-4" />
                    Buat laporan
                  </LinkButton>
                  <span className="text-xs text-[var(--muted-foreground)]">
                    Cukup 1–3 foto temuan · AI bantu isi draf otomatis
                  </span>
                </div>
              </div>

              <div className="hidden sm:col-span-4 sm:flex sm:justify-end lg:col-span-3">
                <div className="relative h-28 w-full max-w-[190px] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--background)]">
                  <Image
                    src={memotretTemuanImage}
                    alt="Warga memotret kondisi lingkungan yang berpotensi menampung air"
                    fill
                    sizes="190px"
                    className="object-cover"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Desktop 2 kolom: D. Kabar terbaru laporan Anda (lebar) & E. Panduan singkat (kanan) */}
          <div className="grid gap-5 lg:grid-cols-12 lg:items-start">
            {/* D. Kabar terbaru laporan Anda */}
            <section
              aria-labelledby="updates-title"
              className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 lg:col-span-7"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] pb-3">
                <div>
                  <h2
                    id="updates-title"
                    className="text-base font-bold text-[var(--foreground)]"
                  >
                    Kabar terbaru laporan Anda
                  </h2>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    Pembaruan terkini dari pemeriksaan dan tindak lanjut
                    lapangan.
                  </p>
                </div>
                {hasReports ? (
                  <Link
                    href="/app/laporan"
                    className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
                  >
                    Semua laporan
                    <ArrowRight aria-hidden="true" className="size-3.5" />
                  </Link>
                ) : null}
              </div>

              {summaryResult.error ? (
                <div className="mt-4">
                  <Alert variant="error">
                    Pembaruan laporan belum dapat dimuat. Muat ulang halaman
                    ini.
                  </Alert>
                </div>
              ) : !hasReports ? (
                <div className="mt-4 rounded-[var(--radius-control)] border border-dashed border-[var(--border)] bg-[var(--background)] p-5">
                  <div className="flex items-start gap-3">
                    <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-subtle)] text-[var(--primary)]">
                      <FilePlus2 aria-hidden="true" className="size-5" />
                    </span>
                    <div>
                      <p className="text-sm font-bold text-[var(--foreground)]">
                        Mulai dari laporan lingkungan pertama Anda
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[var(--muted-foreground)]">
                        Anda belum pernah mengirim laporan. Jika melihat wadah
                        terbuka berisi air, ban bekas, atau saluran mampet di
                        lingkungan sekitar, ambil foto dan kirimkan agar dapat
                        diperiksa pengelola wilayah.
                      </p>
                      <div className="mt-3">
                        <Link
                          href="/app/laporan/buat"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--primary)] hover:underline"
                        >
                          Buat laporan pertama
                          <ArrowRight aria-hidden="true" className="size-3.5" />
                        </Link>
                      </div>
                    </div>
                  </div>
                </div>
              ) : summary?.recentEvents.length ? (
                <ul className="mt-3 divide-y divide-[var(--border)]">
                  {summary.recentEvents.map((ev) => {
                    const eventLabel =
                      residentEventTitle[ev.eventType] ??
                      reportEventLabels[ev.eventType] ??
                      "Pembaruan laporan";
                    const isResolved = ev.eventType === "report_resolved";
                    const isStarted =
                      ev.eventType === "report_action_started" ||
                      ev.eventType === "report_verified";

                    return (
                      <li key={ev.id} className="py-3 first:pt-1 last:pb-0">
                        <Link
                          href={`/app/laporan/${ev.reportId}`}
                          className="group flex items-start justify-between gap-3 rounded-[var(--radius-control)] p-1.5 -mx-1.5 transition hover:bg-[var(--background)]"
                        >
                          <div className="flex min-w-0 items-start gap-3">
                            <span
                              className={`mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-full ${
                                isResolved
                                  ? "bg-[var(--primary-subtle)] text-[var(--primary)]"
                                  : isStarted
                                    ? "bg-[var(--info-subtle)] text-[var(--info)]"
                                    : "bg-[var(--background)] text-[var(--muted-foreground)]"
                              }`}
                            >
                              {isResolved ? (
                                <CheckCircle2
                                  aria-hidden="true"
                                  className="size-4"
                                />
                              ) : (
                                <Clock aria-hidden="true" className="size-4" />
                              )}
                            </span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                                {eventLabel}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[var(--muted-foreground)]">
                                <span className="font-medium text-[var(--foreground)]">
                                  {reportCategoryLabels[ev.category]}
                                </span>
                                <span>·</span>
                                <span className="font-mono">
                                  {ev.publicReference}
                                </span>
                                <span>·</span>
                                <span>{formatJakarta(ev.createdAt)} WIB</span>
                              </div>
                              {ev.reason ? (
                                <p className="mt-1 line-clamp-1 text-xs text-[var(--muted-foreground)]">
                                  Catatan: {ev.reason}
                                </p>
                              ) : null}
                            </div>
                          </div>
                          <ChevronRight
                            aria-hidden="true"
                            className="mt-1 size-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--primary)]"
                          />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="mt-4 text-xs text-[var(--muted-foreground)]">
                  Semua laporan yang memerlukan tindakan Anda sudah ditampilkan
                  di atas. Buka{" "}
                  <Link
                    href="/app/laporan"
                    className="font-semibold text-[var(--primary)] hover:underline"
                  >
                    Laporan saya
                  </Link>{" "}
                  untuk melihat arsip lengkap.
                </p>
              )}
            </section>

            {/* E. Panduan singkat (Maksimal 2 bagian ringkas) */}
            <aside
              aria-labelledby="guide-title"
              className="grid gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 lg:col-span-5"
            >
              <div>
                <h2
                  id="guide-title"
                  className="text-base font-bold text-[var(--foreground)]"
                >
                  Panduan singkat
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Kenali objek yang perlu dilaporkan dan cara memotretnya.
                </p>
              </div>

              {/* Bagian 1: Apa yang bisa dilaporkan? */}
              <details
                open
                className="group rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-3.5"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-[var(--foreground)]">
                  <span>1. Apa yang bisa dilaporkan?</span>
                  <span className="text-xs font-normal text-[var(--muted-foreground)] group-open:hidden">
                    Buka
                  </span>
                </summary>
                <div className="mt-3 grid gap-2.5 text-xs text-[var(--muted-foreground)]">
                  <p className="rounded-md bg-[var(--primary-subtle)]/70 px-2.5 py-2 font-medium text-[var(--foreground)]">
                    Anda <strong>tidak harus melihat jentik</strong> terlebih
                    dahulu untuk melapor kondisi lingkungan yang berpotensi
                    menampung air.
                  </p>
                  <div className="grid grid-cols-3 gap-2 pt-0.5">
                    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <Image
                        src={waterContainerImage}
                        alt="Contoh wadah terbuka berisi air"
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <p className="p-1.5 text-[11px] font-semibold leading-tight text-[var(--foreground)]">
                        Wadah terbuka berisi air
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <Image
                        src={discardedTireImage}
                        alt="Contoh ban atau barang bekas menampung air"
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <p className="p-1.5 text-[11px] font-semibold leading-tight text-[var(--foreground)]">
                        Ban & barang bekas
                      </p>
                    </div>
                    <div className="overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)]">
                      <Image
                        src={cloggedDrainImage}
                        alt="Contoh saluran tersumbat atau genangan"
                        className="aspect-[4/3] w-full object-cover"
                      />
                      <p className="p-1.5 text-[11px] font-semibold leading-tight text-[var(--foreground)]">
                        Saluran mampet / genangan
                      </p>
                    </div>
                  </div>
                </div>
              </details>

              {/* Bagian 2: Tips foto agar mudah diperiksa */}
              <details className="group rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] p-3.5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-bold text-[var(--foreground)]">
                  <span>2. Tips foto agar mudah diperiksa</span>
                  <span className="text-xs font-semibold text-[var(--primary)] group-open:hidden">
                    Lihat tips
                  </span>
                </summary>
                <ul className="mt-2.5 grid gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <li className="flex items-start gap-2">
                    <Sparkles
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0 text-[var(--primary)]"
                    />
                    <span>
                      <strong className="text-[var(--foreground)]">
                        Objek terlihat jelas:
                      </strong>{" "}
                      Pastikan wadah, ban, atau titik genangan tampak terang dan
                      tidak buram.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0 text-[var(--primary)]"
                    />
                    <span>
                      <strong className="text-[var(--foreground)]">
                        Sertakan konteks sekitar:
                      </strong>{" "}
                      Foto ke-2 dapat menampilkan patokan lokasi (pagar, gang,
                      atau fasilitas umum) agar mudah ditemukan petugas.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Sparkles
                      aria-hidden="true"
                      className="mt-0.5 size-3.5 shrink-0 text-[var(--primary)]"
                    />
                    <span>
                      <strong className="text-[var(--foreground)]">
                        Jaga privasi warga:
                      </strong>{" "}
                      Hindari memotret wajah orang atau dokumen/identitas
                      pribadi.
                    </span>
                  </li>
                </ul>
              </details>
            </aside>
          </div>
        </div>
      )}
    </AppShell>
  );
}
