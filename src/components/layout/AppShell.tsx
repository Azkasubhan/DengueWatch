import { MapPin } from "lucide-react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Container } from "@/components/layout/Container";
import { logoutAction } from "@/features/auth/actions";
import type { AreaSummary, Role } from "@/features/areas/types";
import { cleanSimulationText } from "@/lib/format/text";

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
    <div className="flex min-h-screen flex-col bg-[var(--background)] lg:flex-row">
      <AppSidebar
        displayName={displayName}
        logout={logout}
        portalPath={portalPath}
        role={role}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        {area ? (
          <div className="border-b border-[var(--border)] bg-[var(--surface)]/80 px-6 py-2.5 sm:px-8">
            <div className="flex items-center gap-2 text-sm">
              <MapPin
                aria-hidden="true"
                className="size-4 shrink-0 text-[var(--forest)]"
              />
              <span className="font-semibold text-[var(--foreground)]">
                {cleanSimulationText(area.name)}
              </span>
            </div>
          </div>
        ) : null}
        <main className="flex-1">
          <Container className="py-8 sm:py-10">{children}</Container>
        </main>
      </div>
    </div>
  );
}
