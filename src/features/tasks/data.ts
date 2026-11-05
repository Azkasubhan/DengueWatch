import "server-only";

import { createClient as createUserClient } from "@/integrations/supabase/server";
import { reportBucket } from "@/features/reports/data";
import type { TaskListFilters, TaskStatus } from "@/features/tasks/validation";

export type TaskRow = {
  id: string;
  report_id: string;
  area_id: string;
  title: string;
  description: string;
  action_task_assignees: { profile_id: string }[];
  created_by: string;
  status: TaskStatus;
  is_mandatory: boolean;
  due_at: string | null;
  completed_at: string | null;
  version: number;
  evidence_round: number;
  created_at: string;
  updated_at: string;
  reports: { public_reference: string } | null;
};

type EvidenceRow = {
  id: string;
  submitted_by: string;
  reviewed_by: string | null;
  storage_path: string;
  width: number;
  height: number;
  description: string;
  review_status: "pending" | "approved" | "revision_required";
  review_reason: string | null;
  evidence_round: number;
  created_at: string;
  reviewed_at: string | null;
};

type AssigneeRow = {
  task_id: string;
  profile_id: string;
  display_name: string;
  is_me: boolean;
};

export type EvidenceStatus = EvidenceRow["review_status"] | "missing";

type TaskEventRow = {
  id: string;
  event_type: string;
  old_status: TaskStatus | null;
  new_status: TaskStatus;
  reason: string | null;
  created_at: string;
};

const taskColumns = (assignees: string) =>
  `id,report_id,area_id,title,description,${assignees}(profile_id),created_by,status,is_mandatory,due_at,completed_at,version,evidence_round,created_at,updated_at,reports(public_reference)`;

// Profile ids of other cadres stay server-side; the client only learns its own role in a task.
export function toTask(row: TaskRow, userId: string) {
  return {
    id: row.id,
    reportId: row.report_id,
    reportReference: row.reports?.public_reference ?? null,
    areaId: row.area_id,
    title: row.title,
    description: row.description,
    status: row.status,
    isMandatory: row.is_mandatory,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignedToMe: row.action_task_assignees.some(
      (assignee) => assignee.profile_id === userId,
    ),
    createdByMe: row.created_by === userId,
  };
}

export type TaskSummary = ReturnType<typeof toTask>;

// RLS limits rows to the manager's areas or to tasks assigned to the cadre.
export async function listTasks(
  page: number,
  limit: number,
  filters: TaskListFilters,
  userId: string,
) {
  const client = await createUserClient();
  let query = client
    .from("action_tasks")
    .select(
      taskColumns(
        filters.assignee === "me"
          ? "action_task_assignees!inner"
          : "action_task_assignees",
      ),
      { count: "exact" },
    )
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (filters.status) query = query.in("status", filters.status);
  if (filters.reportId) query = query.eq("report_id", filters.reportId);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.assignee === "me")
    query = query.eq("action_task_assignees.profile_id", userId);
  const result = await query.overrideTypes<TaskRow[], { merge: false }>();
  return {
    data: result.data?.map((row) => toTask(row, userId)) ?? null,
    count: result.count,
    error: result.error,
  };
}

export async function getTaskDetail(id: string, userId: string) {
  const client = await createUserClient();
  const task = await client
    .from("action_tasks")
    .select(taskColumns("action_task_assignees"))
    .eq("id", id)
    .maybeSingle<TaskRow>();
  if (task.error) throw new Error("TASK_DETAIL_UNAVAILABLE");
  if (!task.data) return null;
  const [events, evidence, assignees] = await Promise.all([
    client
      .from("task_events")
      .select("id,event_type,old_status,new_status,reason,created_at")
      .eq("task_id", id)
      .order("created_at")
      .overrideTypes<TaskEventRow[], { merge: false }>(),
    client
      .from("task_evidence")
      .select(
        "id,submitted_by,reviewed_by,storage_path,width,height,description,review_status,review_reason,evidence_round,created_at,reviewed_at",
      )
      .eq("task_id", id)
      .order("created_at")
      .overrideTypes<EvidenceRow[], { merge: false }>(),
    client.rpc("list_task_assignees", { p_task_ids: [id] }),
  ]);
  if (events.error || evidence.error || assignees.error)
    throw new Error("TASK_DETAIL_UNAVAILABLE");
  const assigneeRows = (assignees.data ?? []) as AssigneeRow[];
  const names = new Map(
    assigneeRows.map((row) => [row.profile_id, row.display_name]),
  );
  // T33: each cadre's latest evidence in the current round decides their progress.
  const round = task.data.evidence_round;
  const latest = new Map<string, EvidenceRow>();
  for (const row of evidence.data ?? [])
    if (row.evidence_round === round) latest.set(row.submitted_by, row);
  const evidenceWithUrls = await Promise.all(
    (evidence.data ?? []).map(async (row) => {
      let signedUrl = "";
      try {
        const signed = await client.storage
          .from(reportBucket)
          .createSignedUrl(row.storage_path, 60);
        if (signed.data?.signedUrl) {
          signedUrl = signed.data.signedUrl;
        }
      } catch {
        // storage object might be offline or missing
      }
      return {
        id: row.id,
        description: row.description,
        reviewStatus: row.review_status,
        reviewReason: row.review_reason,
        createdAt: row.created_at,
        reviewedAt: row.reviewed_at,
        width: row.width,
        height: row.height,
        url: signedUrl,
        submitterName: names.get(row.submitted_by) ?? "Kader",
        evidenceRound: row.evidence_round,
        currentRound: row.evidence_round === round,
        submittedByMe: row.submitted_by === userId,
        reviewedByMe: row.reviewed_by === userId,
      };
    }),
  );
  return {
    ...toTask(task.data, userId),
    events: (events.data ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      oldStatus: row.old_status,
      newStatus: row.new_status,
      reason: row.reason,
      createdAt: row.created_at,
    })),
    evidence: evidenceWithUrls,
    assignees: assigneeRows.map((row) => ({
      name: row.display_name,
      isMe: row.is_me,
      evidenceStatus: (latest.get(row.profile_id)?.review_status ??
        "missing") as EvidenceStatus,
    })),
  };
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;

// Assignee names per task (T27); profile ids never leave the server.
export async function listTaskAssignees(taskIds: string[]) {
  const names = new Map<string, string[]>();
  if (!taskIds.length) return { data: names, error: null };
  const client = await createUserClient();
  const result = await client.rpc("list_task_assignees", {
    p_task_ids: taskIds,
  });
  for (const row of (result.data ?? []) as {
    task_id: string;
    display_name: string;
  }[])
    names.set(row.task_id, [
      ...(names.get(row.task_id) ?? []),
      row.display_name,
    ]);
  return { data: names, error: result.error };
}

// Verified cadres of a managed area, for the task assignment picker.
export async function listAreaCadres(areaId: string) {
  const client = await createUserClient();
  const result = await client.rpc("list_area_cadres", { p_area_id: areaId });
  return {
    data: (
      (result.data ?? []) as { profile_id: string; display_name: string }[]
    ).map((row) => ({ id: row.profile_id, name: row.display_name })),
    error: result.error,
  };
}

type RichTaskRow = TaskRow & {
  reports: {
    public_reference: string;
    location_note: string | null;
    category: string;
  } | null;
  task_evidence?: {
    id: string;
    submitted_by: string;
    review_status: "pending" | "approved" | "revision_required";
    evidence_round: number;
    review_reason: string | null;
    created_at: string;
  }[];
};

const richTaskColumns = (assignees: string) =>
  `id,report_id,area_id,title,description,${assignees}(profile_id),created_by,status,is_mandatory,due_at,completed_at,version,evidence_round,created_at,updated_at,reports(public_reference,location_note,category),task_evidence(id,submitted_by,review_status,evidence_round,review_reason,created_at)`;

export function toTaskListRow(
  row: RichTaskRow,
  userId: string,
  now = Date.now(),
) {
  const base = toTask(row, userId);
  const round = row.evidence_round;
  const latestByAssignee = new Map<
    string,
    NonNullable<RichTaskRow["task_evidence"]>[number]
  >();

  // Sort evidence by created_at ascending so the last one in the round wins
  const sortedEvidence = [...(row.task_evidence ?? [])].sort((a, b) =>
    a.created_at.localeCompare(b.created_at),
  );
  for (const ev of sortedEvidence) {
    if (ev.evidence_round === round) {
      latestByAssignee.set(ev.submitted_by, ev);
    }
  }

  let approvedAssigneeCount = 0;
  let pendingEvidenceCount = 0;
  for (const assignee of row.action_task_assignees) {
    const ev = latestByAssignee.get(assignee.profile_id);
    if (ev?.review_status === "approved") approvedAssigneeCount += 1;
    else if (ev?.review_status === "pending") pendingEvidenceCount += 1;
  }

  const myLatest = latestByAssignee.get(userId);
  const myEvidenceCount = sortedEvidence.filter(
    (ev) => ev.submitted_by === userId && ev.evidence_round === round,
  ).length;
  const myEvidenceStatus: EvidenceStatus = myLatest?.review_status ?? "missing";
  const myRevisionReason =
    myEvidenceStatus === "revision_required"
      ? (myLatest?.review_reason ?? null)
      : null;

  const isTerminal = row.status === "completed" || row.status === "cancelled";
  const dueMs = row.due_at ? new Date(row.due_at).getTime() : null;
  const isOverdue = Boolean(!isTerminal && dueMs !== null && dueMs < now);
  const isDueSoon = Boolean(
    !isTerminal &&
    !isOverdue &&
    dueMs !== null &&
    dueMs <= now + 2 * 86_400_000,
  );

  return {
    ...base,
    reportLocationNote: row.reports?.location_note ?? null,
    reportCategory: row.reports?.category ?? null,
    evidenceRound: round,
    assigneeCount: row.action_task_assignees.length,
    approvedAssigneeCount,
    pendingEvidenceCount,
    myEvidenceStatus,
    myEvidenceCount,
    myLatestEvidenceId: myLatest?.id ?? null,
    myRevisionReason,
    isOverdue,
    isDueSoon,
  };
}

export type TaskListRow = ReturnType<typeof toTaskListRow>;

export async function listTaskRows(
  page: number,
  limit: number,
  filters: TaskListFilters,
  userId: string,
) {
  const client = await createUserClient();
  const nowIso = new Date().toISOString();
  const soonIso = new Date(Date.now() + 2 * 86_400_000).toISOString();

  let query = client
    .from("action_tasks")
    .select(
      richTaskColumns(
        filters.assignee === "me"
          ? "action_task_assignees!inner"
          : "action_task_assignees",
      ),
      { count: "exact" },
    );

  if (filters.status) query = query.in("status", filters.status);
  if (filters.reportId) query = query.eq("report_id", filters.reportId);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.assignee === "me")
    query = query.eq("action_task_assignees.profile_id", userId);

  if (filters.due === "overdue") {
    query = query
      .not("status", "in", "(completed,cancelled)")
      .not("due_at", "is", null)
      .lt("due_at", nowIso);
  } else if (filters.due === "due_soon") {
    query = query
      .not("status", "in", "(completed,cancelled)")
      .not("due_at", "is", null)
      .gte("due_at", nowIso)
      .lte("due_at", soonIso);
  }

  if (filters.q) {
    const escaped = filters.q.replace(/[%_,()]/g, "").trim();
    if (escaped) {
      query = query.or(
        `title.ilike.%${escaped}%,description.ilike.%${escaped}%`,
      );
    }
  }

  if (filters.needsReview) {
    query = query.eq("status", "awaiting_review");
  }

  if (filters.sort === "due_asc") {
    query = query
      .order("due_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  } else {
    query = query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
  }

  const result = await query
    .range((page - 1) * limit, page * limit - 1)
    .overrideTypes<RichTaskRow[], { merge: false }>();

  return {
    data: result.data?.map((row) => toTaskListRow(row, userId)) ?? null,
    count: result.count,
    error: result.error,
  };
}

export async function getCadreSummary(userId: string, areaId?: string) {
  const client = await createUserClient();
  let query = client
    .from("action_tasks")
    .select(richTaskColumns("action_task_assignees!inner"))
    .eq("action_task_assignees.profile_id", userId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (areaId) query = query.eq("area_id", areaId);

  const result = await query.overrideTypes<RichTaskRow[], { merge: false }>();
  if (result.error || !result.data) {
    return { data: null, error: result.error };
  }

  const rows = result.data.map((row) => toTaskListRow(row, userId));
  const activeRows = rows.filter(
    (t) => t.status !== "completed" && t.status !== "cancelled",
  );

  let overdueCount = 0;
  let dueSoonCount = 0;
  let myPendingEvidenceCount = 0;
  let myRevisionRequiredCount = 0;

  for (const t of activeRows) {
    if (t.isOverdue) overdueCount += 1;
    else if (t.isDueSoon) dueSoonCount += 1;
    if (t.myEvidenceStatus === "pending") myPendingEvidenceCount += 1;
    if (t.myEvidenceStatus === "revision_required")
      myRevisionRequiredCount += 1;
  }

  const priorityRank = (t: TaskListRow) => {
    if (t.myEvidenceStatus === "revision_required") return 0;
    if (t.isOverdue && t.myEvidenceStatus === "missing") return 1;
    if (t.status === "assigned" || t.status === "reopened") return 2;
    if (t.myEvidenceStatus === "missing") return 3;
    if (t.isOverdue) return 4;
    if (t.myEvidenceStatus === "pending") return 5;
    return 6;
  };

  const prioritizedTasks = [...activeRows].sort((a, b) => {
    const rankDiff = priorityRank(a) - priorityRank(b);
    if (rankDiff !== 0) return rankDiff;
    const dueA = a.dueAt
      ? new Date(a.dueAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    const dueB = b.dueAt
      ? new Date(b.dueAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    return dueA - dueB;
  });

  return {
    data: {
      activeTasksCount: activeRows.length,
      overdueCount,
      dueSoonCount,
      dueSoonOrOverdueCount: overdueCount + dueSoonCount,
      myPendingEvidenceCount,
      myRevisionRequiredCount,
      completedCount: rows.filter((t) => t.status === "completed").length,
      prioritizedTasks,
    },
    error: null,
  };
}
