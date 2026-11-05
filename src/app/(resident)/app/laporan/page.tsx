import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { getDefaultPortal, getVerifiedAreas } from "@/features/areas/access";
import {
  getResidentStatusCounts,
  listReportRows,
} from "@/features/reports/data";
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

  const [result, statusCounts] = await Promise.all([
    listReportRows(page, 10, {
      status: status ? [status] : undefined,
      q,
      sort,
    }),
    getResidentStatusCounts(q),
  ]);
  const area = getVerifiedAreas(access.context, "resident")[0];
  const hasActiveFilter = Boolean(status || q || sort !== "newest");

  const statusTabs: {
    key: ReportStatus | "all";
    label: string;
    count: number;
  }[] = [
    { key: "all", label: "Semua", count: statusCounts.all },
    {
      key: "needs_information",
      label: reportStatusLabels.needs_information,
      count: statusCounts.needs_information,
    },
    {
      key: "pending_verification",
      label: reportStatusLabels.pending_verification,
      count: statusCounts.pending_verification,
    },
    {
      key: "verified",
      label: reportStatusLabels.verified,
      count: statusCounts.verified,
    },
    {
      key: "in_action",
      label: reportStatusLabels.in_action,
      count: statusCounts.in_action,
    },
    {
      key: "resolved",
      label: reportStatusLabels.resolved,
      count: statusCounts.resolved,
    },
    ...(statusCounts.rejected > 0 || status === "rejected"
      ? [
          {
            key: "rejected" as const,
            label: reportStatusLabels.rejected,
            count: statusCounts.rejected,
          },
        ]
      : []),
    ...(statusCounts.duplicate > 0 || status === "duplicate"
      ? [
          {
            key: "duplicate" as const,
            label: reportStatusLabels.duplicate,
            count: statusCounts.duplicate,
          },
        ]
      : []),
  ];

  return (
    <AppShell
      area={area}
      displayName={access.context.displayName}
      role="resident"
    >
      <PageHeader
        title="Laporan saya"
        description="Arsip lengkap, pencarian, dan pelacakan status laporan lingkungan Anda."
        actions={
          area ? (
            <LinkButton href="/app/laporan/buat">
              <Plus aria-hidden="true" className="size-4" />
              Buat laporan
            </LinkButton>
          ) : null
        }
      />

      {/* Ringkasan status ringkas melalui filter tab dengan jumlah item yang sinkron */}
      <nav
        aria-label="Filter status cepat"
        className="mb-3 flex flex-wrap items-center gap-1.5"
      >
        {statusTabs.map((tab) => {
          const isActive = tab.key === "all" ? !status : status === tab.key;
          return (
            <Link
              key={tab.key}
              href={buildQuery({
                status: tab.key === "all" ? undefined : tab.key,
                q,
                sort,
              })}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ${
                isActive
                  ? "border-[var(--primary)] bg-[var(--primary)] text-white"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[11px] tabular-nums ${
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-[var(--background)] text-[var(--muted-foreground)]"
                }`}
              >
                {tab.count}
              </span>
            </Link>
          );
        })}
      </nav>

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
            Cari referensi, deskripsi, atau lokasi
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
              className="min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--control-border)] bg-[var(--surface)] py-1.5 pr-3 pl-9 text-sm"
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
          <div className="mt-1">
            <CustomSelect
              id="report-status"
              name="status"
              defaultValue={status ?? ""}
              size="md"
              options={[
                { value: "", label: `Semua status (${statusCounts.all})` },
                ...reportStatuses.map((item) => ({
                  value: item,
                  label: `${reportStatusLabels[item]} (${statusCounts[item]})`,
                })),
              ]}
            />
          </div>
        </div>
        <div className="flex items-end gap-2 sm:col-span-3">
          <div className="flex-1">
            <label
              htmlFor="report-sort"
              className="block text-xs font-semibold text-[var(--foreground)]"
            >
              Urutan
            </label>
            <div className="mt-1">
              <CustomSelect
                id="report-sort"
                name="sort"
                defaultValue={sort}
                size="md"
                options={[
                  { value: "newest", label: "Terbaru" },
                  { value: "oldest", label: "Terlama" },
                ]}
              />
            </div>
          </div>
          <Button type="submit" size="md" className="shrink-0">
            Terapkan
          </Button>
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
                  role="resident"
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
