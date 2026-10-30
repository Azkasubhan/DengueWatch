import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getSupabasePublicConfig,
  requireSupabasePublicConfig,
} from "@/integrations/supabase/config";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Supabase public configuration", () => {
  it("rejects the committed placeholder values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://your-project.supabase.co");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "sb_publishable_replace_me",
    );

    expect(getSupabasePublicConfig()).toBeNull();
  });

  it("rejects alternate replace-style placeholders", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv(
      "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      "replace_with_a_publishable_key",
    );

    expect(getSupabasePublicConfig()).toBeNull();
  });

  it("rejects malformed and non-http URLs", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "javascript:alert(1)");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "local-test-key");

    expect(getSupabasePublicConfig()).toBeNull();
  });

  it("accepts an explicit local development configuration", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "local-test-key");

    expect(getSupabasePublicConfig()).toEqual({
      publishableKey: "local-test-key",
      url: "http://127.0.0.1:54321",
    });
  });

  it("fails closed when required configuration is unavailable", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => requireSupabasePublicConfig()).toThrow(
      "SUPABASE_CONFIGURATION_MISSING",
    );
  });
});
