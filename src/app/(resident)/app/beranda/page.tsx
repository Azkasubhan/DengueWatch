import { redirect } from "next/navigation";
import Link from "next/link";
import { Alert } from "@/components/feedback/Alert";
import { AppShell } from "@/components/layout/AppShell";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import {
  decidePortalAccess,
  getDefaultPortal,
  getVerifiedAreas,
} from "@/features/areas/access";
import { getAccessContext } from "@/lib/auth/context";

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
        <section className="max-w-3xl">
          <p className="text-sm font-semibold text-[var(--primary)]">
            Beranda warga
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.03em]">
            Selamat datang, {result.context.displayName}
          </h1>
          <p className="mt-4 text-[var(--muted-foreground)]">
            Akses wilayah Anda sudah terverifikasi. Laporkan temuan lingkungan
            agar dapat diperiksa kader.
          </p>
          <div className="mt-7 flex flex-wrap gap-4">
            <Link
              href="/app/laporan/buat"
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-[var(--primary)] px-5 font-semibold text-white"
            >
              Buat laporan
            </Link>
            <Link
              href="/app/laporan"
              className="inline-flex min-h-11 items-center text-[var(--primary)]"
            >
              Laporan saya
            </Link>
          </div>
        </section>
      )}
    </AppShell>
  );
}
