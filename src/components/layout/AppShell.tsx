import { LogOut, MapPin } from "lucide-react";
import { AppNav } from "@/components/layout/AppNav";
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
        <Container className="flex min-h-16 flex-wrap items-center justify-between gap-x-6 gap-y-2 py-3">
          <div className="flex items-center gap-3">
            <Brand />
            <span className="hidden rounded-full bg-[var(--sand)] px-2.5 py-1 text-xs font-semibold sm:inline">
              {roleLabels[role]}
            </span>
          </div>
          <div className="order-last w-full md:order-none md:w-auto md:flex-1">
            <AppNav role={role} />
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden max-w-40 truncate text-sm text-[var(--muted-foreground)] lg:inline">
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
      {area ? (
        <div className="border-b border-[var(--border)]">
          <Container className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold">
              <MapPin
                aria-hidden="true"
                className="size-4 text-[var(--clay)]"
              />
              {area.name}
            </span>
            {area.isDemo ? (
              <span className="text-[var(--muted-foreground)]">
                DATA SIMULASI — bukan data kasus DBD sebenarnya
              </span>
            ) : null}
          </Container>
        </div>
      ) : null}
      <main>
        <Container className="py-8 sm:py-10">{children}</Container>
      </main>
    </div>
  );
}
