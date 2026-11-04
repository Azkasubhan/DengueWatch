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
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

// Managers follow every task in their areas and open one to review evidence (T27).
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
          <PageHeader
            title="Tugas wilayah"
            description="Pantau tugas kader, periksa bukti yang masuk, dan buka kembali tugas bila masalah muncul lagi."
          />
          <TaskListPage
            areas={areas}
            basePath="/pengelola/tugas"
            detailBase="/pengelola/tugas"
            showAssignees
            params={await searchParams}
            userId={access.context.userId}
          />
        </>
      )}
    </AppShell>
  );
}
