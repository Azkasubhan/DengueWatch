import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { PendingArea } from "@/components/feedback/PendingArea";
import { getDefaultPortal, getVerifiedAreas } from "@/features/areas/access";
import { ReportForm } from "@/features/reports/components/ReportForm";
import { getAccessContext } from "@/lib/auth/context";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function CreateReportPage() {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated")
    redirect("/login?next=/app/laporan/buat");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  if (access.context.role !== "resident")
    redirect(getDefaultPortal(access.context.role));
  const areas = getVerifiedAreas(access.context, "resident");
  return (
    <AppShell
      area={areas[0]}
      displayName={access.context.displayName}
      role="resident"
    >
      <PageHeader
        back={{ href: "/app/laporan", label: "Laporan saya" }}
        title="Buat laporan lingkungan"
        description="Catat temuan yang terlihat. Kader akan memeriksa laporan setelah dikirim."
      />
      {areas.length ? <ReportForm areas={areas} /> : <PendingArea />}
    </AppShell>
  );
}
