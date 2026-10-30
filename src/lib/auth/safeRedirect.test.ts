import { describe, expect, it } from "vitest";
import { getSafeRedirect } from "@/lib/auth/safeRedirect";

describe("getSafeRedirect", () => {
  it("accepts a local absolute path", () => {
    expect(getSafeRedirect("/kader/ringkasan?tab=baru")).toBe(
      "/kader/ringkasan?tab=baru",
    );
  });

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "javascript:alert(1)",
    "kader/ringkasan",
  ])("rejects unsafe redirect %s", (value) => {
    expect(getSafeRedirect(value)).toBe("/app/beranda");
  });

  it("uses a caller-provided fallback", () => {
    expect(getSafeRedirect(null, "/login")).toBe("/login");
  });
});
