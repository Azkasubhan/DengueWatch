import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";

test.describe("M4 deterministic AI with live local Auth, DB and Storage", () => {
  test.skip(
    process.env.RUN_M4_DETERMINISTIC !== "true",
    "Run pnpm test:e2e:ai with local Supabase.",
  );
  test.describe.configure({ mode: "serial" });

  const email = process.env.M4_TEST_EMAIL ?? "warga.simulasi@denguewatch.test";
  const password = process.env.DEMO_ACCOUNT_PASSWORD ?? "";
  const photo = resolve("assets/demo-reports/water-container.png");
  const origin = "http://localhost:3001";

  test.beforeAll(() => {
    expect(
      new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname,
    ).toMatch(/^(localhost|127\.0\.0\.1)$/);
    expect(password.length).toBeGreaterThan(8);
  });

  async function login(page: Page, account = email) {
    await page.goto("/login");
    await page.getByLabel("Email *", { exact: true }).fill(account);
    await page.getByLabel("Kata sandi *", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/\/app\/beranda$/);
  }

  async function openReport(page: Page) {
    await login(page);
    await page.goto("/app/laporan/buat");
    const areaId = await page.locator("#areaId").inputValue();
    await page.locator("#photos").setInputFiles(photo);
    await page.getByRole("button", { name: "Siapkan foto untuk AI" }).click();
    await expect(
      page.getByRole("button", { name: "Bantu dengan Gemini" }),
    ).toBeVisible();
    return areaId;
  }

  async function submit(page: Page, description: string) {
    await expect(page.locator("#description")).toHaveValue(description);
    await page.getByRole("button", { name: "Tinjau laporan" }).click();
    await expect(page.getByText(description, { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Konfirmasi dan kirim" }).click();
    await expect(page).toHaveURL(/\/app\/laporan\/[0-9a-f-]{36}$/);
    await expect(
      page.getByText("Menunggu Pemeriksaan", { exact: true }),
    ).toBeVisible();
    return page.url().split("/").at(-1)!;
  }

  test("E2E-A: review, confirm replacement, edit, and submit through M3", async ({
    page,
  }) => {
    await openReport(page);
    await page.locator("#category").selectOption("other");
    await page
      .locator("#description")
      .fill("Isian manual awal untuk laporan lingkungan ini.");
    await page.getByRole("button", { name: "Bantu dengan Gemini" }).click();
    await expect(
      page.getByRole("heading", { name: "Saran AI — perlu verifikasi" }),
    ).toBeVisible();
    await expect(page.locator("#description")).toHaveValue(
      "Isian manual awal untuk laporan lingkungan ini.",
    );
    await page
      .getByRole("button", { name: "Terapkan saran ke formulir" })
      .click();
    await expect(
      page.getByText("Ganti dengan saran AI?", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Ya, ganti isian" }).click();
    await expect(page.locator("#category")).toHaveValue("water_container");
    await expect(
      page.getByRole("button", { name: "Pulihkan isian sebelumnya" }),
    ).toBeVisible();
    const description = `Foto menunjukkan wadah terbuka yang perlu diperiksa. Revisi warga ${randomUUID()}.`;
    await page.locator("#description").fill(description);
    const reportId = await submit(page, description);
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const analysis = await admin
      .from("ai_analyses")
      .select("status,report_id,result_json")
      .eq("report_id", reportId)
      .single();
    expect(analysis.error).toBeNull();
    expect(analysis.data?.status).toBe("success");
    expect(analysis.data?.result_json).toHaveProperty(
      "requiresHumanVerification",
      true,
    );
  });

  test("E2E-B: unavailable AI keeps photo and manual submission", async ({
    page,
  }) => {
    await openReport(page);
    const description = `Isian warga tetap ada setelah AI gagal ${randomUUID()}.`;
    await page.locator("#category").selectOption("other");
    await page.locator("#description").fill(description);
    await page.route("**/api/v1/ai/analyze-report", (route) =>
      route.continue({
        headers: {
          ...route.request().headers(),
          "x-ai-test-scenario": "unavailable",
        },
      }),
    );
    await page.getByRole("button", { name: "Bantu dengan Gemini" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Analisis AI tidak tersedia" }),
    ).toBeVisible();
    await expect(page.locator("#description")).toHaveValue(description);
    await expect(page.getByAltText("Pratinjau foto 1")).toBeVisible();
    await submit(page, description);
  });

  test("E2E-C: ignored suggestion leaves manual content unchanged", async ({
    page,
  }) => {
    await openReport(page);
    const description = `Wadah perlu pemeriksaan manual ${randomUUID()}.`;
    await page.locator("#category").selectOption("other");
    await page.locator("#description").fill(description);
    await page.getByRole("button", { name: "Bantu dengan Gemini" }).click();
    await expect(
      page.getByRole("heading", { name: "Saran AI — perlu verifikasi" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Abaikan saran" }).click();
    await expect(page.locator("#description")).toHaveValue(description);
    await expect(page.locator("#category")).toHaveValue("other");
    await submit(page, description);
  });

  test("E2E-D: authenticated resident cannot analyze another resident's upload", async ({
    page,
    browser,
  }) => {
    const areaId = await openReport(page);
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const otherEmail = `m4-${randomUUID()}@denguewatch.test`;
    const created = await admin.auth.admin.createUser({
      email: otherEmail,
      password,
      email_confirm: true,
      user_metadata: { display_name: "Warga M4 Simulasi" },
    });
    expect(created.error).toBeNull();
    const otherId = created.data.user!.id;
    const member = await admin.from("area_memberships").insert({
      profile_id: otherId,
      area_id: areaId,
      membership_type: "resident",
      verified_at: new Date().toISOString(),
    });
    expect(member.error).toBeNull();
    const otherPage = await browser.newPage();
    try {
      await login(otherPage, otherEmail);
      const image = await readFile(photo);
      const upload = await otherPage.request.post("/api/v1/report-uploads", {
        headers: { Origin: origin },
        multipart: {
          photo: {
            name: "synthetic.png",
            mimeType: "image/png",
            buffer: image,
          },
        },
      });
      expect(upload.status()).toBe(201);
      const uploadId = (await upload.json()).id as string;
      const denied = await page.request.post("/api/v1/ai/analyze-report", {
        headers: { Origin: origin },
        data: { areaId, uploadId },
      });
      expect(denied.status()).toBe(404);
      const deleted = await otherPage.request.delete(
        `/api/v1/report-uploads/${uploadId}`,
        { headers: { Origin: origin } },
      );
      expect(deleted.status()).toBe(200);
    } finally {
      await otherPage.close();
      const removed = await admin.auth.admin.deleteUser(otherId);
      expect(removed.error).toBeNull();
    }
  });

  test("E2E-E: responsive suggestion, keyboard focus, reduced motion and axe", async ({
    page,
  }, testInfo) => {
    await openReport(page);
    await page.getByRole("button", { name: "Bantu dengan Gemini" }).click();
    await expect(
      page.getByRole("heading", { name: "Saran AI — perlu verifikasi" }),
    ).toBeVisible();
    await page.emulateMedia({ reducedMotion: "reduce" });
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              document.documentElement.scrollWidth <=
              document.documentElement.clientWidth,
          ),
        )
        .toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`ai-${width}.png`),
        fullPage: true,
      });
    }
    await page
      .getByRole("button", { name: "Terapkan saran ke formulir" })
      .focus();
    await expect(
      page.getByRole("button", { name: "Terapkan saran ke formulir" }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#category")).toHaveValue("water_container");
    const axe = await new AxeBuilder({ page }).include("main").analyze();
    expect(axe.violations).toEqual([]);
  });

  test("rejects anonymous, cadre, forged path, cross-area and expired photo requests", async ({
    page,
    request,
    browser,
  }) => {
    await login(page);
    await page.goto("/app/laporan/buat");
    const areaId = await page.locator("#areaId").inputValue();
    const image = await readFile(photo);
    const uploaded = await page.request.post("/api/v1/report-uploads", {
      headers: { Origin: origin },
      multipart: {
        photo: { name: "synthetic.png", mimeType: "image/png", buffer: image },
      },
    });
    expect(uploaded.status()).toBe(201);
    const uploadId = (await uploaded.json()).id as string;
    const headers = { Origin: origin };
    const anonymous = await request.post("/api/v1/ai/analyze-report", {
      headers,
      data: { areaId, uploadId },
    });
    expect(anonymous.status()).toBe(401);
    const forged = await page.request.post("/api/v1/ai/analyze-report", {
      headers,
      data: { areaId, uploadId, storagePath: "other/photo.webp" },
    });
    expect(forged.status()).toBe(422);
    const wrongArea = await page.request.post("/api/v1/ai/analyze-report", {
      headers,
      data: { areaId: randomUUID(), uploadId },
    });
    expect(wrongArea.status()).toBe(403);
    const missing = await page.request.post("/api/v1/ai/analyze-report", {
      headers,
      data: { areaId, uploadId: randomUUID() },
    });
    expect(missing.status()).toBe(404);
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const expired = await admin
      .from("report_uploads")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", uploadId);
    expect(expired.error).toBeNull();
    const deniedExpired = await page.request.post("/api/v1/ai/analyze-report", {
      headers,
      data: { areaId, uploadId },
    });
    expect(deniedExpired.status()).toBe(404);
    const cadrePage = await browser.newPage();
    try {
      await cadrePage.goto("/login");
      await cadrePage
        .getByLabel("Email *", { exact: true })
        .fill("kader.satu@denguewatch.test");
      await cadrePage
        .getByLabel("Kata sandi *", { exact: true })
        .fill(password);
      await cadrePage.getByRole("button", { name: "Masuk" }).click();
      await expect(cadrePage).toHaveURL(/\/kader\/ringkasan$/);
      const deniedCadre = await cadrePage.request.post(
        "/api/v1/ai/analyze-report",
        { headers, data: { areaId, uploadId } },
      );
      expect(deniedCadre.status()).toBe(403);
    } finally {
      await cadrePage.close();
      await page.request.delete(`/api/v1/report-uploads/${uploadId}`, {
        headers,
      });
    }
  });

  test("stale AI response cannot replace a newer manual edit", async ({
    page,
  }) => {
    await openReport(page);
    await page.route("**/api/v1/ai/analyze-report", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });
    await page.getByRole("button", { name: "Bantu dengan Gemini" }).click();
    const description = `Isian baru setelah permintaan AI ${randomUUID()}.`;
    await page.locator("#description").fill(description);
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Isian berubah saat analisis berjalan" }),
    ).toBeVisible();
    await expect(page.locator("#description")).toHaveValue(description);
    await expect(
      page.getByRole("heading", { name: "Saran AI — perlu verifikasi" }),
    ).toHaveCount(0);
  });
});
