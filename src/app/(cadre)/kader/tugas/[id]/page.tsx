import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge, taskStatusTone } from "@/components/ui/StatusBadge";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { TaskActions } from "@/features/tasks/components/TaskActions";
import { getTaskDetail } from "@/features/tasks/data";
import { taskEventLabels, taskStatusLabels } from "@/features/tasks/validation";
import { getAccessContext } from "@/lib/auth/context";
import { cardClass } from "@/components/ui/Card";
import { Timeline } from "@/components/ui/Timeline";

export const dynamic = "force-dynamic";

const reviewLabels = {
  pending: "Menunggu pemeriksaan",
  approved: "Disetujui",
  revision_required: "Perlu perbaikan",
} as const;

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getAccessContext();
  if (access.kind === "unauthenticated") redirect("/login?next=/kader/tugas");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  const decision = decidePortalAccess(access.context, "cadre");
  if (decision.kind === "forbidden") redirect("/forbidden");
  const areas = getVerifiedAreas(access.context, "assigned_cadre");
  // Detail pages show the bar (and its SIMULASI flag) for the item's own area.
  const shell = (children: React.ReactNode, area = areas[0]) => (
    <AppShell area={area} displayName={access.context.displayName} role="cadre">
      {children}
    </AppShell>
  );
  if (decision.kind === "pending") return shell(<PendingArea />);
  if (!z.uuid().safeParse(id).success) notFound();
  let task;
  try {
    task = await getTaskDetail(id, access.context.userId);
  } catch {
    return <ServiceUnavailable />;
  }
  if (!task) notFound();
  const pendingEvidence = task.evidence.find(
    (item) => item.reviewStatus === "pending",
  );

  return shell(
    <>
      <PageHeader
        back={{ href: "/kader/tugas", label: "Daftar tugas" }}
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
                      <p className="font-semibold">
                        {reviewLabels[item.reviewStatus]}
                        {item.submittedByMe ? " · dikirim oleh Anda" : ""}
                      </p>
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
            <div>
              <dt className="text-sm font-semibold">Penanggung jawab</dt>
              <dd className="mt-1">
                {task.assignedToMe ? "Anda" : "Kader lain di wilayah ini"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">Tenggat</dt>
              <dd className="mt-1">
                {task.dueAt
                  ? `${formatJakarta(task.dueAt)} WIB`
                  : "Tidak ditentukan"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">Jenis</dt>
              <dd className="mt-1">
                {task.isMandatory
                  ? "Wajib untuk penyelesaian laporan"
                  : "Opsional"}
              </dd>
            </div>
            <div>
              <dt className="text-sm font-semibold">Laporan</dt>
              <dd className="mt-1">
                <Link
                  href={`/kader/verifikasi/${task.reportId}`}
                  className="font-semibold text-[var(--primary)] underline underline-offset-2"
                >
                  Lihat laporan {task.reportReference}
                </Link>
              </dd>
            </div>
          </dl>
          <TaskActions
            taskId={task.id}
            status={task.status}
            version={task.version}
            assignedToMe={task.assignedToMe}
            pendingSubmittedByMe={
              pendingEvidence ? pendingEvidence.submittedByMe : null
            }
          />
          <Timeline
            id="task-history-title"
            title="Riwayat tugas"
            items={task.events.map((event) => ({
              id: event.id,
              label: taskEventLabels[event.eventType] ?? "Pembaruan tugas",
              reason: event.reason,
              time: `${formatJakarta(event.createdAt)} WIB`,
            }))}
          />
        </div>
      </div>
    </>,
    areas.find((area) => area.id === task.areaId),
  );
}
