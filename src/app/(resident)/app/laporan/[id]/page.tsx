import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { getDefaultPortal, getVerifiedAreas } from "@/features/areas/access";
import { getReportDetail } from "@/features/reports/data";
import {
  reportCategoryLabels,
  reportStatusLabels,
} from "@/features/reports/validation";
import { getAccessContext } from "@/lib/auth/context";
import { z } from "zod";

export const dynamic = "force-dynamic";

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated") redirect("/login?next=/app/laporan");
  if (access.kind !== "authenticated") return <ServiceUnavailable />;
  if (access.context.role !== "resident")
    redirect(getDefaultPortal(access.context.role));
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  let detail;
  try {
    detail = await getReportDetail(id);
  } catch {
    return <ServiceUnavailable />;
  }
  if (!detail.report.data && !detail.report.error) notFound();
  if (
    !detail.report.data ||
    detail.report.error ||
    !detail.images ||
    !detail.events ||
    detail.images.error ||
    detail.events.error
  )
    return <ServiceUnavailable />;
  const report = detail.report.data;
  const area = getVerifiedAreas(access.context, "resident").find(
    (item) => item.id === report.area_id,
  );
  return (
    <AppShell
      area={area}
      displayName={access.context.displayName}
      role="resident"
    >
      <Link
        href="/app/laporan"
        className="inline-flex min-h-11 items-center text-sm font-semibold text-[var(--primary)]"
      >
        ← Laporan saya
      </Link>
      <div className="mt-5 max-w-3xl">
        <p className="text-sm font-semibold text-[var(--primary)]">
          {report.public_reference}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">
          Detail laporan
        </h1>
        <p className="mt-3 inline-block rounded-[var(--radius-control)] bg-[var(--primary-subtle)] px-3 py-2 font-semibold">
          {reportStatusLabels[report.status as keyof typeof reportStatusLabels]}
        </p>
        {report.is_demo ? (
          <p className="mt-4 text-sm font-semibold">
            DATA SIMULASI — bukan data kasus DBD sebenarnya
          </p>
        ) : null}
        <div
          className={`mt-7 grid gap-3 sm:grid-cols-3 ${detail.images.data?.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {detail.images.data?.map((image, index) => (
            <Image
              unoptimized
              loading={index === 0 ? "eager" : "lazy"}
              key={image.id}
              src={image.url}
              alt={`Foto laporan ${index + 1}`}
              width={image.width}
              height={image.height}
              className="aspect-square w-full rounded-[var(--radius-control)] border border-[var(--border)] object-cover"
            />
          ))}
        </div>
        <dl className="mt-8 grid gap-5 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-7">
          <div>
            <dt className="text-sm font-semibold">Kategori</dt>
            <dd className="mt-1">
              {
                reportCategoryLabels[
                  report.category as keyof typeof reportCategoryLabels
                ]
              }
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold">Deskripsi</dt>
            <dd className="mt-1 whitespace-pre-wrap break-words">
              {report.description}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold">Dikirim</dt>
            <dd className="mt-1">
              {new Intl.DateTimeFormat("id-ID", {
                dateStyle: "long",
                timeStyle: "short",
                timeZone: "Asia/Jakarta",
              }).format(new Date(report.submitted_at))}{" "}
              WIB
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold">Lokasi privat</dt>
            <dd className="mt-1">
              {report.latitude != null && report.longitude != null
                ? `${report.latitude}, ${report.longitude}`
                : "Titik lokasi tidak diberikan"}
              {report.location_note ? (
                <span className="mt-1 block break-words">
                  Petunjuk lokasi: {report.location_note}
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
        <section className="mt-8">
          <h2 className="text-2xl font-bold">Riwayat laporan</h2>
          <ol className="mt-5 border-l-2 border-[var(--border)] pl-5">
            {detail.events.data?.map((event) => (
              <li key={event.id} className="pb-6">
                <p className="font-semibold">
                  {event.event_type === "report_created"
                    ? "Laporan dikirim"
                    : event.event_type}
                </p>
                <p className="text-sm text-[var(--muted-foreground)]">
                  {new Intl.DateTimeFormat("id-ID", {
                    dateStyle: "medium",
                    timeStyle: "short",
                    timeZone: "Asia/Jakarta",
                  }).format(new Date(event.created_at))}{" "}
                  WIB
                </p>
              </li>
            ))}
          </ol>
        </section>
        <p className="mb-10 rounded-[var(--radius-control)] bg-[var(--primary-subtle)] p-4">
          Laporan menunggu pemeriksaan kader. Belum ada keputusan verifikasi
          atau tindakan yang dicatat.
        </p>
      </div>
    </AppShell>
  );
}
