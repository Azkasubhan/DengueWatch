import { AppSidebar } from "@/components/layout/AppSidebar";
import { Container } from "@/components/layout/Container";
import { logoutAction } from "@/features/auth/actions";
import type { AreaSummary, Role } from "@/features/areas/types";

type AppShellProps = {
  area?: AreaSummary;
  children: React.ReactNode;
  displayName: string;
  role: Role;
};

export function AppShell({ children, displayName, role }: AppShellProps) {
  const portalPath =
    role === "resident"
      ? "/app/beranda"
      : role === "cadre"
        ? "/kader/ringkasan"
        : "/pengelola/ringkasan";
  const logout = logoutAction.bind(null, portalPath);

  return (
    <div className="flex min-h-screen flex-col bg-[var(--background)] lg:flex-row">
      <AppSidebar
        displayName={displayName}
        logout={logout}
        portalPath={portalPath}
        role={role}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <main className="flex-1">
          <Container className="py-8 sm:py-10">{children}</Container>
        </main>
      </div>
    </div>
  );
}
