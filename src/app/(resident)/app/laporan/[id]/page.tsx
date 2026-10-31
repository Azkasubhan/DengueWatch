import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Alert } from "@/components/feedback/Alert";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { getDefaultPortal, getVerifiedAreas } from "@/features/areas/access";
import { getReportDetail } from "@/features/reports/data";
import { AddInformationForm } from "@/features/reports/components/AddInformationForm";
import {
  ReportFacts,
  ReportTimeline,
} from "@/features/reports/components/ReportDetailView";
import {
  reportStatusLabels,
  type ReportStatus,
} from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";
import { z } from "zod";

export const dynamic = "force-dynamic";

const statusNotes: Partial<Record<ReportStatus, string>> = {
  pending_verification:
    "Laporan menunggu pemeriksaan kader. Belum ada keputusan verifikasi atau tindakan yang dicatat.",
  needs_information:
    "Kader membutuhkan informasi tambahan sebelum memutuskan laporan ini.",
  verified: "Laporan telah diverifikasi kader wilayah.",
  rejected: "Laporan tidak disetujui. Alasan kader tercatat pada riwayat.",
  duplicate: "Laporan ditandai sama dengan laporan lain yang lebih awal.",
  in_action: "Kader sedang menindaklanjuti temuan ini.",
  resolved:
    "Tindak lanjut selesai dan buktinya telah diperiksa kader. Terima kasih atas laporan Anda.",
};

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ informasi?: string }>;
}) {
  const query = await searchParams;
  const access = await getAccessContext();
  if (access.kind === "unauthenticated") redirect("/login?next=/app/laporan");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  if (access.context.role !== "resident")
    redirect(getDefaultPortal(access.context.role));
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let detail;
  try {
    detail = await getReportDetail(id);
  } catch {
    return <ServiceUnavailable />;
  }
  if (!detail.report.data && !detail.report.error) notFound();
  if (
    !detail.report.data ||
    detail.report.error ||
    !detail.images ||
    !detail.events ||
    detail.images.error ||
    detail.events.error
  )
    return <ServiceUnavailable />;
  const report = detail.report.data;
  const area = getVerifiedAreas(access.context, "resident").find(
    (item) => item.id === report.areaId,
  );
  const request = detail.events.data.findLast(
    (event) => event.eventType === "report_information_requested",
  );
  return (
    <AppShell
      area={area}
      displayName={access.context.displayName}
      role="resident"
    >
      <Link
        href="/app/laporan"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--primary)]"
      >
        ← Laporan saya
      </Link>
      <div className="mt-5 max-w-3xl">
        {query.informasi === "terkirim" &&
        report.status === "pending_verification" ? (
          <div className="mb-5">
            <Alert title="Informasi tambahan terkirim">
              Laporan kembali menunggu pemeriksaan kader.
            </Alert>
          </div>
        ) : null}
        <p className="text-sm font-semibold text-[var(--primary)]">
          {report.publicReference}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Detail laporan
        </h1>
        <p className="mt-3 inline-block rounded-[var(--radius-control)] bg-[var(--primary-subtle)] px-3 py-2 font-semibold">
          {reportStatusLabels[report.status]}
        </p>
        {report.isDemo ? (
          <p className="mt-4 text-sm font-semibold">
            DATA SIMULASI — bukan data kasus DBD sebenarnya
          </p>
        ) : null}
        <ReportFacts images={detail.images.data} report={report} />
        {report.status === "needs_information" ? (
          <section
            aria-labelledby="information-title"
            className="mt-8 rounded-[var(--radius-card)] border border-[var(--primary)] bg-[var(--surface)] p-5 sm:p-7"
          >
            <h2 id="information-title" className="text-2xl font-bold">
              Kader meminta informasi tambahan
            </h2>
            {request?.reason ? (
              <p className="mt-3 whitespace-pre-wrap break-words">
                {request.reason}
              </p>
            ) : null}
            <AddInformationForm
              reportId={report.id}
              expectedVersion={report.version}
            />
          </section>
        ) : null}
        <ReportTimeline events={detail.events.data} />
        <p className="mb-10 rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4">
          {statusNotes[report.status] ??
            "Status laporan diperbarui oleh kader wilayah."}
        </p>
      </div>
    </AppShell>
  );
}
