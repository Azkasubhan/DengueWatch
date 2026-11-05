import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { AppShell } from "@/components/layout/AppShell";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  decidePortalAccess,
  getDefaultPortal,
  getVerifiedAreas,
} from "@/features/areas/access";
import { ReportListItem } from "@/features/reports/components/ReportListItem";
import { listReports } from "@/features/reports/data";
import { getAccessContext } from "@/lib/auth/context";
import { cleanSimulationText } from "@/lib/format/text";

export const dynamic = "force-dynamic";

export default async function ResidentHomePage({
  searchParams,
}: {
  searchParams: Promise<{ logout?: string }>;
}) {
  const query = await searchParams;
  const result = await getAccessContext();
  if (result.kind === "unauthenticated") {
    redirect("/login?next=/app/beranda");
  }
  if (result.kind !== "authenticated") {
    return <ServiceUnavailable />;
  }
  if (result.context.role !== "resident") {
    redirect(getDefaultPortal(result.context.role));
  }

  const decision = decidePortalAccess(result.context, "resident");
  const area = getVerifiedAreas(result.context, "resident")[0];
  const recent =
    decision.kind === "allowed"
      ? await listReports(1, 6)
      : { data: null, error: null };

  const displayName = cleanSimulationText(result.context.displayName);

  return (
    <AppShell
      area={area}
      displayName={result.context.displayName}
      role="resident"
    >
      {query.logout === "failed" ? (
        <div className="mb-6 max-w-2xl">
          <Alert variant="error">
            Sesi belum dapat diakhiri. Coba keluar kembali.
          </Alert>
        </div>
      ) : null}
      {decision.kind === "pending" ? (
        <PendingArea />
      ) : (
        <>
          <PageHeader
            title={`Selamat datang, ${displayName}`}
            description="Laporkan temuan di sekitar rumah. Pengelola wilayah akan memeriksanya dan menugaskan kader untuk menindaklanjuti."
            actions={
              <LinkButton href="/app/laporan/buat">
                <Plus aria-hidden="true" className="size-4" />
                Buat laporan
              </LinkButton>
            }
          />
          <section aria-labelledby="recent-title" className="mt-8">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 id="recent-title" className="text-xl font-bold">
                Laporan terbaru
              </h2>
              {recent.data?.length ? (
                <Link
                  href="/app/laporan"
                  className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--primary)] hover:underline"
                >
                  Lihat semua laporan
                </Link>
              ) : null}
            </div>
            {recent.error ? (
              <Alert variant="error">
                Laporan terbaru belum dapat dimuat. Muat ulang halaman ini.
              </Alert>
            ) : recent.data?.length ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {recent.data.map((report) => (
                  <li key={report.id}>
                    <ReportListItem
                      href={`/app/laporan/${report.id}`}
                      report={report}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                icon={FileText}
                title="Belum ada laporan"
                description="Temuan pertama Anda akan muncul di sini beserta statusnya."
              />
            )}
          </section>
        </>
      )}
    </AppShell>
  );
}
