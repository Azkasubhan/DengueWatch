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

export type UrgentActionItem = {
  kind: "verify_report" | "assign_task" | "review_evidence" | "overdue_task";
  typeLabel: string;
  id: string;
  reference: string;
  title: string;
  locationLabel: string;
  timeLabel: string;
  href: string;
  actionLabel: string;
  tone: "warning" | "danger" | "info" | "neutral";
  priorityRank: number;
  sortTimestamp: number;
};

const categoryLabelMap: Record<string, string> = {
  water_container: "Wadah air terbuka",
  discarded_tire: "Ban bekas",
  clogged_drain: "Saluran tersumbat",
  discarded_item: "Barang bekas",
  other: "Temuan lain",
};

function formatWaitDuration(
  iso: string,
  prefix: string,
  now = Date.now(),
): string {
  const days = Math.max(0, Math.floor((now - Date.parse(iso)) / 86_400_000));
  if (days === 0) return `${prefix} hari ini`;
  return `${prefix} ${days} hari`;
}

// Operational queue is current open work (all time in managed areas), never hidden by period filter.
export async function getManagerOperationalOverview(areaId: string | null) {
  const client = await createClient();
  let reportsQuery = client
    .from("reports")
    .select(
      "id,public_reference,area_id,category,description,status,submitted_at,location_note,action_tasks(id,status,is_mandatory)",
    )
    .in("status", [
      "pending_verification",
      "needs_information",
      "verified",
      "in_action",
    ])
    .order("submitted_at", { ascending: true });

  let tasksQuery = client
    .from("action_tasks")
    .select(
      "id,report_id,area_id,title,status,due_at,evidence_round,created_at,reports(public_reference,location_note),task_evidence(id,submitted_by,review_status,evidence_round,created_at),action_task_assignees(profile_id)",
    )
    .not("status", "in", "(completed,cancelled)")
    .order("due_at", { ascending: true, nullsFirst: false });

  if (areaId) {
    reportsQuery = reportsQuery.eq("area_id", areaId);
    tasksQuery = tasksQuery.eq("area_id", areaId);
  }

  const [reportsRes, tasksRes] = await Promise.all([reportsQuery, tasksQuery]);
  if (reportsRes.error || tasksRes.error) {
    return {
      data: null,
      error: reportsRes.error ?? tasksRes.error,
    };
  }

  const now = Date.now();
  const openReports = (reportsRes.data ?? []) as {
    id: string;
    public_reference: string;
    area_id: string;
    category: string;
    description: string;
    status: string;
    submitted_at: string;
    location_note: string | null;
    action_tasks?: { id: string; status: string; is_mandatory: boolean }[];
  }[];

  const openTasks = (tasksRes.data ?? []) as unknown as {
    id: string;
    report_id: string;
    area_id: string;
    title: string;
    status: string;
    due_at: string | null;
    evidence_round: number;
    created_at: string;
    reports: { public_reference: string; location_note: string | null } | null;
    task_evidence?: {
      id: string;
      submitted_by: string;
      review_status: string;
      evidence_round: number;
      created_at: string;
    }[];
    action_task_assignees?: { profile_id: string }[];
  }[];

  let pendingVerificationCount = 0;
  let needsInformationCount = 0;
  let verifiedWithoutTaskCount = 0;

  const candidates: UrgentActionItem[] = [];

  for (const r of openReports) {
    const submittedMs = Date.parse(r.submitted_at) || now;
    const waitDays = Math.max(0, Math.floor((now - submittedMs) / 86_400_000));
    const loc = r.location_note?.trim() || "Tanpa patokan lokasi tertulis";

    if (r.status === "pending_verification") {
      pendingVerificationCount += 1;
      candidates.push({
        kind: "verify_report",
        typeLabel: "Verifikasi",
        id: r.id,
        reference: r.public_reference,
        title: categoryLabelMap[r.category] ?? "Temuan lingkungan",
        locationLabel: loc,
        timeLabel:
          waitDays > 0 ? `Menunggu ${waitDays} hari` : "Masuk hari ini",
        href: `/pengelola/verifikasi/${r.id}`,
        actionLabel: "Periksa",
        tone: waitDays >= 3 ? "warning" : "neutral",
        priorityRank: 3,
        sortTimestamp: submittedMs,
      });
    } else if (r.status === "needs_information") {
      needsInformationCount += 1;
    } else if (r.status === "verified" || r.status === "in_action") {
      const hasActiveMandatory = (r.action_tasks ?? []).some(
        (t) => t.is_mandatory && t.status !== "cancelled",
      );
      if (!hasActiveMandatory) {
        verifiedWithoutTaskCount += 1;
        candidates.push({
          kind: "assign_task",
          typeLabel: "Penugasan",
          id: r.id,
          reference: r.public_reference,
          title: categoryLabelMap[r.category] ?? "Temuan terverifikasi",
          locationLabel: loc,
          timeLabel: formatWaitDuration(r.submitted_at, "Menunggu tugas", now),
          href: `/pengelola/verifikasi/${r.id}`,
          actionLabel: "Buat tugas",
          tone: "info",
          priorityRank: 4,
          sortTimestamp: submittedMs,
        });
      }
    }
  }

  let overdueTasksCount = 0;
  let pendingEvidenceSubmissionsCount = 0;
  let tasksWithPendingEvidenceCount = 0;

  for (const t of openTasks) {
    const dueMs = t.due_at ? Date.parse(t.due_at) : null;
    const isOverdue = Boolean(dueMs !== null && dueMs < now);
    if (isOverdue) {
      overdueTasksCount += 1;
    }

    const loc =
      t.reports?.location_note?.trim() || "Lokasi sesuai laporan terkait";

    const activeRoundPending = (t.task_evidence ?? []).filter(
      (ev) =>
        ev.evidence_round === t.evidence_round &&
        ev.review_status === "pending",
    );

    if (activeRoundPending.length > 0) {
      pendingEvidenceSubmissionsCount += activeRoundPending.length;
      tasksWithPendingEvidenceCount += 1;

      const oldestEvidenceMs = Math.min(
        ...activeRoundPending.map((ev) => Date.parse(ev.created_at) || now),
      );
      const waitDays = Math.max(
        0,
        Math.floor((now - oldestEvidenceMs) / 86_400_000),
      );

      candidates.push({
        kind: "review_evidence",
        typeLabel: `Tinjau bukti (${activeRoundPending.length})`,
        id: t.id,
        reference: t.reports?.public_reference ?? "Tugas",
        title: t.title,
        locationLabel: loc,
        timeLabel:
          waitDays > 0
            ? `Bukti menunggu ${waitDays} hari`
            : "Bukti masuk hari ini",
        href: `/pengelola/tugas/${t.id}`,
        actionLabel: "Tinjau",
        tone: "warning",
        priorityRank: 2,
        sortTimestamp: oldestEvidenceMs,
      });
    } else if (isOverdue && dueMs !== null) {
      const overdueDays = Math.max(1, Math.ceil((now - dueMs) / 86_400_000));
      candidates.push({
        kind: "overdue_task",
        typeLabel: "Tenggat tugas",
        id: t.id,
        reference: t.reports?.public_reference ?? "Tugas",
        title: t.title,
        locationLabel: loc,
        timeLabel: `Lewat tenggat ${overdueDays} hari`,
        href: `/pengelola/tugas/${t.id}`,
        actionLabel: "Periksa",
        tone: "danger",
        priorityRank: 1,
        sortTimestamp: dueMs,
      });
    }
  }

  // Deterministic operational priority sort:
  // 1. Overdue tasks (oldest due_at first)
  // 2. Active-round cadre evidence waiting review (oldest evidence submission first)
  // 3. Reports pending verification (oldest submitted_at first)
  // 4. Verified reports without mandatory task (oldest submitted_at first)
  candidates.sort((a, b) => {
    if (a.priorityRank !== b.priorityRank) {
      return a.priorityRank - b.priorityRank;
    }
    if (a.sortTimestamp !== b.sortTimestamp) {
      return a.sortTimestamp - b.sortTimestamp;
    }
    return a.id.localeCompare(b.id);
  });

  return {
    data: {
      asOf: new Date(now).toISOString(),
      pendingVerificationCount,
      needsInformationCount,
      verifiedWithoutTaskCount,
      overdueTasksCount,
      pendingEvidenceSubmissionsCount,
      tasksWithPendingEvidenceCount,
      totalUrgentCount: candidates.length,
      urgentItems: candidates.slice(0, 5),
    },
    error: null,
  };
}

export type DailyTrendPoint = {
  date: string;
  submitted: number;
  resolved: number;
};

export async function getManagerDailyTrend(query: SummaryQuery) {
  const client = await createClient();
  const startIso = new Date(`${query.from}T00:00:00+07:00`).toISOString();
  const endDate = new Date(`${query.to}T00:00:00+07:00`);
  const endIso = new Date(endDate.getTime() + 86_400_000).toISOString();

  let submittedQuery = client
    .from("reports")
    .select("submitted_at")
    .gte("submitted_at", startIso)
    .lt("submitted_at", endIso);

  let resolvedQuery = client
    .from("reports")
    .select("resolved_at")
    .eq("status", "resolved")
    .not("resolved_at", "is", null)
    .gte("resolved_at", startIso)
    .lt("resolved_at", endIso);

  if (query.areaId) {
    submittedQuery = submittedQuery.eq("area_id", query.areaId);
    resolvedQuery = resolvedQuery.eq("area_id", query.areaId);
  }

  const [subRes, resRes] = await Promise.all([submittedQuery, resolvedQuery]);
  if (subRes.error || resRes.error) {
    return { data: null, error: subRes.error ?? resRes.error };
  }

  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" });
  const submittedByDay = new Map<string, number>();
  const resolvedByDay = new Map<string, number>();

  for (const row of (subRes.data ?? []) as { submitted_at: string }[]) {
    const day = fmt.format(new Date(row.submitted_at));
    submittedByDay.set(day, (submittedByDay.get(day) ?? 0) + 1);
  }
  for (const row of (resRes.data ?? []) as { resolved_at: string }[]) {
    if (!row.resolved_at) continue;
    const day = fmt.format(new Date(row.resolved_at));
    resolvedByDay.set(day, (resolvedByDay.get(day) ?? 0) + 1);
  }

  const series: DailyTrendPoint[] = [];
  const cursor = new Date(`${query.from}T00:00:00Z`);
  const stop = new Date(`${query.to}T00:00:00Z`);
  while (cursor.getTime() <= stop.getTime()) {
    const d = cursor.toISOString().slice(0, 10);
    series.push({
      date: d,
      submitted: submittedByDay.get(d) ?? 0,
      resolved: resolvedByDay.get(d) ?? 0,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return { data: series, error: null };
}
