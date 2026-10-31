import Link from "next/link";
import { LogOut } from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import { Container } from "@/components/layout/Container";
import { Button } from "@/components/ui/Button";
import { logoutAction } from "@/features/auth/actions";
import type { AreaSummary, Role } from "@/features/areas/types";

const roleLabels: Record<Role, string> = {
  resident: "Warga",
  cadre: "Kader Jumantik",
  manager: "Pengelola",
};

type AppShellProps = {
  area?: AreaSummary;
  children: React.ReactNode;
  displayName: string;
  role: Role;
};

export function AppShell({ area, children, displayName, role }: AppShellProps) {
  const portalPath =
    role === "resident"
      ? "/app/beranda"
      : role === "cadre"
        ? "/kader/ringkasan"
        : "/pengelola/ringkasan";
  const logout = logoutAction.bind(null, portalPath);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--surface)]">
        <Container className="flex min-h-18 flex-wrap items-center justify-between gap-3 py-3">
          <div className="flex items-center gap-4">
            <Brand />
            <span className="hidden border-l border-[var(--border)] pl-4 text-sm font-medium text-[var(--muted-foreground)] sm:inline">
              {roleLabels[role]}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {role === "resident" ? (
              <Link
                href="/app/laporan"
                className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--primary)] focus-visible:outline-2"
              >
                Laporan saya
              </Link>
            ) : role === "cadre" ? (
              <Link
                href="/kader/verifikasi"
                className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[var(--primary)] focus-visible:outline-2"
              >
                Antrean verifikasi
              </Link>
            ) : null}
            <span className="hidden text-sm text-[var(--muted-foreground)] sm:inline">
              {displayName}
            </span>
            <form action={logout}>
              <Button type="submit" variant="ghost">
                <LogOut aria-hidden="true" className="size-4" />
                Keluar
              </Button>
            </form>
          </div>
        </Container>
      </header>
      {area?.isDemo ? (
        <div className="border-b border-[var(--border)] bg-[var(--primary-subtle)]">
          <Container className="py-2 text-sm font-semibold text-[var(--foreground)]">
            DATA SIMULASI — bukan data kasus DBD sebenarnya
          </Container>
        </div>
      ) : null}
      <main>
        <Container className="py-8 sm:py-12">
          {area ? (
            <nav
              aria-label="Lokasi saat ini"
              className="mb-6 text-sm text-[var(--muted-foreground)]"
            >
              <Link
                className="hover:text-[var(--foreground)]"
                href={portalPath}
              >
                {area.name}
              </Link>
            </nav>
          ) : null}
          {children}
        </Container>
      </main>
    </div>
  );
}
