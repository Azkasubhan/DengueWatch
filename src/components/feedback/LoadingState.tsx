// Page-level loading placeholder: a readable status line plus calm skeleton rows.
export function LoadingState({ label }: { label: string }) {
  return (
    <div className="mx-auto max-w-[var(--page-max)] px-4 py-10 sm:px-6 lg:px-8">
      <p
        role="status"
        className="text-sm font-semibold text-[var(--muted-foreground)]"
      >
        {label}
      </p>
      <div aria-hidden="true" className="mt-6 grid gap-3">
        <div className="h-9 w-64 max-w-full animate-pulse rounded-full bg-[var(--sand)]" />
        {[0, 1, 2].map((row) => (
          <div
            className="h-24 animate-pulse rounded-[var(--radius-card)] bg-[var(--sand)]/70"
            key={row}
          />
        ))}
      </div>
    </div>
  );
}
