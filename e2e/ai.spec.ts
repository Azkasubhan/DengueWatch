import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { chooseOption, selectedValue } from "./support/customSelect";

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

  // T29: selecting a photo uploads it and asks the AI to fill the form right away.
  async function openReport(
    page: Page,
    scenario?: "unavailable" | "slow" | "hang",
  ) {
    await login(page);
    if (scenario === "hang")
      // The analysis never answers while the test runs; the client aborts it on submit.
      await page.route("**/api/v1/ai/analyze-report", () => {});
    else if (scenario)
      await page.route("**/api/v1/ai/analyze-report", async (route) => {
        if (scenario === "slow")
          await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue({
          headers: {
            ...route.request().headers(),
            ...(scenario === "unavailable"
              ? { "x-ai-test-scenario": "unavailable" }
              : {}),
          },
        });
      });
    await page.goto("/app/laporan/buat");
    const areaId = await selectedValue(page, "areaId");
    await page.locator("#photos").setInputFiles(photo);
    return areaId;
  }

  // AI marks the category and description it filled until the resident edits them.
  const aiFilled = (page: Page) =>
    page.getByText(/^(Disarankan AI|Draf AI · dapat diedit)$/);
  const aiDescription =
    "Foto tampak menunjukkan wadah terbuka yang berisi air dan perlu diperiksa lebih lanjut.";

  async function submit(page: Page, description: string) {
    await expect(page.locator("#description")).toHaveValue(description);
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    await expect(page).toHaveURL(
      /\/app\/laporan\/[0-9a-f-]{36}\?status=terkirim$/,
    );
    await expect(
      page.getByText("Menunggu Pemeriksaan", { exact: true }),
    ).toBeVisible();
    return new URL(page.url()).pathname.split("/").at(-1)!;
  }

  test("E2E-A: AI fills category and description, resident edits, and submits through M3", async ({
    page,
  }) => {
    await openReport(page);
    await expect(
      page.getByText("AI mengisi draf kategori dan keterangan", {
        exact: false,
      }),
    ).toBeVisible();
    expect(await selectedValue(page, "category")).toBe("water_container");
    await expect(page.locator("#description")).toHaveValue(aiDescription);
    await expect(aiFilled(page)).toHaveCount(2);
    const description = `Foto menunjukkan wadah terbuka yang perlu diperiksa. Revisi warga ${randomUUID()}.`;
    await page.locator("#description").fill(description);
    await expect(aiFilled(page)).toHaveCount(1);
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
    // AI text the resident never saw or edited is not stored on the report.
    const report = await admin
      .from("reports")
      .select("visible_objects,prevention_advice")
      .eq("id", reportId)
      .single();
    expect(report.data).toEqual({
      visible_objects: null,
      prevention_advice: null,
    });
  });

  test("E2E-B: unavailable AI leaves category and description to the resident", async ({
    page,
  }) => {
    await openReport(page, "unavailable");
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "melanjutkan laporan secara manual" }),
    ).toBeVisible();
    await expect(page.locator("#description")).toHaveValue("");
    await expect(page.getByAltText("Pratinjau foto 1")).toBeVisible();
    // Category and description stay required on the manual path.
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    const summary = page.locator('[aria-labelledby="report-errors-title"]');
    await expect(
      summary.getByRole("link", { name: /Pilih kategori temuan/ }),
    ).toHaveAttribute("href", "#category");
    await expect(
      summary.getByRole("link", { name: /Ceritakan temuan Anda/ }),
    ).toHaveAttribute("href", "#description");
    const description = `Isian warga tetap ada setelah AI gagal ${randomUUID()}.`;
    await chooseOption(page.locator("#category"), "Temuan lain");
    await page.locator("#description").fill(description);
    await expect(aiFilled(page)).toHaveCount(0);
    await submit(page, description);
  });

  test("E2E-C: AI fills only empty fields and never overwrites the resident", async ({
    page,
  }) => {
    await openReport(page, "slow");
    await expect(
      page.getByText("AI sedang membaca foto pertama", { exact: false }),
    ).toBeVisible();
    const description = `Wadah perlu pemeriksaan manual ${randomUUID()}.`;
    await chooseOption(page.locator("#category"), "Temuan lain");
    await page.locator("#description").fill(description);
    await expect(
      page.getByText("Kolom yang sudah Anda isi tidak diubah.", {
        exact: false,
      }),
    ).toBeVisible();
    expect(await selectedValue(page, "category")).toBe("other");
    await expect(page.locator("#description")).toHaveValue(description);
    await expect(aiFilled(page)).toHaveCount(0);
    await submit(page, description);
  });

  test("a hanging analysis never blocks a manually completed report", async ({
    page,
  }) => {
    await openReport(page, "hang");
    await expect(
      page.getByText("AI sedang membaca foto pertama", { exact: false }),
    ).toBeVisible();
    const description = `Laporan manual saat AI belum menjawab ${randomUUID()}.`;
    await chooseOption(page.locator("#category"), "Temuan lain");
    await page.locator("#description").fill(description);
    await submit(page, description);
  });

  test("a replaced first photo refreshes unedited AI fields and keeps resident edits", async ({
    page,
  }) => {
    await openReport(page);
    await expect(aiFilled(page)).toHaveCount(2);
    await chooseOption(page.locator("#category"), "Temuan lain");
    await expect(aiFilled(page)).toHaveCount(1);
    const second =
      "Foto kedua menunjukkan ban bekas yang perlu diperiksa lebih lanjut.";
    await page.route("**/api/v1/ai/analyze-report", async (route) => {
      const response = await route.fetch();
      const json = await response.json();
      json.data.suggestion.draftDescription = second;
      await route.fulfill({ response, json });
    });
    await page.getByRole("button", { name: "Hapus foto 1" }).click();
    await page
      .locator("#photos")
      .setInputFiles(resolve("assets/demo-reports/discarded-tire.png"));
    await expect(page.locator("#description")).toHaveValue(second);
    expect(await selectedValue(page, "category")).toBe("other");
    await expect(aiFilled(page)).toHaveCount(1);
  });

  test("cancelled analysis can be retried without re-uploading the photo", async ({
    page,
  }) => {
    // Cancel while the analysis itself runs, after the photo upload finished.
    const analyzing = page.waitForRequest("**/api/v1/ai/analyze-report");
    await openReport(page, "slow");
    await analyzing;
    let uploads = 0;
    page.on("request", (request) => {
      if (
        request.method() === "POST" &&
        request.url().endsWith("/api/v1/report-uploads")
      )
        uploads += 1;
    });
    await page.getByRole("button", { name: "Batalkan analisis" }).click();
    await expect(page.getByText("Analisis AI dibatalkan.")).toBeVisible();
    await expect(page.locator("#description")).toHaveValue("");
    await page.getByRole("button", { name: "Analisis ulang" }).click();
    await expect(page.locator("#description")).toHaveValue(aiDescription);
    expect(await selectedValue(page, "category")).toBe("water_container");
    await expect(aiFilled(page)).toHaveCount(2);
    expect(uploads).toBe(0);
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

  test("E2E-E: responsive autofill, keyboard editing, reduced motion and axe", async ({
    page,
  }, testInfo) => {
    await openReport(page);
    await expect(aiFilled(page)).toHaveCount(2);
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
    await page.locator("#description").focus();
    await page.keyboard.press("End");
    await page.keyboard.type(" Ada ban bekas.");
    await expect(page.locator("#description")).toHaveValue(
      `${aiDescription} Ada ban bekas.`,
    );
    await expect(aiFilled(page)).toHaveCount(1);
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
    const areaId = await selectedValue(page, "areaId");
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
});
