import { redirect } from "next/navigation";
import { Alert } from "@/components/feedback/Alert";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function ManagerSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ logout?: string }>;
}) {
  const query = await searchParams;
  const result = await getAccessContext();
  if (result.kind === "unauthenticated") {
    redirect("/login?next=/pengelola/ringkasan");
  }
  if (result.kind !== "authenticated") {
    return <ServiceUnavailable />;
  }

  const decision = decidePortalAccess(result.context, "manager");
  if (decision.kind === "forbidden") {
    redirect("/forbidden");
  }
  const area = getVerifiedAreas(result.context, "manager")[0];

  return (
    <AppShell
      area={area}
      displayName={result.context.displayName}
      role="manager"
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
        <section className="max-w-3xl">
          <p className="text-sm font-semibold text-[var(--primary)]">
            Ringkasan pengelola
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">
            Akses pemantauan wilayah
          </h1>
          <p className="mt-4 text-[var(--muted-foreground)]">
            Pengelola memiliki akses pemantauan sesuai wilayah, bukan kewenangan
            verifikasi kader. Analitik operasional belum dibangun pada milestone
            ini.
          </p>
        </section>
      )}
    </AppShell>
  );
}
