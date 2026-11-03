import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/LinkButton";

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col justify-center py-16">
      <Container size="form">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <div className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-6 text-center sm:p-10">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-[var(--danger-subtle)]">
            <ShieldAlert
              aria-hidden="true"
              className="size-6 text-[var(--danger)]"
            />
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-[-0.025em]">
            Akun tidak memiliki izin
          </h1>
          <p className="mt-3 text-[var(--muted-foreground)]">
            Akun ini tidak memiliki izin mengakses halaman tersebut. Peran dan
            wilayah tidak dapat diubah melalui tautan atau permintaan dari
            browser.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <LinkButton href="/app/beranda">Kembali ke beranda akun</LinkButton>
            <Link
              className="inline-flex min-h-11 items-center px-3 text-sm font-semibold text-[var(--primary)]"
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
