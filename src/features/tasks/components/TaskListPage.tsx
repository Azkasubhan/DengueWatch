import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ListChecks,
  MapPin,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  StatusBadge,
  taskStatusTone,
  type Tone,
} from "@/components/ui/StatusBadge";
import type { AreaSummary } from "@/features/areas/types";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { controlClass } from "@/features/reports/components/reportAction";
import {
  listTaskAssignees,
  listTaskRows,
  type EvidenceStatus,
  type TaskListRow,
} from "@/features/tasks/data";
import {
  taskListQuerySchema,
  taskStatusLabels,
} from "@/features/tasks/validation";
import { cleanSimulationText } from "@/lib/format/text";

const openStatus = "assigned,in_progress,awaiting_review,reopened";
const pageSize = 10;

export type TaskListParams = Partial<
  Record<
    | "status"
    | "areaId"
    | "assignee"
    | "page"
    | "due"
    | "needsReview"
    | "q"
    | "sort",
    string
  >
>;

const myEvidenceLabels: Record<EvidenceStatus, string> = {
  missing: "Belum kirim bukti",
  pending: "Menunggu periksa",
  revision_required: "Perlu perbaikan",
  approved: "Disetujui",
};

const myEvidenceTones: Record<EvidenceStatus, Tone> = {
  missing: "neutral",
  pending: "warning",
  revision_required: "danger",
  approved: "success",
};

function getActionLabel(task: TaskListRow, isManager: boolean): string {
  if (isManager) {
    if (task.pendingEvidenceCount > 0) return "Periksa bukti";
    return "Lihat tugas";
  }
  if (task.myEvidenceStatus === "revision_required") return "Perbaiki bukti";
  if (task.status === "assigned" || task.status === "reopened") {
    return "Mulai tugas";
  }
  if (task.myEvidenceStatus === "missing") return "Kirim bukti";
  return "Lihat tugas";
}

// Shared server view. Cadres only ever see tasks assigned to them (RLS); managers see
// every task in their areas with the assigned cadres' names (T27).
export async function TaskListPage({
  areas,
  basePath,
  params,
  userId,
  detailBase,
  showAssignees = false,
}: {
  areas: AreaSummary[];
  basePath: string;
  params: TaskListParams;
  userId: string;
  detailBase: string;
  showAssignees?: boolean;
}) {
  const values: Record<string, string> = {};
  for (const key of [
    "status",
    "areaId",
    "assignee",
    "page",
    "due",
    "needsReview",
    "q",
    "sort",
  ] as const) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) values[key] = value.trim();
  }
  const selectedStatus = values.status ?? openStatus;
  const query: Record<string, string> = { ...values, status: selectedStatus };
  if (query.status === "all") delete query.status;
  const parsed = taskListQuerySchema.safeParse({
    ...query,
    limit: String(pageSize),
  });
  const areaAllowed =
    !values.areaId || areas.some((area) => area.id === values.areaId);
  const result =
    parsed.success && areaAllowed
      ? await listTaskRows(
          parsed.data.page,
          pageSize,
          {
            status: parsed.data.status,
            areaId: parsed.data.areaId,
            assignee: parsed.data.assignee,
            due: parsed.data.due,
            needsReview: parsed.data.needsReview,
            q: parsed.data.q,
            sort: parsed.data.sort,
          },
          userId,
        )
      : null;
  const assignees =
    showAssignees && result?.data
      ? await listTaskAssignees(result.data.map((task) => task.id))
      : null;
  const page = parsed.success ? parsed.data.page : 1;
  const total = result?.count ?? 0;
  const pageHref = (target: number) =>
    `${basePath}?${new URLSearchParams({ ...values, status: selectedStatus, page: String(target) })}`;
  const quickFilterHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      ...values,
      status: selectedStatus,
      ...overrides,
    };
    delete merged.page;
    for (const [k, v] of Object.entries(merged)) {
      if (v && v.trim()) next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const areaName = (id: string) =>
    cleanSimulationText(
      areas.find((area) => area.id === id)?.name ?? "Wilayah",
    );

  const isOverdueActive = values.due === "overdue";
  const isDueSoonActive = values.due === "due_soon";
  const isNeedsReviewActive =
    values.needsReview === "1" || values.needsReview === "true";

  return (
    <>
      {/* Quick Filter Pills */}
      <div
        className="mb-3 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Filter cepat tugas"
      >
        <Link
          href={basePath}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            selectedStatus === openStatus &&
            !isOverdueActive &&
            !isDueSoonActive &&
            !isNeedsReviewActive
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          Tugas aktif
        </Link>
        {showAssignees ? (
          <Link
            href={quickFilterHref({
              status: openStatus,
              needsReview: isNeedsReviewActive ? undefined : "1",
              due: undefined,
            })}
            className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
              isNeedsReviewActive
                ? "border-[var(--warning)] bg-[var(--warning)] text-white"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
            }`}
          >
            <AlertTriangle aria-hidden="true" className="size-3.5" />
            Bukti perlu diperiksa
          </Link>
        ) : null}
        <Link
          href={quickFilterHref({
            status: openStatus,
            due: isOverdueActive ? undefined : "overdue",
            needsReview: undefined,
          })}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            isOverdueActive
              ? "border-[var(--danger)] bg-[var(--danger)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          <CalendarClock aria-hidden="true" className="size-3.5" />
          Melewati tenggat
        </Link>
        <Link
          href={quickFilterHref({
            status: openStatus,
            due: isDueSoonActive ? undefined : "due_soon",
            needsReview: undefined,
          })}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            isDueSoonActive
              ? "border-[var(--warning)] bg-[var(--warning)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          Mendekati tenggat
        </Link>
        <Link
          href={quickFilterHref({
            status: "all",
            due: undefined,
            needsReview: undefined,
          })}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            selectedStatus === "all"
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          Semua status
        </Link>
      </div>

      <form
        action={basePath}
        method="get"
        aria-label="Filter tugas"
        className="mb-5 grid gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:grid-cols-2 lg:grid-cols-12 lg:items-end"
      >
        <div className="grid gap-1.5 lg:col-span-4">
          <label htmlFor="q" className="text-xs font-semibold">
            Cari tugas atau referensi
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={values.q ?? ""}
              placeholder="Judul, lokasi, atau DW-2026..."
              className="min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] py-1.5 pr-3 pl-9 text-sm"
            />
          </div>
        </div>
        <div className="grid gap-1.5 lg:col-span-3">
          <label htmlFor="status" className="text-xs font-semibold">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={selectedStatus}
            className={controlClass}
          >
            <option value={openStatus}>Belum selesai</option>
            {Object.entries(taskStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="all">Semua status</option>
          </select>
        </div>
        <div className="grid gap-1.5 lg:col-span-2">
          <label htmlFor="due" className="text-xs font-semibold">
            Tenggat
          </label>
          <select
            id="due"
            name="due"
            defaultValue={values.due ?? "all"}
            className={controlClass}
          >
            <option value="all">Semua tenggat</option>
            <option value="overdue">Lewat tenggat</option>
            <option value="due_soon">≤ 48 jam</option>
          </select>
        </div>
        {areas.length > 1 ? (
          <div className="grid gap-1.5 lg:col-span-2">
            <label htmlFor="areaId" className="text-xs font-semibold">
              Wilayah
            </label>
            <select
              id="areaId"
              name="areaId"
              defaultValue={values.areaId ?? ""}
              className={controlClass}
            >
              <option value="">Semua wilayah</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit">Terapkan filter</Button>
          <Link
            href={basePath}
            className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
          >
            Atur ulang
          </Link>
        </div>
      </form>

      {!parsed.success || !areaAllowed ? (
        <div
          role="alert"
          className="max-w-2xl rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
        >
          <p className="font-semibold text-[var(--danger)]">
            Filter tidak valid.
          </p>
          <p className="mt-1">Atur ulang filter lalu coba lagi.</p>
        </div>
      ) : result?.error ? (
        <div
          role="alert"
          className="max-w-2xl rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
        >
          <p className="font-semibold text-[var(--danger)]">
            Daftar tugas belum tersedia.
          </p>
          <Link
            href={pageHref(page)}
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
          >
            Muat ulang daftar
          </Link>
        </div>
      ) : !result?.data?.length ? (
        <EmptyState
          icon={ListChecks}
          title="Tidak ada tugas yang sesuai filter."
          description="Tugas dibuat pengelola dari laporan yang sudah diverifikasi."
        />
      ) : (
        <>
          <p
            className="mb-3 text-xs font-medium text-[var(--muted-foreground)]"
            aria-live="polite"
          >
            {total} tugas · halaman {page} dari{" "}
            {Math.max(1, Math.ceil(total / pageSize))}
          </p>
          <ul className="grid gap-2.5" aria-label="Daftar tugas">
            {result.data.map((task) => {
              const assignedNames = assignees?.data.get(task.id) ?? [];
              const actionLabel = getActionLabel(task, showAssignees);
              const myStatus = task.myEvidenceStatus ?? "missing";
              return (
                <li key={task.id}>
                  <Link
                    href={`${detailBase}/${task.id}`}
                    className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                            {task.title}
                          </span>
                          <span className="rounded bg-[var(--sand)] px-2 py-0.5 font-mono text-xs text-[var(--muted-foreground)]">
                            {task.reportReference ?? "Laporan"}
                          </span>
                          {!task.isMandatory ? (
                            <span className="text-xs text-[var(--muted-foreground)]">
                              · Opsional
                            </span>
                          ) : null}
                        </div>

                        <p className="mt-1 line-clamp-1 break-words text-xs text-[var(--muted-foreground)]">
                          {task.description}
                        </p>

                        {!showAssignees && task.myRevisionReason ? (
                          <p className="mt-1.5 rounded bg-[var(--danger-subtle)] px-2 py-1 text-xs font-medium text-[var(--danger)]">
                            Perlu perbaikan: {task.myRevisionReason}
                          </p>
                        ) : null}

                        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-[var(--muted-foreground)]">
                          {task.reportLocationNote ? (
                            <span className="inline-flex items-center gap-1">
                              <MapPin
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-[var(--primary)]"
                              />
                              <span className="max-w-[220px] truncate">
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

                          {showAssignees && assignedNames.length > 0 ? (
                            <span className="inline-flex items-center gap-1 font-medium text-[var(--foreground)]">
                              <Users
                                aria-hidden="true"
                                className="size-3.5 shrink-0 text-[var(--primary)]"
                              />
                              {assignedNames.join(", ")}
                            </span>
                          ) : null}

                          <span className="inline-flex items-center gap-1">
                            <CheckCircle2
                              aria-hidden="true"
                              className="size-3.5 shrink-0"
                            />
                            {task.approvedAssigneeCount}/{task.assigneeCount}{" "}
                            bukti disetujui
                          </span>

                          {showAssignees && task.pendingEvidenceCount > 0 ? (
                            <span className="rounded bg-[var(--warning-subtle)] px-1.5 py-0.5 font-semibold text-[var(--warning)]">
                              {task.pendingEvidenceCount} bukti menunggu periksa
                            </span>
                          ) : null}

                          {areas.length > 1 ? (
                            <span>· {areaName(task.areaId)}</span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border)] pt-2.5 sm:shrink-0 sm:flex-col sm:items-end sm:border-t-0 sm:pt-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {!showAssignees ? (
                            <StatusBadge tone={myEvidenceTones[myStatus]}>
                              Bukti saya: {myEvidenceLabels[myStatus]}
                            </StatusBadge>
                          ) : null}
                          <StatusBadge tone={taskStatusTone[task.status]}>
                            {taskStatusLabels[task.status]}
                          </StatusBadge>
                        </div>
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] group-hover:underline">
                          {actionLabel}
                          <ArrowRight aria-hidden="true" className="size-3.5" />
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
          <nav
            aria-label="Halaman tugas"
            className="mt-6 flex flex-wrap gap-4 border-t border-[var(--border)] pt-4"
          >
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                ← Sebelumnya
              </Link>
            ) : null}
            {total > page * pageSize ? (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                Berikutnya →
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </>
  );
}
