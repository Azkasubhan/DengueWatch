import { defineConfig, devices } from "@playwright/test";

const isLiveAuthRun =
  process.env.RUN_LIVE_AUTH === "true" ||
  process.env.RUN_LIVE_REPORTS === "true" ||
  process.env.RUN_M4_DETERMINISTIC === "true" ||
  process.env.RUN_LIVE_GEMINI === "true" ||
  process.env.RUN_LIVE_M5 === "true" ||
  process.env.RUN_LIVE_M6 === "true";
const port = 3001;
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm dev --hostname 127.0.0.1 --port ${port}`,
    env: isLiveAuthRun
      ? undefined
      : {
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_replace_me",
          NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co",
        },
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
