import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { parseAiSuggestion } from "@/features/ai/schema";

test("real Gemini analyzes one synthetic private photo and resident submits through M3", async ({
  page,
}, testInfo) => {
  test.skip(
    process.env.RUN_LIVE_GEMINI !== "true",
    "Run the dedicated live Gemini command.",
  );
  test.setTimeout(90_000);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  expect(["localhost", "127.0.0.1"]).toContain(new URL(url).hostname);
  expect(process.env.AI_TEST_ADAPTER).toBeUndefined();
  expect(process.env.GEMINI_API_KEY).toBeTruthy();
  expect(process.env.GEMINI_MODEL).toBeTruthy();
  const email = process.env.M4_TEST_EMAIL;
  const password = process.env.DEMO_ACCOUNT_PASSWORD;
  expect(email).toMatch(/^m4-verifikasi-[a-f0-9]{8}@denguewatch\.test$/);
  expect(password).toBeTruthy();

  await page.goto("/login");
  await page.getByLabel("Email *", { exact: true }).fill(email!);
  await page.getByLabel("Kata sandi *", { exact: true }).fill(password!);
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page).toHaveURL(/\/app\/beranda$/);
  await page.goto("/app/laporan/buat");
  // T29: selecting the photo uploads it and asks Gemini to fill the form.
  const analyzed = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/v1/ai/analyze-report") &&
      response.request().method() === "POST",
    { timeout: 70_000 },
  );
  await page
    .locator("#photos")
    .setInputFiles(resolve("assets/demo-reports/water-container.png"));
  const response = await analyzed;
  const payload = await response.json();
  if (response.status() !== 200)
    throw new Error(
      `Live Gemini endpoint failed: HTTP ${response.status()}, code ${payload.error?.code ?? "UNKNOWN"}`,
    );
  const suggestion = parseAiSuggestion(
    JSON.stringify(payload.data?.suggestion),
  );
  const analysisId = payload.data?.analysisId as string;
  expect(analysisId).toMatch(/^[0-9a-f-]{36}$/);
  expect(suggestion.requiresHumanVerification).toBe(true);
  await expect(page.locator("#category")).toHaveValue(
    suggestion.suggestedCategory,
  );
  await expect(page.locator("#description")).toHaveValue(
    suggestion.draftDescription,
  );
  await expect(page.locator("#visibleObjects")).toHaveValue(
    suggestion.visibleObjects.join(", "),
  );
  await page.screenshot({
    path: testInfo.outputPath("live-gemini-suggestion.png"),
    fullPage: true,
  });

  const admin = createClient(url, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const before = await admin
    .from("ai_analyses")
    .select(
      "request_user_id,model_id,status,result_json,input_hash,input_tokens,output_tokens,report_id",
    )
    .eq("id", analysisId)
    .single();
  expect(before.error).toBeNull();
  expect(before.data?.model_id).toBe(process.env.GEMINI_MODEL);
  expect(before.data?.status).toBe("success");
  expect(before.data?.input_tokens).toBeGreaterThan(1);
  expect(before.data?.output_tokens).toBeGreaterThan(1);
  expect(before.data?.input_hash).toMatch(/^[0-9a-f]{64}$/);
  expect(before.data?.report_id).toBeNull();
  expect(parseAiSuggestion(JSON.stringify(before.data?.result_json))).toEqual(
    suggestion,
  );
  const owner = await admin.auth.admin.getUserById(
    before.data!.request_user_id,
  );
  expect(owner.error).toBeNull();
  expect(owner.data.user?.email).toBe(email);

  const edited = `Foto simulasi lingkungan perlu pemeriksaan lanjutan. Catatan warga ${randomUUID().slice(0, 8)}.`;
  await page.locator("#description").fill(edited);
  await page.getByRole("button", { name: "Tinjau laporan" }).click();
  await expect(page.getByText(edited, { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Konfirmasi dan kirim" }).click();
  await expect(page).toHaveURL(/\/app\/laporan\/[0-9a-f-]{36}$/);
  await expect(
    page.getByText("Menunggu Pemeriksaan", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(edited, { exact: false })).toBeVisible();
  const reportId = page.url().split("/").at(-1)!;
  const [report, linked] = await Promise.all([
    admin
      .from("reports")
      .select("status,description")
      .eq("id", reportId)
      .single(),
    admin
      .from("ai_analyses")
      .select("report_id,status")
      .eq("id", analysisId)
      .single(),
  ]);
  expect(report.error).toBeNull();
  expect(report.data).toMatchObject({
    status: "pending_verification",
    description: edited,
  });
  expect(linked.error).toBeNull();
  expect(linked.data).toMatchObject({ report_id: reportId, status: "success" });
  await page.screenshot({
    path: testInfo.outputPath("live-gemini-report.png"),
    fullPage: true,
  });
});
