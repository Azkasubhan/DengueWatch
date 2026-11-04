import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { AreaSummary } from "@/features/areas/types";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { controlClass } from "@/features/reports/components/reportAction";
import { listTaskAssignees, listTasks } from "@/features/tasks/data";
import {
  taskListQuerySchema,
  taskStatusLabels,
} from "@/features/tasks/validation";
import { ListChecks } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, taskStatusTone } from "@/components/ui/StatusBadge";

const openStatus = "assigned,in_progress,awaiting_review,reopened";
const pageSize = 10;

export type TaskListParams = Partial<
  Record<"status" | "areaId" | "assignee" | "page", string>
>;

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
  for (const key of ["status", "areaId", "assignee", "page"] as const) {
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
      ? await listTasks(
          parsed.data.page,
          pageSize,
          {
            status: parsed.data.status,
            areaId: parsed.data.areaId,
            assignee: parsed.data.assignee,
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
  const areaName = (id: string) =>
    areas.find((area) => area.id === id)?.name ?? "Wilayah";

  return (
    <>
      <form
        action={basePath}
        method="get"
        aria-label="Filter tugas"
        className="mb-6 grid gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
      >
        <div className="grid gap-2">
          <label htmlFor="status" className="text-sm font-semibold">
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
        {areas.length > 1 ? (
          <div className="grid gap-2">
            <label htmlFor="areaId" className="text-sm font-semibold">
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
        <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Terapkan filter</Button>
          <Link
            href={basePath}
            className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--primary)] underline underline-offset-2"
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
            className="mb-3 text-sm text-[var(--muted-foreground)]"
            aria-live="polite"
          >
            {total} tugas · halaman {page} dari{" "}
            {Math.max(1, Math.ceil(total / pageSize))}
          </p>
          <ul className="grid gap-3" aria-label="Daftar tugas">
            {result.data.map((task) => {
              const body = (
                <>
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-bold text-[var(--primary)]">
                      {task.title}
                    </span>
                    <StatusBadge tone={taskStatusTone[task.status]}>
                      {taskStatusLabels[task.status]}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 line-clamp-2 break-words text-[var(--muted-foreground)]">
                    {task.description}
                  </p>
                  <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                    {task.reportReference ?? "Laporan"}
                    {task.isMandatory ? "" : " · Opsional"}
                    {task.dueAt
                      ? ` · Tenggat ${formatJakarta(task.dueAt, false)}`
                      : ""}
                    {assignees?.data.get(task.id)
                      ? ` · ${assignees.data.get(task.id)!.join(", ")}`
                      : ""}
                    {areas.length > 1 ? ` · ${areaName(task.areaId)}` : ""}
                    {areas.find((area) => area.id === task.areaId)?.isDemo
                      ? " · Data simulasi"
                      : ""}
                  </p>
                </>
              );
              const card =
                "block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5";
              return (
                <li key={task.id}>
                  <Link
                    href={`${detailBase}/${task.id}`}
                    className={`${card} hover:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]`}
                  >
                    {body}
                  </Link>
                </li>
              );
            })}
          </ul>
          <nav aria-label="Halaman tugas" className="mt-7 flex flex-wrap gap-4">
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--primary)]"
              >
                ← Sebelumnya
              </Link>
            ) : null}
            {total > page * pageSize ? (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--primary)]"
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
