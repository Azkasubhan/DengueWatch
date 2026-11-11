// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runScheduledCleanup: vi.fn(),
  createStorageAdmin: vi.fn(() => ({})),
}));
vi.mock("@/features/maintenance/cleanup", () => ({
  CleanupError: class CleanupError extends Error {},
  runScheduledCleanup: mocks.runScheduledCleanup,
}));
vi.mock("@/features/reports/data", () => ({
  createStorageAdmin: mocks.createStorageAdmin,
}));

import { GET } from "@/app/api/cron/cleanup/route";

const secret = "s".repeat(40);
const call = (authorization?: string) =>
  GET(
    new Request("http://localhost/api/cron/cleanup", {
      headers: authorization ? { authorization } : {},
    }),
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runScheduledCleanup.mockResolvedValue({
    uploads: { rows: 2, orphanedObjects: 0 },
    aiAnalyses: { rows: 1 },
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("GET /api/cron/cleanup", () => {
  it("stays closed when CRON_SECRET is missing or too short", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await call(`Bearer `)).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "short-secret");
    expect((await call("Bearer short-secret")).status).toBe(503);
    expect(mocks.runScheduledCleanup).not.toHaveBeenCalled();
  });

  it("rejects missing or wrong bearer tokens", async () => {
    vi.stubEnv("CRON_SECRET", secret);
    expect((await call()).status).toBe(401);
    expect((await call(`Bearer ${secret}x`)).status).toBe(401);
    expect((await call(secret)).status).toBe(401);
    expect(mocks.runScheduledCleanup).not.toHaveBeenCalled();
  });

  it("runs the cleanup for Vercel Cron and returns counts without caching", async () => {
    vi.stubEnv("CRON_SECRET", secret);
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      data: {
        uploads: { rows: 2, orphanedObjects: 0 },
        aiAnalyses: { rows: 1 },
      },
    });
  });

  it("reports failures as 503 without details", async () => {
    vi.stubEnv("CRON_SECRET", secret);
    mocks.runScheduledCleanup.mockRejectedValueOnce(new Error("db password=x"));
    const response = await call(`Bearer ${secret}`);
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("password");
  });
});
