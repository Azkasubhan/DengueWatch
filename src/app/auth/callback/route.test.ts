// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ exchangeCodeForSession: vi.fn() }));
vi.mock("@/integrations/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: mocks.exchangeCodeForSession },
  }),
}));

import { GET } from "@/app/auth/callback/route";

// next start builds request.url from its bind address; headers carry spoofed values.
const callback = (query: string) =>
  new Request(`http://localhost:3000/auth/callback${query}`, {
    headers: {
      host: "evil.test",
      "x-forwarded-host": "evil.test",
      "x-forwarded-proto": "https",
    },
  });

describe("GET /auth/callback in production", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "https://dw.example.test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("redirects to the canonical origin despite spoofed headers", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(callback("?code=abc&next=/app/beranda"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://dw.example.test/app/beranda",
    );
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("abc");
  });

  it("keeps unsafe next values and failures on the canonical login page", async () => {
    mocks.exchangeCodeForSession.mockResolvedValue({ error: new Error("x") });
    const response = await GET(callback("?code=abc&next=//evil.test"));
    expect(response.headers.get("location")).toBe(
      "https://dw.example.test/login?error=callback",
    );
    expect((await GET(callback(""))).headers.get("location")).toBe(
      "https://dw.example.test/login?error=callback",
    );
  });

  it("uses a relative redirect instead of the bind address when APP_BASE_URL is invalid", async () => {
    vi.stubEnv("APP_BASE_URL", "http://dw.example.test");
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    const response = await GET(callback("?code=abc&next=/app/beranda"));
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("/app/beranda");
  });
});
