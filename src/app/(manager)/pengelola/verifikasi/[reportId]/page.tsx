import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { Alert } from "@/components/feedback/Alert";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  StatusBadge,
  reportStatusTone,
  taskStatusTone,
} from "@/components/ui/StatusBadge";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import {
  formatJakarta,
  ReportFactsCard,
  ReportPhotos,
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
import { CreateTaskForm } from "@/features/tasks/components/CreateTaskForm";
import {
  listAreaCadres,
  listTaskAssignees,
  listTasks,
} from "@/features/tasks/data";
import { taskStatusLabels } from "@/features/tasks/validation";
import { getAccessContext } from "@/lib/auth/context";
import { cardClass } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

const suggestionSchema = z.array(
  z.object({
    analysis_id: z.uuid(),
    suggested_category: reportCategorySchema,
    visible_objects: z.array(z.string()),
    draft_description: z.string(),
    suggested_precaution: z.string(),
    limitations: z.string(),
    analyzed_at: z.string(),
  }),
);

const decidedNotes: Partial<Record<ReportStatus, string>> = {
  needs_information:
    "Menunggu informasi tambahan dari warga. Laporan kembali ke antrean setelah warga menjawab.",
  verified: "Laporan sudah diverifikasi. Buat tugas tindak lanjut di bawah.",
  rejected: "Laporan tidak disetujui.",
  duplicate: "Laporan ditandai sebagai duplikat.",
  in_action: "Laporan sedang ditangani melalui tugas tindak lanjut.",
  resolved: "Semua tugas wajib selesai dan buktinya telah diperiksa.",
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
    redirect(`/login?next=/pengelola/verifikasi`);
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  const decision = decidePortalAccess(access.context, "manager");
  if (decision.kind === "forbidden") redirect("/forbidden");
  const areas = getVerifiedAreas(access.context, "manager");
  // Detail pages show the bar (and its SIMULASI flag) for the item's own area.
  const shell = (children: React.ReactNode, area = areas[0]) => (
    <AppShell
      area={area}
      displayName={access.context.displayName}
      role="manager"
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
  // RLS already scopes reads; this keeps reports outside the managed areas out of this page.
  if (!areas.some((area) => area.id === report.areaId)) notFound();

  const pending = report.status === "pending_verification";
  const [suggestions, candidates] = await Promise.all([
    getReportAiSuggestions(report.id),
    pending ? listDuplicateCandidates(report) : null,
  ]);
  const parsedSuggestions = suggestions.error
    ? null
    : suggestionSchema.safeParse(suggestions.data ?? []);
  // A report links at most one suggestion: the last one the resident saw.
  const suggestion = parsedSuggestions?.success
    ? parsedSuggestions.data[0]
    : undefined;
  // T29: the AI fills the form directly. The marker shows only when a stored text field
  // still matches the AI draft (a category can match by chance), and flags reports
  // submitted exactly as drafted.
  const aiTextMatches = suggestion
    ? [
        suggestion.visible_objects.join(", ") === report.visibleObjects,
        suggestion.draft_description === report.description,
        suggestion.suggested_precaution === report.preventionAdvice,
      ]
    : [];
  const aiUsed = aiTextMatches.some(Boolean);
  const aiUnchanged =
    aiTextMatches.every(Boolean) &&
    suggestion?.suggested_category === report.category;
  const saved = (await searchParams).keputusan === "tersimpan" && !pending;
  const actionable = ["verified", "in_action", "resolved"].includes(
    report.status,
  );
  const tasks = actionable
    ? await listTasks(1, 50, { reportId: report.id }, access.context.userId)
    : null;
  const canAssign =
    report.status === "verified" || report.status === "in_action";
  const [cadres, assignees] = await Promise.all([
    canAssign ? listAreaCadres(report.areaId) : null,
    listTaskAssignees(tasks?.data?.map((task) => task.id) ?? []),
  ]);

  return shell(
    <>
      <PageHeader
        back={{ href: "/pengelola/verifikasi", label: "Antrean verifikasi" }}
        title="Pemeriksaan laporan"
        meta={
          <>
            <span className="font-semibold">{report.publicReference}</span>
            <StatusBadge tone={reportStatusTone[report.status]}>
              {reportStatusLabels[report.status]}
            </StatusBadge>
          </>
        }
      />
      <div className="grid gap-7 lg:grid-cols-12 lg:items-start">
        <div className="grid min-w-0 gap-6 lg:col-span-5">
          <ReportPhotos images={detail.images.data} />
        </div>
        <div className="grid min-w-0 gap-6 lg:col-span-7">
          {saved ? (
            <div>
              <Alert title="Keputusan tersimpan">
                Status terbaru: {reportStatusLabels[report.status]}.
              </Alert>
            </div>
          ) : null}
          {suggestion && aiUsed ? (
            <p className="rounded-[var(--radius-control)] bg-[var(--info-subtle)] p-4 text-sm">
              <span className="font-semibold">
                Diisi dengan bantuan AI
                {aiUnchanged ? " · tidak diubah warga" : ""}
              </span>
              <span className="block text-[var(--muted-foreground)]">
                Analisis {formatJakarta(suggestion.analyzed_at)} WIB. Isian AI
                bukan diagnosis; cocokkan dengan foto sebelum memutuskan.
              </span>
            </p>
          ) : null}
          <ReportFactsCard report={report} />
          {report.duplicateOfReportId ? (
            <p>
              Duplikat dari{" "}
              <Link
                href={`/pengelola/verifikasi/${report.duplicateOfReportId}`}
                className="font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                laporan rujukan
              </Link>
            </p>
          ) : null}
          {pending ? (
            candidates?.error ? (
              <div>
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
            <p className="rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4">
              {decidedNotes[report.status] ?? "Laporan sudah diputuskan."}
            </p>
          )}
          {actionable ? (
            <section aria-labelledby="tasks-title" className={cardClass}>
              <h2 id="tasks-title" className="text-lg font-bold">
                Tugas tindak lanjut
              </h2>
              {tasks?.error ? (
                <p role="alert" className="mt-3 text-[var(--danger)]">
                  Daftar tugas belum dapat dimuat.
                </p>
              ) : !tasks?.data?.length ? (
                <p className="mt-3 text-[var(--muted-foreground)]">
                  Belum ada tugas untuk laporan ini.
                </p>
              ) : (
                <ul className="mt-4 grid gap-3">
                  {tasks.data.map((task) => (
                    <li key={task.id}>
                      <Link
                        href={`/pengelola/tugas/${task.id}`}
                        className="flex flex-wrap justify-between gap-2 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 hover:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                      >
                        <span className="min-w-0">
                          <span className="block font-semibold break-words">
                            {task.title}
                            {task.isMandatory ? "" : " (opsional)"}
                          </span>
                          <span className="block text-sm break-words text-[var(--muted-foreground)]">
                            {assignees.data.get(task.id)?.join(", ") ??
                              "Kader belum dapat dimuat"}
                          </span>
                        </span>
                        <StatusBadge tone={taskStatusTone[task.status]}>
                          {taskStatusLabels[task.status]}
                        </StatusBadge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {!canAssign ? (
                <p className="mt-4 rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4">
                  Laporan sudah tuntas. Buka kembali tugas yang selesai bila
                  masalah muncul lagi.
                </p>
              ) : cadres?.error ? (
                <p role="alert" className="mt-4 text-[var(--danger)]">
                  Daftar kader belum dapat dimuat. Muat ulang halaman.
                </p>
              ) : (
                <CreateTaskForm
                  reportId={report.id}
                  cadres={cadres?.data ?? []}
                />
              )}
            </section>
          ) : null}
          <ReportTimeline events={detail.events.data} />
        </div>
      </div>
    </>,
    areas.find((area) => area.id === report.areaId),
  );
}
