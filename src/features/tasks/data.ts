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
  assigned_to: string;
  created_by: string;
  status: TaskStatus;
  is_mandatory: boolean;
  due_at: string | null;
  completed_at: string | null;
  version: number;
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
  created_at: string;
  reviewed_at: string | null;
};

type TaskEventRow = {
  id: string;
  event_type: string;
  old_status: TaskStatus | null;
  new_status: TaskStatus;
  reason: string | null;
  created_at: string;
};

const taskColumns =
  "id,report_id,area_id,title,description,assigned_to,created_by,status,is_mandatory,due_at,completed_at,version,created_at,updated_at,reports(public_reference)";

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
    assignedToMe: row.assigned_to === userId,
    createdByMe: row.created_by === userId,
  };
}

export type TaskSummary = ReturnType<typeof toTask>;

// RLS limits rows to verified cadre or manager areas.
export async function listTasks(
  page: number,
  limit: number,
  filters: TaskListFilters,
  userId: string,
) {
  const client = await createUserClient();
  let query = client
    .from("action_tasks")
    .select(taskColumns, { count: "exact" })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);
  if (filters.status) query = query.in("status", filters.status);
  if (filters.reportId) query = query.eq("report_id", filters.reportId);
  if (filters.areaId) query = query.eq("area_id", filters.areaId);
  if (filters.assignee === "me") query = query.eq("assigned_to", userId);
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
    .select(taskColumns)
    .eq("id", id)
    .maybeSingle<TaskRow>();
  if (task.error) throw new Error("TASK_DETAIL_UNAVAILABLE");
  if (!task.data) return null;
  const [events, evidence] = await Promise.all([
    client
      .from("task_events")
      .select("id,event_type,old_status,new_status,reason,created_at")
      .eq("task_id", id)
      .order("created_at")
      .overrideTypes<TaskEventRow[], { merge: false }>(),
    client
      .from("task_evidence")
      .select(
        "id,submitted_by,reviewed_by,storage_path,width,height,description,review_status,review_reason,created_at,reviewed_at",
      )
      .eq("task_id", id)
      .order("created_at")
      .overrideTypes<EvidenceRow[], { merge: false }>(),
  ]);
  if (events.error || evidence.error)
    throw new Error("TASK_DETAIL_UNAVAILABLE");
  const evidenceWithUrls = await Promise.all(
    (evidence.data ?? []).map(async (row) => {
      const signed = await client.storage
        .from(reportBucket)
        .createSignedUrl(row.storage_path, 60);
      if (signed.error || !signed.data)
        throw new Error("SIGNED_URL_UNAVAILABLE");
      return {
        id: row.id,
        description: row.description,
        reviewStatus: row.review_status,
        reviewReason: row.review_reason,
        createdAt: row.created_at,
        reviewedAt: row.reviewed_at,
        width: row.width,
        height: row.height,
        url: signed.data.signedUrl,
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
  };
}

export type TaskDetail = NonNullable<Awaited<ReturnType<typeof getTaskDetail>>>;
