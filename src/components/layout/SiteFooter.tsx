import { Container } from "@/components/layout/Container";

export function SiteFooter() {
  return (
    <footer className="border-t border-[var(--border)] bg-[var(--surface)] py-8">
      <Container className="flex flex-col gap-2 text-sm text-[var(--muted-foreground)] sm:flex-row sm:items-center sm:justify-between">
        <p>DengueWatch — Temukan. Tindak. Tuntaskan.</p>
        <p>Bukan layanan diagnosis atau surveilans pasien.</p>
      </Container>
    </footer>
  );
}
