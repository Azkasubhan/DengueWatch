import { Clock3 } from "lucide-react";

export function PendingArea() {
  return (
    <section className="max-w-2xl rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
      <span className="grid size-11 place-items-center rounded-full bg-[var(--warning-subtle)]">
        <Clock3 aria-hidden="true" className="size-5 text-[var(--warning)]" />
      </span>
      <h1 className="mt-5 text-2xl font-bold tracking-[-0.025em]">
        Keanggotaan wilayah belum disetujui
      </h1>
      <p className="mt-3 text-[var(--muted-foreground)]">
        Akun Anda sudah aktif, tetapi belum memiliki keanggotaan wilayah
        operasional yang terverifikasi. Tidak ada data wilayah yang dapat
        diakses sampai penugasan disetujui melalui proses tepercaya.
      </p>
    </section>
  );
}
