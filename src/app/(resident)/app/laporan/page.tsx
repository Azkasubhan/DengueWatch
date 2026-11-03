import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { getDefaultPortal, getVerifiedAreas } from "@/features/areas/access";
import { listReports } from "@/features/reports/data";
import { ReportListItem } from "@/features/reports/components/ReportListItem";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

export default async function MyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated") redirect("/login?next=/app/laporan");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  if (access.context.role !== "resident")
    redirect(getDefaultPortal(access.context.role));
  const pageRaw = (await searchParams).page;
  const page =
    pageRaw && /^[1-9][0-9]{0,3}$/.test(pageRaw) ? Number(pageRaw) : 1;
  const result = await listReports(page, 10);
  const area = getVerifiedAreas(access.context, "resident")[0];
  return (
    <AppShell
      area={area}
      displayName={access.context.displayName}
      role="resident"
    >
      <PageHeader
        title="Laporan saya"
        description="Lihat status dan riwayat temuan lingkungan Anda."
        actions={
          area ? (
            <LinkButton href="/app/laporan/buat">
              <Plus aria-hidden="true" className="size-4" />
              Buat laporan
            </LinkButton>
          ) : null
        }
      />
      {result.error ? (
        <div
          role="alert"
          className="max-w-2xl rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
        >
          <p className="font-semibold text-[var(--danger)]">
            Daftar laporan belum tersedia.
          </p>
          <p className="mt-1">Periksa koneksi lalu coba lagi.</p>
          <form action="/app/laporan" method="get">
            <button
              type="submit"
              className="mt-3 inline-flex min-h-11 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
            >
              Muat ulang laporan
            </button>
          </form>
        </div>
      ) : !result.data?.length ? (
        <EmptyState
          icon={FileText}
          title={
            page > 1
              ? "Tidak ada laporan di halaman ini."
              : "Belum ada laporan."
          }
          description={
            page > 1
              ? "Kembali ke halaman sebelumnya untuk melihat laporan."
              : "Temuan yang Anda kirim akan muncul di sini."
          }
          action={
            page > 1 ? (
              <Link
                href={`/app/laporan?page=${page - 1}`}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                ← Halaman sebelumnya
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <ul className="grid gap-3">
            {result.data.map((report) => (
              <li key={report.id}>
                <ReportListItem
                  href={`/app/laporan/${report.id}`}
                  report={report}
                />
              </li>
            ))}
          </ul>
          <nav aria-label="Halaman laporan" className="mt-7 flex gap-4">
            {page > 1 ? (
              <Link
                href={`/app/laporan?page=${page - 1}`}
                className="min-h-11 text-[var(--primary)]"
              >
                ← Sebelumnya
              </Link>
            ) : null}
            {(result.count ?? 0) > page * 10 ? (
              <Link
                href={`/app/laporan?page=${page + 1}`}
                className="min-h-11 text-[var(--primary)]"
              >
                Berikutnya →
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </AppShell>
  );
}
