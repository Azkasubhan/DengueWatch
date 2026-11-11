import "server-only";

import type { createStorageAdmin } from "@/features/reports/data";
import { reportBucket } from "@/features/reports/data";

type Admin = ReturnType<typeof createStorageAdmin>;

const batchSize = 100;
const maxBatches = 5;
export const aiRetentionDays = 30;

export class CleanupError extends Error {}

// Expired, unconsumed upload leases (report photos and task evidence). Rows are deleted
// first and conditionally, so a lease consumed in the meantime is never touched; objects are
// removed only for rows that were actually deleted.
async function cleanExpiredUploads(admin: Admin, now: Date) {
  let rows = 0;
  let orphanedObjects = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const expired = await admin
      .from("report_uploads")
      .select("id")
      .is("consumed_at", null)
      .lt("expires_at", now.toISOString())
      .order("expires_at")
      .limit(batchSize);
    if (expired.error) throw new CleanupError("UPLOAD_QUERY_FAILED");
    const ids = (expired.data ?? []).map((row) => row.id as string);
    if (!ids.length) break;
    const deleted = await admin
      .from("report_uploads")
      .delete()
      .in("id", ids)
      .is("consumed_at", null)
      .lt("expires_at", now.toISOString())
      .select("storage_path");
    if (deleted.error) throw new CleanupError("UPLOAD_DELETE_FAILED");
    const paths = (deleted.data ?? []).map((row) => row.storage_path as string);
    rows += paths.length;
    if (paths.length) {
      const removed = await admin.storage.from(reportBucket).remove(paths);
      if (removed.error) orphanedObjects += paths.length;
    }
    if (ids.length < batchSize) break;
  }
  return { rows, orphanedObjects };
}

async function cleanOldAiAnalyses(admin: Admin, now: Date) {
  const cutoff = new Date(
    now.getTime() - aiRetentionDays * 24 * 60 * 60 * 1000,
  ).toISOString();
  let rows = 0;
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const old = await admin
      .from("ai_analyses")
      .select("id")
      .lt("created_at", cutoff)
      .limit(batchSize);
    if (old.error) throw new CleanupError("AI_QUERY_FAILED");
    const ids = (old.data ?? []).map((row) => row.id as string);
    if (!ids.length) break;
    const deleted = await admin.from("ai_analyses").delete().in("id", ids);
    if (deleted.error) throw new CleanupError("AI_DELETE_FAILED");
    rows += ids.length;
    if (ids.length < batchSize) break;
  }
  return { rows };
}

export async function runScheduledCleanup(admin: Admin, now = new Date()) {
  const uploads = await cleanExpiredUploads(admin, now);
  const aiAnalyses = await cleanOldAiAnalyses(admin, now);
  return { uploads, aiAnalyses };
}
