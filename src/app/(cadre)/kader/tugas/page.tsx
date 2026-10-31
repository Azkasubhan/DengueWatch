import { redirect } from "next/navigation";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import {
  TaskListPage,
  type TaskListParams,
} from "@/features/tasks/components/TaskListPage";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function CadreTasksPage({
  searchParams,
}: {
  searchParams: Promise<TaskListParams>;
}) {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated") redirect("/login?next=/kader/tugas");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  const decision = decidePortalAccess(access.context, "cadre");
  if (decision.kind === "forbidden") redirect("/forbidden");
  const areas = getVerifiedAreas(access.context, "assigned_cadre");
  return (
    <AppShell
      area={areas[0]}
      displayName={access.context.displayName}
      role="cadre"
    >
      {decision.kind === "pending" ? (
        <PendingArea />
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Tugas</h1>
            <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
              Tindak lanjut dari laporan terverifikasi. Tugas selesai setelah
              bukti diperiksa kader lain.
            </p>
          </div>
          <TaskListPage
            areas={areas}
            basePath="/kader/tugas"
            detailBase="/kader/tugas"
            params={await searchParams}
            userId={access.context.userId}
          />
        </>
      )}
    </AppShell>
  );
}
