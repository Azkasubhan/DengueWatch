import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/feedback/Alert";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { getManagerSummary } from "@/features/analytics/data";
import { summaryQuerySchema } from "@/features/analytics/validation";
import { formatJakarta } from "@/features/reports/components/ReportDetailView";
import { controlClass } from "@/features/reports/components/reportAction";
import { getAccessContext } from "@/lib/auth/context";

export const dynamic = "force-dynamic";

const number = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const formatDate = (date: string) =>
  formatJakarta(`${date}T00:00:00+07:00`, false);
// Durations are rounded to 0.1 hour in SQL; 0 means under six minutes.
const hours = (value: number | null) =>
  value === null
    ? "—"
    : value === 0
      ? "< 0,1 jam"
      : `${number.format(value)} jam`;

export default async function ManagerSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{
    logout?: string;
    areaId?: string;
    from?: string;
    to?: string;
  }>;
}) {
  const { logout, ...filters } = await searchParams;
  const result = await getAccessContext();
  if (result.kind === "unauthenticated") {
    redirect("/login?next=/pengelola/ringkasan");
  }
  if (result.kind !== "authenticated") {
    return <ServiceUnavailable />;
  }

  const decision = decidePortalAccess(result.context, "manager");
  if (decision.kind === "forbidden") {
    redirect("/forbidden");
  }
  const areas = getVerifiedAreas(result.context, "manager");
  const values = Object.fromEntries(
    Object.entries(filters).filter(
      ([, value]) => typeof value === "string" && value.trim(),
    ),
  );
  const parsed =
    decision.kind === "allowed" ? summaryQuerySchema().safeParse(values) : null;
  const summary = parsed?.success ? await getManagerSummary(parsed.data) : null;
  const data = summary?.data;

  return (
    <AppShell
      area={areas[0]}
      displayName={result.context.displayName}
      role="manager"
    >
      {logout === "failed" ? (
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
          <div className="mb-8 max-w-3xl">
            <h1 className="text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
              Ringkasan laporan wilayah
            </h1>
            <p className="mt-3 text-[var(--muted-foreground)]">
              Angka dihitung langsung dari database laporan dan tugas, bukan
              oleh AI. Anda memverifikasi laporan, menugaskan kader, dan
              memeriksa bukti penanganan.
            </p>
          </div>

          <form
            action="/pengelola/ringkasan"
            method="get"
            aria-label="Filter ringkasan"
            className="mb-6 grid gap-4 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end"
          >
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
                  <option value="">Semua wilayah kelola</option>
                  {areas.map((area) => (
                    <option key={area.id} value={area.id}>
                      {area.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
            <div className="grid gap-2">
              <label htmlFor="from" className="text-sm font-semibold">
                Dikirim sejak
              </label>
              <input
                id="from"
                name="from"
                type="date"
                defaultValue={parsed?.success ? parsed.data.from : values.from}
                className={controlClass}
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="to" className="text-sm font-semibold">
                Dikirim sampai
              </label>
              <input
                id="to"
                name="to"
                type="date"
                defaultValue={parsed?.success ? parsed.data.to : values.to}
                className={controlClass}
              />
            </div>
            <div className="flex flex-wrap gap-3">
              <Button type="submit">Terapkan</Button>
              <Link
                href="/pengelola/ringkasan"
                className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                30 hari terakhir
              </Link>
            </div>
          </form>

          {!parsed?.success ? (
            <div
              role="alert"
              className="max-w-2xl rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
            >
              <p className="font-semibold text-[var(--danger)]">
                Filter tidak valid.
              </p>
              <p className="mt-1">
                Pilih rentang tanggal yang benar, maksimal 366 hari.
              </p>
            </div>
          ) : !data ? (
            <div
              role="alert"
              className="max-w-2xl rounded-[var(--radius-control)] border border-[var(--danger)] bg-[var(--danger-subtle)] p-4"
            >
              <p className="font-semibold text-[var(--danger)]">
                Ringkasan belum tersedia.
              </p>
              <Link
                href="/pengelola/ringkasan"
                className="mt-3 inline-flex min-h-11 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
              >
                Muat ulang ringkasan
              </Link>
            </div>
          ) : (
            <section aria-labelledby="kpi-title">
              <h2 id="kpi-title" className="sr-only">
                Indikator laporan
              </h2>
              <p className="mb-4 text-sm text-[var(--muted-foreground)]">
                Periode {formatDate(data.from)} – {formatDate(data.to)} (WIB) ·
                Diperbarui {formatJakarta(data.asOf)} WIB ·{" "}
                {data.areaCount > 1
                  ? `${data.areaCount} wilayah kelola`
                  : "1 wilayah kelola"}
              </p>
              {data.isDemo ? (
                <p className="mb-4 rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-3 text-sm font-semibold">
                  DATA SIMULASI — angka berasal dari data simulasi, bukan data
                  kasus DBD sebenarnya.
                </p>
              ) : null}
              {data.reportsTotal === 0 ? (
                <p className="mb-4 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] p-4">
                  Belum ada laporan pada periode ini.
                </p>
              ) : null}
              <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  [
                    "Laporan masuk",
                    number.format(data.reportsTotal),
                    "Laporan lingkungan yang dikirim pada periode ini, bukan jumlah kasus DBD.",
                  ],
                  [
                    "Menunggu pemeriksaan",
                    number.format(data.awaitingVerification),
                    "Belum diverifikasi pengelola atau menunggu informasi tambahan warga.",
                  ],
                  [
                    "Dalam penanganan",
                    number.format(data.inAction),
                    "Terverifikasi tetapi belum tuntas, termasuk yang dibuka kembali.",
                  ],
                  [
                    "Selesai",
                    number.format(data.resolved),
                    "Semua tugas wajib aktif selesai dengan bukti yang disetujui pengelola.",
                  ],
                  [
                    "Tingkat penyelesaian",
                    data.completionRate === null
                      ? "—"
                      : `${number.format(data.completionRate)}%`,
                    data.completionEligible === 0
                      ? "Belum ada laporan tervalidasi pada periode ini."
                      : `${number.format(data.resolved)} dari ${number.format(data.completionEligible)} laporan tervalidasi. Laporan ditolak atau duplikat tidak dihitung.`,
                  ],
                  [
                    "Bukti menunggu pemeriksaan",
                    number.format(data.tasksAwaitingReview),
                    "Tugas pada laporan periode ini yang buktinya belum diperiksa.",
                  ],
                ].map(([label, value, help]) => (
                  <div
                    key={label}
                    className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5"
                  >
                    <dt className="text-sm font-semibold">{label}</dt>
                    <dd className="mt-2 text-3xl font-bold tracking-tight">
                      {value}
                    </dd>
                    <dd className="mt-2 text-sm text-[var(--muted-foreground)]">
                      {help}
                    </dd>
                  </div>
                ))}
              </dl>
              <dl className="mt-6 grid gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-3">
                <div>
                  <dt className="text-sm font-semibold">
                    Median waktu ke keputusan verifikasi
                  </dt>
                  <dd className="mt-1">
                    {hours(data.medianHoursToFirstReview)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">
                    Median verifikasi ke selesai
                  </dt>
                  <dd className="mt-1">
                    {hours(data.medianHoursToResolution)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm font-semibold">
                    Tidak diproses lanjut
                  </dt>
                  <dd className="mt-1">
                    {number.format(data.notActionable)} laporan ditolak atau
                    duplikat
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-[var(--muted-foreground)]">
                Sumber: kueri database laporan, riwayat keputusan, dan tugas
                DengueWatch. Kelompok data berdasarkan tanggal laporan dikirim;
                status adalah kondisi saat diperbarui. Median dihitung dari
                laporan yang sudah mencapai tahap tersebut.
              </p>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
