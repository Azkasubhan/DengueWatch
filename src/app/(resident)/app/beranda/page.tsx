import { redirect } from "next/navigation";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { AppShell } from "@/components/layout/AppShell";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { Card } from "@/components/ui/Card";
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

const steps = [
  { title: "Dikirim", text: "Laporan Anda masuk ke antrean kader wilayah." },
  { title: "Diperiksa", text: "Kader memverifikasi foto dan keterangan." },
  { title: "Ditangani", text: "Kader membuat tugas dan mengerjakannya." },
  {
    title: "Selesai",
    text: "Bukti penanganan disetujui oleh kader lain.",
  },
];

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
      ? await listReports(1, 3)
      : { data: null, error: null };

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
            title={`Selamat datang, ${result.context.displayName}`}
            description="Laporkan temuan di sekitar rumah. Kader di wilayah Anda akan memeriksa dan menindaklanjutinya."
            actions={
              <LinkButton href="/app/laporan/buat">
                <Plus aria-hidden="true" className="size-4" />
                Buat laporan
              </LinkButton>
            }
          />
          <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
            <section aria-labelledby="recent-title" className="lg:col-span-8">
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
                <ul className="grid gap-3">
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
            <Card className="lg:col-span-4">
              <h2 className="text-lg font-bold">Bagaimana laporan diproses</h2>
              <ol className="mt-4 grid gap-4">
                {steps.map((step, index) => (
                  <li className="flex gap-3" key={step.title}>
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--forest)] text-xs font-bold text-[var(--forest-foreground)]">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold">{step.title}</p>
                      <p className="text-sm text-[var(--muted-foreground)]">
                        {step.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </>
      )}
    </AppShell>
  );
}
