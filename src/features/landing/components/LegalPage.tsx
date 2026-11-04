import type { ReactNode } from "react";
import { Container } from "@/components/layout/Container";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <div className="landing flex min-h-screen flex-col bg-[var(--background)] text-[var(--foreground)]">
      <SiteHeader />
      <main className="flex-1 pt-28 pb-14 sm:pt-36 sm:pb-20">
        <Container size="form">
          <h1 className="text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
            {title}
          </h1>
          <p className="mt-3 text-sm text-[var(--muted-foreground)]">
            Terakhir diperbarui {updated}
          </p>
          <div className="mt-10 grid gap-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:tracking-[-0.02em] [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:text-[var(--muted-foreground)] [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-[var(--muted-foreground)]">
            {children}
          </div>
        </Container>
      </main>
      <SiteFooter />
    </div>
  );
}
