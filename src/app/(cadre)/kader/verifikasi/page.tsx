import Link from "next/link";
import { redirect } from "next/navigation";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { controlClass } from "@/features/reports/components/reportAction";
import { listReports } from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportListQuerySchema,
  reportStatusLabels,
} from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";
import { Clock3, Inbox } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatusBadge, reportStatusTone } from "@/components/ui/StatusBadge";
import { PageHeader } from "@/components/ui/PageHeader";

// Aging signal for reports still waiting on a cadre decision (PRD 13.10); reports that
// need information are waiting on the resident instead.
function waitingDays(report: { status: string; submittedAt: string }) {
  if (report.status !== "pending_verification") return 0;
  return Math.floor((Date.now() - Date.parse(report.submittedAt)) / 86_400_000);
}

export const dynamic = "force-dynamic";

const queueStatus = "pending_verification,needs_information";
const pageSize = 10;
const filterKeys = [
  "status",
  "category",
  "areaId",
  "submittedFrom",
  "submittedTo",
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
    redirect("/login?next=/kader/verifikasi");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  const decision = decidePortalAccess(access.context, "cadre");
  if (decision.kind === "forbidden") redirect("/forbidden");
  const areas = getVerifiedAreas(access.context, "assigned_cadre");
  const shell = (children: React.ReactNode) => (
    <AppShell
      area={areas[0]}
      displayName={access.context.displayName}
      role="cadre"
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
  const selectedStatus = values.status ?? queueStatus;
  const query = { ...values, status: selectedStatus };
  if (query.status === "all") delete (query as Partial<typeof query>).status;
  const parsed = reportListQuerySchema.safeParse({
    ...query,
    limit: String(pageSize),
  });
  const areaAllowed =
    !values.areaId || areas.some((area) => area.id === values.areaId);
  const result =
    parsed.success && areaAllowed
      ? await listReports(parsed.data.page, pageSize, {
          category: parsed.data.category,
          status: parsed.data.status,
          areaId: parsed.data.areaId,
          submittedFrom: parsed.data.submittedFrom,
          submittedTo: parsed.data.submittedTo,
        })
      : null;
  const page = parsed.success ? parsed.data.page : 1;
  const total = result?.count ?? 0;
  const pageHref = (target: number) => {
    const search = new URLSearchParams({
      ...values,
      status: selectedStatus,
      page: String(target),
    });
    return `/kader/verifikasi?${search.toString()}`;
  };
  const areaName = (id: string) =>
    areas.find((area) => area.id === id)?.name ?? "Wilayah tugas";

  return shell(
    <>
      <PageHeader
        title="Antrean verifikasi"
        description="Laporan dari wilayah tugas Anda. Periksa foto dan keterangan sebelum memutuskan."
      />
      <form
        action="/kader/verifikasi"
        method="get"
        aria-label="Filter antrean"
        className="mb-6 grid gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      >
        <div className="grid gap-2">
          <label htmlFor="status" className="text-sm font-semibold">
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
        <div className="grid gap-2">
          <label htmlFor="category" className="text-sm font-semibold">
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
        {areas.length > 1 ? (
          <div className="grid gap-2">
            <label htmlFor="areaId" className="text-sm font-semibold">
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
        <div className="grid gap-2">
          <label htmlFor="submittedFrom" className="text-sm font-semibold">
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
        <div className="grid gap-2">
          <label htmlFor="submittedTo" className="text-sm font-semibold">
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
        <div className="flex flex-wrap gap-3 sm:col-span-2 lg:col-span-5">
          <Button type="submit">Terapkan filter</Button>
          <Link
            href="/kader/verifikasi"
            className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--primary)] underline underline-offset-2"
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
            className="mb-3 text-sm text-[var(--muted-foreground)]"
            aria-live="polite"
          >
            {total} laporan · halaman {page} dari{" "}
            {Math.max(1, Math.ceil(total / pageSize))}
          </p>
          <ul className="grid gap-3" aria-label="Daftar laporan">
            {result.data.map((report) => (
              <li key={report.id}>
                <Link
                  href={`/kader/verifikasi/${report.id}`}
                  className="block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 hover:border-[var(--primary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
                >
                  <div className="flex flex-wrap justify-between gap-2">
                    <span className="text-sm font-semibold text-[var(--muted-foreground)]">
                      {report.publicReference}
                    </span>
                    <StatusBadge tone={reportStatusTone[report.status]}>
                      {reportStatusLabels[report.status]}
                    </StatusBadge>
                  </div>
                  <p className="mt-2 font-semibold">
                    {reportCategoryLabels[report.category]}
                  </p>
                  <p className="mt-1 line-clamp-2 break-words text-[var(--muted-foreground)]">
                    {report.description}
                  </p>
                  <p className="mt-3 text-sm text-[var(--muted-foreground)]">
                    {formatJakarta(report.submittedAt, false)}
                    {areas.length > 1 ? ` · ${areaName(report.areaId)}` : ""}
                    {report.isDemo ? " · Data simulasi" : ""}
                  </p>
                  {waitingDays(report) ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--warning)]">
                      <Clock3 aria-hidden="true" className="size-4" />
                      Menunggu {waitingDays(report)} hari
                    </p>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <nav
            aria-label="Halaman antrean"
            className="mt-7 flex flex-wrap gap-4"
          >
            {page > 1 ? (
              <Link
                href={pageHref(page - 1)}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--primary)]"
              >
                ← Sebelumnya
              </Link>
            ) : null}
            {total > page * pageSize ? (
              <Link
                href={pageHref(page + 1)}
                className="inline-flex min-h-11 items-center font-semibold text-[var(--primary)]"
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
