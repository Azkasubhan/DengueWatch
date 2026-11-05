import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { cardClass } from "@/components/ui/Card";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import {
  ReportFactsCard,
  ReportPhotos,
} from "@/features/reports/components/ReportDetailView";
import { getReportDetail } from "@/features/reports/data";
import { TaskDetailView } from "@/features/tasks/components/TaskDetailView";
import { getTaskDetail } from "@/features/tasks/data";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function CadreTaskDetailPage({
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
  // Detail pages show the bar for the item's own area.
  const shell = (children: React.ReactNode, area = areas[0]) => (
    <AppShell area={area} displayName={access.context.displayName} role="cadre">
      {children}
    </AppShell>
  );
  if (decision.kind === "pending") return shell(<PendingArea />);
  if (!z.uuid().safeParse(id).success) notFound();
  let task;
  let detail;
  try {
    task = await getTaskDetail(id, access.context.userId);
    detail = task ? await getReportDetail(task.reportId) : null;
  } catch {
    return <ServiceUnavailable />;
  }
  if (!task) notFound();
  const report = detail?.report.data;

  return shell(
    <TaskDetailView
      backLink={{ href: "/kader/tugas", label: "Tugas saya" }}
      report={
        // Assigned cadres read the report (photos and private location) through RLS.
        report && detail?.images?.data ? (
          <section aria-label="Laporan warga" className="grid gap-4">
            <ReportPhotos images={detail.images.data} />
            <ReportFactsCard report={report} />
          </section>
        ) : (
          <p className={cardClass}>Laporan terkait belum dapat dimuat.</p>
        )
      }
      role="cadre"
      task={task}
    />,
    areas.find((area) => area.id === task.areaId),
  );
}
