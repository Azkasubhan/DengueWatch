import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/ui/PageHeader";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import {
  decidePortalAccess,
  getDefaultPortal,
  getVerifiedAreas,
} from "@/features/areas/access";
import { ReportForm } from "@/features/reports/components/ReportForm";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function CreateReportPage() {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated") {
    redirect("/login?next=/app/laporan/buat");
  }
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  if (access.context.role !== "resident") {
    redirect(getDefaultPortal(access.context.role));
  }
  const decision = decidePortalAccess(access.context, "resident");
  const areas = getVerifiedAreas(access.context, "resident");
  return (
    <AppShell
      area={areas[0]}
      displayName={access.context.displayName}
      role="resident"
    >
      <div className="mx-auto w-full max-w-[840px]">
        <PageHeader
          back={{ href: "/app/beranda", label: "Beranda" }}
          title="Buat laporan lingkungan"
          description="Unggah foto temuan dan tulis keterangan singkat agar dapat diperiksa pengelola wilayah."
        />
        {decision.kind === "pending" || !areas.length ? (
          <PendingArea />
        ) : (
          <ReportForm areas={areas} />
        )}
      </div>
    </AppShell>
  );
}
