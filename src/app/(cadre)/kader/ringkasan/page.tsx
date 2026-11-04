import { redirect } from "next/navigation";
import { Alert } from "@/components/feedback/Alert";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { LinkButton } from "@/components/ui/LinkButton";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { getAccessContext } from "@/lib/auth/context";
import { ListChecks } from "lucide-react";
import { Card } from "@/components/ui/Card";

export const dynamic = "force-dynamic";

export default async function CadreSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ logout?: string }>;
}) {
  const query = await searchParams;
  const result = await getAccessContext();
  if (result.kind === "unauthenticated") {
    redirect("/login?next=/kader/ringkasan");
  }
  if (result.kind !== "authenticated") {
    return <ServiceUnavailable />;
  }

  const decision = decidePortalAccess(result.context, "cadre");
  if (decision.kind === "forbidden") {
    redirect("/forbidden");
  }
  const area = getVerifiedAreas(result.context, "assigned_cadre")[0];

  return (
    <AppShell area={area} displayName={result.context.displayName} role="cadre">
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
        <section>
          <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
            Wilayah tugas terverifikasi
          </h1>
          <p className="mt-3 max-w-3xl text-[var(--muted-foreground)]">
            Akun ini berwenang sebagai kader pada wilayah yang ditampilkan.
            Pengelola wilayah memeriksa laporan warga lalu menugaskan tindak
            lanjutnya kepada Anda.
          </p>
          <div className="mt-8 max-w-2xl">
            <Card className="flex flex-col justify-between gap-6">
              <div>
                <span className="grid size-11 place-items-center rounded-full bg-[var(--forest)] text-[var(--forest-foreground)]">
                  <ListChecks aria-hidden="true" className="size-5" />
                </span>
                <h2 className="mt-4 text-lg font-bold">Kerjakan tugas</h2>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  Buka lokasi laporan, mulai tugas, lalu kirim foto bukti untuk
                  diperiksa pengelola.
                </p>
              </div>
              <LinkButton href="/kader/tugas" className="self-start">
                Buka tugas saya
              </LinkButton>
            </Card>
          </div>
        </section>
      )}
    </AppShell>
  );
}
