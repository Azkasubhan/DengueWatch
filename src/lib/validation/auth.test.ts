import { describe, expect, it } from "vitest";
import {
  loginSchema,
  registerSchema,
  updatePasswordSchema,
} from "@/lib/validation/auth";

describe("auth validation", () => {
  it("normalizes a valid login email", () => {
    const result = loginSchema.parse({
      email: "WARGA@EXAMPLE.COM",
      password: "rahasia",
    });

    expect(result.email).toBe("warga@example.com");
  });

  it("rejects an injected role during registration", () => {
    const result = registerSchema.safeParse({
      confirmPassword: "aman-sekali",
      displayName: "Warga Uji",
      email: "warga@example.com",
      password: "aman-sekali",
      role: "manager",
    });

    expect(result.success).toBe(false);
  });

  it("rejects mismatched password confirmation", () => {
    const result = registerSchema.safeParse({
      confirmPassword: "berbeda-sekali",
      displayName: "Warga Uji",
      email: "warga@example.com",
      password: "aman-sekali",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.flatten().fieldErrors.confirmPassword).toBeDefined();
    }
  });

  it("requires a meaningful display name", () => {
    const result = registerSchema.safeParse({
      confirmPassword: "aman-sekali",
      displayName: " ",
      email: "warga@example.com",
      password: "aman-sekali",
    });

    expect(result.success).toBe(false);
  });

  it("enforces the password length on recovery", () => {
    expect(
      updatePasswordSchema.safeParse({
        password: "pendek",
        confirmPassword: "pendek",
      }).success,
    ).toBe(false);
  });
});
