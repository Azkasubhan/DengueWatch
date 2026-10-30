import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/LinkButton";

export default function ForbiddenPage() {
  return (
    <main className="py-16">
      <Container size="form">
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 sm:p-8">
          <p className="text-sm font-semibold text-[var(--danger)]">
            Akses ditolak
          </p>
          <h1 className="mt-2 text-2xl font-bold">Akun tidak memiliki izin</h1>
          <p className="mt-3 text-[var(--muted-foreground)]">
            Akun ini tidak memiliki izin mengakses halaman tersebut. Peran dan
            wilayah tidak dapat diubah melalui tautan atau permintaan dari
            browser.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <LinkButton href="/app/beranda">Kembali ke beranda akun</LinkButton>
            <Link
              className="px-3 py-2 text-sm font-semibold text-[var(--primary)]"
              href="/"
            >
              Halaman publik
            </Link>
          </div>
        </div>
      </Container>
    </main>
  );
}
