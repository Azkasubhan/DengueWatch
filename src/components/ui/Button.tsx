import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
};

const variants = {
  primary:
    "border-[var(--primary)] bg-[var(--primary)] text-white hover:bg-[var(--primary-hover)]",
  secondary:
    "border-[var(--control-border)] bg-[var(--surface)] text-[var(--foreground)] hover:border-[var(--primary)]",
  ghost:
    "border-transparent bg-transparent text-[var(--foreground)] hover:bg-[var(--primary-subtle)]",
  danger:
    "border-[var(--danger)] bg-[var(--danger)] text-white hover:brightness-90",
};

const sizes = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-10 px-3.5 py-2 text-sm",
  lg: "min-h-11 px-4 py-2.5 text-sm",
};

export function Button({
  children,
  className = "",
  disabled,
  isLoading = false,
  type = "button",
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] border font-semibold shadow-2xs transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${sizes[size]} ${variants[variant]} ${className}`}
      disabled={disabled || isLoading}
      type={type}
      {...props}
    >
      {isLoading ? (
        <span
          aria-hidden="true"
          className="size-3.5 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      <span className="inline-flex items-center gap-1.5">
        {isLoading ? "Memproses…" : children}
      </span>
    </button>
  );
}
