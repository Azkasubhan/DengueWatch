import { describe, expect, it } from "vitest";
import {
  decidePortalAccess,
  getDefaultPortal,
  getVerifiedAreas,
} from "@/features/areas/access";
import type { AccessContext } from "@/features/areas/types";

const verifiedArea = {
  code: "DEMO-RW-01",
  id: "8f76aa5e-f072-46a2-948f-311b31f5871f",
  isDemo: true,
  name: "Wilayah Harmoni (Simulasi)",
};

function context(overrides: Partial<AccessContext> = {}): AccessContext {
  return {
    displayName: "Pengguna Uji",
    memberships: [],
    role: "resident",
    userId: "8a249627-e56b-42bd-9222-693f5865bc52",
    ...overrides,
  };
}

describe("portal authorization", () => {
  it("forbids a resident from cadre routes even with a forged cadre membership", () => {
    const decision = decidePortalAccess(
      context({
        memberships: [
          {
            area: verifiedArea,
            areaId: verifiedArea.id,
            membershipType: "assigned_cadre",
            verifiedAt: new Date().toISOString(),
          },
        ],
      }),
      "cadre",
    );

    expect(decision.kind).toBe("forbidden");
  });

  it("keeps matching role pending without verified membership", () => {
    expect(decidePortalAccess(context({ role: "cadre" }), "cadre").kind).toBe(
      "pending",
    );
  });

  it("allows only a verified membership of the expected type", () => {
    const cadre = context({
      role: "cadre",
      memberships: [
        {
          area: verifiedArea,
          areaId: verifiedArea.id,
          membershipType: "assigned_cadre",
          verifiedAt: "2026-10-30T00:00:00.000Z",
        },
      ],
    });

    expect(decidePortalAccess(cadre, "cadre").kind).toBe("allowed");
    expect(getVerifiedAreas(cadre, "assigned_cadre")).toEqual([verifiedArea]);
  });

  it("does not treat an unverified membership as active", () => {
    const manager = context({
      role: "manager",
      memberships: [
        {
          area: null,
          areaId: verifiedArea.id,
          membershipType: "manager",
          verifiedAt: null,
        },
      ],
    });

    expect(decidePortalAccess(manager, "manager").kind).toBe("pending");
    expect(getVerifiedAreas(manager, "manager")).toEqual([]);
  });

  it("maps every role to its own portal", () => {
    expect(getDefaultPortal("resident")).toBe("/app/beranda");
    expect(getDefaultPortal("cadre")).toBe("/kader/ringkasan");
    expect(getDefaultPortal("manager")).toBe("/pengelola/ringkasan");
  });
});
