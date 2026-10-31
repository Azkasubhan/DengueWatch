import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { TaskActions } from "@/features/tasks/components/TaskActions";
import { getTaskDetail } from "@/features/tasks/data";
import { taskEventLabels, taskStatusLabels } from "@/features/tasks/validation";
import { getAccessContext } from "@/lib/auth/context";

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
      <Link
        href="/kader/tugas"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--primary)]"
      >
        ← Daftar tugas
      </Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--primary)]">
            {task.reportReference ?? "Laporan"}
          </p>
          <h1 className="mt-2 break-words text-3xl font-bold tracking-tight">
            {task.title}
          </h1>
          <p className="mt-3 inline-block rounded-[var(--radius-control)] bg-[var(--primary-subtle)] px-3 py-2 font-semibold">
            {taskStatusLabels[task.status]}
          </p>
          <dl className="mt-7 grid gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
            <div>
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

          <section aria-labelledby="evidence-title" className="mt-8">
            <h2 id="evidence-title" className="text-2xl font-bold">
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
                    className="grid gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-[10rem_minmax(0,1fr)]"
                  >
                    <Image
                      unoptimized
                      src={item.url}
                      alt={`Foto bukti ${index + 1}`}
                      width={item.width}
                      height={item.height}
                      className="aspect-square w-full rounded-[var(--radius-control)] border border-[var(--border)] object-cover"
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

          <section aria-labelledby="task-history-title" className="mt-8">
            <h2 id="task-history-title" className="text-2xl font-bold">
              Riwayat tugas
            </h2>
            <ol className="mt-5 border-l-2 border-[var(--border)] pl-5">
              {task.events.map((event) => (
                <li key={event.id} className="pb-6">
                  <p className="font-semibold">
                    {taskEventLabels[event.eventType] ?? "Pembaruan tugas"}
                  </p>
                  {event.reason ? (
                    <p className="mt-1 whitespace-pre-wrap break-words">
                      {event.reason}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                    {formatJakarta(event.createdAt)} WIB
                  </p>
                </li>
              ))}
            </ol>
          </section>
        </div>
        <div className="min-w-0">
          <TaskActions
            taskId={task.id}
            status={task.status}
            version={task.version}
            assignedToMe={task.assignedToMe}
            pendingSubmittedByMe={
              pendingEvidence ? pendingEvidence.submittedByMe : null
            }
          />
        </div>
      </div>
    </>,
  );
}
