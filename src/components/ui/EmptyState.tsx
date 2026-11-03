import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

// What this is, why it is empty, and how to start.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-[var(--control-border)] bg-[var(--surface)] px-6 py-10 text-center">
      {Icon ? (
        <span className="mx-auto grid size-11 place-items-center rounded-full bg-[var(--sand)]">
          <Icon aria-hidden="true" className="size-5 text-[var(--forest)]" />
        </span>
      ) : null}
      <h2 className="mt-4 text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-[var(--muted-foreground)]">
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  );
}
