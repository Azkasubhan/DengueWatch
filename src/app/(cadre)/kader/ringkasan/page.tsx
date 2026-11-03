import { redirect } from "next/navigation";
import { Alert } from "@/components/feedback/Alert";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { LinkButton } from "@/components/ui/LinkButton";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { getAccessContext } from "@/lib/auth/context";
import { ClipboardCheck, ListChecks } from "lucide-react";
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
            Akun ini berwenang sebagai kader hanya pada wilayah yang
            ditampilkan. Laporan warga dari wilayah ini tersedia di antrean
            verifikasi.
          </p>
          <div className="mt-8 grid max-w-4xl gap-4 md:grid-cols-2">
            <Card className="flex flex-col justify-between gap-6">
              <div>
                <span className="grid size-11 place-items-center rounded-full bg-[var(--forest)] text-[var(--forest-foreground)]">
                  <ClipboardCheck aria-hidden="true" className="size-5" />
                </span>
                <h2 className="mt-4 text-lg font-bold">
                  Periksa laporan warga
                </h2>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  Verifikasi, minta informasi, atau tandai duplikat.
                </p>
              </div>
              <LinkButton href="/kader/verifikasi" className="self-start">
                Buka antrean verifikasi
              </LinkButton>
            </Card>
            <Card className="flex flex-col justify-between gap-6">
              <div>
                <span className="grid size-11 place-items-center rounded-full bg-[var(--sand)]">
                  <ListChecks
                    aria-hidden="true"
                    className="size-5 text-[var(--forest)]"
                  />
                </span>
                <h2 className="mt-4 text-lg font-bold">Kerjakan tugas</h2>
                <p className="mt-1 text-[var(--muted-foreground)]">
                  Mulai tugas, kirim bukti, dan periksa bukti kader lain.
                </p>
              </div>
              <LinkButton
                href="/kader/tugas"
                className="self-start"
                variant="secondary"
              >
                Buka daftar tugas
              </LinkButton>
            </Card>
          </div>
        </section>
      )}
    </AppShell>
  );
}
