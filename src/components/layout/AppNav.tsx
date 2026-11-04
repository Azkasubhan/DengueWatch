"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  FileText,
  Home,
  LayoutDashboard,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/features/areas/types";

const items: Record<Role, { href: string; label: string; icon: LucideIcon }[]> =
  {
    resident: [
      { href: "/app/beranda", label: "Beranda", icon: Home },
      { href: "/app/laporan", label: "Laporan saya", icon: FileText },
    ],
    cadre: [
      { href: "/kader/ringkasan", label: "Ringkasan", icon: LayoutDashboard },
      { href: "/kader/tugas", label: "Tugas saya", icon: ListChecks },
    ],
    manager: [
      {
        href: "/pengelola/ringkasan",
        label: "Ringkasan",
        icon: LayoutDashboard,
      },
      {
        href: "/pengelola/verifikasi",
        label: "Antrean verifikasi",
        icon: ClipboardCheck,
      },
      { href: "/pengelola/tugas", label: "Tugas wilayah", icon: ListChecks },
    ],
  };

export function AppNav({ role }: { role: Role }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigasi portal"
      className="-mx-1 flex gap-1 overflow-x-auto"
    >
      {items[role].map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-3.5 text-sm font-semibold transition-colors ${active ? "bg-[var(--forest)] text-[var(--forest-foreground)]" : "text-[var(--muted-foreground)] hover:bg-[var(--sand)] hover:text-[var(--foreground)]"}`}
            href={href}
            key={href}
          >
            <Icon aria-hidden="true" className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
