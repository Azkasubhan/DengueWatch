import Link from "next/link";
import { redirect } from "next/navigation";
import { Inbox, Search } from "lucide-react";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { ReportListItem } from "@/features/reports/components/ReportListItem";
import { controlClass } from "@/features/reports/components/reportAction";
import {
  getVerificationQueueCounts,
  listReportRows,
} from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportListQuerySchema,
  reportStatusLabels,
} from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";
import { cleanSimulationText } from "@/lib/format/text";

export const dynamic = "force-dynamic";

const queueStatus = "pending_verification,needs_information";
const pageSize = 10;
const filterKeys = [
  "status",
  "category",
  "areaId",
  "submittedFrom",
  "submittedTo",
  "q",
  "sort",
  "tab",
] as const;

type QueueParams = Partial<
  Record<(typeof filterKeys)[number] | "page", string>
>;

export default async function VerificationQueuePage({
  searchParams,
}: {
  searchParams: Promise<QueueParams>;
}) {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated")
    redirect("/login?next=/pengelola/verifikasi");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  const decision = decidePortalAccess(access.context, "manager");
  if (decision.kind === "forbidden") redirect("/forbidden");
  const areas = getVerifiedAreas(access.context, "manager");
  const shell = (children: React.ReactNode) => (
    <AppShell
      area={areas[0]}
      displayName={access.context.displayName}
      role="manager"
    >
      {children}
    </AppShell>
  );
  if (decision.kind === "pending") return shell(<PendingArea />);

  const params = await searchParams;
  const values: Record<string, string> = {};
  for (const key of [...filterKeys, "page"] as const) {
    const value = params[key];
    if (typeof value === "string" && value.trim()) values[key] = value.trim();
  }
  const activeTab = values.tab;
  const selectedStatus =
    activeTab === "needs_task" ? "verified" : (values.status ?? queueStatus);
  const query: Record<string, string> = { ...values, status: selectedStatus };
  if (query.status === "all") delete query.status;
  const parsed = reportListQuerySchema.safeParse({
    ...query,
    limit: String(pageSize),
  });
  const areaAllowed =
    !values.areaId || areas.some((area) => area.id === values.areaId);

  const [result, queueCounts] = await Promise.all([
    parsed.success && areaAllowed
      ? listReportRows(parsed.data.page, pageSize, {
          category: parsed.data.category,
          status: parsed.data.status,
          areaId: parsed.data.areaId,
          submittedFrom: parsed.data.submittedFrom,
          submittedTo: parsed.data.submittedTo,
          q: parsed.data.q,
          sort: parsed.data.sort,
          tab: parsed.data.tab,
        })
      : Promise.resolve(null),
    areaAllowed
      ? getVerificationQueueCounts(values.areaId)
      : Promise.resolve({
          pendingVerification: 0,
          needsInformation: 0,
          needsTask: 0,
        }),
  ]);

  const page = parsed.success ? parsed.data.page : 1;
  const total = result?.count ?? 0;
  const pageHref = (target: number) => {
    const search = new URLSearchParams({
      ...values,
      status: selectedStatus,
      page: String(target),
    });
    return `/pengelola/verifikasi?${search.toString()}`;
  };
  const tabHref = (overrides: Record<string, string | undefined>) => {
    const next = new URLSearchParams();
    const merged: Record<string, string | undefined> = {
      ...values,
      ...overrides,
    };
    delete merged.page;
    for (const [k, v] of Object.entries(merged)) {
      if (v && v.trim()) next.set(k, v);
    }
    const qs = next.toString();
    return qs ? `/pengelola/verifikasi?${qs}` : "/pengelola/verifikasi";
  };
  const areaName = (id: string) =>
    cleanSimulationText(
      areas.find((area) => area.id === id)?.name ?? "Wilayah tugas",
    );

  return shell(
    <>
      <PageHeader
        title="Antrean verifikasi"
        description="Periksa temuan lingkungan dari warga, minta keterangan tambahan, atau tugaskan kader pada laporan terverifikasi."
      />

      {/* Tab pemisah antrean operasional */}
      <div
        className="mb-4 flex flex-wrap items-center gap-2"
        role="group"
        aria-label="Kategori antrean verifikasi"
      >
        <Link
          href={tabHref({ status: undefined, tab: undefined })}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            selectedStatus === queueStatus && activeTab !== "needs_task"
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          Semua antrean (
          {queueCounts.pendingVerification + queueCounts.needsInformation})
        </Link>
        <Link
          href={tabHref({ status: "pending_verification", tab: undefined })}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            selectedStatus === "pending_verification" &&
            activeTab !== "needs_task"
              ? "border-[var(--warning)] bg-[var(--warning)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          Menunggu keputusan pengelola ({queueCounts.pendingVerification})
        </Link>
        <Link
          href={tabHref({ status: "needs_information", tab: undefined })}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            selectedStatus === "needs_information" && activeTab !== "needs_task"
              ? "border-[var(--info)] bg-[var(--info)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          Menunggu informasi warga ({queueCounts.needsInformation})
        </Link>
        <Link
          href={tabHref({ status: "verified", tab: "needs_task" })}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            activeTab === "needs_task"
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          Perlu penugasan kader ({queueCounts.needsTask})
        </Link>
        <Link
          href={tabHref({ status: "all", tab: undefined })}
          className={`inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${
            selectedStatus === "all" && activeTab !== "needs_task"
              ? "border-[var(--primary)] bg-[var(--primary)] text-white"
              : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]"
          }`}
        >
          Semua status
        </Link>
      </div>

      <form
        action="/pengelola/verifikasi"
        method="get"
        aria-label="Filter antrean"
        className="mb-5 grid gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
      >
        {activeTab === "needs_task" ? (
          <input type="hidden" name="tab" value="needs_task" />
        ) : null}
        <div className="grid gap-1.5 lg:col-span-2">
          <label htmlFor="q" className="text-xs font-semibold">
            Cari referensi atau lokasi
          </label>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--muted-foreground)]"
            />
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={values.q ?? ""}
              placeholder="DW-2026, lokasi, deskripsi..."
              className="min-h-10 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] py-1.5 pr-3 pl-9 text-sm"
            />
          </div>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="status" className="text-xs font-semibold">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={selectedStatus}
            className={controlClass}
          >
            <option value={queueStatus}>Perlu pemeriksaan</option>
            {Object.entries(reportStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
            <option value="all">Semua status</option>
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="category" className="text-xs font-semibold">
            Kategori
          </label>
          <select
            id="category"
            name="category"
            defaultValue={values.category ?? ""}
            className={controlClass}
          >
            <option value="">Semua kategori</option>
            {Object.entries(reportCategoryLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="sort" className="text-xs font-semibold">
            Urutkan
          </label>
          <select
            id="sort"
            name="sort"
            defaultValue={values.sort ?? "newest"}
            className={controlClass}
          >
            <option value="newest">Terbaru masuk</option>
            <option value="waiting_longest">Paling lama menunggu</option>
            <option value="oldest">Terlama</option>
          </select>
        </div>
        {areas.length > 1 ? (
          <div className="grid gap-1.5">
            <label htmlFor="areaId" className="text-xs font-semibold">
              Wilayah
            </label>
            <select
              id="areaId"
              name="areaId"
              defaultValue={values.areaId ?? ""}
              className={controlClass}
            >
              <option value="">Semua wilayah tugas</option>
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="grid gap-1.5">
          <label htmlFor="submittedFrom" className="text-xs font-semibold">
            Dikirim sejak
          </label>
          <input
            id="submittedFrom"
            name="submittedFrom"
            type="date"
            defaultValue={values.submittedFrom}
            className={controlClass}
          />
        </div>
        <div className="grid gap-1.5">
          <label htmlFor="submittedTo" className="text-xs font-semibold">
            Dikirim sampai
          </label>
          <input
            id="submittedTo"
            name="submittedTo"
            type="date"
            defaultValue={values.submittedTo}
            className={controlClass}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-4">
          <Button type="submit">Terapkan filter</Button>
          <Link
            href="/pengelola/verifikasi"
            className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
          >
            Atur ulang
          </Link>
        </div>
      </form>

      {!parsed.success || !areaAllowed ? (
        <div
          role="alert"
          className="max-w-2xl rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
        >
          <p className="font-semibold text-[var(--danger)]">
            Filter tidak valid.
          </p>
          <p className="mt-1">
            Periksa rentang tanggal dan pilihan filter, lalu coba lagi.
          </p>
        </div>
      ) : result?.error ? (
        <div
          role="alert"
          className="max-w-2xl rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
        >
          <p className="font-semibold text-[var(--danger)]">
            Antrean belum tersedia.
          </p>
          <p className="mt-1">Periksa koneksi lalu muat ulang halaman.</p>
          <Link
            href={pageHref(page)}
            className="mt-3 inline-flex min-h-11 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
          >
            Muat ulang antrean
          </Link>
        </div>
      ) : !result?.data?.length ? (
        <EmptyState
          icon={Inbox}
          title={
            page > 1
              ? "Tidak ada laporan di halaman ini."
              : "Tidak ada laporan yang sesuai filter."
          }
          description="Laporan baru dari wilayah tugas akan muncul di sini."
        />
      ) : (
        <>
          <p
            className="mb-3 text-xs font-medium text-[var(--muted-foreground)]"
            aria-live="polite"
          >
            {total} laporan · halaman {page} dari{" "}
            {Math.max(1, Math.ceil(total / pageSize))}
          </p>
          <ul className="grid gap-2.5" aria-label="Daftar laporan">
            {result.data.map((report) => (
              <li key={report.id}>
                <ReportListItem
                  href={`/pengelola/verifikasi/${report.id}`}
                  report={report}
                  areaName={
                    areas.length > 1 ? areaName(report.areaId) : undefined
                  }
                />
              </li>
            ))}
          </ul>
          <nav
            aria-label="Halaman antrean"
            className="mt-6 flex flex-wrap gap-4 border-t border-[var(--border)] pt-4"
          >
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                ← Sebelumnya
              </Link>
            ) : null}
            {total > page * pageSize ? (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex min-h-10 items-center text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                Berikutnya →
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </>,
  );
}
