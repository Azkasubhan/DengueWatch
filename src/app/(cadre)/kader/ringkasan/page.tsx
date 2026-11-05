import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CheckCircle2, ListChecks } from "lucide-react";
import { Alert } from "@/components/feedback/Alert";
import { PendingArea } from "@/components/feedback/PendingArea";
import { ServiceUnavailable } from "@/components/feedback/ServiceUnavailable";
import { AppShell } from "@/components/layout/AppShell";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkButton } from "@/components/ui/LinkButton";
import { PageHeader } from "@/components/ui/PageHeader";
import { decidePortalAccess, getVerifiedAreas } from "@/features/areas/access";
import { CadreTaskTable } from "@/features/tasks/components/TaskListPage";
import { getCadreSummary } from "@/features/tasks/data";
import { getAccessContext } from "@/lib/auth/context";
import { cleanSimulationText } from "@/lib/format/text";

export const dynamic = "force-dynamic";

export default async function CadreSummaryPage({
  searchParams,
}: {
  searchParams: Promise<{ logout?: string }>;
}) {
  const query = await searchParams;
  const result = await getAccessContext();
  if (result.kind === "unauthenticated") {
    redirect("/login?next=/kader/ringkasan");
  }
  if (result.kind !== "authenticated") {
    return <ServiceUnavailable />;
  }

  const decision = decidePortalAccess(result.context, "cadre");
  if (decision.kind === "forbidden") {
    redirect("/forbidden");
  }
  const area = getVerifiedAreas(result.context, "assigned_cadre")[0];
  const summaryResult =
    decision.kind === "allowed"
      ? await getCadreSummary(result.context.userId, area?.id)
      : { data: null, error: null };

  const summary = summaryResult.data;
  const displayName = cleanSimulationText(result.context.displayName);

  return (
    <AppShell area={area} displayName={result.context.displayName} role="cadre">
      {query.logout === "failed" ? (
        <div className="mb-5 max-w-2xl">
          <Alert variant="error">
            Sesi belum dapat diakhiri. Coba keluar kembali.
          </Alert>
        </div>
      ) : null}
      {decision.kind === "pending" ? (
        <PendingArea />
      ) : (
        <div className="grid gap-6">
          <PageHeader
            title={`Ringkasan tugas, ${displayName}`}
            description="Pantau tenggat penugasan lapangan, progres bukti Anda, dan tindak lanjuti temuan warga."
            actions={
              <LinkButton href="/kader/tugas" variant="secondary">
                <ListChecks aria-hidden="true" className="size-4" />
                Semua tugas saya
              </LinkButton>
            }
          />

          {summaryResult.error ? (
            <Alert variant="error">
              Ringkasan tugas belum dapat dimuat. Muat ulang halaman ini.
            </Alert>
          ) : null}

          {/* 4 Indikator Kerja Aktual Kader */}
          {summary ? (
            <section aria-label="Indikator kerja kader">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Link
                  href="/kader/tugas"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Tugas aktif
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.activeTasksCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Penugasan belum selesai
                  </p>
                </Link>

                <Link
                  href="/kader/tugas?due=overdue"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Mendekati / lewat tenggat
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.dueSoonOrOverdueCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    {summary.overdueCount > 0
                      ? `${summary.overdueCount} melewati tenggat`
                      : "Dalam batas 48 jam ke depan"}
                  </p>
                </Link>

                <Link
                  href="/kader/tugas?status=awaiting_review"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Bukti saya menunggu periksa
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.myPendingEvidenceCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Sedang ditinjau pengelola
                  </p>
                </Link>

                <Link
                  href="/kader/tugas?status=in_progress"
                  className="group block rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 transition hover:border-[var(--primary)]"
                >
                  <p className="text-xs sm:text-sm font-semibold text-[var(--muted-foreground)]">
                    Bukti saya perlu diperbaiki
                  </p>
                  <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                    {summary.myRevisionRequiredCount}
                  </p>
                  <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                    Memerlukan foto/keterangan ulang
                  </p>
                </Link>
              </div>
            </section>
          ) : null}

          {/* Daftar Tugas yang Perlu Dikerjakan */}
          <section aria-labelledby="priority-tasks-heading">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 id="priority-tasks-heading" className="text-lg font-bold">
                  Tugas yang perlu dikerjakan
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Diurutkan berdasarkan kebutuhan perbaikan bukti dan tenggat
                  terdekat.
                </p>
              </div>
              <Link
                href="/kader/tugas"
                className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-[var(--primary)] hover:underline"
              >
                Buka daftar lengkap
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>

            {!summary?.prioritizedTasks.length ? (
              <EmptyState
                icon={CheckCircle2}
                title="Tidak ada tugas aktif yang menunggu tindakan"
                description="Semua penugasan lapangan pada wilayah Anda sudah selesai atau belum ada tugas baru."
                action={
                  <Link
                    href="/kader/tugas?status=all"
                    className="inline-flex min-h-10 items-center font-semibold text-[var(--primary)] underline underline-offset-2"
                  >
                    Lihat riwayat tugas selesai
                  </Link>
                }
              />
            ) : (
              <CadreTaskTable
                tasks={summary.prioritizedTasks}
                detailBase="/kader/tugas"
                caption="Tugas yang perlu dikerjakan"
              />
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}
