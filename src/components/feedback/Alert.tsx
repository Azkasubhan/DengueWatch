import type { ReactNode } from "react";

type AlertProps = {
  children: ReactNode;
  title?: string;
  variant?: "info" | "error";
};

export function Alert({ children, title, variant = "info" }: AlertProps) {
  const tone =
    variant === "error"
      ? "border-[var(--danger)] bg-[var(--danger-subtle)] text-[var(--danger)]"
      : "border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)]";

  return (
    <div
      className={`rounded-[var(--radius-control)] border p-4 ${tone}`}
      role="status"
    >
      {title ? <p className="font-semibold">{title}</p> : null}
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}
