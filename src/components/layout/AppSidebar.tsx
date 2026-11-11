"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  FileText,
  Home,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MapPin,
  Menu,
  User,
  X,
  type LucideIcon,
} from "lucide-react";
import { Brand } from "@/components/layout/Brand";
import type { Role } from "@/features/areas/types";
import { cleanSimulationText } from "@/lib/format/text";

const roleLabels: Record<Role, string> = {
  resident: "Warga",
  cadre: "Kader Jumantik",
  manager: "Pengelola",
};

const navItemsByRole: Record<
  Role,
  { href: string; label: string; icon: LucideIcon }[]
> = {
  resident: [
    { href: "/app/beranda", label: "Beranda", icon: Home },
    { href: "/app/laporan", label: "Laporan saya", icon: FileText },
  ],
  cadre: [
    { href: "/kader/ringkasan", label: "Ringkasan", icon: LayoutDashboard },
    { href: "/kader/tugas", label: "Tugas saya", icon: ListChecks },
  ],
  manager: [
    { href: "/pengelola/ringkasan", label: "Ringkasan", icon: LayoutDashboard },
    {
      href: "/pengelola/verifikasi",
      label: "Antrean verifikasi",
      icon: ClipboardCheck,
    },
    { href: "/pengelola/tugas", label: "Tugas wilayah", icon: ListChecks },
    { href: "/pengelola/peta", label: "Peta temuan", icon: MapPin },
  ],
};

type AppSidebarProps = {
  displayName: string;
  logout: () => void | Promise<void>;
  portalPath: string;
  role: Role;
};

export function AppSidebar({
  displayName,
  logout,
  portalPath,
  role,
}: AppSidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setMobileOpen(false);
        setShowLogoutModal(false);
      }
    }
    if (mobileOpen || showLogoutModal) {
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }
  }, [mobileOpen, showLogoutModal]);

  const items = navItemsByRole[role];
  const cleanDisplayName = cleanSimulationText(displayName) || displayName;

  const renderContent = () => (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Brand logo at the top */}
        <div className="px-2 py-1" onClick={() => setMobileOpen(false)}>
          <Brand href={portalPath} size="md" />
        </div>

        {/* Navigation Section */}
        <div className="mt-8">
          <p className="px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]">
            MENU UTAMA
          </p>
          <nav aria-label="Navigasi portal" className="mt-2 space-y-1">
            {items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== portalPath &&
                  pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-all ${
                    active
                      ? "bg-[var(--sand)] text-[var(--foreground)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:bg-[var(--sand)]/50 hover:text-[var(--foreground)]"
                  }`}
                >
                  <item.icon
                    aria-hidden="true"
                    className={`size-5 shrink-0 ${
                      active
                        ? "text-[var(--forest)]"
                        : "text-[var(--muted-foreground)]"
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* User Card & Logout button at the bottom */}
      <div className="mt-auto space-y-3 border-t border-[var(--border)]/60 pt-4">
        <div className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface-muted)]/50 p-3">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--sand)] text-[var(--foreground)]">
            <User
              aria-hidden="true"
              className="size-5 text-[var(--muted-foreground)]"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="truncate text-sm font-bold leading-tight text-[var(--foreground)]"
              title={cleanDisplayName}
            >
              {cleanDisplayName}
            </p>
            <p className="mt-0.5 truncate text-xs text-[var(--muted-foreground)]">
              {roleLabels[role]}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            setShowLogoutModal(true);
          }}
          className="group flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[var(--muted-foreground)] transition-colors hover:bg-[var(--danger-subtle)] hover:text-[var(--danger)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
        >
          <LogOut
            aria-hidden="true"
            className="size-4 transition-colors group-hover:text-[var(--danger)]"
          />
          <span>Keluar dari Akun</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 sm:px-6 lg:hidden">
        <Brand href={portalPath} size="sm" />
        <button
          type="button"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Tutup menu navigasi" : "Buka menu navigasi"}
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex size-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:bg-[var(--sand)] focus-visible:outline-2 focus-visible:outline-[var(--focus)]"
        >
          {mobileOpen ? (
            <X aria-hidden="true" className="size-5" />
          ) : (
            <Menu aria-hidden="true" className="size-5" />
          )}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 z-50 flex h-full w-72 max-w-[85vw] flex-col justify-between bg-[var(--surface)] p-5 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="mb-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Tutup menu"
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] hover:bg-[var(--sand)] hover:text-[var(--foreground)]"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{renderContent()}</div>
          </div>
        </div>
      ) : null}

      {/* Desktop Sidebar */}
      <aside className="sticky top-0 z-20 hidden h-screen w-64 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] p-6 lg:flex">
        {renderContent()}
      </aside>

      {/* Logout Confirmation Modal (AksesKelas style) */}
      {showLogoutModal ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="logout-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowLogoutModal(false)}
            aria-hidden="true"
          />

          {/* Modal Card */}
          <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-2">
              <h2
                id="logout-title"
                className="text-lg font-bold text-[var(--foreground)]"
              >
                Konfirmasi Keluar
              </h2>
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                aria-label="Tutup dialog"
                className="rounded-lg p-1.5 text-[var(--muted-foreground)] transition-colors hover:bg-[var(--sand)] hover:text-[var(--foreground)]"
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>

            <p className="mt-2 text-sm text-[var(--muted-foreground)]">
              Apakah Anda yakin ingin keluar dari akun DengueWatch?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutModal(false)}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-control)] border border-[var(--border)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--foreground)] transition-colors hover:bg-[var(--sand)]/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)]"
              >
                Batal
              </button>
              <form action={logout}>
                <button
                  type="submit"
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-[var(--danger)]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--danger)]"
                >
                  <LogOut aria-hidden="true" className="size-4" />
                  <span>Ya, Keluar</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
