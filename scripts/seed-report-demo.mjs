import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

assert(
  process.env.ALLOW_DEMO_SEED === "true",
  "Set ALLOW_DEMO_SEED=true explicitly.",
);
assert(
  process.env.NODE_ENV !== "production",
  "Demo seed is disabled in production.",
);
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const password = process.env.DEMO_ACCOUNT_PASSWORD;
assert(
  url && publicKey && secret && password,
  "Local environment is incomplete.",
);
assert(
  ["localhost", "127.0.0.1"].includes(new URL(url).hostname),
  "Report seed is local-only.",
);
assert(
  ![url, publicKey, secret, password].some((value) =>
    /replace|placeholder/i.test(value),
  ),
  "Environment contains placeholders.",
);

const admin = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const resident = createClient(url, publicKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const session = await resident.auth.signInWithPassword({
  email: "warga.simulasi@denguewatch.test",
  password,
});
assert.ifError(session.error);
const userId = session.data.user?.id;
assert(userId, "Seed resident is missing.");

const areaResult = await admin
  .from("areas")
  .select("id")
  .eq("code", "DEMO-RW-01")
  .single();
assert.ifError(areaResult.error);
const areaId = areaResult.data.id;

const samples = [
  {
    category: "water_container",
    file: "water-container.png",
    key: "demo-report-water-v1",
    description:
      "Wadah air terbuka terlihat di area bersama setelah hujan. Berpotensi menjadi sarang jentik nyamuk.",
  },
  {
    category: "discarded_tire",
    file: "discarded-tire.png",
    key: "demo-report-tire-v1",
    description:
      "Ban bekas berada di area bersama dan tampak menampung air hujan.",
  },
  {
    category: "clogged_drain",
    file: "clogged-drain.png",
    key: "demo-report-drain-v1",
    description:
      "Saluran umum terlihat tersumbat daun dan sampah kecil setelah hujan. Air menggenang dan tidak mengalir.",
  },
];

for (const sample of samples) {
  const existing = await admin
    .from("reports")
    .select("id")
    .eq("reporter_id", userId)
    .eq("description", sample.description)
    .limit(1);
  assert.ifError(existing.error);
  if (existing.data.length) continue;

  const source = await readFile(resolve("assets/demo-reports", sample.file));
  const output = await sharp(source, {
    failOn: "error",
    limitInputPixels: 24_000_000,
  })
    .rotate()
    .webp({ quality: 80 })
    .toBuffer();
  const meta = await sharp(output).metadata();
  assert(meta.width && meta.height && output.length <= 5 * 1024 * 1024);
  const uploadId = randomUUID();
  const path = `${userId}/${uploadId}.webp`;

  const reserved = await admin.from("report_uploads").insert({
    id: uploadId,
    created_by: userId,
    storage_path: path,
    mime_type: "image/webp",
    byte_size: output.length,
    width: meta.width,
    height: meta.height,
  });
  assert.ifError(reserved.error);
  try {
    const stored = await admin.storage
      .from("report-photos")
      .upload(path, output, { contentType: "image/webp", upsert: false });
    assert.ifError(stored.error);
    const marked = await admin
      .from("report_uploads")
      .update({ uploaded_at: new Date().toISOString() })
      .eq("id", uploadId);
    assert.ifError(marked.error);
    const created = await resident.rpc("create_environmental_report", {
      p_area_id: areaId,
      p_category: sample.category,
      p_description: sample.description,
      p_latitude: null,
      p_longitude: null,
      p_location_note: "Area umum fiktif",
      p_upload_ids: [uploadId],
      p_idempotency_key: sample.key,
    });
    assert.ifError(created.error);
  } catch (error) {
    await admin.storage.from("report-photos").remove([path]);
    await admin.from("report_uploads").delete().eq("id", uploadId);
    throw error;
  }
}

console.info("Three synthetic environmental reports are ready.");
