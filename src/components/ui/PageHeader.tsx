import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

type PageHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  /** Small context line under the title, e.g. a reference number and status badge. */
  meta?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
};

export function PageHeader({
  title,
  description,
  meta,
  actions,
  back,
}: PageHeaderProps) {
  return (
    <div className="mb-5 border-b border-[var(--border)]/70 pb-4">
      {back ? (
        <Link
          className="mb-1.5 inline-flex min-h-9 items-center gap-1.5 text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          href={back.href}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-2xl font-bold tracking-[-0.025em] break-words sm:text-3xl">
            {title}
          </h1>
          {meta ? (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-[var(--muted-foreground)]">
              {meta}
            </div>
          ) : null}
          {description ? (
            <p className="mt-1.5 text-sm text-[var(--muted-foreground)]">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
