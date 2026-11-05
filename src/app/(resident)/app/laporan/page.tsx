import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { getDefaultPortal, getVerifiedAreas } from "@/features/areas/access";
import { listReportRows } from "@/features/reports/data";
import { ReportListItem } from "@/features/reports/components/ReportListItem";
import {
  reportStatuses,
  reportStatusLabels,
  type ReportStatus,
} from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

function buildQuery(params: {
  page?: number;
  status?: string;
  q?: string;
  sort?: string;
}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.q) qs.set("q", params.q);
  if (params.sort && params.sort !== "newest") qs.set("sort", params.sort);
  if (params.page && params.page > 1) qs.set("page", String(params.page));
  const str = qs.toString();
  return str ? `/app/laporan?${str}` : "/app/laporan";
}

export default async function MyReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    q?: string;
    sort?: string;
  }>;
}) {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated") redirect("/login?next=/app/laporan");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  if (access.context.role !== "resident")
    redirect(getDefaultPortal(access.context.role));

  const query = await searchParams;
  const page =
    query.page && /^[1-9][0-9]{0,3}$/.test(query.page) ? Number(query.page) : 1;
  const status = reportStatuses.includes(query.status as ReportStatus)
    ? (query.status as ReportStatus)
    : undefined;
  const q = query.q?.trim() ? query.q.trim().slice(0, 120) : undefined;
  const sort = query.sort === "oldest" ? "oldest" : "newest";

  const result = await listReportRows(page, 10, {
    status: status ? [status] : undefined,
    q,
    sort,
  });
  const area = getVerifiedAreas(access.context, "resident")[0];
  const hasActiveFilter = Boolean(status || q || sort !== "newest");

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

      {/* Filter & pencarian server-side */}
      <form
        action="/app/laporan"
        method="get"
        aria-label="Filter laporan"
        className="mb-5 grid gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:grid-cols-12 sm:items-end"
      >
        <div className="sm:col-span-5">
          <label
            htmlFor="report-search"
            className="block text-xs font-semibold text-[var(--foreground)]"
          >
            Cari referensi atau deskripsi
          </label>
          <div className="relative mt-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              id="report-search"
              name="q"
              type="search"
              defaultValue={q ?? ""}
              placeholder="Contoh: DW-2026 atau selokan..."
              className="min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] py-1.5 pr-3 pl-9 text-sm"
            />
          </div>
        </div>
        <div className="sm:col-span-4">
          <label
            htmlFor="report-status"
            className="block text-xs font-semibold text-[var(--foreground)]"
          >
            Status laporan
          </label>
          <select
            id="report-status"
            name="status"
            defaultValue={status ?? ""}
            className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm"
          >
            <option value="">Semua status</option>
            {reportStatuses.map((item) => (
              <option key={item} value={item}>
                {reportStatusLabels[item]}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-3 flex items-center gap-2">
          <div className="flex-1">
            <label
              htmlFor="report-sort"
              className="block text-xs font-semibold text-[var(--foreground)]"
            >
              Urutan
            </label>
            <select
              id="report-sort"
              name="sort"
              defaultValue={sort}
              className="mt-1 min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-sm"
            >
              <option value="newest">Terbaru</option>
              <option value="oldest">Terlama</option>
            </select>
          </div>
          <button
            type="submit"
            className="mt-5 inline-flex min-h-10 items-center justify-center rounded-[var(--radius-control)] bg-[var(--primary)] px-3.5 py-1.5 text-sm font-semibold text-white transition hover:bg-[var(--primary-hover)]"
          >
            Terapkan
          </button>
        </div>
        {hasActiveFilter ? (
          <div className="flex items-center justify-between border-t border-[var(--border)] pt-2.5 text-xs text-[var(--muted-foreground)] sm:col-span-12">
            <span>
              Menampilkan {result.count ?? 0} laporan sesuai filter aktif.
            </span>
            <Link
              href="/app/laporan"
              className="font-semibold text-[var(--primary)] hover:underline"
            >
              Atur ulang filter
            </Link>
          </div>
        ) : null}
      </form>

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
              : hasActiveFilter
                ? "Tidak ada laporan yang cocok dengan filter."
                : "Belum ada laporan."
          }
          description={
            page > 1
              ? "Kembali ke halaman sebelumnya untuk melihat laporan."
              : hasActiveFilter
                ? "Coba ubah kata kunci pencarian atau pilih status laporan lain."
                : "Temuan yang Anda kirim akan muncul di sini."
          }
          action={
            page > 1 ? (
              <Link
                href={buildQuery({ page: page - 1, status, q, sort })}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                ← Halaman sebelumnya
              </Link>
            ) : hasActiveFilter ? (
              <Link
                href="/app/laporan"
                className="inline-flex min-h-11 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                Tampilkan semua laporan
              </Link>
            ) : null
          }
        />
      ) : (
        <>
          <ul className="grid gap-2.5">
            {result.data.map((report) => (
              <li key={report.id}>
                <ReportListItem
                  href={`/app/laporan/${report.id}`}
                  report={report}
                />
              </li>
            ))}
          </ul>
          <nav
            aria-label="Halaman laporan"
            className="mt-6 flex items-center justify-between gap-4 border-t border-[var(--border)] pt-4 text-sm"
          >
            <span className="text-xs text-[var(--muted-foreground)]">
              Halaman {page} · Total {result.count ?? result.data.length}{" "}
              laporan
            </span>
            <div className="flex gap-4">
              {page > 1 ? (
                <Link
                  href={buildQuery({ page: page - 1, status, q, sort })}
                  className="inline-flex min-h-10 items-center font-semibold text-[var(--primary)] hover:underline"
                >
                  ← Sebelumnya
                </Link>
              ) : null}
              {(result.count ?? 0) > page * 10 ? (
                <Link
                  href={buildQuery({ page: page + 1, status, q, sort })}
                  className="inline-flex min-h-10 items-center font-semibold text-[var(--primary)] hover:underline"
                >
                  Berikutnya →
                </Link>
              ) : null}
            </div>
          </nav>
        </>
      )}
    </AppShell>
  );
}
