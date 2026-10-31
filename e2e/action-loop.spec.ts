import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import {
  expect,
  test,
  type APIResponse,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type ActorKey = "resident" | "cadreA1" | "cadreA2" | "cadreB" | "manager";
type Actor = { email: string; id: string; page: Page; context: BrowserContext };

test.describe("live verified ActionLoop (M6)", () => {
  test.skip(
    process.env.RUN_LIVE_M6 !== "true",
    "Run the dedicated local M6 E2E script.",
  );
  test.describe.configure({ mode: "serial" });

  const run = randomUUID().slice(0, 8).toUpperCase();
  const password = `Dw-${randomUUID()}-Aa1!`;
  const samplePath = resolve("assets/demo-reports/water-container.png");
  let admin: SupabaseClient;
  let origin = "";
  let areaA = "";
  let areaB = "";
  let sample: Buffer;
  const actors = {} as Record<ActorKey, Actor>;
  const ids = {} as Record<
    "main" | "task1" | "task2" | "lease" | "taskX" | "taskY",
    string
  >;

  async function login(page: Page, email: string, landing: RegExp) {
    await page.goto("/login");
    await page.getByLabel("Email *", { exact: true }).fill(email);
    await page.getByLabel("Kata sandi *", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(landing);
  }

  function post(
    page: Page,
    path: string,
    data: unknown,
    headers: Record<string, string> = {},
  ) {
    return page.request.post(path, {
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        ...headers,
      },
      data,
    });
  }

  function uploadEvidence(page: Page, taskId: string, buffer = sample) {
    return page.request.post(`/api/v1/tasks/${taskId}/evidence-uploads`, {
      headers: { Origin: origin },
      multipart: {
        photo: { name: "bukti.png", mimeType: "image/png", buffer },
      },
    });
  }

  async function createReport(description: string) {
    const page = actors.resident.page;
    const upload = await page.request.post("/api/v1/report-uploads", {
      headers: { Origin: origin },
      multipart: {
        photo: { name: "lapor.png", mimeType: "image/png", buffer: sample },
      },
    });
    expect(upload.status()).toBe(201);
    const created = await post(
      page,
      "/api/v1/reports",
      {
        areaId: areaA,
        category: "water_container",
        description,
        imageUploadIds: [(await upload.json()).id],
        location: null,
      },
      { "Idempotency-Key": randomUUID() },
    );
    expect(created.status()).toBe(201);
    const id = (await created.json()).data.id as string;
    const verified = await post(
      actors.cadreA1.page,
      `/api/v1/reports/${id}/review`,
      {
        decision: "verify",
        expectedVersion: 1,
      },
    );
    expect(verified.status()).toBe(200);
    return id;
  }

  async function createTask(key: ActorKey, reportId: string, title: string) {
    const response = await post(
      actors[key].page,
      `/api/v1/reports/${reportId}/tasks`,
      {
        title,
        description: `Tindak lanjut simulasi ${run} untuk ${title}.`,
        assignedTo: actors[key].id,
      },
      { "Idempotency-Key": randomUUID() },
    );
    expect(response.status()).toBe(201);
    return (await response.json()).data.id as string;
  }

  async function startAndSubmit(key: ActorKey, taskId: string) {
    const page = actors[key].page;
    expect(
      (
        await post(page, `/api/v1/tasks/${taskId}/start`, {
          expectedVersion: 1,
        })
      ).status(),
    ).toBe(200);
    const lease = await uploadEvidence(page, taskId);
    expect(lease.status()).toBe(201);
    const submitted = await post(page, `/api/v1/tasks/${taskId}/evidence`, {
      uploadId: (await lease.json()).data.id,
      description: "Tindakan selesai dilakukan sesuai foto bukti.",
      expectedVersion: 2,
    });
    expect(submitted.status()).toBe(200);
  }

  async function task(id: string) {
    const result = await admin
      .from("action_tasks")
      .select("status,version,completed_at")
      .eq("id", id)
      .single();
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function report(id: string) {
    const result = await admin
      .from("reports")
      .select("status,version,resolved_at")
      .eq("id", id)
      .single();
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function reportEvents(id: string) {
    const result = await admin
      .from("report_events")
      .select("event_type,reason")
      .eq("report_id", id)
      .order("created_at");
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function errorCode(response: APIResponse) {
    return (await response.json()).error.code as string;
  }

  async function expectNoOverflow(page: Page) {
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      )
      .toBe(true);
  }

  async function expectAccessible(page: Page) {
    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(axe.violations).toEqual([]);
  }

  test.beforeAll(async ({ browser }, testInfo) => {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
    origin = new URL(testInfo.project.use.baseURL!).origin;
    sample = await readFile(samplePath);
    admin = createClient(url.toString(), process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const areas = await admin
      .from("areas")
      .insert([
        {
          code: `M6E2E-A-${run}`,
          name: `Wilayah Uji M6 A ${run}`,
          is_demo: true,
        },
        {
          code: `M6E2E-B-${run}`,
          name: `Wilayah Uji M6 B ${run}`,
          is_demo: true,
        },
      ])
      .select("id,code");
    expect(areas.error).toBeNull();
    areaA = areas.data!.find((area) => area.code.includes("-A-"))!.id;
    areaB = areas.data!.find((area) => area.code.includes("-B-"))!.id;
    const plan: [ActorKey, "resident" | "cadre" | "manager", string, RegExp][] =
      [
        ["resident", "resident", areaA, /\/app\/beranda$/],
        ["cadreA1", "cadre", areaA, /\/kader\/ringkasan$/],
        ["cadreA2", "cadre", areaA, /\/kader\/ringkasan$/],
        ["cadreB", "cadre", areaB, /\/kader\/ringkasan$/],
        ["manager", "manager", areaA, /\/pengelola\/ringkasan$/],
      ];
    for (const [key, role, areaId, landing] of plan) {
      const email = `m6.${key.toLowerCase()}.${run.toLowerCase()}@example.test`;
      const created = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { display_name: `M6 ${key} ${run}` },
      });
      expect(created.error).toBeNull();
      const id = created.data.user!.id;
      expect(
        (await admin.from("profiles").update({ role }).eq("id", id)).error,
      ).toBeNull();
      const membership = await admin.from("area_memberships").insert({
        area_id: areaId,
        membership_type: role === "cadre" ? "assigned_cadre" : role,
        profile_id: id,
        verified_at: new Date().toISOString(),
      });
      expect(membership.error).toBeNull();
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, email, landing);
      actors[key] = { email, id, context, page };
    }
  });

  test.afterAll(async () => {
    await Promise.all(
      Object.values(actors).map((actor) => actor.context.close()),
    );
  });

  test("first task from the form moves report to in_action; idempotent second task", async ({}, testInfo) => {
    ids.main = await createReport(`Wadah terbuka di balai simulasi ${run}.`);
    const page = actors.cadreA1.page;
    await page.goto(`/kader/verifikasi/${ids.main}`);
    await expect(
      page.getByRole("heading", { name: "Tugas tindak lanjut", exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Buat tugas" }).click();
    await expect(page.locator("#task-title")).toBeFocused();
    await expect(page.getByText("Judul 5–140 karakter.")).toBeVisible();
    await page.locator("#task-title").fill("Kuras wadah balai");
    await page
      .locator("#task-description")
      .fill("Kuras dan tutup wadah air di balai warga.");
    await page.getByRole("button", { name: "Buat tugas" }).click();
    await expect(
      page.getByText("Tugas dibuat dan ditugaskan kepada Anda."),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Kuras wadah balai/ }),
    ).toBeVisible();
    await expect(
      page.getByText("Dalam Penanganan", { exact: true }).first(),
    ).toBeVisible();
    const rows = await admin
      .from("action_tasks")
      .select("id")
      .eq("report_id", ids.main);
    ids.task1 = rows.data![0]!.id;
    expect(await report(ids.main)).toMatchObject({
      status: "in_action",
      version: 3,
    });
    expect(
      (await reportEvents(ids.main)).map((event) => event.event_type),
    ).toEqual(["report_created", "report_verified", "report_action_started"]);
    await expectAccessible(page);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`report-tasks-${width}.png`),
        fullPage: true,
      });
    }

    // Second task while in_action, created by cadre A2 for themselves.
    const key = { "Idempotency-Key": `m6-e2e-${run}-task2` };
    const body = {
      title: "Bersihkan talang balai",
      description: "Bersihkan talang yang menampung air di balai.",
      assignedTo: actors.cadreA2.id,
    };
    const [first, retry] = await Promise.all([
      post(actors.cadreA2.page, `/api/v1/reports/${ids.main}/tasks`, body, key),
      post(actors.cadreA2.page, `/api/v1/reports/${ids.main}/tasks`, body, key),
    ]);
    expect([first.status(), retry.status()]).toEqual([201, 201]);
    ids.task2 = (await first.json()).data.id;
    expect((await retry.json()).data.id).toBe(ids.task2);
    const conflict = await post(
      actors.cadreA2.page,
      `/api/v1/reports/${ids.main}/tasks`,
      { ...body, title: "Judul lain dengan kunci sama" },
      key,
    );
    expect(conflict.status()).toBe(409);
    expect(await errorCode(conflict)).toBe("IDEMPOTENCY_CONFLICT");
    const count = await admin
      .from("action_tasks")
      .select("id", { count: "exact", head: true })
      .eq("report_id", ids.main);
    expect(count.count).toBe(2);
    expect(await report(ids.main)).toMatchObject({
      status: "in_action",
      version: 3,
    });
  });

  test("assignee starts, uploads private WebP evidence, and cannot self-approve", async ({}, testInfo) => {
    const page = actors.cadreA1.page;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/kader/tugas");
    await expect(
      page.getByRole("heading", { name: "Tugas", exact: true }),
    ).toBeVisible();
    await expectAccessible(page);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`tasks-${width}.png`),
        fullPage: true,
      });
    }
    await page.getByRole("link", { name: /Kuras wadah balai/ }).click();
    await expect(page).toHaveURL(new RegExp(`/kader/tugas/${ids.task1}$`));
    await page.getByRole("button", { name: "Mulai kerjakan" }).click();
    await expect(
      page.getByText("Sedang Dikerjakan", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Kirim bukti" }).click();
    await expect(page.locator("#evidence-photo")).toBeFocused();
    await page.locator("#evidence-photo").setInputFiles(samplePath);
    await page
      .locator("#description")
      .fill("Wadah sudah dikuras dan ditutup rapat.");
    await page.getByRole("button", { name: "Kirim bukti" }).click();
    await expect(
      page.getByText("Menunggu Pemeriksaan Bukti", { exact: true }),
    ).toBeVisible();
    await expect(page.getByAltText("Foto bukti 1")).toBeVisible();
    await expect(
      page.getByText("Bukti Anda menunggu pemeriksaan kader lain."),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Simpan pemeriksaan" }),
    ).toHaveCount(0);
    await expectAccessible(page);
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`task-detail-${width}.png`),
        fullPage: true,
      });
    }

    const evidence = await admin
      .from("task_evidence")
      .select("storage_path,upload_id,review_status")
      .eq("task_id", ids.task1)
      .single();
    expect(evidence.data?.review_status).toBe("pending");
    const lease = await admin
      .from("report_uploads")
      .select("purpose,task_id,consumed_at,mime_type")
      .eq("id", evidence.data!.upload_id)
      .single();
    expect(lease.data).toMatchObject({
      purpose: "task_evidence",
      task_id: ids.task1,
      mime_type: "image/webp",
    });
    expect(lease.data?.consumed_at).not.toBeNull();
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/report-photos/${evidence.data!.storage_path}`;
    expect((await page.request.get(publicUrl)).status()).not.toBe(200);
    const detail = await page.request.get(`/api/v1/tasks/${ids.task1}`);
    const signed = (await detail.json()).data.evidence[0].url as string;
    const photo = await page.request.get(signed);
    expect(photo.status()).toBe(200);
    expect(photo.headers()["content-type"]).toContain("image/webp");

    const self = await post(page, `/api/v1/tasks/${ids.task1}/review`, {
      decision: "approve",
      expectedVersion: 3,
    });
    expect(self.status()).toBe(403);
    expect(await errorCode(self)).toBe("SELF_REVIEW_FORBIDDEN");
  });

  test("different cadre requests revision, assignee resubmits, then approval", async () => {
    const reviewer = actors.cadreA2.page;
    await reviewer.goto(`/kader/tugas/${ids.task1}`);
    await reviewer.getByRole("radio", { name: /Minta perbaikan/ }).check();
    await reviewer.getByRole("button", { name: "Simpan pemeriksaan" }).click();
    await expect(reviewer.locator("#review-reason")).toBeFocused();
    await reviewer
      .locator("#review-reason")
      .fill("Foto belum memperlihatkan tutup wadah.");
    await reviewer.getByRole("button", { name: "Simpan pemeriksaan" }).click();
    await expect(
      reviewer.getByText("Sedang Dikerjakan", { exact: true }),
    ).toBeVisible();
    expect(await task(ids.task1)).toMatchObject({
      status: "in_progress",
      version: 4,
    });

    const assignee = actors.cadreA1.page;
    await assignee.goto(`/kader/tugas/${ids.task1}`);
    await expect(
      assignee.getByText("Foto belum memperlihatkan tutup wadah.").first(),
    ).toBeVisible();
    await assignee.locator("#evidence-photo").setInputFiles(samplePath);
    await assignee
      .locator("#description")
      .fill("Wadah sudah ditutup, foto dari dekat.");
    await assignee.getByRole("button", { name: "Kirim bukti" }).click();
    await expect(
      assignee.getByText("Menunggu Pemeriksaan Bukti", { exact: true }),
    ).toBeVisible();

    await reviewer.goto(`/kader/tugas/${ids.task1}`);
    await reviewer.getByRole("radio", { name: /Setujui bukti/ }).check();
    await reviewer.getByRole("button", { name: "Simpan pemeriksaan" }).click();
    await expect(
      reviewer.getByText("Bukti disetujui. Tugas selesai."),
    ).toBeVisible();
    expect(await task(ids.task1)).toMatchObject({
      status: "completed",
      version: 6,
    });
    expect((await task(ids.task1)).completed_at).not.toBeNull();
    const history = await admin
      .from("task_evidence")
      .select("review_status")
      .eq("task_id", ids.task1);
    expect(history.data!.map((row) => row.review_status).sort()).toEqual([
      "approved",
      "revision_required",
    ]);
    // Task 2 is still open, so the report must not close early.
    expect(await report(ids.main)).toMatchObject({
      status: "in_action",
      version: 3,
    });
  });

  test("last mandatory approval resolves; resident sees status without private data", async () => {
    await startAndSubmit("cadreA2", ids.task2);
    const approved = await post(
      actors.cadreA1.page,
      `/api/v1/tasks/${ids.task2}/review`,
      {
        decision: "approve",
        reason: "Talang terlihat bersih pada foto.",
        expectedVersion: 3,
      },
    );
    expect(approved.status()).toBe(200);
    expect((await approved.json()).data).toMatchObject({
      status: "completed",
      reportStatus: "resolved",
      reportVersion: 4,
    });
    expect((await report(ids.main)).resolved_at).not.toBeNull();

    const resident = actors.resident.page;
    await resident.setViewportSize({ width: 390, height: 844 });
    await resident.goto(`/app/laporan/${ids.main}`);
    await expect(resident.getByText("Selesai", { exact: true })).toBeVisible();
    await expect(resident.getByText("Penanganan dimulai")).toBeVisible();
    await expect(
      resident.getByText("Penanganan selesai diverifikasi"),
    ).toBeVisible();
    await expectNoOverflow(resident);
    await expectAccessible(resident);
    const json = await (
      await resident.request.get(`/api/v1/reports/${ids.main}`)
    ).text();
    const evidence = await admin.from("task_evidence").select("storage_path");
    for (const row of evidence.data ?? [])
      expect(json).not.toContain(row.storage_path);
    for (const key of ["cadreA1", "cadreA2"] as const)
      expect(json).not.toContain(actors[key].id);
    expect(json).not.toMatch(/taskId|evidence|actor/i);
    expect((await resident.request.get("/api/v1/tasks")).status()).toBe(403);
    expect(
      (await resident.request.get(`/api/v1/tasks/${ids.task1}`)).status(),
    ).toBe(403);
  });

  test("reopen and cancel follow T19 with audit trail", async () => {
    const page = actors.cadreA1.page;
    await page.goto(`/kader/tugas/${ids.task1}`);
    await page.getByRole("button", { name: "Buka kembali tugas" }).click();
    await page
      .getByRole("button", { name: "Buka kembali", exact: true })
      .click();
    await expect(page.locator("#close-reason")).toBeFocused();
    const reopenReason = "Wadah kembali terisi air setelah hujan.";
    await page.locator("#close-reason").fill(reopenReason);
    await page
      .getByRole("button", { name: "Buka kembali", exact: true })
      .click();
    await expect(
      page.getByText("Dibuka Kembali", { exact: true }),
    ).toBeVisible();
    expect(await report(ids.main)).toMatchObject({
      status: "in_action",
      resolved_at: null,
    });

    const resident = actors.resident.page;
    await resident.goto(`/app/laporan/${ids.main}`);
    await expect(
      resident.getByText("Dalam Penanganan", { exact: true }),
    ).toBeVisible();
    await expect(resident.getByText(reopenReason)).toBeVisible();

    const cancelCompleted = await post(
      page,
      `/api/v1/tasks/${ids.task2}/cancel`,
      {
        reason: "Membatalkan tugas yang sudah selesai.",
        expectedVersion: 4,
      },
    );
    expect(cancelCompleted.status()).toBe(422);
    expect(await errorCode(cancelCompleted)).toBe("INVALID_TRANSITION");

    await page.goto(`/kader/tugas/${ids.task1}`);
    await page.getByRole("button", { name: "Batalkan tugas" }).click();
    await page
      .locator("#close-reason")
      .fill("Wadah dipindahkan pengelola sehingga tugas tidak relevan.");
    await page.getByRole("button", { name: "Batalkan tugas" }).click();
    await expect(page.getByText("Dibatalkan", { exact: true })).toBeVisible();
    expect(await report(ids.main)).toMatchObject({ status: "resolved" });
    expect(
      (await reportEvents(ids.main)).map((event) => event.event_type),
    ).toEqual([
      "report_created",
      "report_verified",
      "report_action_started",
      "report_resolved",
      "report_reopened",
      "report_resolved",
    ]);
    const reopenCancelled = await post(
      page,
      `/api/v1/tasks/${ids.task1}/reopen`,
      {
        reason: "Membuka tugas yang sudah dibatalkan.",
        expectedVersion: 8,
      },
    );
    expect(reopenCancelled.status()).toBe(422);
    const onResolved = await post(
      page,
      `/api/v1/reports/${ids.main}/tasks`,
      {
        title: "Tugas pada laporan tuntas",
        description: "Tidak boleh dibuat langsung pada laporan tuntas.",
        assignedTo: actors.cadreA1.id,
      },
      { "Idempotency-Key": randomUUID() },
    );
    expect(onResolved.status()).toBe(422);
    expect(await errorCode(onResolved)).toBe("INVALID_TRANSITION");
  });

  test("evidence leases reject cross-task, cross-area, expired, used, and resident uploads", async () => {
    const reportId = await createReport(
      `Ban bekas simulasi ${run} untuk uji lease.`,
    );
    ids.taskX = await createTask("cadreA1", reportId, "Balik ban bekas");
    ids.taskY = await createTask("cadreA1", reportId, "Angkut ban bekas");
    const a1 = actors.cadreA1.page;
    for (const id of [ids.taskX, ids.taskY])
      expect(
        (
          await post(a1, `/api/v1/tasks/${id}/start`, { expectedVersion: 1 })
        ).status(),
      ).toBe(200);

    const fake = await uploadEvidence(a1, ids.taskX, Buffer.from("%PDF-1.7"));
    expect(fake.status()).toBeGreaterThanOrEqual(400);
    expect(await errorCode(fake)).toBe("INVALID_IMAGE");
    const notAssignee = await uploadEvidence(actors.cadreA2.page, ids.taskX);
    expect(notAssignee.status()).toBe(403);
    const crossArea = await uploadEvidence(actors.cadreB.page, ids.taskX);
    expect(crossArea.status()).toBe(404);
    expect(
      (await uploadEvidence(actors.manager.page, ids.taskX)).status(),
    ).toBe(403);
    expect(
      (await uploadEvidence(actors.resident.page, ids.taskX)).status(),
    ).toBe(403);

    const leaseX = (await (await uploadEvidence(a1, ids.taskX)).json()).data
      .id as string;
    const crossTask = await post(a1, `/api/v1/tasks/${ids.taskY}/evidence`, {
      uploadId: leaseX,
      description: "Mencoba memakai foto task lain.",
      expectedVersion: 2,
    });
    expect(crossTask.status()).toBe(409);
    expect(await errorCode(crossTask)).toBe("UPLOAD_UNAVAILABLE");

    const leaseY = (await (await uploadEvidence(a1, ids.taskY)).json()).data
      .id as string;
    await admin
      .from("report_uploads")
      .update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
      .eq("id", leaseY);
    const expired = await post(a1, `/api/v1/tasks/${ids.taskY}/evidence`, {
      uploadId: leaseY,
      description: "Mencoba memakai foto kedaluwarsa.",
      expectedVersion: 2,
    });
    expect(expired.status()).toBe(409);

    const residentUpload = await actors.resident.page.request.post(
      "/api/v1/report-uploads",
      {
        headers: { Origin: origin },
        multipart: {
          photo: { name: "warga.png", mimeType: "image/png", buffer: sample },
        },
      },
    );
    expect(residentUpload.status()).toBe(201);
    const residentLease = (await residentUpload.json()).id as string;
    const residentAsEvidence = await post(
      a1,
      `/api/v1/tasks/${ids.taskY}/evidence`,
      {
        uploadId: residentLease,
        description: "Mencoba memakai foto warga.",
        expectedVersion: 2,
      },
    );
    expect(residentAsEvidence.status()).toBe(409);
    const evidenceAsReport = await post(
      actors.resident.page,
      "/api/v1/reports",
      {
        areaId: areaA,
        category: "other",
        description: "Mencoba memakai foto bukti kader sebagai laporan.",
        imageUploadIds: [leaseX],
        location: null,
      },
      { "Idempotency-Key": randomUUID() },
    );
    expect(evidenceAsReport.status()).toBe(409);

    const used = await post(a1, `/api/v1/tasks/${ids.taskX}/evidence`, {
      uploadId: leaseX,
      description: "Ban sudah dibalik dan kering.",
      expectedVersion: 2,
    });
    expect(used.status()).toBe(200);
    const replay = await post(a1, `/api/v1/tasks/${ids.taskY}/evidence`, {
      uploadId: leaseX,
      description: "Mencoba memakai ulang foto.",
      expectedVersion: 2,
    });
    expect(replay.status()).toBe(409);
    const notInProgress = await uploadEvidence(a1, ids.taskX);
    expect(notInProgress.status()).toBe(422);
    ids.lease = leaseX;
  });

  test("manager, resident, and other-area cadre cannot mutate or read across scope", async () => {
    const manager = actors.manager.page;
    for (const [path, data] of [
      [`/api/v1/tasks/${ids.taskY}/start`, { expectedVersion: 2 }],
      [
        `/api/v1/tasks/${ids.taskX}/review`,
        { decision: "approve", expectedVersion: 3 },
      ],
      [
        `/api/v1/tasks/${ids.taskY}/cancel`,
        { reason: "Dibatalkan manager uji.", expectedVersion: 2 },
      ],
    ] as const) {
      expect((await post(manager, path, data)).status()).toBe(403);
      expect((await post(actors.resident.page, path, data)).status()).toBe(403);
    }
    const managerCreate = await post(
      manager,
      `/api/v1/reports/${ids.main}/tasks`,
      {
        title: "Tugas manager",
        description: "Manager tidak boleh membuat.",
        assignedTo: actors.manager.id,
      },
      { "Idempotency-Key": randomUUID() },
    );
    expect(managerCreate.status()).toBe(403);
    const list = await manager.request.get("/api/v1/tasks");
    expect(list.status()).toBe(200);
    expect(
      (await list.json()).data.map((row: { id: string }) => row.id),
    ).toContain(ids.task1);
    await manager.goto("/pengelola/tugas?status=all");
    await expect(
      manager.getByRole("heading", { name: "Tugas wilayah" }),
    ).toBeVisible();
    await expect(manager.getByText("Kuras wadah balai")).toBeVisible();
    await expect(
      manager.getByRole("link", { name: /Kuras wadah balai/ }),
    ).toHaveCount(0);
    await expectAccessible(manager);
    await manager.goto("/kader/tugas");
    await expect(manager).toHaveURL(/\/forbidden$/);

    const outsider = actors.cadreB.page;
    expect(
      (await outsider.request.get(`/api/v1/tasks/${ids.task1}`)).status(),
    ).toBe(404);
    const outsiderList = await outsider.request.get("/api/v1/tasks");
    expect((await outsiderList.json()).data).toEqual([]);
    const start = await post(outsider, `/api/v1/tasks/${ids.taskY}/start`, {
      expectedVersion: 2,
    });
    expect(start.status()).toBe(404);
    await outsider.goto(`/kader/tugas/${ids.task1}`);
    await expect(outsider.getByText("Kuras wadah balai")).toHaveCount(0);

    const evidence = await admin
      .from("task_evidence")
      .select("storage_path")
      .eq("task_id", ids.task1)
      .limit(1)
      .single();
    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    expect(
      (
        await client.auth.signInWithPassword({
          email: actors.cadreB.email,
          password,
        })
      ).error,
    ).toBeNull();
    const signed = await client.storage
      .from("report-photos")
      .createSignedUrl(evidence.data!.storage_path, 60);
    expect(signed.data).toBeNull();
    expect(
      (await client.from("task_evidence").select("id")).data ?? [],
    ).toEqual([]);
    await client.auth.signOut();
  });

  test("UI conflict on stale task shows a safe refresh path", async () => {
    const reviewer = actors.cadreA2.page;
    await reviewer.goto(`/kader/tugas/${ids.taskX}`);
    await expect(
      reviewer.getByRole("button", { name: "Simpan pemeriksaan" }),
    ).toBeVisible();
    const cancelled = await post(
      actors.cadreA1.page,
      `/api/v1/tasks/${ids.taskX}/cancel`,
      {
        reason: "Ban sudah diangkut petugas kebersihan.",
        expectedVersion: 3,
      },
    );
    expect(cancelled.status()).toBe(200);
    await reviewer.getByRole("button", { name: "Simpan pemeriksaan" }).click();
    const alert = reviewer
      .getByRole("alert")
      .filter({ hasText: "Tugas telah diperbarui" });
    await expect(alert).toBeVisible();
    await alert.getByRole("button", { name: "Muat data terbaru" }).click();
    await expect(
      reviewer.getByText("Dibatalkan", { exact: true }),
    ).toBeVisible();
    await expect(
      reviewer.getByRole("button", { name: "Simpan pemeriksaan" }),
    ).toHaveCount(0);
    const events = await admin
      .from("task_events")
      .select("event_type")
      .eq("task_id", ids.taskX)
      .eq("event_type", "task_evidence_approved");
    expect(events.data).toEqual([]);
  });

  test("parallel approvals on two mandatory tasks close the report exactly once", async () => {
    for (const round of [1, 2, 3]) {
      const reportId = await createReport(
        `Saluran simulasi ${run} paralel ${round}.`,
      );
      const taskA = await createTask(
        "cadreA1",
        reportId,
        `Tugas paralel A${round}`,
      );
      const taskB = await createTask(
        "cadreA2",
        reportId,
        `Tugas paralel B${round}`,
      );
      await startAndSubmit("cadreA1", taskA);
      await startAndSubmit("cadreA2", taskB);
      const [first, second] = await Promise.all([
        post(actors.cadreA2.page, `/api/v1/tasks/${taskA}/review`, {
          decision: "approve",
          expectedVersion: 3,
        }),
        post(actors.cadreA1.page, `/api/v1/tasks/${taskB}/review`, {
          decision: "approve",
          expectedVersion: 3,
        }),
      ]);
      expect([first.status(), second.status()]).toEqual([200, 200]);
      expect(await task(taskA)).toMatchObject({
        status: "completed",
        version: 4,
      });
      expect(await task(taskB)).toMatchObject({
        status: "completed",
        version: 4,
      });
      expect(await report(reportId)).toMatchObject({
        status: "resolved",
        version: 4,
      });
      const closures = (await reportEvents(reportId)).filter(
        (event) => event.event_type === "report_resolved",
      );
      expect(closures).toHaveLength(1);
      const approvals = await admin
        .from("task_events")
        .select("task_id")
        .in("task_id", [taskA, taskB])
        .eq("event_type", "task_evidence_approved");
      expect(approvals.data).toHaveLength(2);
    }
  });

  test("200% zoom-equivalent layout keeps task pages usable", async ({
    browser,
  }) => {
    // Chromium page zoom is not scriptable here; 640 CSS px at DPR 2 matches 1280 px at 200%.
    const context = await browser.newContext({
      viewport: { width: 640, height: 400 },
      deviceScaleFactor: 2,
      storageState: await actors.cadreA1.context.storageState(),
    });
    const page = await context.newPage();
    for (const path of [
      "/kader/tugas",
      `/kader/tugas/${ids.task1}`,
      `/kader/verifikasi/${ids.main}`,
    ]) {
      await page.goto(path);
      await expect(page.getByText("DATA SIMULASI").first()).toBeVisible();
      await expectNoOverflow(page);
    }
    await context.close();
  });
});
