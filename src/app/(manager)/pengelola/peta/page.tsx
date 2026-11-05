import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { CustomDatePicker } from "@/components/ui/CustomDatePicker";
import { CustomSelect } from "@/components/ui/CustomSelect";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { FindingsMap } from "@/features/map/components/FindingsMap";
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
import { cleanSimulationText } from "@/lib/format/text";

export const dynamic = "force-dynamic";

type MapPageParams = Partial<
  Record<
    | "status"
    | "mapStatus"
    | "category"
    | "areaId"
    | "submittedFrom"
    | "submittedTo"
    | "from"
    | "to"
    | "mode",
    string
  >
>;

const VALID_REPORT_STATUSES: ReportStatus[] = [
  "pending_verification",
  "needs_information",
  "verified",
  "in_action",
  "resolved",
];

const OPEN_REPORT_STATUSES: ReportStatus[] = [
  "pending_verification",
  "needs_information",
  "verified",
  "in_action",
];

function resolveStatusFilter(
  statusParam?: string,
  mapStatusParam?: string,
): { statuses?: ReportStatus[]; selectedPreset: string } {
  if (statusParam && reportStatuses.includes(statusParam as ReportStatus)) {
    return {
      statuses: [statusParam as ReportStatus],
      selectedPreset: statusParam,
    };
  }
  const group = mapStatusParam || statusParam || "valid";
  if (group === "open") {
    return { statuses: OPEN_REPORT_STATUSES, selectedPreset: "open" };
  }
  if (group === "resolved") {
    return { statuses: ["resolved"], selectedPreset: "resolved" };
  }
  if (group === "all") {
    return { statuses: undefined, selectedPreset: "all" };
  }
  return { statuses: VALID_REPORT_STATUSES, selectedPreset: "valid" };
}

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
  const { statuses, selectedPreset } = resolveStatusFilter(
    params.status,
    params.mapStatus,
  );
  const category = reportCategories.includes(params.category as ReportCategory)
    ? (params.category as ReportCategory)
    : undefined;
  const areaId =
    params.areaId && areas.some((a) => a.id === params.areaId)
      ? params.areaId
      : undefined;
  const rawFrom = params.submittedFrom ?? params.from;
  const rawTo = params.submittedTo ?? params.to;
  const submittedFrom =
    rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? rawFrom : undefined;
  const submittedTo =
    rawTo && /^\d{4}-\d{2}-\d{2}$/.test(rawTo) ? rawTo : undefined;
  const initialMode = params.mode === "heatmap" ? "heatmap" : "points";

  const mapResult = await listMapReports({
    status: statuses,
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
    withCoordinatesTotal: 0,
    isTruncated: false,
    pointLimit: 300,
  };

  const backParams = new URLSearchParams();
  if (areaId) backParams.set("areaId", areaId);
  if (submittedFrom) backParams.set("from", submittedFrom);
  if (submittedTo) backParams.set("to", submittedTo);
  const backHref = backParams.toString()
    ? `/pengelola/ringkasan?${backParams.toString()}`
    : "/pengelola/ringkasan";

  return shell(
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] pb-3.5">
        <div>
          <Link
            href={backHref}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--primary)] hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Dasbor wilayah
          </Link>
          <div className="mt-1 flex flex-wrap items-baseline gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-[var(--foreground)] sm:text-2xl">
              Peta temuan lingkungan
            </h1>
          </div>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            Sebaran titik laporan lingkungan warga dan kepadatan laporan pada
            wilayah tugas Anda.
          </p>
        </div>
      </header>

      <section
        aria-label="Peta temuan"
        className="overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]"
      >
        <form
          action="/pengelola/peta"
          method="get"
          aria-label="Filter peta temuan"
          className="flex flex-wrap items-end gap-2.5 border-b border-[var(--border)] bg-[var(--background)] px-4 py-3"
        >
          <input type="hidden" name="mode" value={initialMode} />
          {areas.length > 1 ? (
            <div className="grid gap-1">
              <label
                htmlFor="areaId"
                className="text-[11px] font-semibold text-[var(--foreground)]"
              >
                Wilayah
              </label>
              <CustomSelect
                id="areaId"
                name="areaId"
                defaultValue={areaId ?? ""}
                size="sm"
                className="w-48"
                options={[
                  { value: "", label: "Semua wilayah kelola" },
                  ...areas.map((area) => ({
                    value: area.id,
                    label: cleanSimulationText(area.name),
                  })),
                ]}
              />
            </div>
          ) : null}

          <div className="grid gap-1">
            <label
              htmlFor="status"
              className="text-[11px] font-semibold text-[var(--foreground)]"
            >
              Status
            </label>
            <CustomSelect
              id="status"
              name="status"
              defaultValue={selectedPreset}
              size="sm"
              className="w-48"
              options={[
                { value: "valid", label: "Semua temuan valid" },
                { value: "open", label: "Belum tuntas" },
                { value: "resolved", label: "Selesai" },
                {
                  value: "all",
                  label: "Semua status (termasuk ditolak/duplikat)",
                },
                ...Object.entries(reportStatusLabels).map(([value, label]) => ({
                  value,
                  label: `Status: ${label}`,
                })),
              ]}
            />
          </div>

          <div className="grid gap-1">
            <label
              htmlFor="category"
              className="text-[11px] font-semibold text-[var(--foreground)]"
            >
              Kategori
            </label>
            <CustomSelect
              id="category"
              name="category"
              defaultValue={category ?? ""}
              size="sm"
              className="w-44"
              options={[
                { value: "", label: "Semua kategori" },
                ...Object.entries(reportCategoryLabels).map(
                  ([value, label]) => ({
                    value,
                    label,
                  }),
                ),
              ]}
            />
          </div>

          <div className="grid gap-1">
            <label
              htmlFor="submittedFrom"
              className="text-[11px] font-semibold text-[var(--foreground)]"
            >
              Dari tanggal
            </label>
            <CustomDatePicker
              id="submittedFrom"
              name="submittedFrom"
              defaultValue={submittedFrom ?? ""}
              size="sm"
              className="w-36"
            />
          </div>

          <div className="grid gap-1">
            <label
              htmlFor="submittedTo"
              className="text-[11px] font-semibold text-[var(--foreground)]"
            >
              Sampai tanggal
            </label>
            <CustomDatePicker
              id="submittedTo"
              name="submittedTo"
              defaultValue={submittedTo ?? ""}
              size="sm"
              className="w-36"
            />
          </div>

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" className="min-h-9 px-3.5">
              Terapkan
            </Button>
            <Link
              href="/pengelola/peta"
              className="inline-flex min-h-9 items-center gap-1 px-2 text-xs font-semibold text-[var(--primary)] hover:underline"
            >
              <RefreshCw aria-hidden="true" className="size-3" />
              Atur ulang
            </Link>
          </div>
        </form>

        {mapResult.error ? (
          <div
            role="alert"
            className="p-4 text-sm text-[var(--danger)] bg-[var(--danger-subtle)]"
          >
            <p className="font-semibold">
              Data koordinat peta belum dapat dimuat.
            </p>
            <Link
              href="/pengelola/peta"
              className="mt-2 inline-flex font-semibold text-[var(--primary)] underline underline-offset-2"
            >
              Muat ulang peta
            </Link>
          </div>
        ) : (
          <FindingsMap
            reports={data.points}
            missingCoordinatesCount={data.missingCoordinatesCount}
            totalMatching={data.totalMatching}
            withCoordinatesTotal={data.withCoordinatesTotal}
            isTruncated={data.isTruncated}
            pointLimit={data.pointLimit}
            areaId={areaId}
            initialMode={initialMode}
            variant="full"
          />
        )}
      </section>
    </div>,
  );
}
