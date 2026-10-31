import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/feedback/Alert";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import {
  formatJakarta,
  ReportFacts,
  ReportTimeline,
} from "@/features/reports/components/ReportDetailView";
import { ReviewDecisionForm } from "@/features/reports/components/ReviewDecisionForm";
import {
  getReportAiSuggestions,
  getReportDetail,
  listDuplicateCandidates,
} from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportCategorySchema,
  reportStatusLabels,
  type ReportStatus,
} from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

const suggestionSchema = z.array(
  z.object({
    analysis_id: z.uuid(),
    suggested_category: reportCategorySchema,
    visible_objects: z.array(z.string()),
    draft_description: z.string(),
    suggested_precaution: z.string(),
    limitations: z.string(),
  }),
);

const decidedNotes: Partial<Record<ReportStatus, string>> = {
  needs_information:
    "Menunggu informasi tambahan dari warga. Laporan kembali ke antrean setelah warga menjawab.",
  verified: "Laporan sudah diverifikasi.",
  rejected: "Laporan tidak disetujui.",
  duplicate: "Laporan ditandai sebagai duplikat.",
  in_action: "Laporan sedang ditangani.",
  resolved: "Laporan telah selesai.",
};

export default async function VerificationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ reportId: string }>;
  searchParams: Promise<{ keputusan?: string }>;
}) {
  const { reportId } = await params;
  const access = await getAccessContext();
  if (access.kind === "unauthenticated")
    redirect(`/login?next=/kader/verifikasi`);
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  const decision = decidePortalAccess(access.context, "cadre");
  if (decision.kind === "forbidden") redirect("/forbidden");
  const areas = getVerifiedAreas(access.context, "assigned_cadre");
  const shell = (children: React.ReactNode) => (
    <AppShell
      area={areas[0]}
      displayName={access.context.displayName}
      role="cadre"
    >
      {children}
    </AppShell>
  );
  if (decision.kind === "pending") return shell(<PendingArea />);
  if (!z.uuid().safeParse(reportId).success) notFound();

  let detail;
  try {
    detail = await getReportDetail(reportId);
  } catch {
    return <ServiceUnavailable />;
  }
  if (!detail.report.data && !detail.report.error) notFound();
  if (!detail.report.data || !detail.images || !detail.events)
    return <ServiceUnavailable />;
  const report = detail.report.data;
  // RLS already scopes reads; this keeps manager-style reads out of the cadre page.
  if (!areas.some((area) => area.id === report.areaId)) notFound();

  const pending = report.status === "pending_verification";
  const [suggestions, candidates] = await Promise.all([
    getReportAiSuggestions(report.id),
    pending ? listDuplicateCandidates(report) : null,
  ]);
  const parsedSuggestions = suggestions.error
    ? null
    : suggestionSchema.safeParse(suggestions.data ?? []);
  const saved = (await searchParams).keputusan === "tersimpan" && !pending;

  return shell(
    <>
      <Link
        href="/kader/verifikasi"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--primary)]"
      >
        ← Antrean verifikasi
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <div className="min-w-0">
          {saved ? (
            <div className="mb-5">
              <Alert title="Keputusan tersimpan">
                Status terbaru: {reportStatusLabels[report.status]}.
              </Alert>
            </div>
          ) : null}
          <p className="text-sm font-semibold text-[var(--primary)]">
            {report.publicReference}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Pemeriksaan laporan
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
          {report.duplicateOfReportId ? (
            <p className="mt-4">
              Duplikat dari{" "}
              <Link
                href={`/kader/verifikasi/${report.duplicateOfReportId}`}
                className="font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                laporan rujukan
              </Link>
            </p>
          ) : null}
          <ReportTimeline events={detail.events.data} />
        </div>
        <div className="min-w-0">
          <section
            aria-labelledby="ai-title"
            className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7"
          >
            <h2 id="ai-title" className="text-xl font-bold">
              Saran AI — perlu verifikasi
            </h2>
            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Dibuat otomatis dari foto. Bukan diagnosis dan bukan keputusan;
              periksa foto dan keterangan warga.
            </p>
            {!parsedSuggestions?.success ? (
              <p className="mt-4">Saran AI belum dapat dimuat.</p>
            ) : !parsedSuggestions.data.length ? (
              <p className="mt-4">Tidak ada saran AI untuk laporan ini.</p>
            ) : (
              parsedSuggestions.data.map((item) => (
                <dl key={item.analysis_id} className="mt-4 grid gap-3">
                  <div>
                    <dt className="text-sm font-semibold">Usulan kategori</dt>
                    <dd>{reportCategoryLabels[item.suggested_category]}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold">Objek terlihat</dt>
                    <dd>{item.visible_objects.join(", ")}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold">Draf deskripsi</dt>
                    <dd className="break-words">{item.draft_description}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold">Saran pencegahan</dt>
                    <dd className="break-words">{item.suggested_precaution}</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-semibold">Batasan</dt>
                    <dd className="break-words">{item.limitations}</dd>
                  </div>
                </dl>
              ))
            )}
          </section>
          {pending ? (
            candidates?.error ? (
              <div className="mt-8">
                <Alert variant="error" title="Form keputusan belum tersedia">
                  Muat ulang halaman untuk mencoba lagi.
                </Alert>
              </div>
            ) : (
              <ReviewDecisionForm
                reportId={report.id}
                expectedVersion={report.version}
                candidates={(candidates?.data ?? []).map((item) => ({
                  id: item.id,
                  label: `${item.publicReference} · ${reportCategoryLabels[item.category]} · ${formatJakarta(item.submittedAt, false)}`,
                }))}
              />
            )
          ) : (
            <p className="mt-8 rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4">
              {decidedNotes[report.status] ?? "Laporan sudah diputuskan."}
            </p>
          )}
        </div>
      </div>
    </>,
  );
}
