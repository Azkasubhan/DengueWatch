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

// `overlay` sits on top of the landing hero photo; `plain` is used on content pages.
export function SiteHeader({
  variant = "plain",
}: {
  variant?: "overlay" | "plain";
}) {
  const overlay = variant === "overlay";
  return (
    <header
      className={`flex min-h-18 items-center justify-between gap-3 px-5 py-4 sm:px-8 lg:px-12 ${overlay ? "text-white" : "border-b border-[var(--border)]"}`}
    >
      <Brand inverse={overlay} />
      <nav aria-label="Navigasi utama" className="flex items-center gap-1">
        {sections.map((section) => (
          <a
            className={`hidden rounded-full px-3 py-2 text-sm font-medium md:inline-flex ${overlay ? "text-white/85 hover:text-white" : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"}`}
            href={section.href}
            key={section.href}
          >
            {section.label}
          </a>
        ))}
        <Link
          className={`inline-flex min-h-11 items-center rounded-full px-3 text-sm font-semibold md:ml-3 ${overlay ? "hover:text-[var(--mint)]" : "hover:text-[var(--primary)]"}`}
          href="/login"
        >
          Masuk
        </Link>
        <LinkButton
          className={
            overlay
              ? "border-white bg-white text-[var(--foreground)] hover:bg-[var(--sand)]"
              : ""
          }
          href="/daftar"
          variant={overlay ? "secondary" : "primary"}
        >
          Daftar
        </LinkButton>
      </nav>
    </header>
  );
}
