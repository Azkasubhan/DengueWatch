import type { InputHTMLAttributes } from "react";

type FormFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
};

export function FormField({
  className = "",
  error,
  hint,
  id,
  label,
  required,
  ...props
}: FormFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="grid gap-2">
      <label
        className="text-sm font-semibold text-[var(--foreground)]"
        htmlFor={id}
      >
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <input
        aria-describedby={describedBy}
        aria-invalid={Boolean(error)}
        className={`min-h-11 w-full rounded-[var(--radius-control)] border bg-[var(--surface)] px-3.5 py-2.5 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] disabled:cursor-not-allowed disabled:bg-[var(--background)] disabled:opacity-70 ${
          error ? "border-[var(--danger)]" : "border-[var(--border)]"
        } ${className}`}
        id={id}
        required={required}
        {...props}
      />
      {hint ? (
        <p className="text-sm text-[var(--muted-foreground)]" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          className="text-sm font-medium text-[var(--danger)]"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
