import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { cardClass } from "@/components/ui/Card";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  RowNumberCell,
  RowNumberHeader,
} from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { PhotoLightboxButton } from "@/components/ui/PhotoLightboxButton";
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
import { cleanSimulationText } from "@/lib/format/text";

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
      <div className="grid min-w-0 gap-5">
        <section
          aria-label="Ringkasan penugasan"
          className={`${cardClass} grid min-w-0 gap-5 lg:grid-cols-12`}
        >
          <div className="grid min-w-0 content-between gap-4 lg:col-span-7">
            <dl>
              <dt className="text-[11px] font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
                Deskripsi tindakan
              </dt>
              <dd className="mt-1 text-sm leading-relaxed text-[var(--foreground)] whitespace-pre-wrap break-words">
                {task.description}
              </dd>
            </dl>
            <dl className="grid gap-4 border-t border-[var(--border)] pt-3.5 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
                  Tenggat
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {task.dueAt
                    ? formatJakarta(task.dueAt, false)
                    : "Tidak ditentukan"}
                </dd>
              </div>
              {/* T28: every new task is mandatory; only legacy tasks can be optional. */}
              {task.isMandatory ? null : (
                <div>
                  <dt className="text-[11px] font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
                    Jenis
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-[var(--foreground)]">
                    Opsional
                  </dd>
                </div>
              )}
              {reportHref ? (
                <div>
                  <dt className="text-[11px] font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
                    Laporan rujukan
                  </dt>
                  <dd className="mt-1 text-sm">
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
          </div>

          <div className="min-w-0 border-t border-[var(--border)] pt-4 lg:col-span-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <p className="text-[11px] font-semibold tracking-wider text-[var(--muted-foreground)] uppercase">
              Kader pelaksana · {approvedCount} dari {task.assignees.length}{" "}
              bukti disetujui
            </p>
            <ul className="mt-2.5 divide-y divide-[var(--border)]">
              {task.assignees.map((assignee, index) => (
                <li
                  key={index}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0"
                >
                  <span className="min-w-0 text-sm font-medium text-[var(--foreground)] break-words">
                    {assignee.name}
                    {assignee.isMe ? " (Anda)" : ""}
                  </span>
                  <StatusBadge tone={progressTone[assignee.evidenceStatus]}>
                    {progressLabels[assignee.evidenceStatus]}
                  </StatusBadge>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <div className="min-w-0">{report}</div>

        <section
          aria-labelledby="evidence-title"
          className={`${cardClass} min-w-0`}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="evidence-title" className="text-base font-bold">
              Kiriman bukti lapangan
            </h2>
            <span className="text-xs text-[var(--muted-foreground)]">
              {task.evidence.length} kiriman
            </span>
          </div>
          {!task.evidence.length ? (
            <p className="mt-3 text-sm text-[var(--muted-foreground)]">
              Belum ada bukti yang dikirim.
            </p>
          ) : (
            <div className="mt-3 w-full max-w-full overflow-x-auto rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)]">
              <DataTable caption="Daftar kiriman bukti kader">
                <DataTableHeader>
                  <RowNumberHeader />
                  <DataTableHeadCell>Kader</DataTableHeadCell>
                  <DataTableHeadCell className="hidden sm:table-cell">
                    Putaran
                  </DataTableHeadCell>
                  <DataTableHeadCell className="hidden md:table-cell">
                    Waktu
                  </DataTableHeadCell>
                  <DataTableHeadCell>Status</DataTableHeadCell>
                  <DataTableHeadCell>Bukti</DataTableHeadCell>
                </DataTableHeader>
                <DataTableBody>
                  {task.evidence.map((item, index) => {
                    const submitterLabel = item.submittedByMe
                      ? "Anda"
                      : cleanSimulationText(item.submitterName);
                    const cleanDescription = cleanSimulationText(
                      item.description,
                    );
                    const cleanReviewReason = item.reviewReason
                      ? cleanSimulationText(item.reviewReason)
                      : null;
                    return (
                      <DataTableRow key={item.id}>
                        {/* 1. No. (PALING KIRI) */}
                        <RowNumberCell number={index + 1} />

                        {/* 2. Kader & Keterangan */}
                        <DataTableCell className="max-w-[240px] sm:max-w-[320px]">
                          <div className="min-w-0">
                            <p
                              title={submitterLabel}
                              className="block truncate font-semibold text-[var(--foreground)]"
                            >
                              {submitterLabel}
                            </p>
                            <p
                              title={cleanDescription}
                              className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]"
                            >
                              {cleanDescription}
                            </p>
                            {cleanReviewReason ? (
                              <p
                                title={cleanReviewReason}
                                className="mt-1 block truncate rounded bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] font-medium text-[var(--foreground)]"
                              >
                                Catatan pemeriksa: {cleanReviewReason}
                              </p>
                            ) : null}
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] md:hidden">
                              <span>Putaran {item.evidenceRound}</span>
                              <span>·</span>
                              <span>{formatJakarta(item.createdAt)} WIB</span>
                            </div>
                          </div>
                        </DataTableCell>

                        {/* 3. Putaran */}
                        <DataTableCell className="hidden whitespace-nowrap sm:table-cell">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-[var(--foreground)]">
                              Putaran {item.evidenceRound}
                            </span>
                            {!item.currentRound ? (
                              <span className="text-[11px] text-[var(--muted-foreground)]">
                                Sebelum dibuka kembali
                              </span>
                            ) : null}
                          </div>
                        </DataTableCell>

                        {/* 4. Waktu */}
                        <DataTableCell className="hidden whitespace-nowrap md:table-cell">
                          <span className="text-xs text-[var(--muted-foreground)]">
                            {formatJakarta(item.createdAt)} WIB
                          </span>
                        </DataTableCell>

                        {/* 5. Status */}
                        <DataTableCell className="whitespace-nowrap">
                          <StatusBadge tone={progressTone[item.reviewStatus]}>
                            {reviewLabels[item.reviewStatus]}
                          </StatusBadge>
                        </DataTableCell>

                        {/* 6. Bukti (Lightbox link + accessible sr-only image for E2E) */}
                        {/* relative keeps the absolutely positioned sr-only image inside the scroll container. */}
                        <DataTableCell className="relative whitespace-nowrap">
                          <PhotoLightboxButton
                            count={1}
                            fetchUrl={`/api/v1/tasks/${task.id}/evidence-photos?evidenceId=${item.id}`}
                            labelType="bukti"
                            title={`Bukti #${index + 1} · ${submitterLabel}`}
                          />
                          <Image
                            unoptimized
                            src={item.url}
                            alt={`Foto bukti ${index + 1}`}
                            width={1}
                            height={1}
                            className="sr-only"
                          />
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </div>
          )}
        </section>

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
    </>
  );
}
