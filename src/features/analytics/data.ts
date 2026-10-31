import "server-only";

import { createClient } from "@/integrations/supabase/server";
import type { SummaryQuery } from "@/features/analytics/validation";

type SummaryRow = {
  as_of: string;
  period_start: string;
  period_end: string;
  area_count: number;
  is_demo: boolean;
  reports_total: number;
  awaiting_verification: number;
  in_action: number;
  resolved: number;
  not_actionable: number;
  completion_eligible: number;
  completion_rate: number | null;
  median_hours_to_first_review: number | null;
  median_hours_to_resolution: number | null;
  tasks_awaiting_review: number;
};

const numberOrNull = (value: number | string | null) =>
  value === null ? null : Number(value);

// Aggregates come from get_manager_report_summary; RLS and area checks run in the database.
export async function getManagerSummary(query: SummaryQuery) {
  const client = await createClient();
  const result = await client.rpc("get_manager_report_summary", {
    p_area_id: query.areaId,
    p_from: query.from,
    p_to: query.to,
  });
  const row = (result.data as SummaryRow[] | null)?.[0];
  if (result.error || !row) return { data: null, error: result.error ?? {} };
  return {
    data: {
      asOf: row.as_of,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      from: query.from,
      to: query.to,
      areaCount: row.area_count,
      isDemo: row.is_demo,
      reportsTotal: row.reports_total,
      awaitingVerification: row.awaiting_verification,
      inAction: row.in_action,
      resolved: row.resolved,
      notActionable: row.not_actionable,
      completionEligible: row.completion_eligible,
      completionRate: numberOrNull(row.completion_rate),
      medianHoursToFirstReview: numberOrNull(row.median_hours_to_first_review),
      medianHoursToResolution: numberOrNull(row.median_hours_to_resolution),
      tasksAwaitingReview: row.tasks_awaiting_review,
    },
    error: null,
  };
}

export type ManagerSummary = NonNullable<
  Awaited<ReturnType<typeof getManagerSummary>>["data"]
>;
