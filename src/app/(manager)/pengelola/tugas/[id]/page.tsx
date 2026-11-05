import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { TaskDetailView } from "@/features/tasks/components/TaskDetailView";
import { getTaskDetail } from "@/features/tasks/data";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function ManagerTaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const access = await getAccessContext();
  if (access.kind === "unauthenticated")
    redirect("/login?next=/pengelola/tugas");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  const decision = decidePortalAccess(access.context, "manager");
  if (decision.kind === "forbidden") redirect("/forbidden");
  const areas = getVerifiedAreas(access.context, "manager");
  // Detail pages show the bar for the item's own area.
  const shell = (children: React.ReactNode, area = areas[0]) => (
    <AppShell
      area={area}
      displayName={access.context.displayName}
      role="manager"
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

  return shell(
    <TaskDetailView
      backLink={{ href: "/pengelola/tugas", label: "Tugas wilayah" }}
      reportHref={`/pengelola/verifikasi/${task.reportId}`}
      role="manager"
      task={task}
    />,
    areas.find((area) => area.id === task.areaId),
  );
}
