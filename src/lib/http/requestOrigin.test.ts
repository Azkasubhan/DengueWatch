// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { appOrigin, requestOrigin } from "@/lib/http/requestOrigin";
import { sameOrigin } from "@/features/reports/http";

const local = "http://localhost:3000/api/v1/reports";
const request = (headers: Record<string, string>) =>
  new Request(local, { method: "POST", headers });
const proxied = {
  host: "dw.example.test",
  "x-forwarded-proto": "https",
};

describe("requestOrigin behind the reverse proxy", () => {
  it("uses the forwarded public host and scheme", () => {
    expect(requestOrigin(request(proxied))).toBe("https://dw.example.test");
    expect(
      requestOrigin(
        request({
          ...proxied,
          "x-forwarded-host": "dw.example.test, internal",
          "x-forwarded-proto": "https, http",
        }),
      ),
    ).toBe("https://dw.example.test");
  });

  it("normalizes the default port of the forwarded scheme", () => {
    expect(
      requestOrigin(
        request({ host: "dw.example.test:443", "x-forwarded-proto": "https" }),
      ),
    ).toBe("https://dw.example.test");
    expect(
      requestOrigin(
        request({ host: "dw.example.test:8443", "x-forwarded-proto": "https" }),
      ),
    ).toBe("https://dw.example.test:8443");
  });

  it("falls back to request.url without headers or with invalid values", () => {
    expect(requestOrigin(new Request(local))).toBe("http://localhost:3000");
    expect(
      requestOrigin(
        request({ host: "dw.example.test", "x-forwarded-proto": "ftp" }),
      ),
    ).toBe("http://localhost:3000");
    expect(
      requestOrigin(request({ "x-forwarded-host": "evil.test/@x", host: "a" })),
    ).toBe("http://localhost:3000");
  });

  it("accepts same-site mutations and rejects foreign or missing origins", () => {
    expect(
      sameOrigin(request({ ...proxied, origin: "https://dw.example.test" })),
    ).toBe(true);
    expect(
      sameOrigin(request({ ...proxied, origin: "http://dw.example.test" })),
    ).toBe(false);
    expect(
      sameOrigin(request({ ...proxied, origin: "https://evil.test" })),
    ).toBe(false);
    expect(sameOrigin(request(proxied))).toBe(false);
  });
});

describe("requestOrigin in production", () => {
  afterEach(() => vi.unstubAllEnvs());
  const production = (base?: string) => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", base ?? "");
  };
  const spoofed = {
    host: "evil.test",
    "x-forwarded-host": "evil.test",
    "x-forwarded-proto": "https",
    forwarded: "host=evil.test;proto=https",
  };

  it("pins the origin to APP_BASE_URL regardless of Host or Forwarded headers", () => {
    production("https://dw.example.test/app");
    expect(requestOrigin(request(spoofed))).toBe("https://dw.example.test");
    expect(
      sameOrigin(request({ ...spoofed, origin: "https://evil.test" })),
    ).toBe(false);
    expect(
      sameOrigin(request({ ...spoofed, origin: "https://dw.example.test" })),
    ).toBe(true);
    expect(
      sameOrigin(request({ ...proxied, origin: "http://localhost:3000" })),
    ).toBe(false);
  });

  it.each([
    undefined,
    "not a url",
    "javascript:alert(1)",
    "http://dw.example.test",
  ])("fails closed when APP_BASE_URL is %j", (base) => {
    production(base);
    expect(requestOrigin(request(proxied))).toBeNull();
    expect(
      sameOrigin(request({ ...proxied, origin: "https://dw.example.test" })),
    ).toBe(false);
  });
});

describe("appOrigin", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("requires HTTPS in production except on loopback", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_BASE_URL", "https://dw.example.test/x");
    expect(appOrigin()).toBe("https://dw.example.test");
    vi.stubEnv("APP_BASE_URL", "http://127.0.0.1:3000");
    expect(appOrigin()).toBe("http://127.0.0.1:3000");
    vi.stubEnv("APP_BASE_URL", "http://dw.example.test");
    expect(appOrigin()).toBeNull();
    vi.stubEnv("APP_BASE_URL", "");
    expect(appOrigin()).toBeNull();
  });

  it("defaults to localhost outside production and rejects invalid values", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_BASE_URL", "");
    expect(appOrigin()).toBe("http://localhost:3000");
    vi.stubEnv("APP_BASE_URL", "ftp://dw.example.test");
    expect(appOrigin()).toBeNull();
  });
});
