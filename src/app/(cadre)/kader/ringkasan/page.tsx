import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ListChecks,
  MapPin,
  Users,
} from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  StatusBadge,
  taskStatusTone,
  type Tone,
} from "@/components/ui/StatusBadge";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import {
  reportCategoryLabels,
  type ReportCategory,
} from "@/features/reports/validation";
import {
  getCadreSummary,
  type EvidenceStatus,
  type TaskListRow,
} from "@/features/tasks/data";
import { taskStatusLabels } from "@/features/tasks/validation";
import { getAccessContext } from "@/lib/auth/context";
import { cleanSimulationText } from "@/lib/format/text";

export const dynamic = "force-dynamic";

const myEvidenceLabels: Record<EvidenceStatus, string> = {
  missing: "Belum kirim bukti",
  pending: "Menunggu pemeriksaan",
  revision_required: "Perlu diperbaiki",
  approved: "Bukti disetujui",
};

const myEvidenceTones: Record<EvidenceStatus, Tone> = {
  missing: "neutral",
  pending: "warning",
  revision_required: "danger",
  approved: "success",
};

function getCadreActionLabel(task: TaskListRow): string {
  if (task.myEvidenceStatus === "revision_required") return "Perbaiki bukti";
  if (task.status === "assigned" || task.status === "reopened") {
    return "Mulai tugas";
  }
  if (task.myEvidenceStatus === "missing") return "Kirim bukti";
  return "Lihat tugas";
}

export default async function CadreSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ logout?: string }>;
}) {
  const query = await searchParams;
  const result = await getAccessContext();
  if (result.kind === "unauthenticated") {
    redirect("/login?next=/kader/ringkasan");
  }
  if (result.kind !== "authenticated") {
    return <ServiceUnavailable />;
  }

  const decision = decidePortalAccess(result.context, "cadre");
  if (decision.kind === "forbidden") {
    redirect("/forbidden");
  }
  const area = getVerifiedAreas(result.context, "assigned_cadre")[0];
  const summaryResult =
    decision.kind === "allowed"
      ? await getCadreSummary(result.context.userId, area?.id)
      : { data: null, error: null };

  const summary = summaryResult.data;
  const displayName = cleanSimulationText(result.context.displayName);

  return (
    <AppShell area={area} displayName={result.context.displayName} role="cadre">
      {query.logout === "failed" ? (
        <div className="mb-5 max-w-2xl">
          <Alert variant="error">
            Sesi belum dapat diakhiri. Coba keluar kembali.
          </Alert>
        </div>
      ) : null}
      {decision.kind === "pending" ? (
        <PendingArea />
      ) : (
        <div className="grid gap-6">
          <PageHeader
            title={`Ringkasan tugas, ${displayName}`}
            description="Pantau tenggat penugasan lapangan, progres bukti Anda, dan tindak lanjuti temuan warga."
            actions={
              <LinkButton href="/kader/tugas" variant="secondary">
                <ListChecks aria-hidden="true" className="size-4" />
                Semua tugas saya
              </LinkButton>
            }
          />

          {summaryResult.error ? (
            <Alert variant="error">
              Ringkasan tugas belum dapat dimuat. Muat ulang halaman ini.
            </Alert>
          ) : null}

          {/* 4 Indikator Kerja Aktual Kader */}
          {summary ? (
            <section aria-label="Indikator kerja kader">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                  href="/kader/tugas"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Tugas aktif
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.activeTasksCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Penugasan belum selesai
                  </p>
                </Link>

                <Link
                  href="/kader/tugas?due=overdue"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Mendekati / lewat tenggat
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.dueSoonOrOverdueCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {summary.overdueCount > 0
                      ? `${summary.overdueCount} melewati tenggat`
                      : "Dalam batas 48 jam ke depan"}
                  </p>
                </Link>

                <Link
                  href="/kader/tugas?status=awaiting_review"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Bukti saya menunggu periksa
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.myPendingEvidenceCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Sedang ditinjau pengelola
                  </p>
                </Link>

                <Link
                  href="/kader/tugas?status=in_progress"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Bukti saya perlu diperbaiki
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.myRevisionRequiredCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Memerlukan foto/keterangan ulang
                  </p>
                </Link>
              </div>
            </section>
          ) : null}

          {/* Daftar Tugas yang Perlu Dikerjakan */}
          <section aria-labelledby="priority-tasks-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="priority-tasks-heading" className="text-lg font-bold">
                  Tugas yang perlu dikerjakan
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Diurutkan berdasarkan kebutuhan perbaikan bukti dan tenggat
                  terdekat.
                </p>
              </div>
              <Link
                href="/kader/tugas"
                className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                Buka daftar lengkap
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>

            {!summary?.prioritizedTasks.length ? (
              <EmptyState
                icon={CheckCircle2}
                title="Tidak ada tugas aktif yang menunggu tindakan"
                description="Semua penugasan lapangan pada wilayah Anda sudah selesai atau belum ada tugas baru."
                action={
                  <Link
                    href="/kader/tugas?status=all"
                    className="inline-flex min-h-10 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
                  >
                    Lihat riwayat tugas selesai
                  </Link>
                }
              />
            ) : (
              <ul className="grid gap-2.5" aria-label="Tugas prioritas kader">
                {summary.prioritizedTasks.map((task) => {
                  const actionLabel = getCadreActionLabel(task);
                  const myStatus = task.myEvidenceStatus ?? "missing";
                  const isShared = task.assigneeCount > 1;
                  return (
                    <li
                      key={task.id}
                      className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)]"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/kader/tugas/${task.id}`}
                              className="text-sm font-bold text-[var(--foreground)] hover:text-[var(--primary)] hover:underline"
                            >
                              {task.title}
                            </Link>
                            <span className="rounded bg-[var(--sand)] px-2 py-0.5 font-mono text-xs text-[var(--muted-foreground)]">
                              {task.reportReference ?? "Laporan"}
                            </span>
                            {task.reportCategory ? (
                              <span className="text-xs text-[var(--muted-foreground)]">
                                ·{" "}
                                {
                                  reportCategoryLabels[
                                    task.reportCategory as ReportCategory
                                  ]
                                }
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-1 line-clamp-1 text-xs text-[var(--muted-foreground)]">
                            {task.description}
                          </p>

                          {task.myRevisionReason ? (
                            <p className="mt-2 rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] px-2.5 py-1.5 text-xs font-medium text-[var(--danger)]">
                              Catatan perbaikan pengelola:{" "}
                              {task.myRevisionReason}
                            </p>
                          ) : null}

                          <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--muted-foreground)]">
                            {task.reportLocationNote ? (
                              <span className="inline-flex items-center gap-1">
                                <MapPin
                                  aria-hidden="true"
                                  className="size-3.5 shrink-0 text-[var(--primary)]"
                                />
                                <span className="max-w-[240px] truncate">
                                  {task.reportLocationNote}
                                </span>
                              </span>
                            ) : null}

                            <span
                              className={`inline-flex items-center gap-1 font-medium ${
                                task.isOverdue
                                  ? "text-[var(--danger)]"
                                  : task.isDueSoon
                                    ? "text-[var(--warning)]"
                                    : ""
                              }`}
                            >
                              <CalendarClock
                                aria-hidden="true"
                                className="size-3.5 shrink-0"
                              />
                              {task.dueAt
                                ? `Tenggat ${formatJakarta(task.dueAt, false)}`
                                : "Tanpa tenggat"}
                              {task.isOverdue
                                ? " (Lewat tenggat)"
                                : task.isDueSoon
                                  ? " (Segera)"
                                  : ""}
                            </span>

                            {isShared ? (
                              <span className="inline-flex items-center gap-1">
                                <Users
                                  aria-hidden="true"
                                  className="size-3.5 shrink-0"
                                />
                                Tim ({task.approvedAssigneeCount}/
                                {task.assigneeCount} bukti disetujui)
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5 sm: shrink-0 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <StatusBadge tone={myEvidenceTones[myStatus]}>
                              Bukti Anda: {myEvidenceLabels[myStatus]}
                            </StatusBadge>
                            {isShared ? (
                              <StatusBadge tone={taskStatusTone[task.status]}>
                                Tugas: {taskStatusLabels[task.status]}
                              </StatusBadge>
                            ) : null}
                          </div>
                          <Link
                            href={`/kader/tugas/${task.id}`}
                            className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[var(--primary-hover)]"
                          >
                            {actionLabel}
                            <ArrowRight
                              aria-hidden="true"
                              className="size-3.5"
                            />
                          </Link>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
