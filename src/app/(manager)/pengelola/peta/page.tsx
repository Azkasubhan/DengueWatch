import Link from "next/link";
import { redirect } from "next/navigation";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { FindingsMap } from "@/features/map/components/FindingsMap";
import { controlClass } from "@/features/reports/components/reportAction";
import { listMapReports } from "@/features/reports/data";
import {
  reportCategories,
  reportCategoryLabels,
  reportStatuses,
  reportStatusLabels,
  type ReportCategory,
  type ReportStatus,
} from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

type MapPageParams = Partial<
  Record<
    "status" | "category" | "areaId" | "submittedFrom" | "submittedTo",
    string
  >
>;

export default async function ManagerMapPage({
  searchParams,
}: {
  searchParams: Promise<MapPageParams>;
}) {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated")
    redirect("/login?next=/pengelola/peta");
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
  const status = reportStatuses.includes(params.status as ReportStatus)
    ? [params.status as ReportStatus]
    : undefined;
  const category = reportCategories.includes(params.category as ReportCategory)
    ? (params.category as ReportCategory)
    : undefined;
  const areaId =
    params.areaId && areas.some((a) => a.id === params.areaId)
      ? params.areaId
      : undefined;
  const submittedFrom =
    params.submittedFrom && /^\d{4}-\d{2}-\d{2}$/.test(params.submittedFrom)
      ? params.submittedFrom
      : undefined;
  const submittedTo =
    params.submittedTo && /^\d{4}-\d{2}-\d{2}$/.test(params.submittedTo)
      ? params.submittedTo
      : undefined;

  const mapResult = await listMapReports({
    status,
    category,
    areaId,
    from: submittedFrom,
    to: submittedTo,
  });

  const data = mapResult.data ?? {
    points: [],
    missingCoordinatesCount: 0,
    totalMatching: 0,
    withCoordinatesCount: 0,
  };

  return shell(
    <div className="grid gap-5">
      <PageHeader
        title="Peta temuan lingkungan"
        description="Sebaran titik laporan lingkungan warga dan kepadatan laporan pada wilayah tugas Anda."
      />

      <form
        action="/pengelola/peta"
        method="get"
        aria-label="Filter peta temuan"
        className="grid gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3.5 sm:grid-cols-2 lg:grid-cols-5 lg:items-end"
      >
        <div className="grid gap-1.5">
          <label htmlFor="status" className="text-xs font-semibold">
            Status laporan
          </label>
          <select
            id="status"
            name="status"
            defaultValue={status?.[0] ?? ""}
            className={controlClass}
          >
            <option value="">Semua status</option>
            {Object.entries(reportStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-1.5">
          <label htmlFor="category" className="text-xs font-semibold">
            Kategori temuan
          </label>
          <select
            id="category"
            name="category"
            defaultValue={category ?? ""}
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
          <div className="grid gap-1.5">
            <label htmlFor="areaId" className="text-xs font-semibold">
              Wilayah kelola
            </label>
            <select
              id="areaId"
              name="areaId"
              defaultValue={areaId ?? ""}
              className={controlClass}
            >
              <option value="">Semua wilayah kelola</option>
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
            defaultValue={submittedFrom ?? ""}
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
            defaultValue={submittedTo ?? ""}
            className={controlClass}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:col-span-2 lg:col-span-5">
          <Button type="submit">Terapkan filter peta</Button>
          <Link
            href="/pengelola/peta"
            className="inline-flex min-h-10 items-center px-2 text-xs font-semibold text-[var(--primary)] underline underline-offset-2"
          >
            Atur ulang
          </Link>
        </div>
      </form>

      {mapResult.error ? (
        <div
          role="alert"
          className="rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4 text-sm text-[var(--danger)]"
        >
          Data koordinat peta belum dapat dimuat. Muat ulang halaman ini.
        </div>
      ) : (
        <FindingsMap
          reports={data.points}
          missingCoordinatesCount={data.missingCoordinatesCount}
        />
      )}
    </div>,
  );
}
