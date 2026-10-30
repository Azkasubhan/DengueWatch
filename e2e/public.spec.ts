import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 1000 },
];

async function expectNoHorizontalOverflow(
  page: import("@playwright/test").Page,
) {
  const hasHorizontalOverflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
}

for (const viewport of viewports) {
  test(`landing page is responsive at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.goto("/");

    await expect(
      page.getByRole("heading", {
        name: "Temuan lingkungan menjadi tindakan yang dapat ditelusuri.",
      }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Daftar sebagai warga" }).first(),
    ).toBeVisible();

    await expectNoHorizontalOverflow(page);

    await page.screenshot({
      fullPage: true,
      path: testInfo.outputPath(`landing-${viewport.name}.png`),
    });
  });
}

test("public and authentication pages have no serious automated accessibility violations", async ({
  page,
}) => {
  for (const route of ["/", "/login", "/daftar", "/lupa-password"]) {
    await page.goto(route);
    const results = await new AxeBuilder({ page }).analyze();
    const serious = results.violations.filter(
      (violation) =>
        violation.impact === "critical" || violation.impact === "serious",
    );
    expect(serious, `Accessibility violations on ${route}`).toEqual([]);
  }
});

test("registration exposes no role selector and labels every input", async ({
  page,
}) => {
  await page.goto("/daftar");

  await expect(
    page.getByLabel("Nama panggilan *", { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Email *", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Kata sandi *", { exact: true })).toBeVisible();
  await expect(
    page.getByLabel("Ulangi kata sandi *", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);
  await expect(page.getByText(/selalu membuat akun warga/i)).toBeVisible();
});

for (const viewport of viewports) {
  test(`authentication and forbidden states are responsive at ${viewport.width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize(viewport);

    for (const route of ["/login", "/daftar", "/lupa-password", "/forbidden"]) {
      await page.goto(route);
      await expectNoHorizontalOverflow(page);
      const fileName = route.replaceAll("/", "-").replace(/^-/, "") || "home";
      await page.screenshot({
        fullPage: true,
        path: testInfo.outputPath(`${fileName}-${viewport.name}.png`),
      });
    }
  });

  test(`protected entries fail closed at ${viewport.width}px without a session`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);

    for (const route of [
      "/app/beranda",
      "/kader/ringkasan",
      "/pengelola/ringkasan",
    ]) {
      await page.goto(route);
      if (new URL(page.url()).pathname === "/login") {
        await expect(
          page.getByRole("heading", { name: "Masuk ke DengueWatch" }),
        ).toBeVisible();
      } else {
        await expect(
          page.getByText("Layanan akun belum tersedia"),
        ).toBeVisible();
      }
      await expect(page.getByText(/fitur laporan lingkungan/i)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }
  });
}
