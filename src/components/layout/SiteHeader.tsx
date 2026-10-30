import Link from "next/link";
import { Brand } from "@/components/layout/Brand";
import { Container } from "@/components/layout/Container";
import { LinkButton } from "@/components/ui/LinkButton";

export function SiteHeader() {
  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <Container className="flex min-h-18 flex-wrap items-center justify-between gap-3 py-3">
        <Brand />
        <nav
          aria-label="Navigasi utama"
          className="flex items-center gap-2 sm:gap-4"
        >
          <Link
            className="rounded-md px-2 py-2 text-sm font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            href="/#cara-kerja"
          >
            Cara kerja
          </Link>
          <LinkButton href="/login" variant="secondary">
            Masuk
          </LinkButton>
        </nav>
      </Container>
    </header>
  );
}
