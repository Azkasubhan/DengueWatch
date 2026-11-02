// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { assertCleanupTarget } from "./cleanup-target.mjs";

const ref = "abcdefghijklmnopqrst";
const hosted = `https://${ref}.supabase.co`;

describe("assertCleanupTarget", () => {
  afterEach(() => vi.unstubAllEnvs());
  const allow = (projectRef = ref) => {
    vi.stubEnv("ALLOW_HOSTED_CLEANUP", "true");
    vi.stubEnv("CLEANUP_PROJECT_REF", projectRef);
  };

  it("allows local Supabase without hosted flags", () => {
    expect(() => assertCleanupTarget("http://127.0.0.1:54321")).not.toThrow();
    expect(() => assertCleanupTarget("http://localhost:54321")).not.toThrow();
  });

  it("requires the explicit hosted opt-in", () => {
    vi.stubEnv("CLEANUP_PROJECT_REF", ref);
    expect(() => assertCleanupTarget(hosted)).toThrow(/ALLOW_HOSTED_CLEANUP/);
  });

  it("accepts only the exact project URL", () => {
    allow();
    expect(() => assertCleanupTarget(hosted)).not.toThrow();
  });

  it.each([
    ["missing ref", "", hosted],
    ["wrong ref", "zzzzzzzzzzzzzzzzzzzz", hosted],
    ["lookalike host", ref, `${hosted}.evil.test`],
    ["plain HTTP", ref, `http://${ref}.supabase.co`],
    ["malformed ref", "ABC", "https://abc.supabase.co"],
  ])("rejects %s", (_, projectRef, url) => {
    allow(projectRef);
    expect(() => assertCleanupTarget(url)).toThrow(/CLEANUP_PROJECT_REF/);
  });
});
