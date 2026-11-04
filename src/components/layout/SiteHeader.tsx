import Link from "next/link";
import { Brand } from "@/components/layout/Brand";
import { LinkButton } from "@/components/ui/LinkButton";

const sections = [
  { href: "/#cara-kerja", label: "Cara kerja" },
  { href: "/#pencegahan", label: "Pencegahan" },
  { href: "/#faq", label: "FAQ" },
];

// Section links use a plain <a>: next/link skips scrolling when the URL already has the
// same hash, so a second click on "Cara kerja" would do nothing.

// Floating liquid-glass bar shared by public pages; it stays visible over every section.
export function SiteHeader() {
  return (
    <header
      className="fixed inset-x-0 top-3 z-50 px-3 sm:top-4 sm:px-6"
      data-site-header
    >
      <div className="glass-nav mx-auto flex max-w-5xl items-center justify-between gap-2 rounded-full py-1.5 pr-1.5 pl-4 sm:pl-5">
        <Brand compact />
        <nav aria-label="Navigasi utama" className="flex items-center gap-1">
          {sections.map((section) => (
            <a
              className="hidden min-h-11 items-center rounded-full px-3 text-sm font-medium hover:text-[var(--primary)] md:inline-flex"
              href={section.href}
              key={section.href}
            >
              {section.label}
            </a>
          ))}
          <Link
            className="inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold hover:text-[var(--primary)] md:ml-2"
            href="/login"
          >
            Masuk
          </Link>
          <LinkButton href="/daftar">Daftar</LinkButton>
        </nav>
      </div>
    </header>
  );
}
