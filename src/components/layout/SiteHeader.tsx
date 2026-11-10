"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "@/components/layout/Brand";
import { LinkButton } from "@/components/ui/LinkButton";

const sections = [
  { href: "/#cara-kerja", label: "Cara kerja" },
  { href: "/#temuan", label: "Jenis temuan" },
  { href: "/#peran", label: "Peran" },
];

// Section links use a plain <a>: next/link skips scrolling when the URL already has the
// same hash, so a second click on "Cara kerja" would do nothing.

// Floating liquid-glass bar shared by public pages; shrinks on scroll down and expands on scroll up.
export function SiteHeader() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    let ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        const currentY = window.scrollY;
        const delta = currentY - lastScrollY;

        if (currentY <= 40) {
          setCompact(false);
        } else if (delta > 6) {
          setCompact(true);
        } else if (delta < -6) {
          setCompact(false);
        }

        lastScrollY = currentY;
        ticking = false;
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-6"
      data-site-header
    >
      <div
        className={`glass-nav mx-auto flex w-full items-center justify-between gap-2 rounded-full transition-[max-width,padding,transform] duration-300 ease-out ${
          compact
            ? "max-w-xl scale-[0.97] py-1 pr-1 pl-3.5 sm:max-w-2xl sm:pl-4"
            : "max-w-5xl scale-100 py-1.5 pr-1.5 pl-4 sm:pl-5"
        }`}
      >
        <Brand compact />
        <nav aria-label="Navigasi utama" className="flex items-center gap-1">
          {sections.map((section) => (
            <a
              className={`hidden items-center rounded-full text-sm font-medium transition-colors hover:text-[var(--primary)] md:inline-flex ${
                compact ? "min-h-9 px-2.5" : "min-h-11 px-3"
              }`}
              href={section.href}
              key={section.href}
            >
              {section.label}
            </a>
          ))}
          <Link
            className={`inline-flex items-center rounded-full text-sm font-semibold transition-colors hover:text-[var(--primary)] md:ml-1 ${
              compact ? "min-h-9 px-2.5" : "min-h-11 px-3"
            }`}
            href="/login"
          >
            Masuk
          </Link>
          <LinkButton
            className={compact ? "min-h-9 px-3.5 py-1 text-xs" : ""}
            href="/daftar"
          >
            Daftar
          </LinkButton>
        </nav>
      </div>
    </header>
  );
}
