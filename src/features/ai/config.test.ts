import { afterEach, describe, expect, it, vi } from "vitest";
import { AiRequestError, aiConfiguration } from "@/features/ai/config";

describe("AI configuration and manual fallback", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("fails closed without credentials or model", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_MODEL", "");
    expect(() => aiConfiguration()).toThrow(AiRequestError);
    expect(() => aiConfiguration()).toThrowError("AI_UNAVAILABLE");
  });

  it("uses the configured model and bounded timeout", () => {
    vi.stubEnv("GEMINI_API_KEY", "synthetic-unit-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    vi.stubEnv("AI_REQUEST_TIMEOUT_MS", "12000");
    expect(aiConfiguration()).toEqual({
      model: "gemini-3.8-flash",
      timeoutMs: 12000,
    });
    vi.stubEnv("AI_REQUEST_TIMEOUT_MS", "999999");
    expect(aiConfiguration().timeoutMs).toBe(15000);
  });

  it("allows an explicit deterministic adapter without a provider key", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    expect(aiConfiguration(true).model).toBe("gemini-3.8-flash");
    expect(() => aiConfiguration(false)).toThrowError("AI_UNAVAILABLE");
  });
});
