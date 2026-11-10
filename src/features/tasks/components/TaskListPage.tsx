import Link from "next/link";
import { ArrowRight, ListChecks, Search } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import {
  AssigneeListSummary,
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableContainer,
  DataTableHeadCell,
  DataTableHeader,
  DataTableRow,
  RowNumberCell,
  RowNumberHeader,
} from "@/components/ui/DataTable";
import { EmptyState } from "@/components/ui/EmptyState";
import { PhotoLightboxButton } from "@/components/ui/PhotoLightboxButton";
import {
  StatusBadge,
  taskStatusTone,
  type Tone,
} from "@/components/ui/StatusBadge";
import type { AreaSummary } from "@/features/areas/types";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import {
  reportCategoryLabels,
  type ReportCategory,
} from "@/features/reports/validation";
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

export const myEvidenceLabels: Record<EvidenceStatus, string> = {
  missing: "Belum dikirim",
  pending: "Menunggu pemeriksaan",
  revision_required: "Perlu revisi",
  approved: "Disetujui",
};

export const myEvidenceTones: Record<EvidenceStatus, Tone> = {
  missing: "neutral",
  pending: "warning",
  revision_required: "danger",
  approved: "success",
};

export function getTaskActionLabel(
  task: TaskListRow,
  isManager: boolean,
): string {
  if (isManager) {
    if (task.pendingEvidenceCount > 0) return "Tinjau";
    return "Periksa";
  }
  if (task.myEvidenceStatus === "revision_required") return "Perbaiki";
  if (task.status === "assigned" || task.status === "reopened") {
    return "Mulai";
  }
  if (task.myEvidenceStatus === "missing") return "Kirim bukti";
  return "Periksa";
}

export function CadreTaskTable({
  tasks,
  detailBase = "/kader/tugas",
  page = 1,
  pageSize: size = 10,
  caption = "Daftar tugas kader",
}: {
  tasks: TaskListRow[];
  detailBase?: string;
  page?: number;
  pageSize?: number;
  caption?: string;
}) {
  return (
    <DataTableContainer>
      <DataTable caption={caption}>
        <DataTableHeader>
          <RowNumberHeader />
          <DataTableHeadCell>Tugas</DataTableHeadCell>
          <DataTableHeadCell className="hidden md:table-cell">
            Lokasi
          </DataTableHeadCell>
          <DataTableHeadCell className="hidden lg:table-cell">
            Tenggat
          </DataTableHeadCell>
          <DataTableHeadCell className="hidden sm:table-cell">
            Status tugas
          </DataTableHeadCell>
          <DataTableHeadCell className="hidden md:table-cell">
            Bukti saya
          </DataTableHeadCell>
          <DataTableHeadCell className="w-[110px] whitespace-nowrap text-right pr-4 sm:pr-6">
            Tindakan
          </DataTableHeadCell>
        </DataTableHeader>
        <DataTableBody>
          {tasks.map((task, index) => {
            const rowNumber = (page - 1) * size + index + 1;
            const href = `${detailBase}/${task.id}`;
            const actionLabel = getTaskActionLabel(task, false);
            const myStatus = task.myEvidenceStatus ?? "missing";
            const locationNote = task.reportLocationNote
              ? cleanSimulationText(task.reportLocationNote)
              : null;
            const cleanTitle = cleanSimulationText(task.title);
            const cleanDescription = cleanSimulationText(task.description);

            return (
              <DataTableRow key={task.id}>
                {/* 1. No. (PALING KIRI) */}
                <RowNumberCell number={rowNumber} />

                {/* 2. Tugas */}
                <DataTableCell className="max-w-[180px] md:w-[28%] md:max-w-0">
                  <div className="min-w-0">
                    <Link
                      href={href}
                      title={cleanTitle}
                      className="block truncate font-semibold text-[var(--foreground)] transition hover:text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                    >
                      {cleanTitle}
                    </Link>
                    {task.reportCategory ? (
                      <span className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]">
                        {
                          reportCategoryLabels[
                            task.reportCategory as ReportCategory
                          ]
                        }
                        {!task.isMandatory ? " · Opsional" : ""}
                      </span>
                    ) : null}
                    <p
                      title={cleanDescription}
                      className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]"
                    >
                      {cleanDescription}
                    </p>
                    {task.myRevisionReason ? (
                      <p
                        title={cleanSimulationText(task.myRevisionReason)}
                        className="mt-1 block truncate rounded bg-[var(--danger-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--danger)]"
                      >
                        Perlu revisi:{" "}
                        {cleanSimulationText(task.myRevisionReason)}
                      </p>
                    ) : null}

                    {/* Mobile compact metadata & disclosure */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                      <StatusBadge tone={taskStatusTone[task.status]}>
                        {taskStatusLabels[task.status]}
                      </StatusBadge>
                      <StatusBadge tone={myEvidenceTones[myStatus]}>
                        {myEvidenceLabels[myStatus]}
                      </StatusBadge>
                    </div>
                    <details className="mt-1.5 md:hidden">
                      <summary className="cursor-pointer text-[11px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                        Rincian lokasi, tenggat & bukti
                      </summary>
                      <div className="mt-1.5 space-y-1 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] p-2 text-xs text-[var(--muted-foreground)]">
                        <p className="truncate">
                          <span className="font-semibold text-[var(--foreground)]">
                            Lokasi:{" "}
                          </span>
                          {locationNote ?? "Belum dicantumkan"}
                        </p>
                        <p>
                          <span className="font-semibold text-[var(--foreground)]">
                            Tenggat:{" "}
                          </span>
                          {task.dueAt
                            ? formatJakarta(task.dueAt, false)
                            : "Tanpa tenggat"}
                          {task.isOverdue
                            ? " (Lewat tenggat)"
                            : task.isDueSoon
                              ? " (Segera)"
                              : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                          <span className="font-semibold text-[var(--foreground)]">
                            Bukti saya:{" "}
                          </span>
                          <StatusBadge tone={myEvidenceTones[myStatus]}>
                            {myEvidenceLabels[myStatus]}
                          </StatusBadge>
                          {task.myEvidenceCount > 0 ? (
                            <PhotoLightboxButton
                              count={task.myEvidenceCount}
                              fetchUrl={`/api/v1/tasks/${task.id}/evidence-photos?mine=1`}
                              labelType="bukti"
                              title={`Bukti Tugas: ${cleanTitle}`}
                              hideWhenEmpty
                            />
                          ) : null}
                        </div>
                      </div>
                    </details>
                  </div>
                </DataTableCell>

                {/* 3. Lokasi */}
                <DataTableCell className="hidden md:table-cell md:w-[22%] md:max-w-0">
                  {locationNote ? (
                    <span
                      title={locationNote}
                      className="block truncate text-xs text-[var(--foreground)]"
                    >
                      {locationNote}
                    </span>
                  ) : (
                    <span className="block truncate text-xs italic text-[var(--muted-foreground)]">
                      Belum dicantumkan
                    </span>
                  )}
                </DataTableCell>

                {/* 4. Tenggat */}
                <DataTableCell className="hidden whitespace-nowrap lg:table-cell">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs font-medium text-[var(--foreground)]">
                      {task.dueAt
                        ? formatJakarta(task.dueAt, false)
                        : "Tanpa tenggat"}
                    </span>
                    {task.isOverdue ? (
                      <span className="text-[11px] font-semibold text-[var(--danger)]">
                        Lewat tenggat
                      </span>
                    ) : task.isDueSoon ? (
                      <span className="text-[11px] font-semibold text-[var(--warning)]">
                        Segera
                      </span>
                    ) : null}
                  </div>
                </DataTableCell>

                {/* 5. Status tugas */}
                <DataTableCell className="hidden whitespace-nowrap sm:table-cell">
                  <StatusBadge tone={taskStatusTone[task.status]}>
                    {taskStatusLabels[task.status]}
                  </StatusBadge>
                </DataTableCell>

                {/* 6. Bukti saya */}
                <DataTableCell className="hidden whitespace-nowrap md:table-cell">
                  <div className="flex flex-col items-start gap-1">
                    <StatusBadge tone={myEvidenceTones[myStatus]}>
                      {myEvidenceLabels[myStatus]}
                    </StatusBadge>
                    {task.myEvidenceCount > 0 ? (
                      <PhotoLightboxButton
                        count={task.myEvidenceCount}
                        fetchUrl={`/api/v1/tasks/${task.id}/evidence-photos?mine=1`}
                        labelType="bukti"
                        title={`Bukti Tugas: ${cleanTitle}`}
                        hideWhenEmpty
                      />
                    ) : null}
                  </div>
                </DataTableCell>

                {/* 7. Tindakan */}
                <DataTableCell className="w-[110px] whitespace-nowrap text-right pr-4 sm:pr-6">
                  <Link
                    href={href}
                    className="inline-flex min-h-8 w-[92px] items-center justify-center gap-1 rounded-[var(--radius-control)] bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white shadow-2xs transition hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                  >
                    <span>{actionLabel}</span>
                    <ArrowRight
                      aria-hidden="true"
                      className="size-3.5 shrink-0"
                    />
                  </Link>
                </DataTableCell>
              </DataTableRow>
            );
          })}
        </DataTableBody>
      </DataTable>
    </DataTableContainer>
  );
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
  const isNeedsReview =
    values.needsReview === "1" ||
    values.needsReview === "true" ||
    values.status === "needs_review";
  const selectedStatus = isNeedsReview
    ? "needs_review"
    : (values.status ?? openStatus);
  const queryStatus = isNeedsReview ? openStatus : selectedStatus;
  const query: Record<string, string> = {
    ...values,
    status: queryStatus,
    ...(isNeedsReview ? { needsReview: "1" } : {}),
  };
  if (!isNeedsReview) delete query.needsReview;
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
  const pageHref = (target: number) => {
    const search = new URLSearchParams({
      ...values,
      status: selectedStatus,
      page: String(target),
    });
    if (!isNeedsReview) search.delete("needsReview");
    return `${basePath}?${search.toString()}`;
  };
  const areaName = (id: string) =>
    cleanSimulationText(
      areas.find((area) => area.id === id)?.name ?? "Wilayah",
    );

  return (
    <>
      <form
        action={basePath}
        method="get"
        aria-label="Filter tugas"
        className="mb-5 grid gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:grid-cols-2 lg:grid-cols-12 lg:items-end"
      >
        <div className="grid gap-1.5 lg:col-span-4">
          <label htmlFor="q" className="text-xs font-semibold">
            Cari tugas atau lokasi
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={values.q ?? ""}
              placeholder="Judul tugas, lokasi, atau deskripsi..."
              className="min-h-9 w-full rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--surface)] py-1.5 pr-3 pl-9 text-xs font-medium text-[var(--foreground)]"
            />
          </div>
        </div>
        <div className="grid gap-1 lg:col-span-3">
          <label
            htmlFor="status"
            className="text-[11px] font-semibold text-[var(--foreground)]"
          >
            Status
          </label>
          <CustomSelect
            id="status"
            name="status"
            defaultValue={selectedStatus}
            size="sm"
            options={[
              { value: openStatus, label: "Belum selesai" },
              ...(showAssignees
                ? [{ value: "needs_review", label: "Bukti perlu diperiksa" }]
                : []),
              ...Object.entries(taskStatusLabels).map(([value, label]) => ({
                value,
                label,
              })),
              { value: "all", label: "Semua status" },
            ]}
          />
        </div>
        <div className="grid gap-1 lg:col-span-2">
          <label
            htmlFor="due"
            className="text-[11px] font-semibold text-[var(--foreground)]"
          >
            Tenggat
          </label>
          <CustomSelect
            id="due"
            name="due"
            defaultValue={values.due ?? "all"}
            size="sm"
            options={[
              { value: "all", label: "Semua tenggat" },
              { value: "overdue", label: "Lewat tenggat" },
              { value: "due_soon", label: "≤ 48 jam" },
            ]}
          />
        </div>
        {areas.length > 1 ? (
          <div className="grid gap-1 lg:col-span-2">
            <label
              htmlFor="areaId"
              className="text-[11px] font-semibold text-[var(--foreground)]"
            >
              Wilayah
            </label>
            <CustomSelect
              id="areaId"
              name="areaId"
              defaultValue={values.areaId ?? ""}
              size="sm"
              options={[
                { value: "", label: "Semua wilayah" },
                ...areas.map((area) => ({
                  value: area.id,
                  label: cleanSimulationText(area.name),
                })),
              ]}
            />
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-3">
          <Button type="submit" size="sm" className="min-h-9 px-4">
            Terapkan filter
          </Button>
          <Link
            href={basePath}
            className="inline-flex min-h-9 items-center px-2 text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
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
          {showAssignees ? (
            <DataTableContainer>
              <DataTable caption="Daftar tugas wilayah">
                <DataTableHeader>
                  <RowNumberHeader />
                  <DataTableHeadCell>Tugas</DataTableHeadCell>
                  <DataTableHeadCell className="hidden md:table-cell">
                    Lokasi
                  </DataTableHeadCell>
                  <DataTableHeadCell className="hidden md:table-cell">
                    Kader & Bukti
                  </DataTableHeadCell>
                  <DataTableHeadCell className="hidden lg:table-cell">
                    Tenggat
                  </DataTableHeadCell>
                  <DataTableHeadCell className="hidden sm:table-cell">
                    Status
                  </DataTableHeadCell>
                  <DataTableHeadCell className="w-[104px] whitespace-nowrap text-right pr-3.5 sm:pr-5">
                    Tindakan
                  </DataTableHeadCell>
                </DataTableHeader>
                <DataTableBody>
                  {result.data.map((task, index) => {
                    const rowNumber = (page - 1) * pageSize + index + 1;
                    const assignedNames = assignees?.data.get(task.id) ?? [];
                    const actionLabel = getTaskActionLabel(task, true);
                    const href = `${detailBase}/${task.id}`;
                    const locationNote = task.reportLocationNote
                      ? cleanSimulationText(task.reportLocationNote)
                      : null;
                    const cleanTitle = cleanSimulationText(task.title);
                    const cleanDescription = cleanSimulationText(
                      task.description,
                    );

                    return (
                      <DataTableRow key={task.id}>
                        {/* 1. No. (PALING KIRI) */}
                        <RowNumberCell number={rowNumber} />

                        {/* 2. Tugas */}
                        <DataTableCell className="max-w-[180px] md:w-[25%] md:max-w-0">
                          <div className="min-w-0">
                            <Link
                              href={href}
                              title={cleanTitle}
                              className="block truncate font-semibold text-[var(--foreground)] transition hover:text-[var(--primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                            >
                              {cleanTitle}
                              {assignedNames.length > 0 ? (
                                <span className="sr-only">
                                  {" "}
                                  · {assignedNames.join(", ")}
                                </span>
                              ) : null}
                            </Link>
                            {task.reportCategory ? (
                              <span className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]">
                                {
                                  reportCategoryLabels[
                                    task.reportCategory as ReportCategory
                                  ]
                                }
                                {!task.isMandatory ? " · Opsional" : ""}
                              </span>
                            ) : null}
                            <p
                              title={cleanDescription}
                              className="mt-0.5 block truncate text-xs text-[var(--muted-foreground)]"
                            >
                              {cleanDescription}
                            </p>

                            {/* Mobile compact metadata & disclosure */}
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
                              <StatusBadge tone={taskStatusTone[task.status]}>
                                {taskStatusLabels[task.status]}
                              </StatusBadge>
                              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                                {task.approvedAssigneeCount}/
                                {task.assigneeCount} disetujui
                              </span>
                            </div>
                            <details className="mt-1.5 md:hidden">
                              <summary className="cursor-pointer text-[11px] font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]">
                                Rincian lokasi, kader & progres
                              </summary>
                              <div className="mt-1.5 space-y-1 rounded-[var(--radius-sm)] bg-[var(--surface-muted)] p-2 text-xs text-[var(--muted-foreground)]">
                                <p className="truncate">
                                  <span className="font-semibold text-[var(--foreground)]">
                                    Lokasi:{" "}
                                  </span>
                                  {locationNote ?? "Belum dicantumkan"}
                                  {areas.length > 1
                                    ? ` · ${areaName(task.areaId)}`
                                    : ""}
                                </p>
                                <p className="truncate">
                                  <span className="font-semibold text-[var(--foreground)]">
                                    Kader:{" "}
                                  </span>
                                  {assignedNames.length > 0
                                    ? assignedNames.join(", ")
                                    : "Belum ditugaskan"}
                                </p>
                                <p>
                                  <span className="font-semibold text-[var(--foreground)]">
                                    Tenggat:{" "}
                                  </span>
                                  {task.dueAt
                                    ? formatJakarta(task.dueAt, false)
                                    : "Tanpa tenggat"}
                                  {task.isOverdue
                                    ? " (Lewat tenggat)"
                                    : task.isDueSoon
                                      ? " (Segera)"
                                      : ""}
                                </p>
                                <p>
                                  <span className="font-semibold text-[var(--foreground)]">
                                    Progres bukti:{" "}
                                  </span>
                                  {task.approvedAssigneeCount}/
                                  {task.assigneeCount} disetujui
                                  {task.pendingEvidenceCount > 0
                                    ? ` (${task.pendingEvidenceCount} menunggu tinjau)`
                                    : ""}
                                </p>
                              </div>
                            </details>
                          </div>
                        </DataTableCell>

                        {/* 3. Lokasi */}
                        <DataTableCell className="hidden md:table-cell md:w-[18%] md:max-w-0">
                          <div className="min-w-0">
                            {locationNote ? (
                              <span
                                title={locationNote}
                                className="block truncate text-xs text-[var(--foreground)]"
                              >
                                {locationNote}
                              </span>
                            ) : (
                              <span className="block truncate text-xs italic text-[var(--muted-foreground)]">
                                Belum dicantumkan
                              </span>
                            )}
                            {areas.length > 1 ? (
                              <span
                                title={areaName(task.areaId)}
                                className="mt-0.5 block truncate text-[11px] text-[var(--muted-foreground)]"
                              >
                                {areaName(task.areaId)}
                              </span>
                            ) : null}
                          </div>
                        </DataTableCell>

                        {/* 4. Kader & Progres Bukti */}
                        <DataTableCell className="hidden md:table-cell md:w-[17%] md:max-w-0">
                          <div className="min-w-0">
                            <AssigneeListSummary names={assignedNames} />
                            <p className="mt-0.5 truncate text-[11px] font-medium text-[var(--muted-foreground)]">
                              {task.approvedAssigneeCount}/{task.assigneeCount}{" "}
                              disetujui
                              {task.pendingEvidenceCount > 0 ? (
                                <span className="font-semibold text-[var(--warning)]">
                                  {" "}
                                  · {task.pendingEvidenceCount} tinjau
                                </span>
                              ) : null}
                            </p>
                          </div>
                        </DataTableCell>

                        {/* 5. Tenggat */}
                        <DataTableCell className="hidden whitespace-nowrap lg:table-cell">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-xs font-medium text-[var(--foreground)]">
                              {task.dueAt
                                ? formatJakarta(task.dueAt, false)
                                : "Tanpa tenggat"}
                            </span>
                            {task.isOverdue ? (
                              <span className="text-[11px] font-semibold text-[var(--danger)]">
                                Lewat tenggat
                              </span>
                            ) : task.isDueSoon ? (
                              <span className="text-[11px] font-semibold text-[var(--warning)]">
                                Segera
                              </span>
                            ) : null}
                          </div>
                        </DataTableCell>

                        {/* 6. Status */}
                        <DataTableCell className="hidden whitespace-nowrap sm:table-cell">
                          <StatusBadge tone={taskStatusTone[task.status]}>
                            {taskStatusLabels[task.status]}
                          </StatusBadge>
                        </DataTableCell>

                        {/* 7. Tindakan */}
                        <DataTableCell className="w-[104px] whitespace-nowrap text-right pr-3.5 sm:pr-5">
                          <Link
                            href={href}
                            className="inline-flex min-h-8 w-[88px] items-center justify-center gap-1 rounded-[var(--radius-control)] bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white shadow-2xs transition hover:bg-[var(--primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                          >
                            <span>{actionLabel}</span>
                            <ArrowRight
                              aria-hidden="true"
                              className="size-3.5 shrink-0"
                            />
                          </Link>
                        </DataTableCell>
                      </DataTableRow>
                    );
                  })}
                </DataTableBody>
              </DataTable>
            </DataTableContainer>
          ) : (
            <CadreTaskTable
              tasks={result.data}
              detailBase={detailBase}
              page={page}
              pageSize={pageSize}
            />
          )}
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
