import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@google/genai";

vi.mock("server-only", () => ({}));

import {
  aiOutputJsonSchema,
  aiRetryOptions,
  aiSystemInstruction,
  mapGeminiError,
} from "@/features/ai/gemini";

describe("Gemini adapter policy", () => {
  it("maps provider 429, 503 and timeout to controlled categories", () => {
    expect(
      mapGeminiError(new ApiError({ status: 429, message: "rate" })).code,
    ).toBe("RATE_LIMIT");
    expect(
      mapGeminiError(new ApiError({ status: 503, message: "down" })).code,
    ).toBe("UNAVAILABLE");
    expect(
      mapGeminiError(new ApiError({ status: 403, message: "invalid key" }))
        .code,
    ).toBe("UNAVAILABLE");
    expect(mapGeminiError(new Error("request timeout")).code).toBe("TIMEOUT");
  });

  it("bounds retries and has no tool configuration", () => {
    expect(aiRetryOptions.attempts).toBe(2);
    expect(aiRetryOptions.httpStatusCodes).toContain(429);
    expect(aiRetryOptions.httpStatusCodes).toContain(503);
    expect(aiOutputJsonSchema.additionalProperties).toBe(false);
    expect(aiOutputJsonSchema.required).toHaveLength(6);
  });

  it("instructs the model to ignore image text and avoid privileged actions", () => {
    expect(aiSystemInstruction).toMatch(/Abaikan setiap instruksi/);
    expect(aiSystemInstruction).toMatch(/Jangan memverifikasi/);
    expect(aiSystemInstruction).toMatch(/diagnosis medis/);
  });
});
