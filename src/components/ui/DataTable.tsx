import type { ReactNode, ThHTMLAttributes, TdHTMLAttributes } from "react";

export function DataTableContainer({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`w-full max-w-full overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] shadow-2xs ${className}`}
    >
      <div className="w-full max-w-full overflow-x-auto">{children}</div>
    </div>
  );
}

export function DataTable({
  caption,
  children,
  className = "",
}: {
  caption: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <table
      className={`w-full border-collapse text-left text-xs sm:text-sm ${className}`}
    >
      <caption className="sr-only">{caption}</caption>
      {children}
    </table>
  );
}

export function DataTableHeader({ children }: { children: ReactNode }) {
  return (
    <thead className="border-b border-[var(--border)] bg-[var(--background)] text-[11px] font-bold tracking-wider text-[var(--muted-foreground)] uppercase">
      <tr>{children}</tr>
    </thead>
  );
}

export function DataTableHeadCell({
  children,
  className = "",
  align = "left",
  ...props
}: ThHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "center" | "right";
}) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";
  return (
    <th
      scope="col"
      className={`px-3 py-2.5 font-bold whitespace-nowrap sm:px-4 ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </th>
  );
}

export function DataTableBody({ children }: { children: ReactNode }) {
  return (
    <tbody className="divide-y divide-[var(--border)] bg-[var(--surface)]">
      {children}
    </tbody>
  );
}

export function DataTableRow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tr
      className={`transition-colors hover:bg-[var(--background)]/65 ${className}`}
    >
      {children}
    </tr>
  );
}

export function DataTableCell({
  children,
  className = "",
  align = "left",
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "center" | "right";
}) {
  const alignClass =
    align === "right"
      ? "text-right"
      : align === "center"
        ? "text-center"
        : "text-left";
  return (
    <td
      className={`px-3 py-3 align-middle sm:px-4 sm:py-3.5 ${alignClass} ${className}`}
      {...props}
    >
      {children}
    </td>
  );
}

export function RowNumberHeader() {
  return (
    <DataTableHeadCell align="left" className="w-12 pl-3.5 sm:pl-4">
      No.
    </DataTableHeadCell>
  );
}

export function RowNumberCell({ number }: { number: number }) {
  return (
    <DataTableCell
      align="left"
      className="w-12 pl-3.5 whitespace-nowrap sm:pl-4"
    >
      <span className="inline-flex size-6 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background)] font-mono text-xs font-bold tabular-nums text-[var(--foreground)]">
        {number}
      </span>
    </DataTableCell>
  );
}

export function AssigneeListSummary({ names }: { names: string[] }) {
  if (names.length === 0) {
    return (
      <span className="block truncate text-xs text-[var(--muted-foreground)]">
        Belum ditentukan
      </span>
    );
  }

  if (names.length <= 2) {
    const joined = names.join(", ");
    return (
      <span
        className="block max-w-[180px] truncate text-xs font-medium text-[var(--foreground)]"
        title={joined}
      >
        {joined}
      </span>
    );
  }

  const visible = names.slice(0, 2).join(", ");
  const remainingCount = names.length - 2;

  return (
    <div className="max-w-[180px] text-xs">
      <span
        className="block truncate font-medium text-[var(--foreground)]"
        title={visible}
      >
        {visible}
      </span>
      <details className="mt-0.5">
        <summary className="cursor-pointer truncate font-semibold text-[var(--primary)] hover:underline">
          +{remainingCount} kader lainnya
        </summary>
        <p className="mt-1 rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs text-[var(--foreground)]">
          {names.join(", ")}
        </p>
      </details>
    </div>
  );
}
