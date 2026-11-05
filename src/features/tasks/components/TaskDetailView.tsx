import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cardClass } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  StatusBadge,
  taskStatusTone,
  type Tone,
} from "@/components/ui/StatusBadge";
import { Timeline } from "@/components/ui/Timeline";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { TaskActions } from "@/features/tasks/components/TaskActions";
import type { EvidenceStatus, TaskDetail } from "@/features/tasks/data";
import { taskEventLabels, taskStatusLabels } from "@/features/tasks/validation";

const reviewLabels = {
  pending: "Menunggu pemeriksaan",
  approved: "Disetujui",
  revision_required: "Perlu perbaikan",
} as const;

const progressLabels: Record<EvidenceStatus, string> = {
  missing: "Belum mengirim bukti",
  ...reviewLabels,
};

const progressTone: Record<EvidenceStatus, Tone> = {
  missing: "neutral",
  pending: "warning",
  approved: "success",
  revision_required: "danger",
};

// Shared task page: cadres see the report inline and work the task; managers link to
// the report and review, cancel, or reopen (T27).
export function TaskDetailView({
  backLink,
  report,
  reportHref,
  role,
  task,
}: {
  backLink: { href: string; label: string };
  report?: ReactNode;
  reportHref?: string;
  role: "cadre" | "manager";
  task: TaskDetail;
}) {
  // T33: the task completes only when every assigned cadre has approved evidence.
  const approvedCount = task.assignees.filter(
    (assignee) => assignee.evidenceStatus === "approved",
  ).length;
  const mine = task.assignees.find((assignee) => assignee.isMe);
  const myLatestRevision = task.evidence.findLast(
    (item) =>
      item.submittedByMe &&
      item.currentRound &&
      item.reviewStatus === "revision_required" &&
      Boolean(item.reviewReason),
  );
  return (
    <>
      <PageHeader
        back={backLink}
        title={task.title}
        meta={
          <>
            <span className="font-semibold">
              {task.reportReference ?? "Laporan"}
            </span>
            <StatusBadge tone={taskStatusTone[task.status]}>
              {taskStatusLabels[task.status]}
            </StatusBadge>
          </>
        }
      />
      <div className="grid gap-7 lg:grid-cols-12 lg:items-start">
        <div className="grid min-w-0 gap-6 lg:col-span-5">
          {report}
          <section aria-labelledby="evidence-title" className={cardClass}>
            <h2 id="evidence-title" className="text-lg font-bold">
              Bukti
            </h2>
            {!task.evidence.length ? (
              <p className="mt-3 text-[var(--muted-foreground)]">
                Belum ada bukti yang dikirim.
              </p>
            ) : (
              <ul className="mt-4 grid gap-4">
                {task.evidence.map((item, index) => (
                  <li
                    key={item.id}
                    className="grid gap-3 rounded-[var(--radius-control)] bg-[var(--background)] p-3"
                  >
                    <Image
                      unoptimized
                      src={item.url}
                      alt={`Foto bukti ${index + 1}`}
                      width={item.width}
                      height={item.height}
                      className="aspect-[4/3] w-full rounded-[var(--radius-control)] border border-[var(--border)] object-cover"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold break-words">
                        {item.submittedByMe ? "Anda" : item.submitterName} ·{" "}
                        {reviewLabels[item.reviewStatus]}
                      </p>
                      {item.currentRound ? null : (
                        <p className="text-sm text-[var(--muted-foreground)]">
                          Sebelum tugas dibuka kembali
                        </p>
                      )}
                      <p className="mt-1 whitespace-pre-wrap break-words">
                        {item.description}
                      </p>
                      {item.reviewReason ? (
                        <p className="mt-2 break-words text-sm">
                          Catatan pemeriksa: {item.reviewReason}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm text-[var(--muted-foreground)]">
                        {formatJakarta(item.createdAt)} WIB
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
        <div className="grid min-w-0 gap-6 lg:col-span-7">
          <dl className={`grid gap-5 sm:grid-cols-2 ${cardClass}`}>
            <div className="sm:col-span-2">
              <dt className="text-sm font-semibold">Deskripsi</dt>
              <dd className="mt-1 whitespace-pre-wrap break-words">
                {task.description}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-semibold">
                Kader pelaksana · {approvedCount} dari {task.assignees.length}{" "}
                bukti disetujui
              </dt>
              <dd className="mt-2">
                <ul className="grid gap-2">
                  {task.assignees.map((assignee, index) => (
                    <li
                      key={index}
                      className="flex flex-wrap items-center justify-between gap-2"
                    >
                      <span className="min-w-0 break-words">
                        {assignee.name}
                        {assignee.isMe ? " (Anda)" : ""}
                      </span>
                      <StatusBadge tone={progressTone[assignee.evidenceStatus]}>
                        {progressLabels[assignee.evidenceStatus]}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">Tenggat</dt>
              <dd className="mt-1">
                {task.dueAt
                  ? formatJakarta(task.dueAt, false)
                  : "Tidak ditentukan"}
              </dd>
            </div>
            {/* T28: every new task is mandatory; only legacy tasks can be optional. */}
            {task.isMandatory ? null : (
              <div>
                <dt className="text-sm font-semibold">Jenis</dt>
                <dd className="mt-1">Opsional</dd>
              </div>
            )}
            {reportHref ? (
              <div>
                <dt className="text-sm font-semibold">Laporan</dt>
                <dd className="mt-1">
                  <Link
                    href={reportHref}
                    className="font-semibold text-[var(--primary)] underline underline-offset-2"
                  >
                    Lihat laporan {task.reportReference}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>
          {role === "cadre" &&
          mine?.evidenceStatus === "revision_required" &&
          myLatestRevision?.reviewReason ? (
            <div
              role="region"
              aria-label="Catatan perbaikan bukti dari pengelola"
              className="rounded-[var(--radius-card)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
            >
              <p className="text-xs font-bold tracking-wider text-[var(--danger)] uppercase">
                Perlu Perbaikan Bukti Anda
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--foreground)] whitespace-pre-wrap break-words">
                {myLatestRevision.reviewReason}
              </p>
            </div>
          ) : null}
          <TaskActions
            role={role}
            taskId={task.id}
            status={task.status}
            version={task.version}
            myEvidenceStatus={mine?.evidenceStatus ?? null}
            pendingEvidence={task.evidence
              .filter((item) => item.reviewStatus === "pending")
              .map((item) => ({
                id: item.id,
                submitterName: item.submitterName,
              }))}
          />
          <Timeline
            id="task-history-title"
            title="Riwayat tugas"
            items={task.events.map((event) => ({
              id: event.id,
              label:
                event.eventType === "task_evidence_approved" &&
                event.newStatus === "completed"
                  ? "Bukti semua kader disetujui, tugas selesai"
                  : (taskEventLabels[event.eventType] ?? "Pembaruan tugas"),
              reason: event.reason,
              time: `${formatJakarta(event.createdAt)} WIB`,
            }))}
          />
        </div>
      </div>
    </>
  );
}
