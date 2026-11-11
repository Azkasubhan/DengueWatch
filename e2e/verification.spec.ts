import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { openOptions } from "./support/customSelect";

type Actor = {
  email: string;
  id: string;
  page: Page;
  context: BrowserContext;
};

test.describe("live manager verification (M5, T27)", () => {
  test.skip(
    process.env.RUN_LIVE_M5 !== "true",
    "Run the dedicated local M5 E2E script.",
  );
  test.describe.configure({ mode: "serial" });

  const run = randomUUID().slice(0, 8).toUpperCase();
  const password = `Dw-${randomUUID()}-Aa1!`;
  const samplePath = resolve("assets/demo-reports/water-container.png");
  let admin: SupabaseClient;
  let origin = "";
  let areaA = "";
  let areaB = "";
  const actors = {} as Record<
    "resident" | "managerA1" | "managerA2" | "managerB" | "cadreA",
    Actor
  >;
  const reports = {} as Record<
    "main" | "info" | "duplicate" | "race" | "uiRace",
    string
  >;

  async function createActor(
    key: string,
    role: "resident" | "cadre" | "manager",
    areaId: string,
  ) {
    const email = `m5.${key}.${run.toLowerCase()}@example.test`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: `M5 ${key} ${run}` },
    });
    expect(error).toBeNull();
    const id = data.user!.id;
    const profile = await admin.from("profiles").update({ role }).eq("id", id);
    expect(profile.error).toBeNull();
    const membership = await admin.from("area_memberships").insert({
      area_id: areaId,
      membership_type: role === "cadre" ? "assigned_cadre" : role,
      profile_id: id,
      verified_at: new Date().toISOString(),
    });
    expect(membership.error).toBeNull();
    return { email, id };
  }

  async function login(page: Page, email: string, landing: RegExp) {
    await page.goto("/login");
    await page.getByLabel("Email *", { exact: true }).fill(email);
    await page.getByLabel("Kata sandi *", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(landing);
  }

  async function createReport(
    description: string,
    withAi = false,
    useAiText = true,
  ) {
    const page = actors.resident.page;
    const upload = await page.request.post("/api/v1/report-uploads", {
      multipart: {
        photo: {
          name: "m5.png",
          mimeType: "image/png",
          buffer: await readFile(samplePath),
        },
      },
      headers: { Origin: origin },
    });
    expect(upload.status()).toBe(201);
    const uploadId = (await upload.json()).id as string;
    // T29: AI output fills the observation fields; the resident wrote the description.
    let visibleObjects = "Wadah terbuka berisi air";
    let preventionAdvice = "Tutup wadah dan kuras seminggu sekali.";
    if (withAi) {
      const ai = await page.request.post("/api/v1/ai/analyze-report", {
        headers: { Origin: origin, "Content-Type": "application/json" },
        data: { areaId: areaA, uploadId },
      });
      expect(ai.status()).toBe(200);
      const suggestion = (await ai.json()).data.suggestion;
      if (useAiText) {
        visibleObjects = suggestion.visibleObjects.join(", ");
        preventionAdvice = suggestion.suggestedPrecaution;
      }
    }
    const created = await page.request.post("/api/v1/reports", {
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        "Idempotency-Key": randomUUID(),
      },
      data: {
        areaId: areaA,
        category: "water_container",
        description,
        visibleObjects,
        preventionAdvice,
        imageUploadIds: [uploadId],
        location: {
          latitude: -6.2,
          longitude: 106.8,
          note: "Titik simulasi M5",
        },
      },
    });
    expect(created.status()).toBe(201);
    const body = await created.json();
    expect(body.data).toMatchObject({
      status: "pending_verification",
      publicReference: expect.stringMatching(/^DW-/),
    });
    return body.data.id as string;
  }

  function review(page: Page, id: string, data: Record<string, unknown>) {
    return page.request.post(`/api/v1/reports/${id}/review`, {
      headers: { Origin: origin, "Content-Type": "application/json" },
      data,
    });
  }

  async function events(reportId: string) {
    const result = await admin
      .from("report_events")
      .select("event_type,old_status,new_status,actor_id,reason")
      .eq("report_id", reportId)
      .order("created_at");
    expect(result.error).toBeNull();
    return result.data!;
  }

  async function state(reportId: string) {
    const result = await admin
      .from("reports")
      .select("status,version,duplicate_of_report_id")
      .eq("id", reportId)
      .single();
    expect(result.error).toBeNull();
    return result.data!;
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

  test.beforeAll(async ({ browser }, testInfo) => {
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
    origin = new URL(testInfo.project.use.baseURL!).origin;
    admin = createClient(url.toString(), process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const areas = await admin
      .from("areas")
      .insert([
        {
          code: `M5E2E-A-${run}`,
          name: `Wilayah Uji M5 A ${run}`,
          is_demo: true,
        },
        {
          code: `M5E2E-B-${run}`,
          name: `Wilayah Uji M5 B ${run}`,
          is_demo: true,
        },
      ])
      .select("id,code");
    expect(areas.error).toBeNull();
    areaA = areas.data!.find((area) => area.code.includes("-A-"))!.id;
    areaB = areas.data!.find((area) => area.code.includes("-B-"))!.id;
    const plan = [
      ["resident", "resident", areaA, /\/app\/beranda$/],
      ["managerA1", "manager", areaA, /\/pengelola\/ringkasan$/],
      ["managerA2", "manager", areaA, /\/pengelola\/ringkasan$/],
      ["managerB", "manager", areaB, /\/pengelola\/ringkasan$/],
      ["cadreA", "cadre", areaA, /\/kader\/ringkasan$/],
    ] as const;
    for (const [key, role, areaId, landing] of plan) {
      const user = await createActor(key, role, areaId);
      const context = await browser.newContext();
      const page = await context.newPage();
      await login(page, user.email, landing);
      actors[key] = { ...user, context, page };
    }
  });

  test.afterAll(async () => {
    await Promise.all(
      Object.values(actors).map((actor) => actor.context.close()),
    );
  });

  test("resident report appears in the area manager queue with AI suggestion", async ({}, testInfo) => {
    const description = `Wadah terbuka berisi air di balai simulasi ${run}.`;
    reports.main = await createReport(description, true);
    const page = actors.managerA1.page;
    await page.goto("/pengelola/ringkasan");
    await page
      .getByRole("navigation", { name: "Navigasi portal" })
      .getByRole("link", { name: "Antrean verifikasi" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Antrean verifikasi" }),
    ).toBeVisible();
    const item = page.getByRole("link").filter({ hasText: description });
    await expect(item).toBeVisible();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`queue-${width}.png`),
        fullPage: true,
      });
    }
    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(axe.violations).toEqual([]);

    await item.click();
    await expect(page).toHaveURL(
      new RegExp(`/pengelola/verifikasi/${reports.main}$`),
    );
    // T29: no separate AI panel; the report fields carry the AI-assisted values.
    await expect(page.getByText("Diisi dengan bantuan AI")).toBeVisible();
    await expect(page.getByText("tidak diubah warga")).toHaveCount(0);
    await expect(
      page.getByText("wadah air terbuka, air terlihat di dalam wadah", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Periksa dan kosongkan genangan jika aman dilakukan.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByAltText("Foto laporan 1")).toBeVisible();
    await expect(page.getByText("-6.20000, 106.80000")).toBeVisible();
    await expect(
      page.getByRole("link", { name: /Buka di Google Maps/ }),
    ).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=-6.2,106.8",
    );
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expectNoOverflow(page);
      await page.screenshot({
        path: testInfo.outputPath(`detail-${width}.png`),
        fullPage: true,
      });
    }
    // 200% zoom of a 1280 px window leaves a 640 CSS px viewport.
    await page.setViewportSize({ width: 640, height: 400 });
    await expectNoOverflow(page);
    const detailAxe = await new AxeBuilder({ page }).include("main").analyze();
    expect(detailAxe.violations).toEqual([]);
  });

  test("cross-area manager, resident, and area cadre cannot review or read private data", async () => {
    const id = reports.main;
    const managerB = actors.managerB.page;
    expect((await managerB.request.get(`/api/v1/reports/${id}`)).status()).toBe(
      404,
    );
    expect(
      (
        await managerB.request.get(`/api/v1/reports/${id}/ai-suggestions`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await review(managerB, id, { decision: "verify", expectedVersion: 1 })
      ).status(),
    ).toBe(404);
    const queue = await managerB.request.get("/api/v1/reports");
    expect(
      (await queue.json()).data.map((row: { id: string }) => row.id),
    ).not.toContain(id);
    await managerB.goto(`/pengelola/verifikasi/${id}`);
    await expect(managerB.getByText("Pemeriksaan laporan")).toHaveCount(0);

    const image = await admin
      .from("report_images")
      .select("storage_path")
      .eq("report_id", id)
      .single();
    expect(image.error).toBeNull();
    const outsider = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const signIn = await outsider.auth.signInWithPassword({
      email: actors.managerB.email,
      password,
    });
    expect(signIn.error).toBeNull();
    const signed = await outsider.storage
      .from("report-photos")
      .createSignedUrl(image.data!.storage_path, 60);
    expect(signed.data).toBeNull();
    const download = await outsider.storage
      .from("report-photos")
      .download(image.data!.storage_path);
    expect(download.data).toBeNull();
    const directAi = await outsider.from("ai_analyses").select("id");
    expect(directAi.data ?? []).toEqual([]);
    await outsider.auth.signOut();

    for (const key of ["resident", "cadreA"] as const) {
      const response = await review(actors[key].page, id, {
        decision: "verify",
        expectedVersion: 1,
      });
      expect(response.status()).toBe(403);
    }
    expect(
      (
        await actors.cadreA.page.request.get(
          `/api/v1/reports/${id}/ai-suggestions`,
        )
      ).status(),
    ).toBe(403);
    // T27: a cadre without a task on this report cannot read it at all.
    expect(
      (await actors.cadreA.page.request.get(`/api/v1/reports/${id}`)).status(),
    ).toBe(404);
    await actors.cadreA.page.goto("/pengelola/verifikasi");
    await expect(actors.cadreA.page).toHaveURL(/\/forbidden$/);
    expect(await state(id)).toMatchObject({
      status: "pending_verification",
      version: 1,
    });
  });

  test("keyboard manager verifies through the form and the audit trail updates", async () => {
    const page = actors.managerA1.page;
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pengelola/verifikasi/${reports.main}`);
    await page.getByRole("button", { name: "Simpan keputusan" }).click();
    await expect(page.getByText("Pilih salah satu keputusan.")).toBeVisible();
    const verify = page.getByRole("radio", { name: /Verifikasi/ });
    await expect(verify).toBeFocused();
    await page.keyboard.press("Space");
    await expect(verify).toBeChecked();
    await page.getByRole("button", { name: "Simpan keputusan" }).focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("Keputusan tersimpan")).toBeVisible();
    await expect(
      page.getByText("Terverifikasi", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText("Diverifikasi pengelola")).toBeVisible();
    expect(await state(reports.main)).toMatchObject({
      status: "verified",
      version: 2,
    });
    const audit = await events(reports.main);
    expect(audit.map((event) => event.event_type)).toEqual([
      "report_created",
      "report_verified",
    ]);
    expect(audit[1]).toMatchObject({
      actor_id: actors.managerA1.id,
      old_status: "pending_verification",
      new_status: "verified",
    });
  });

  test("illegal transition, stale version, and invalid input map to API errors", async () => {
    const page = actors.managerA2.page;
    const stale = await review(page, reports.main, {
      decision: "reject",
      reason: "Foto tidak menunjukkan genangan air.",
      expectedVersion: 1,
    });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error.code).toBe("STALE_VERSION");
    const illegal = await review(page, reports.main, {
      decision: "reject",
      reason: "Foto tidak menunjukkan genangan air.",
      expectedVersion: 2,
    });
    expect(illegal.status()).toBe(422);
    expect((await illegal.json()).error.code).toBe("INVALID_TRANSITION");
    for (const data of [
      { decision: "reject", expectedVersion: 2 },
      { decision: "verify", expectedVersion: "2" },
      { decision: "approve", expectedVersion: 2 },
      { decision: "verify", expectedVersion: 2, status: "resolved" },
    ]) {
      const invalid = await review(page, reports.main, data);
      expect(invalid.status()).toBe(422);
    }
    const crossOrigin = await page.request.post(
      `/api/v1/reports/${reports.main}/review`,
      {
        headers: {
          Origin: "https://evil.example",
          "Content-Type": "application/json",
        },
        data: { decision: "verify", expectedVersion: 2 },
      },
    );
    expect(crossOrigin.status()).toBe(403);
    expect((await events(reports.main)).length).toBe(2);
  });

  test("request information, resident answer, then rejection", async ({}, testInfo) => {
    reports.info = await createReport(
      `Ember terbuka di halaman simulasi ${run} perlu dicek.`,
    );
    const reviewer = actors.managerA1.page;
    await reviewer.goto(`/pengelola/verifikasi/${reports.info}`);
    await reviewer.getByRole("radio", { name: /Minta informasi/ }).check();
    await reviewer.locator("#reason").fill("pendek");
    await reviewer.getByRole("button", { name: "Simpan keputusan" }).click();
    await expect(reviewer.locator("#reason")).toBeFocused();
    await expect(
      reviewer.getByText("Tulis minimal 10 karakter."),
    ).toBeVisible();
    const askReason = "Mohon kirim keterangan apakah wadah masih berisi air.";
    await reviewer.locator("#reason").fill(askReason);
    await reviewer.getByRole("button", { name: "Simpan keputusan" }).click();
    await expect(reviewer.getByText("Keputusan tersimpan")).toBeVisible();
    expect(await state(reports.info)).toMatchObject({
      status: "needs_information",
      version: 2,
    });

    const resident = actors.resident.page;
    expect(
      (
        await resident.request.post(
          `/api/v1/reports/${reports.info}/add-information`,
          {
            headers: { Origin: origin, "Content-Type": "application/json" },
            data: { note: "Wadah masih berisi air hujan.", expectedVersion: 1 },
          },
        )
      ).status(),
    ).toBe(409);
    await resident.setViewportSize({ width: 390, height: 844 });
    await resident.goto(`/app/laporan/${reports.info}`);
    await expect(
      resident.getByRole("heading", {
        name: "Pengelola meminta informasi tambahan",
      }),
    ).toBeVisible();
    await expect(resident.getByText(askReason).first()).toBeVisible();
    await expectNoOverflow(resident);
    const residentAxe = await new AxeBuilder({ page: resident })
      .include("main")
      .analyze();
    expect(residentAxe.violations).toEqual([]);
    await resident.screenshot({
      path: testInfo.outputPath("resident-needs-information-390.png"),
      fullPage: true,
    });
    await resident.getByRole("button", { name: "Kirim informasi" }).click();
    await expect(resident.locator("#information-note")).toBeFocused();
    const note = "Wadah masih berisi air hujan dan belum ditutup.";
    await resident.locator("#information-note").fill(note);
    await resident.getByRole("button", { name: "Kirim informasi" }).click();
    await expect(
      resident.getByText("Informasi tambahan terkirim"),
    ).toBeVisible();
    await expect(
      resident.getByText("Menunggu Pemeriksaan", { exact: true }),
    ).toBeVisible();
    await expect(
      resident.getByText("Informasi tambahan dikirim"),
    ).toBeVisible();
    await expect(resident.getByText(note)).toBeVisible();
    expect(await state(reports.info)).toMatchObject({
      status: "pending_verification",
      version: 3,
    });

    await reviewer.goto(`/pengelola/verifikasi/${reports.info}`);
    await expect(reviewer.getByText(note)).toBeVisible();
    await reviewer.getByRole("radio", { name: /Tolak/ }).check();
    const rejectReason = "Wadah berada di dalam rumah, bukan area bersama.";
    await reviewer.locator("#reason").fill(rejectReason);
    await reviewer.getByRole("button", { name: "Simpan keputusan" }).click();
    await expect(reviewer.getByText("Keputusan tersimpan")).toBeVisible();
    expect(await state(reports.info)).toMatchObject({
      status: "rejected",
      version: 4,
    });
    const audit = await events(reports.info);
    expect(audit.map((event) => [event.event_type, event.actor_id])).toEqual([
      ["report_created", actors.resident.id],
      ["report_information_requested", actors.managerA1.id],
      ["report_information_added", actors.resident.id],
      ["report_rejected", actors.managerA1.id],
    ]);
    expect(audit[3]?.reason).toBe(rejectReason);

    await resident.goto(`/app/laporan/${reports.info}`);
    await expect(
      resident.getByText("Tidak Disetujui", { exact: true }),
    ).toBeVisible();
    await expect(resident.getByText(rejectReason)).toBeVisible();
  });

  test("duplicate references only an earlier canonical report in the area", async () => {
    reports.duplicate = await createReport(
      `Wadah yang sama di balai simulasi ${run} terlihat lagi.`,
    );
    const reviewer = actors.managerA1.page;
    const rejectedTarget = await review(reviewer, reports.duplicate, {
      decision: "duplicate",
      reason: "Objek sama dengan laporan sebelumnya.",
      expectedVersion: 1,
      duplicateOfReportId: reports.info,
    });
    expect(rejectedTarget.status()).toBe(422);
    await reviewer.goto(`/pengelola/verifikasi/${reports.duplicate}`);
    await reviewer.getByRole("radio", { name: /Tandai duplikat/ }).check();
    const target = reviewer.locator("#duplicateOfReportId");
    // CustomSelect options carry the public reference, not the report ID.
    const refs = await admin
      .from("reports")
      .select("id, public_reference")
      .in("id", [reports.main, reports.info]);
    expect(refs.error).toBeNull();
    const refOf = (id: string) =>
      `${refs.data!.find((row) => row.id === id)!.public_reference} ·`;
    const options = await openOptions(target);
    await expect(options.filter({ hasText: refOf(reports.main) })).toHaveCount(
      1,
    );
    await expect(options.filter({ hasText: refOf(reports.info) })).toHaveCount(
      0,
    );
    await options.filter({ hasText: refOf(reports.main) }).click();
    await reviewer
      .locator("#reason")
      .fill("Objek sama dengan laporan balai sebelumnya.");
    await reviewer.getByRole("button", { name: "Simpan keputusan" }).click();
    await expect(reviewer.getByText("Keputusan tersimpan")).toBeVisible();
    await expect(
      reviewer.getByRole("link", { name: "laporan rujukan" }),
    ).toHaveAttribute("href", `/pengelola/verifikasi/${reports.main}`);
    expect(await state(reports.duplicate)).toMatchObject({
      status: "duplicate",
      version: 2,
      duplicate_of_report_id: reports.main,
    });
  });

  test("AC-31: two manager sessions race with the same version", async () => {
    // Three rounds: each pair is sent concurrently from separate sessions.
    for (const round of [1, 2, 3]) {
      const id = await createReport(
        `Ban bekas berisi air di simulasi ${run} untuk uji paralel ${round}.`,
      );
      const [first, second] = await Promise.all([
        review(actors.managerA1.page, id, {
          decision: "verify",
          expectedVersion: 1,
        }),
        review(actors.managerA2.page, id, {
          decision: "reject",
          reason: "Foto tidak menunjukkan genangan air.",
          expectedVersion: 1,
        }),
      ]);
      expect([first.status(), second.status()].sort()).toEqual([200, 409]);
      const loser = first.status() === 409 ? first : second;
      expect((await loser.json()).error.code).toBe("STALE_VERSION");
      const audit = await events(id);
      expect(
        audit.filter((event) => event.event_type !== "report_created"),
      ).toHaveLength(1);
      const final = await state(id);
      expect(final.version).toBe(2);
      expect(["verified", "rejected"]).toContain(final.status);
      reports.race = id;
    }

    // The losing UI must offer a safe refresh rather than resubmitting.
    await actors.managerA2.page.goto(`/pengelola/verifikasi/${reports.race}`);
    await expect(
      actors.managerA2.page.getByRole("button", { name: "Simpan keputusan" }),
    ).toHaveCount(0);
  });

  test("UI conflict shows a refresh path when another manager decides first", async () => {
    reports.uiRace = await createReport(
      `Saluran tersumbat simulasi ${run} untuk uji konflik UI.`,
    );
    const page = actors.managerA2.page;
    await page.goto(`/pengelola/verifikasi/${reports.uiRace}`);
    await page.getByRole("radio", { name: /Verifikasi/ }).check();
    const won = await review(actors.managerA1.page, reports.uiRace, {
      decision: "verify",
      expectedVersion: 1,
    });
    expect(won.status()).toBe(200);
    await page.getByRole("button", { name: "Simpan keputusan" }).click();
    const alert = page.getByRole("alert").filter({
      hasText: "Laporan telah diperbarui",
    });
    await expect(alert).toBeVisible();
    await alert.getByRole("button", { name: "Muat data terbaru" }).click();
    await expect(page.getByText("Laporan sudah diverifikasi.")).toBeVisible();
    expect(
      (await events(reports.uiRace)).filter(
        (event) => event.event_type === "report_verified",
      ),
    ).toHaveLength(1);
  });

  test("resident M3 list and detail stay camelCase and private", async () => {
    const page = actors.resident.page;
    const list = await page.request.get("/api/v1/reports?limit=50");
    expect(list.status()).toBe(200);
    const rows = (await list.json()).data as Record<string, unknown>[];
    expect(rows.map((row) => row.id)).toContain(reports.main);
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(
        [
          "areaId",
          "category",
          "description",
          "id",
          "isDemo",
          "publicReference",
          "status",
          "submittedAt",
        ].sort(),
      );
    }
    const detail = await page.request.get(`/api/v1/reports/${reports.info}`);
    const json = (await detail.json()).data;
    expect(json).toMatchObject({ status: "rejected", version: 4 });
    expect(json.events[0]).toEqual(
      expect.objectContaining({ eventType: "report_created" }),
    );
    expect(JSON.stringify(json)).not.toMatch(
      /actor_id|actorId|reporter_id|storage_path/,
    );
    await page.goto("/app/laporan");
    await expect(
      page.getByRole("heading", { name: "Laporan saya" }),
    ).toBeVisible();
    await expect(page.getByText("Tidak Disetujui").first()).toBeVisible();
    const ownOnly = await actors.managerB.page.request.get(
      `/api/v1/reports?areaId=${areaA}`,
    );
    expect(ownOnly.status()).toBe(403);
  });

  test("an analysis the resident did not use shows no AI marker", async () => {
    const id = await createReport(
      `Isian warga sendiri tanpa teks AI ${run}.`,
      true,
      false,
    );
    const page = actors.managerA1.page;
    await page.goto(`/pengelola/verifikasi/${id}`);
    await expect(
      page.getByRole("heading", { name: "Pemeriksaan laporan" }),
    ).toBeVisible();
    await expect(page.getByText("Wadah terbuka berisi air")).toBeVisible();
    await expect(page.getByText("Diisi dengan bantuan AI")).toHaveCount(0);
  });
});
