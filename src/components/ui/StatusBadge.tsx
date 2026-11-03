import type { ReactNode } from "react";
import type { ReportStatus } from "@/features/reports/validation";
import type { TaskStatus } from "@/features/tasks/validation";

export type Tone =
  "neutral" | "info" | "progress" | "success" | "warning" | "danger";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--sand)] text-[var(--foreground)]",
  info: "bg-[var(--info-subtle)] text-[var(--info)]",
  progress: "bg-[var(--forest)] text-[var(--forest-foreground)]",
  success: "bg-[var(--primary-subtle)] text-[var(--primary)]",
  warning: "bg-[var(--warning-subtle)] text-[var(--warning)]",
  danger: "bg-[var(--danger-subtle)] text-[var(--danger)]",
};

// One mapping for every page, so the same status always looks the same.
export const reportStatusTone: Record<ReportStatus, Tone> = {
  pending_verification: "warning",
  needs_information: "warning",
  verified: "info",
  in_action: "progress",
  resolved: "success",
  rejected: "neutral",
  duplicate: "neutral",
};

export const taskStatusTone: Record<TaskStatus, Tone> = {
  assigned: "info",
  in_progress: "progress",
  awaiting_review: "warning",
  completed: "success",
  reopened: "warning",
  cancelled: "neutral",
};

export function StatusBadge({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
