import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, reportStatusTone } from "@/components/ui/StatusBadge";
import { Alert } from "@/components/feedback/Alert";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { getDefaultPortal, getVerifiedAreas } from "@/features/areas/access";
import { getReportDetail } from "@/features/reports/data";
import { AddInformationForm } from "@/features/reports/components/AddInformationForm";
import {
  ReportFactsCard,
  ReportPhotos,
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
    "Laporan menunggu pemeriksaan pengelola. Belum ada keputusan verifikasi atau tindakan yang dicatat.",
  needs_information:
    "Pengelola membutuhkan informasi tambahan sebelum memutuskan laporan ini.",
  verified: "Laporan telah diverifikasi pengelola wilayah.",
  rejected: "Laporan tidak disetujui. Alasan pengelola tercatat pada riwayat.",
  duplicate: "Laporan ditandai sama dengan laporan lain yang lebih awal.",
  in_action: "Kader yang ditugaskan sedang menindaklanjuti temuan ini.",
  resolved:
    "Tindak lanjut selesai dan buktinya telah diperiksa pengelola. Terima kasih atas laporan Anda.",
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
      <PageHeader
        back={{ href: "/app/laporan", label: "Laporan saya" }}
        title="Detail laporan"
        meta={
          <>
            <span className="font-semibold">{report.publicReference}</span>
            <StatusBadge tone={reportStatusTone[report.status]}>
              {reportStatusLabels[report.status]}
            </StatusBadge>
          </>
        }
      />
      {query.informasi === "terkirim" &&
      report.status === "pending_verification" ? (
        <div className="mb-6 max-w-3xl">
          <Alert title="Informasi tambahan terkirim">
            Laporan kembali menunggu pemeriksaan pengelola.
          </Alert>
        </div>
      ) : null}
      <div className="grid gap-7 lg:grid-cols-12 lg:items-start">
        <div className="grid gap-6 lg:col-span-5">
          <ReportPhotos images={detail.images.data} />
          <p className="rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4">
            {statusNotes[report.status] ??
              "Status laporan diperbarui oleh pengelola wilayah."}
          </p>
        </div>
        <div className="grid gap-6 lg:col-span-7">
          <ReportFactsCard report={report} />
          {report.status === "needs_information" ? (
            <section
              aria-labelledby="information-title"
              className="rounded-[var(--radius-card)] border border-[var(--primary)] bg-[var(--surface)] p-5"
            >
              <h2 id="information-title" className="text-lg font-bold">
                Pengelola meminta informasi tambahan
              </h2>
              {request?.reason ? (
                <p className="mt-2 whitespace-pre-wrap break-words">
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
        </div>
      </div>
    </AppShell>
  );
}
