import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { PendingArea } from "@/components/feedback/PendingArea";
import { getDefaultPortal, getVerifiedAreas } from "@/features/areas/access";
import { ReportForm } from "@/features/reports/components/ReportForm";
import { getAccessContext } from "@/lib/auth/context";

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
      <div className="mb-8">
        <Link
          href="/app/laporan"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--primary)]"
        >
          ← Laporan saya
        </Link>
        <h1 className="mt-3 text-3xl font-bold tracking-tight">
          Buat laporan lingkungan
        </h1>
        <p className="mt-2 max-w-2xl text-[var(--muted-foreground)]">
          Catat temuan yang terlihat. Kader akan memeriksa laporan setelah
          dikirim.
        </p>
      </div>
      {areas.length ? <ReportForm areas={areas} /> : <PendingArea />}
    </AppShell>
  );
}
