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
  ReportOverviewCard,
  ReportStatusOverview,
  ReportTimeline,
} from "@/features/reports/components/ReportDetailView";
import { reportStatusLabels } from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";
import { z } from "zod";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ informasi?: string; status?: string }>;
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
      {query.status === "terkirim" ? (
        <div className="mb-5 max-w-3xl">
          <Alert title={`Laporan ${report.publicReference} berhasil dikirim`}>
            Terima kasih. Laporan Anda telah tercatat dengan nomor referensi{" "}
            <strong className="font-mono">{report.publicReference}</strong> dan
            sedang menunggu pemeriksaan pengelola wilayah.
          </Alert>
        </div>
      ) : null}
      {query.informasi === "terkirim" &&
      report.status === "pending_verification" ? (
        <div className="mb-5 max-w-3xl">
          <Alert title="Informasi tambahan terkirim">
            Laporan kembali menunggu pemeriksaan pengelola.
          </Alert>
        </div>
      ) : null}

      <div className="grid gap-5">
        <ReportStatusOverview
          status={report.status}
          events={detail.events.data}
        />

        {report.status === "needs_information" ? (
          <section
            id="tanggapan-warga"
            aria-labelledby="information-title"
            className="rounded-[var(--radius-card)] border border-[var(--warning)] bg-[var(--surface)] p-5 shadow-2xs"
          >
            <h2 id="information-title" className="text-lg font-bold">
              Pengelola meminta informasi tambahan
            </h2>
            {request?.reason ? (
              <p className="mt-2 rounded-[var(--radius-control)] bg-[var(--warning-subtle)] p-3 text-sm whitespace-pre-wrap break-words">
                {request.reason}
              </p>
            ) : null}
            <AddInformationForm
              reportId={report.id}
              expectedVersion={report.version}
            />
          </section>
        ) : null}

        <ReportOverviewCard report={report} images={detail.images.data} />

        <ReportTimeline events={detail.events.data} />
      </div>
    </AppShell>
  );
}
