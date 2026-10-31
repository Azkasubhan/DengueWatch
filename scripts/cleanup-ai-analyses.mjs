import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";

assert(
  process.env.ALLOW_AI_CLEANUP === "true",
  "Set ALLOW_AI_CLEANUP=true explicitly.",
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
assert(
  url && key && !/replace|placeholder/i.test(key),
  "Local Supabase configuration is incomplete.",
);
assert(
  ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  "AI cleanup is local-only.",
);

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
const old = await admin
  .from("ai_analyses")
  .select("id")
  .lt("created_at", cutoff)
  .limit(100);
assert.ifError(old.error);
const ids = (old.data ?? []).map((row) => row.id);
if (ids.length) {
  const deleted = await admin.from("ai_analyses").delete().in("id", ids);
  assert.ifError(deleted.error);
}
console.log(`AI analysis records cleaned: ${ids.length}`);
