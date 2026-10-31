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

// Managers monitor tasks read-only; there are no action links here.
export default async function ManagerTasksPage({
  searchParams,
}: {
  searchParams: Promise<TaskListParams>;
}) {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated")
    redirect("/login?next=/pengelola/tugas");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  const decision = decidePortalAccess(access.context, "manager");
  if (decision.kind === "forbidden") redirect("/forbidden");
  const areas = getVerifiedAreas(access.context, "manager");
  return (
    <AppShell
      area={areas[0]}
      displayName={access.context.displayName}
      role="manager"
    >
      {decision.kind === "pending" ? (
        <PendingArea />
      ) : (
        <>
          <div className="mb-6">
            <h1 className="text-3xl font-bold tracking-tight">Tugas wilayah</h1>
            <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
              Pantau tindak lanjut kader. Halaman ini hanya untuk dibaca.
            </p>
          </div>
          <TaskListPage
            areas={areas}
            basePath="/pengelola/tugas"
            detailBase={null}
            params={await searchParams}
            userId={access.context.userId}
          />
        </>
      )}
    </AppShell>
  );
}
