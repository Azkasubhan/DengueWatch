import type { ComponentPropsWithoutRef } from "react";

// Shared surface for cards and form panels (same as the report form panel).
export const cardClass =
  "rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5";

export function Card({
  className = "",
  ...props
}: ComponentPropsWithoutRef<"div">) {
  return <div className={`${cardClass} ${className}`} {...props} />;
}
