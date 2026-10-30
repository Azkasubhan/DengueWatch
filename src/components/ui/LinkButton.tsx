import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type LinkButtonProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: "primary" | "secondary";
};

export function LinkButton({
  className = "",
  variant = "primary",
  ...props
}: LinkButtonProps) {
  const style =
    variant === "primary"
      ? "border-[var(--primary)] bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]"
      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]";

  return (
    <Link
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-control)] border px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ${style} ${className}`}
      {...props}
    />
  );
}
