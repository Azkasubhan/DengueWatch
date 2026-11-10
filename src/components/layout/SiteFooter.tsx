import Link from "next/link";
import { Brand } from "@/components/layout/Brand";
import { Container } from "@/components/layout/Container";
import { contacts } from "@/features/landing/content";

const groups = [
  {
    title: "Jelajahi",
    links: [
      { href: "/#cara-kerja", label: "Cara kerja" },
      { href: "/#temuan", label: "Jenis temuan" },
      { href: "/#peran", label: "Peran" },
    ],
  },
  {
    title: "Bantuan",
    links: [
      { href: "/kebijakan-privasi", label: "Kebijakan privasi" },
      { href: "/syarat-layanan", label: "Syarat layanan" },
      { href: "/login", label: "Masuk" },
    ],
  },
];

export function SiteFooter() {
  const filledContacts = contacts.filter((contact) => contact.value);
  return (
    <footer
      className="bg-[var(--forest-deep)] pt-14 pb-8 text-[var(--forest-muted)]"
      id="kontak"
    >
      <Container>
        <div className="grid gap-10 md:grid-cols-12">
          <div className="md:col-span-5">
            <Brand inverse />
            <p className="mt-3 max-w-sm">
              Pelaporan dan penanganan sarang nyamuk berbasis warga, dari temuan
              sampai tuntas.
            </p>
          </div>
          {groups.map((group) => (
            <nav
              aria-label={group.title}
              className="md:col-span-2"
              key={group.title}
            >
              <h2 className="text-sm font-semibold text-[var(--forest-foreground)]">
                {group.title}
              </h2>
              <ul className="mt-3 grid">
                {group.links.map((link) => {
                  // Same-page section links need a plain <a> to scroll on every click.
                  const Anchor = link.href.startsWith("/#") ? "a" : Link;
                  return (
                    <li key={link.href}>
                      <Anchor
                        className="inline-flex min-h-10 items-center text-sm hover:text-white"
                        href={link.href}
                      >
                        {link.label}
                      </Anchor>
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
          {filledContacts.length ? (
            <div className="md:col-span-3">
              <h2 className="text-sm font-semibold text-[var(--forest-foreground)]">
                Kontak
              </h2>
              <ul className="mt-3 grid gap-2 text-sm">
                {filledContacts.map((contact) => (
                  <li key={contact.label}>
                    <span className="block text-xs">{contact.label}</span>
                    {contact.href ? (
                      <a
                        className="text-[var(--forest-foreground)] hover:underline"
                        href={contact.href}
                      >
                        {contact.value}
                      </a>
                    ) : (
                      <span className="text-[var(--forest-foreground)]">
                        {contact.value}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <p className="mt-12 border-t border-white/10 pt-6 text-center text-sm">
          © 2026 DengueWatch. Hak cipta dilindungi.
        </p>
      </Container>
    </footer>
  );
}
