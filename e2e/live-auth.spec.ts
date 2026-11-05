import { randomBytes } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";

test.describe("live Supabase authentication", () => {
  test.skip(
    process.env.RUN_LIVE_AUTH !== "true",
    "Set RUN_LIVE_AUTH=true and use the dedicated live-auth script.",
  );
  test.describe.configure({ mode: "serial" });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const secretKey = process.env.SUPABASE_SECRET_KEY ?? "";
  const runId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
  const email = `m2.browser.${runId}@example.test`;
  const password = `Dw-${randomBytes(18).toString("base64url")}Aa1!`;
  const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD ?? "";
  let admin: SupabaseClient;
  let userId: string | undefined;

  // Local databases accumulate E2E fixture users, so search every page.
  async function findDemoUser(demoEmail: string) {
    for (let page = 1; page <= 50; page += 1) {
      const { data, error } = await admin.auth.admin.listUsers({
        page,
        perPage: 100,
      });
      expect(error).toBeNull();
      const user = data.users.find(
        (candidate) => candidate.email === demoEmail,
      );
      if (user) return user;
      if (data.users.length < 100) break;
    }
    throw new Error(`Demo user ${demoEmail} not found.`);
  }

  async function login(
    page: import("@playwright/test").Page,
    loginEmail: string,
    loginPassword: string,
  ) {
    await page.goto("/login");
    await page.getByLabel("Email *", { exact: true }).fill(loginEmail);
    await page.getByLabel("Kata sandi *", { exact: true }).fill(loginPassword);
    await page.getByRole("button", { name: "Masuk" }).click();
  }

  test.beforeAll(async () => {
    const parsed = new URL(url);
    expect(["127.0.0.1", "localhost"]).toContain(parsed.hostname);
    expect(demoPassword).not.toMatch(/replace|placeholder/i);
    expect(demoPassword.length).toBeGreaterThanOrEqual(8);
    admin = createClient(url, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    for (const demoEmail of [
      "kader.satu@denguewatch.test",
      "pengelola.simulasi@denguewatch.test",
    ]) {
      await findDemoUser(demoEmail);
    }
  });

  test.afterAll(async () => {
    if (userId) await admin.auth.admin.deleteUser(userId);
  });

  test("registration creates a real resident session with pending membership", async ({
    page,
  }) => {
    await page.goto("/daftar");
    await page
      .getByLabel("Nama panggilan *", { exact: true })
      .fill("Warga Browser M2");
    await page.getByLabel("Email *", { exact: true }).fill(email);
    await page.getByLabel("Kata sandi *", { exact: true }).fill(password);
    await page
      .getByLabel("Ulangi kata sandi *", { exact: true })
      .fill(password);
    await page.getByRole("button", { name: "Daftar sebagai warga" }).click();

    await expect(page).toHaveURL(/\/app\/beranda$/);
    await expect(
      page.getByRole("heading", {
        name: "Keanggotaan wilayah belum disetujui",
      }),
    ).toBeVisible();

    const user = await findDemoUser(email);
    userId = user.id;
  });

  test("wrong login fails, correct login persists, and logout clears the session", async ({
    page,
  }) => {
    await login(page, email, `${password}-wrong`);
    await expect(
      page.getByText("Periksa kembali email dan kata sandi."),
    ).toBeVisible();

    await login(page, email, password);
    await expect(page).toHaveURL(/\/app\/beranda$/);
    await page.reload();
    await expect(
      page.getByRole("heading", {
        name: "Keanggotaan wilayah belum disetujui",
      }),
    ).toBeVisible();

    await page.goto("/kader/ringkasan");
    await expect(page).toHaveURL(/\/forbidden$/);
    await page.goto("/app/beranda");
    await page.getByRole("button", { name: "Keluar" }).click();
    const confirmLogout = page.getByRole("button", { name: "Ya, Keluar" });
    if (await confirmLogout.isVisible()) {
      await confirmLogout.click();
    }
    await expect(page).toHaveURL(/\/login(?:\?auth=logged_out)?$/);
    await page.goto("/app/beranda");
    await expect(page).toHaveURL(
      /\/login\?next=(?:%2F|\/)app(?:%2F|\/)beranda$/,
    );
  });

  test("cadre and manager sessions are confined to their portals", async ({
    page,
  }) => {
    await login(page, "kader.satu@denguewatch.test", demoPassword);
    await expect(page).toHaveURL(/\/kader\/ringkasan$/);
    await expect(
      page.getByRole("heading", { name: "Wilayah tugas terverifikasi" }),
    ).toBeVisible();
    await page.goto("/pengelola/ringkasan");
    await expect(page).toHaveURL(/\/forbidden$/);

    await page.context().clearCookies();
    await login(page, "pengelola.simulasi@denguewatch.test", demoPassword);
    await expect(page).toHaveURL(/\/pengelola\/ringkasan$/);
    await expect(
      page.getByRole("heading", { name: "Ringkasan laporan wilayah" }),
    ).toBeVisible();
    await page.goto("/kader/ringkasan");
    await expect(page).toHaveURL(/\/forbidden$/);
  });
});
