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

async function signInActor(email) {
  const client = createClient(url, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const session = await client.auth.signInWithPassword({ email, password });
  assert.ifError(session.error);
  const id = session.data.user?.id;
  assert(id, `Seed user missing for ${email}`);
  return { client, id };
}

const resident = await signInActor("warga.simulasi@denguewatch.test");
const manager = await signInActor("pengelola.simulasi@denguewatch.test");
const cadre1 = await signInActor("kader.satu@denguewatch.test");
const cadre2 = await signInActor("kader.dua@denguewatch.test");

const areaResult = await admin
  .from("areas")
  .select("id")
  .eq("code", "DEMO-RW-01")
  .single();
assert.ifError(areaResult.error);
const areaId = areaResult.data.id;

async function createUpload(ownerId, file, purpose = null, taskId = null) {
  const source = await readFile(resolve("assets/demo-reports", file));
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
  const path = `${ownerId}/${uploadId}.webp`;

  const row = {
    id: uploadId,
    created_by: ownerId,
    storage_path: path,
    mime_type: "image/webp",
    byte_size: output.length,
    width: meta.width,
    height: meta.height,
    uploaded_at: new Date().toISOString(),
  };
  if (purpose) row.purpose = purpose;
  if (taskId) row.task_id = taskId;

  const reserved = await admin.from("report_uploads").insert(row);
  assert.ifError(reserved.error);

  const stored = await admin.storage
    .from("report-photos")
    .upload(path, output, { contentType: "image/webp", upsert: false });
  assert.ifError(stored.error);

  return { uploadId, path };
}

const samples = [
  {
    category: "water_container",
    file: "water-container.png",
    key: "demo-report-water-v2",
    description:
      "Drum air terbuka di samping balai warga tampak menampung air hujan dan berpotensi menjadi sarang jentik.",
    visibleObjects: "Drum plastik biru terbuka berisi genangan air hujan",
    preventionAdvice:
      "Kuras drum sampai kering dan pasang penutup rapat agar nyamuk tidak bertelur.",
    latitude: -6.2012,
    longitude: 106.8168,
    locationNote: "Samping Balai Warga RT 02 RW 01",
    stage: "pending_verification",
  },
  {
    category: "discarded_tire",
    file: "discarded-tire.png",
    key: "demo-report-tire-v2",
    description:
      "Tumpukan ban bekas di pojok lapangan parkir warga terisi air setelah hujan semalam.",
    visibleObjects: "Tiga ban bekas kendaraan menampung air di cekungan dalam",
    preventionAdvice:
      "Keringkan air di dalam ban, lubangi atau simpan di tempat beratap.",
    latitude: -6.2015,
    longitude: 106.8172,
    locationNote: "Pojok lahan parkir bersama RT 03",
    stage: "needs_information",
  },
  {
    category: "clogged_drain",
    file: "clogged-drain.png",
    key: "demo-report-drain-v2",
    description:
      "Saluran drainase depan pos ronda tersumbat guguran daun sehingga air menggenang lebih dari tiga hari.",
    visibleObjects: "Saluran air tersumbat serasah daun dan air tergenang",
    preventionAdvice:
      "Angkat sumbatan daun dan sampah agar aliran air kembali lancar.",
    latitude: -6.2024,
    longitude: 106.8181,
    locationNote: "Depan Pos Ronda RT 01 RW 01",
    stage: "verified_needs_task",
  },
  {
    category: "water_container",
    file: "water-container.png",
    key: "demo-report-garden-v2",
    description:
      "Bak penampungan air penyiram tanaman di taman warga tidak tertutup dan tampak ada jentik.",
    visibleObjects: "Bak penampungan terbuka di area taman bersama",
    preventionAdvice:
      "Kuras bak penyiram tanaman setiap pekan dan tambahkan penutup kasa.",
    latitude: -6.2014,
    longitude: 106.817,
    locationNote: "Taman Warga Harmoni Blok B",
    stage: "in_action_awaiting_review",
  },
  {
    category: "clogged_drain",
    file: "clogged-drain.png",
    key: "demo-report-alley-v2",
    description:
      "Genangan air pada saluran belakang mushola sudah menggenang sejak awal pekan.",
    visibleObjects: "Cekungan saluran belakang mushola berisi air keruh",
    preventionAdvice:
      "Bersihkan endapan lumpur agar tidak menjadi tempat perkembangbiakan nyamuk.",
    latitude: -6.2031,
    longitude: 106.8159,
    locationNote: "Saluran belakang Mushola Al-Ikhlas RT 04",
    stage: "resolved",
  },
  {
    category: "other",
    file: "discarded-tire.png",
    key: "demo-report-nocord-v2",
    description:
      "Kaleng cat dan ember bekas di dekat tempat sampah sementara menampung air hujan.",
    visibleObjects: "Ember dan kaleng bekas terbuka berisi air",
    preventionAdvice:
      "Balikkan wadah bekas atau angkut ke fasilitas daur ulang.",
    latitude: null,
    longitude: null,
    locationNote: "Dekat TPS Sementara Gang Melati",
    stage: "pending_verification",
  },
];

function jakartaDateOffset(daysOffset) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(Date.now() + daysOffset * 86_400_000));
}

for (const sample of samples) {
  const existing = await admin
    .from("reports")
    .select("id,status")
    .eq("reporter_id", resident.id)
    .eq("description", sample.description)
    .limit(1);
  assert.ifError(existing.error);
  let reportId = existing.data[0]?.id ?? null;
  if (existing.data[0] && existing.data[0].status !== "pending_verification") {
    continue;
  }

  let uploadId = null;
  let path = null;
  if (!reportId) {
    const uploaded = await createUpload(resident.id, sample.file);
    uploadId = uploaded.uploadId;
    path = uploaded.path;
  }
  try {
    if (!reportId) {
      const created = await resident.client.rpc("create_environmental_report", {
        p_area_id: areaId,
        p_category: sample.category,
        p_description: sample.description,
        p_visible_objects: sample.visibleObjects,
        p_prevention_advice: sample.preventionAdvice,
        p_latitude: sample.latitude,
        p_longitude: sample.longitude,
        p_location_note: sample.locationNote,
        p_upload_ids: [uploadId],
        p_idempotency_key: sample.key,
      });
      assert.ifError(created.error);
      reportId = created.data[0].id;
    }

    if (sample.stage === "needs_information") {
      const rev = await manager.client.rpc("review_report", {
        p_report_id: reportId,
        p_decision: "request_information",
        p_reason:
          "Mohon informasikan apakah tumpukan ban tersebut berada di area akses terbuka atau terkunci pagar.",
        p_duplicate_of_report_id: null,
        p_expected_version: 1,
      });
      assert.ifError(rev.error);
    } else if (sample.stage === "verified_needs_task") {
      const rev = await manager.client.rpc("review_report", {
        p_report_id: reportId,
        p_decision: "verify",
        p_reason:
          "Lokasi saluran berada di fasilitas umum RT 01, siap ditugaskan.",
        p_duplicate_of_report_id: null,
        p_expected_version: 1,
      });
      assert.ifError(rev.error);
    } else if (sample.stage === "in_action_awaiting_review") {
      const rev = await manager.client.rpc("review_report", {
        p_report_id: reportId,
        p_decision: "verify",
        p_reason: "Temuan bak taman terverifikasi.",
        p_duplicate_of_report_id: null,
        p_expected_version: 1,
      });
      assert.ifError(rev.error);

      const taskCreated = await manager.client.rpc("create_action_task", {
        p_report_id: reportId,
        p_title: "Kuras dan tutup bak air Taman Harmoni",
        p_description:
          "Kuras bak penampungan air di Taman Harmoni Blok B, sikat dinding bak, dan pasang penutup rapat.",
        p_assignees: [cadre1.id, cadre2.id],
        p_due_date: jakartaDateOffset(1),
        p_idempotency_key: `${sample.key}-task`,
      });
      assert.ifError(taskCreated.error);
      const taskId = taskCreated.data[0].task_id;

      const started = await cadre1.client.rpc("start_action_task", {
        p_task_id: taskId,
        p_expected_version: 1,
      });
      assert.ifError(started.error);

      const evUpload = await createUpload(
        cadre1.id,
        sample.file,
        "task_evidence",
        taskId,
      );
      const submitted = await cadre1.client.rpc("submit_task_evidence", {
        p_task_id: taskId,
        p_upload_id: evUpload.uploadId,
        p_description:
          "Bak air sisi utara sudah dikuras bersih dan disikat bersama warga.",
        p_expected_version: 2,
      });
      assert.ifError(submitted.error);
    } else if (sample.stage === "resolved") {
      const rev = await manager.client.rpc("review_report", {
        p_report_id: reportId,
        p_decision: "verify",
        p_reason: "Saluran belakang mushola perlu dibersihkan segera.",
        p_duplicate_of_report_id: null,
        p_expected_version: 1,
      });
      assert.ifError(rev.error);

      const taskCreated = await manager.client.rpc("create_action_task", {
        p_report_id: reportId,
        p_title: "Bersihkan saluran belakang Mushola Al-Ikhlas",
        p_description:
          "Angkat endapan lumpur dan sampah daun agar air mengalir lancar.",
        p_assignees: [cadre1.id],
        p_due_date: jakartaDateOffset(2),
        p_idempotency_key: `${sample.key}-task`,
      });
      assert.ifError(taskCreated.error);
      const taskId = taskCreated.data[0].task_id;

      const started = await cadre1.client.rpc("start_action_task", {
        p_task_id: taskId,
        p_expected_version: 1,
      });
      assert.ifError(started.error);

      const evUpload = await createUpload(
        cadre1.id,
        sample.file,
        "task_evidence",
        taskId,
      );
      const submitted = await cadre1.client.rpc("submit_task_evidence", {
        p_task_id: taskId,
        p_upload_id: evUpload.uploadId,
        p_description:
          "Saluran sudah dibersihkan seluruhnya dan tidak ada lagi genangan air.",
        p_expected_version: 2,
      });
      assert.ifError(submitted.error);

      const evRow = await admin
        .from("task_evidence")
        .select("id")
        .eq("task_id", taskId)
        .single();
      assert.ifError(evRow.error);

      const approved = await manager.client.rpc("review_task_evidence", {
        p_task_id: taskId,
        p_evidence_id: evRow.data.id,
        p_decision: "approve",
        p_reason: "Bukti foto jelas, saluran sudah bersih dan kering.",
        p_expected_version: 3,
      });
      assert.ifError(approved.error);
    }
  } catch (error) {
    if (path) await admin.storage.from("report-photos").remove([path]);
    if (uploadId)
      await admin.from("report_uploads").delete().eq("id", uploadId);
    throw error;
  }
}

console.info("Multi-stage demo environmental reports and tasks are ready.");
