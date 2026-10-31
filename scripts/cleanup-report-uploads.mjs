import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { assertCleanupTarget, dryRun } from "./cleanup-target.mjs";

assert(
  process.env.ALLOW_UPLOAD_CLEANUP === "true",
  "Set ALLOW_UPLOAD_CLEANUP=true explicitly.",
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
assert(url && key, "Storage environment is incomplete.");
assertCleanupTarget(url);
const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const onlyId = process.env.UPLOAD_CLEANUP_ID;
if (onlyId)
  assert(/^[0-9a-f-]{36}$/.test(onlyId), "UPLOAD_CLEANUP_ID must be a UUID.");
let query = admin
  .from("report_uploads")
  .select("id,storage_path")
  .is("consumed_at", null)
  .lt("expires_at", new Date().toISOString());
if (onlyId) query = query.eq("id", onlyId);
const expired = await query.order("expires_at").limit(100);
assert.ifError(expired.error);
if (dryRun) {
  console.info(`Dry run: ${expired.data?.length ?? 0} expired uploads found.`);
  process.exit(0);
}
let cleaned = 0;
for (const upload of expired.data ?? []) {
  const removed = await admin.storage
    .from("report-photos")
    .remove([upload.storage_path]);
  if (removed.error) continue;
  const deleted = await admin
    .from("report_uploads")
    .delete()
    .eq("id", upload.id)
    .is("consumed_at", null)
    .lt("expires_at", new Date().toISOString());
  if (!deleted.error) cleaned += 1;
}
console.info(`Expired unconsumed report uploads cleaned: ${cleaned}.`);
