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
    <div className="mb-6">
      {back ? (
        <Link
          className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          href={back.href}
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-[-0.03em] break-words sm:text-4xl">
            {title}
          </h1>
          {meta ? (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--muted-foreground)]">
              {meta}
            </div>
          ) : null}
          {description ? (
            <p className="mt-3 text-[var(--muted-foreground)]">{description}</p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-3">{actions}</div>
        ) : null}
      </div>
    </div>
  );
}
