import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { chooseOption, selectedValue } from "./support/customSelect";
import { createClient } from "@supabase/supabase-js";

test.describe("live environmental reports", () => {
  test.skip(
    process.env.RUN_LIVE_REPORTS !== "true",
    "Run the dedicated local reports E2E script.",
  );
  test.describe.configure({ mode: "serial" });

  const email = process.env.M3_TEST_EMAIL ?? "warga.simulasi@denguewatch.test";
  const password = process.env.DEMO_ACCOUNT_PASSWORD ?? "";
  const samplePath = resolve("assets/demo-reports/water-container.png");
  let createdReportId = "";
  let reportAreaId = "";

  async function login(page: Page) {
    // T29: photo selection starts AI analysis. This suite covers the manual path;
    // AI autofill is covered by test:e2e:ai with the deterministic adapter.
    await page.route("**/api/v1/ai/analyze-report", (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: {
            code: "AI_UNAVAILABLE",
            message: "Analisis AI tidak tersedia.",
          },
        }),
      }),
    );
    await page.goto("/login");
    await page.getByLabel("Email *", { exact: true }).fill(email);
    await page.getByLabel("Kata sandi *", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Masuk" }).click();
    await expect(page).toHaveURL(/\/app\/beranda$/);
  }

  // Waits for the AI step to settle, then fills the T29 fields by hand.
  test.beforeAll(() => {
    expect(password.length).toBeGreaterThan(8);
    const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    expect(["localhost", "127.0.0.1"]).toContain(url.hostname);
  });

  test("mobile resident submits a photo and sees persistent timeline", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await login(page);
    await page.getByRole("link", { name: "Buat laporan" }).click();
    await expect(
      page.getByRole("heading", { name: "Buat laporan lingkungan" }),
    ).toBeVisible();
    reportAreaId = await selectedValue(page, "areaId");
    await page.locator("#photos").setInputFiles(samplePath);
    await expect(page.getByAltText("Pratinjau foto 1")).toBeVisible();
    await chooseOption(page.locator("#category"), "Wadah air terbuka");
    const description = `Wadah air terlihat di area bersama. Uji laporan ${randomUUID()}.`;
    await page.locator("#description").fill(description);
    await page.screenshot({
      path: testInfo.outputPath("report-form-mobile.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    await expect(page).toHaveURL(
      /\/app\/laporan\/[0-9a-f-]{36}\?status=terkirim$/,
    );
    createdReportId = new URL(page.url()).pathname.split("/").at(-1)!;
    await expect(
      page.getByText("Menunggu Pemeriksaan", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(description)).toBeVisible();
    await expect(page.getByText("Laporan dikirim")).toBeVisible();
    await expect(page.getByAltText("Foto laporan 1")).toBeVisible();
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
      path: testInfo.outputPath("report-detail-mobile.png"),
      fullPage: true,
    });
    await page.reload();
    await expect(page.getByText("Laporan dikirim")).toBeVisible();
    await page.goto("/app/laporan");
    await expect(
      page.getByRole("heading", { name: "Laporan saya" }),
    ).toBeVisible();
    // The list shows a truncated line with the full text in its title (plus an sr-only copy).
    await expect(page.getByTitle(description)).toBeVisible();
  });

  test("form validation keeps input and file API rejects disguised files", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/app/laporan/buat");
    await page.locator("#description").fill("Pendek");
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    await expect(page.locator("#photos-error")).toBeVisible();
    await expect(page.locator("#description")).toHaveValue("Pendek");
    await page.locator("#photos").setInputFiles({
      name: "fake.png",
      mimeType: "image/png",
      buffer: Buffer.from("%PDF-1.7 disguised as a PNG photo"),
    });
    await chooseOption(page.locator("#category"), "Temuan lain");
    await page
      .locator("#description")
      .fill("Temuan lain pada area bersama yang perlu diperiksa.");
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    // The server rejects the disguised file; the form keeps every input.
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Isian dan foto Anda tetap tersimpan" })
        .filter({ hasText: "Gunakan foto JPG" }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/app\/laporan\/buat$/);
    await expect(page.locator("#description")).toHaveValue(
      "Temuan lain pada area bersama yang perlu diperiksa.",
    );
  });

  test("validation summary receives focus and photo selection can be repeated", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 320, height: 900 });
    await login(page);
    await page.goto("/app/laporan/buat");
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    const summary = page.locator('[aria-labelledby="report-errors-title"]');
    await expect(summary).toBeFocused();
    await expect(
      summary.getByRole("link", { name: "Tambahkan minimal satu foto." }),
    ).toHaveAttribute("href", "#photos");
    await page.keyboard.press("Tab");
    await expect(
      summary.getByRole("link", { name: "Tambahkan minimal satu foto." }),
    ).toBeFocused();
    await expect(page.locator("#category")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    // The help text stays referenced next to the error message.
    await expect(page.locator("#category")).toHaveAttribute(
      "aria-describedby",
      "category-help category-error",
    );
    await page.screenshot({
      path: testInfo.outputPath("ui-errors-320.png"),
      fullPage: true,
    });
    await expect(page.getByText("Pilih foto", { exact: true })).toBeVisible();
    await page.locator("#photos").setInputFiles(samplePath);
    await expect(page.locator("#photos-selected")).toHaveText(
      "1/3 foto dipilih",
    );
    await page.getByRole("button", { name: "Hapus foto 1" }).click();
    const chooserReady = page.waitForEvent("filechooser");
    await page.getByText("Pilih foto", { exact: true }).click();
    await (await chooserReady).setFiles(samplePath);
    await expect(page.getByAltText("Pratinjau foto 1")).toBeVisible();
    await page.goto("/app/laporan/buat");
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press("Tab");
      if (
        await page
          .locator("#photos")
          .evaluate((input) => document.activeElement === input)
      )
        break;
    }
    await expect(page.locator("#photos")).toBeFocused();
    expect(
      await page
        .locator("#photos")
        .evaluate((input) => input.matches(":focus-visible")),
    ).toBe(true);
    // The label's `transition` animates outline-color, so wait for it to settle.
    await expect
      .poll(() =>
        page
          .locator('label[for="photos"]')
          .evaluate((label) => getComputedStyle(label).outlineColor),
      )
      .toBe("rgb(15, 118, 110)");
  });

  test("upload retry resumes after the first successful photo", async ({
    page,
  }) => {
    await login(page);
    await page.goto("/app/laporan/buat");
    await page
      .locator("#photos")
      .setInputFiles([
        samplePath,
        resolve("assets/demo-reports/discarded-tire.png"),
      ]);
    await chooseOption(page.locator("#category"), "Temuan lain");
    await page
      .locator("#description")
      .fill(
        `Dua foto lingkungan untuk uji pemulihan unggahan ${randomUUID()}.`,
      );
    // The AI step already uploaded the first photo privately before failing.
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Analisis AI tidak tersedia." }),
    ).toBeVisible();
    let uploads = 0;
    await page.route("**/api/v1/report-uploads", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      uploads += 1;
      if (uploads === 1) {
        await route.fulfill({
          status: 503,
          contentType: "application/json",
          body: JSON.stringify({ error: { message: "Unggahan kedua gagal." } }),
        });
      } else {
        await route.continue();
      }
    });
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    await expect(
      page.getByRole("alert").filter({ hasText: "Unggahan kedua gagal." }),
    ).toBeVisible();
    await expect(
      page.getByText("Isian dan foto Anda tetap tersimpan", { exact: false }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    await expect(page).toHaveURL(
      /\/app\/laporan\/[0-9a-f-]{36}\?status=terkirim$/,
    );
    await expect(page.getByAltText("Foto laporan 2")).toBeVisible();
    expect(uploads).toBe(2);
  });

  test("owner can remove an unconsumed upload without leaving an object", async ({
    page,
  }) => {
    await login(page);
    const origin = new URL(test.info().project.use.baseURL!).origin;
    const image = await readFile(samplePath);
    const upload = await page.request.post("/api/v1/report-uploads", {
      multipart: {
        photo: { name: "temporary.png", mimeType: "image/png", buffer: image },
      },
      headers: { Origin: origin },
    });
    expect(upload.status()).toBe(201);
    const id = (await upload.json()).id as string;
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const before = await admin
      .from("report_uploads")
      .select("storage_path")
      .eq("id", id)
      .single();
    expect(before.error).toBeNull();
    const deleted = await page.request.delete(`/api/v1/report-uploads/${id}`, {
      headers: { Origin: origin },
    });
    expect(deleted.status()).toBe(200);
    const after = await admin
      .from("report_uploads")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    expect(after.data).toBeNull();
    const object = await admin.storage
      .from("report-photos")
      .download(before.data!.storage_path);
    expect(object.error).not.toBeNull();
  });

  test("expired unconsumed upload is removed by guarded cleanup", async ({
    page,
  }) => {
    await login(page);
    const origin = new URL(test.info().project.use.baseURL!).origin;
    const image = await readFile(samplePath);
    const upload = await page.request.post("/api/v1/report-uploads", {
      multipart: {
        photo: { name: "expired.png", mimeType: "image/png", buffer: image },
      },
      headers: { Origin: origin },
    });
    expect(upload.status()).toBe(201);
    const id = (await upload.json()).id as string;
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      {
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const row = await admin
      .from("report_uploads")
      .select("storage_path")
      .eq("id", id)
      .single();
    expect(row.error).toBeNull();
    const expired = await admin
      .from("report_uploads")
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq("id", id);
    expect(expired.error).toBeNull();
    const output = execFileSync(
      "node",
      ["--env-file=.env.local", "scripts/cleanup-report-uploads.mjs"],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          ALLOW_UPLOAD_CLEANUP: "true",
          UPLOAD_CLEANUP_ID: id,
        },
        encoding: "utf8",
      },
    );
    expect(output).toContain("cleaned: 1");
    const after = await admin
      .from("report_uploads")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    expect(after.data).toBeNull();
    const object = await admin.storage
      .from("report-photos")
      .download(row.data!.storage_path);
    expect(object.error).not.toBeNull();
  });

  test("API returns scoped validation and authentication errors", async ({
    page,
    request,
  }) => {
    const origin = new URL(test.info().project.use.baseURL!).origin;
    const base = {
      areaId: randomUUID(),
      category: "other",
      description: "Temuan di area bersama perlu pemeriksaan lebih lanjut.",
      visibleObjects: "Wadah terbuka berisi air",
      preventionAdvice: "Tutup wadah dan kuras seminggu sekali.",
      imageUploadIds: [randomUUID()],
      location: null,
    };
    const headers = { Origin: origin, "Idempotency-Key": randomUUID() };
    const anonymous = await request.post("/api/v1/reports", {
      headers,
      data: base,
    });
    expect(anonymous.status()).toBe(401);
    const hidden = await request.get(`/api/v1/reports/${randomUUID()}`);
    expect(hidden.status()).toBe(401);
    await login(page);
    const wrongArea = await page.request.post("/api/v1/reports", {
      headers,
      data: { ...base, areaId: randomUUID() },
    });
    expect(wrongArea.status()).toBe(403);
    const noPhoto = await page.request.post("/api/v1/reports", {
      headers,
      data: { ...base, imageUploadIds: [] },
    });
    expect(noPhoto.status()).toBe(422);
    const wrongType = await page.request.post("/api/v1/reports", {
      headers: { ...headers, "Content-Type": "text/plain" },
      data: "plain text",
    });
    expect(wrongType.status()).toBe(415);
    const malformed = await page.request.post("/api/v1/reports", {
      headers: { ...headers, "Content-Type": "application/json" },
      data: Buffer.from("{"),
    });
    expect(malformed.status()).toBe(400);
    const tooLarge = await page.request.post("/api/v1/report-uploads", {
      headers: { Origin: origin },
      multipart: {
        photo: {
          name: "huge.png",
          mimeType: "image/png",
          buffer: Buffer.alloc(6 * 1024 * 1024 + 1),
        },
      },
    });
    expect(tooLarge.status()).toBe(413);
  });

  test("API enforces idempotency, pagination, and private image access", async ({
    page,
  }) => {
    await login(page);
    const image = await readFile(samplePath);
    const origin = new URL(test.info().project.use.baseURL!).origin;
    const upload = await page.request.post("/api/v1/report-uploads", {
      multipart: {
        photo: { name: "sample.png", mimeType: "image/png", buffer: image },
      },
      headers: { Origin: origin },
    });
    expect(upload.status()).toBe(201);
    const uploadId = (await upload.json()).id as string;
    const key = randomUUID();
    const body = {
      areaId: reportAreaId,
      category: "water_container",
      description: `Foto simulasi untuk uji idempotensi ${randomUUID()}.`,
      visibleObjects: "Wadah terbuka berisi air",
      preventionAdvice: "Tutup wadah dan kuras seminggu sekali.",
      imageUploadIds: [uploadId],
      location: null,
    };
    const headers = {
      Origin: origin,
      "Content-Type": "application/json",
      "Idempotency-Key": key,
    };
    const responses = await Promise.all([
      page.request.post("/api/v1/reports", { headers, data: body }),
      page.request.post("/api/v1/reports", { headers, data: body }),
    ]);
    expect(responses.map((response) => response.status())).toEqual([201, 201]);
    const ids = await Promise.all(
      responses.map(async (response) => (await response.json()).data.id),
    );
    expect(new Set(ids).size).toBe(1);
    const conflict = await page.request.post("/api/v1/reports", {
      headers,
      data: { ...body, description: `${body.description} changed` },
    });
    expect(conflict.status()).toBe(409);
    const list = await page.request.get("/api/v1/reports?page=1&limit=2");
    expect(list.status()).toBe(200);
    const pageData = await list.json();
    expect(pageData.data).toHaveLength(2);
    expect(pageData.pagination.total).toBeGreaterThanOrEqual(2);
    const detail = await page.request.get(`/api/v1/reports/${ids[0]}`);
    expect(detail.status()).toBe(200);
    const json = await detail.json();
    expect(json.data.images).toHaveLength(1);
    expect(json.data.events[0].eventType).toBe("report_created");
    const signedImage = await page.request.get(json.data.images[0].url);
    expect(signedImage.status()).toBe(200);
    expect(signedImage.headers()["content-type"]).toContain("image/webp");
  });

  test("a second resident cannot read another resident's report or photo", async ({
    page,
  }) => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const outsiderEmail = `m3.security.${randomUUID()}@example.test`;
    const outsiderPassword = `Dw-${randomUUID()}-Aa1!`;
    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email: outsiderEmail,
        password: outsiderPassword,
        email_confirm: true,
        user_metadata: { display_name: "Warga Keamanan M3" },
      });
    expect(createError).toBeNull();
    const outsiderId = created.user!.id;
    try {
      const membership = await admin.from("area_memberships").insert({
        area_id: reportAreaId,
        membership_type: "resident",
        profile_id: outsiderId,
        verified_at: new Date().toISOString(),
      });
      expect(membership.error).toBeNull();
      const photo = await admin
        .from("report_images")
        .select("storage_path")
        .eq("report_id", createdReportId)
        .single();
      expect(photo.error).toBeNull();

      await page.goto("/login");
      await page.getByLabel("Email *", { exact: true }).fill(outsiderEmail);
      await page
        .getByLabel("Kata sandi *", { exact: true })
        .fill(outsiderPassword);
      await page.getByRole("button", { name: "Masuk" }).click();
      await expect(page).toHaveURL(/\/app\/beranda$/);
      const hidden = await page.request.get(
        `/api/v1/reports/${createdReportId}`,
      );
      expect(hidden.status()).toBe(404);
      const list = await page.request.get("/api/v1/reports");
      expect(list.status()).toBe(200);
      expect(
        (await list.json()).data.map((row: { id: string }) => row.id),
      ).not.toContain(createdReportId);
      const outsider = createClient(
        url,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          auth: { persistSession: false, autoRefreshToken: false },
        },
      );
      const signedIn = await outsider.auth.signInWithPassword({
        email: outsiderEmail,
        password: outsiderPassword,
      });
      expect(signedIn.error).toBeNull();
      const signed = await outsider.storage
        .from("report-photos")
        .createSignedUrl(photo.data!.storage_path, 60);
      expect(signed.error).not.toBeNull();
      const downloaded = await outsider.storage
        .from("report-photos")
        .download(photo.data!.storage_path);
      expect(downloaded.error).not.toBeNull();
      await page.goto(`/app/laporan/${createdReportId}`);
      await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
    } finally {
      const deleted = await admin.auth.admin.deleteUser(outsiderId);
      expect(deleted.error).toBeNull();
    }
  });

  test("report pages reflow at tablet and desktop widths", async ({
    page,
  }, testInfo) => {
    await login(page);
    for (const width of [768, 1440]) {
      await page.setViewportSize({ width, height: 1024 });
      await page.goto("/app/laporan/buat");
      await expect(
        page.getByRole("heading", { name: "Buat laporan lingkungan" }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      const axe = await new AxeBuilder({ page }).analyze();
      expect(
        axe.violations.filter((violation) =>
          ["serious", "critical"].includes(violation.impact ?? ""),
        ),
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(`report-form-${width}.png`),
        fullPage: true,
      });
      await page.goto(`/app/laporan/${createdReportId}`);
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <=
            document.documentElement.clientWidth,
        ),
      ).toBe(true);
      await page.screenshot({
        path: testInfo.outputPath(`report-detail-${width}.png`),
        fullPage: true,
      });
    }
  });

  test("UI audit captures resident pages at four widths and 200 percent reflow", async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await login(page);
    await page.goto("/app/laporan");
    const detailHref = await page
      // Report detail links; the list no longer prints the DW- reference.
      .locator('a[href^="/app/laporan/"]:not([href$="/buat"])')
      .first()
      .getAttribute("href");
    expect(detailHref).toBeTruthy();
    const measurements: Array<{
      page: string;
      width: number;
      scrollWidth: number;
      clientWidth: number;
    }> = [];
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const [name, path] of [
        ["list", "/app/laporan"],
        ["form", "/app/laporan/buat"],
        ["detail", detailHref!],
      ] as const) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        await page.screenshot({
          path: testInfo.outputPath(`ui-audit-${name}-${width}.png`),
          fullPage: true,
        });
        const bounds = await page.evaluate(() => ({
          scrollWidth: document.documentElement.scrollWidth,
          clientWidth: document.documentElement.clientWidth,
        }));
        measurements.push({ page: name, width, ...bounds });
        expect(bounds.scrollWidth).toBeLessThanOrEqual(bounds.clientWidth);
        if (width === 320 || width === 1440) {
          const axe = await new AxeBuilder({ page }).analyze();
          expect(
            axe.violations.filter((violation) =>
              ["serious", "critical"].includes(violation.impact ?? ""),
            ),
          ).toEqual([]);
        }
      }
    }
    await page.setViewportSize({ width: 320, height: 900 });
    await page.goto("/app/laporan/buat");
    for (const selector of [
      'label[for="photos"]',
      'label[for="camera-photo"]',
      'button[aria-label="Buka menu navigasi"]',
      'button:has-text("Gunakan lokasi saya")',
      'button:has-text("Kirim laporan")',
    ]) {
      const height = await page
        .locator(selector)
        .first()
        .evaluate((element) => element.getBoundingClientRect().height);
      expect(height).toBeGreaterThanOrEqual(44);
    }
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto("/app/laporan/buat");
    await page.waitForLoadState("networkidle");
    await page.emulateMedia({ reducedMotion: "reduce" });
    expect(
      await page.evaluate(
        () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      ),
    ).toBe(true);
    const duration = await page
      .getByRole("button", { name: "Kirim laporan" })
      .evaluate((button) => getComputedStyle(button).transitionDuration);
    expect(Number.parseFloat(duration)).toBeLessThanOrEqual(0.001);
    await page.evaluate(() => {
      document.documentElement.style.zoom = "200%";
    });
    await page.screenshot({
      path: testInfo.outputPath("ui-audit-form-css-zoom-200.png"),
      fullPage: true,
    });
    const zoomBounds = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(zoomBounds.scrollWidth).toBeLessThanOrEqual(zoomBounds.clientWidth);
    console.log("UI_AUDIT_MEASUREMENTS", JSON.stringify(measurements));
  });
});
