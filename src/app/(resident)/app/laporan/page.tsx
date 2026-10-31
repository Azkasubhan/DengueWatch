import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { getDefaultPortal, getVerifiedAreas } from "@/features/areas/access";
import { listReports } from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportStatusLabels,
} from "@/features/reports/validation";
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
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Laporan saya</h1>
          <p className="mt-2 text-[var(--muted-foreground)]">
            Lihat status dan riwayat temuan lingkungan Anda.
          </p>
        </div>
        {area ? (
          <Link
            href="/app/laporan/buat"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] bg-[var(--primary)] px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Buat laporan
          </Link>
        ) : null}
      </div>
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
        <div className="max-w-2xl rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="font-semibold">
            {page > 1
              ? "Tidak ada laporan di halaman ini."
              : "Belum ada laporan."}
          </p>
          <p className="mt-2 text-[var(--muted-foreground)]">
            {page > 1
              ? "Kembali ke halaman sebelumnya untuk melihat laporan."
              : "Temuan yang Anda kirim akan muncul di sini."}
          </p>
          {page > 1 ? (
            <Link
              href={`/app/laporan?page=${page - 1}`}
              className="mt-3 inline-flex min-h-11 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
            >
              ← Halaman sebelumnya
            </Link>
          ) : null}
        </div>
      ) : (
        <>
          <ul className="grid gap-3">
            {result.data.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/app/laporan/${report.id}`}
                  className="block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="font-bold text-[var(--primary)]">
                      {report.public_reference}
                    </span>
                    <span className="text-sm font-semibold">
                      {
                        reportStatusLabels[
                          report.status as keyof typeof reportStatusLabels
                        ]
                      }
                    </span>
                  </div>
                  <p className="mt-2 font-semibold">
                    {
                      reportCategoryLabels[
                        report.category as keyof typeof reportCategoryLabels
                      ]
                    }
                  </p>
                  <p className="mt-1 line-clamp-2 break-words text-[var(--muted-foreground)]">
                    {report.description}
                  </p>
                  <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                    {new Intl.DateTimeFormat("id-ID", {
                      dateStyle: "medium",
                      timeZone: "Asia/Jakarta",
                    }).format(new Date(report.submitted_at))}
                    {report.is_demo ? " · Data simulasi" : ""}
                  </p>
                </Link>
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
