import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type LinkButtonProps = ComponentPropsWithoutRef<typeof Link> & {
  variant?: "primary" | "secondary";
  size?: "sm" | "md" | "lg";
};

const variants = {
  primary:
    "border-[var(--primary)] bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]",
  secondary:
    "border-[var(--control-border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]",
};

const sizes = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-10 px-3.5 py-2 text-sm",
  lg: "min-h-11 px-4 py-2.5 text-sm",
};

export function LinkButton({
  className = "",
  variant = "primary",
  size = "md",
  ...props
}: LinkButtonProps) {
  return (
    <Link
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border font-semibold shadow-2xs transition-colors duration-150 ${sizes[size]} ${variants[variant]} ${className}`}
      {...props}
    />
  );
}
