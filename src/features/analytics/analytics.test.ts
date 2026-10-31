// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessContext } from "@/features/areas/types";
import {
  jakartaToday,
  summaryQuerySchema,
} from "@/features/analytics/validation";

const mocks = vi.hoisted(() => ({
  getAccessContext: vi.fn(),
  getManagerSummary: vi.fn(),
}));
vi.mock("@/lib/auth/context", () => ({
  getAccessContext: mocks.getAccessContext,
}));
vi.mock("@/features/analytics/data", () => ({
  getManagerSummary: mocks.getManagerSummary,
}));

import { GET } from "@/app/api/v1/analytics/route";

const areaId = "72000000-0000-4000-8000-000000000001";

function signIn(
  role: AccessContext["role"],
  membershipType: AccessContext["memberships"][number]["membershipType"],
) {
  mocks.getAccessContext.mockResolvedValue({
    kind: "authenticated",
    context: {
      displayName: "Uji",
      role,
      userId: "71000000-0000-4000-8000-000000000004",
      memberships: [
        {
          area: { code: "M7", id: areaId, isDemo: true, name: "Area Uji" },
          areaId,
          membershipType,
          verifiedAt: "2026-10-31T00:00:00Z",
        },
      ],
    },
  });
}

const request = (query = "") =>
  new Request(`http://localhost/api/v1/analytics${query}`);

describe("summary query", () => {
  // 31 Oct 2026 20:00 UTC is already 1 Nov in WIB.
  const now = new Date("2026-10-31T20:00:00Z");

  it("defaults to the last 30 WIB days including today", () => {
    expect(jakartaToday(now)).toBe("2026-11-01");
    expect(summaryQuerySchema(now).parse({})).toEqual({
      areaId: null,
      from: "2026-10-03",
      to: "2026-11-01",
    });
  });

  it.each([
    [{ from: "2026-10-31", to: "2026-10-01" }],
    [{ from: "2025-01-01", to: "2026-10-31" }],
    [{ from: "2026-02-30" }],
    [{ areaId: "area-a" }],
    [{ scope: "all" }],
  ])("rejects %j", (query) => {
    expect(summaryQuerySchema(now).safeParse(query).success).toBe(false);
  });

  it("accepts a full 366-day range", () => {
    expect(
      summaryQuerySchema(now).safeParse({
        from: "2025-11-01",
        to: "2026-11-01",
      }).success,
    ).toBe(true);
  });
});

describe("GET /api/v1/analytics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signIn("manager", "manager");
  });

  it.each([
    ["resident", "resident"],
    ["cadre", "assigned_cadre"],
  ] as const)("denies %s", async (role, membership) => {
    signIn(role, membership);
    expect((await GET(request())).status).toBe(403);
    expect(mocks.getManagerSummary).not.toHaveBeenCalled();
  });

  it("returns the database summary for a manager", async () => {
    const data = { reportsTotal: 5, completionRate: 80 };
    mocks.getManagerSummary.mockResolvedValue({ data, error: null });
    const response = await GET(
      request(`?areaId=${areaId}&from=2026-10-01&to=2026-10-31`),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data });
    expect(mocks.getManagerSummary).toHaveBeenCalledWith({
      areaId,
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });

  it.each([
    ["P0404", 404],
    ["P0403", 403],
    ["P0422", 422],
    ["42P01", 503],
  ])("maps %s to %i without leaking SQL", async (code, status) => {
    mocks.getManagerSummary.mockResolvedValue({
      data: null,
      error: { code, message: 'relation "public.reports" secret' },
    });
    const response = await GET(request());
    expect(response.status).toBe(status);
    expect(await response.text()).not.toContain("secret");
  });

  it("rejects invalid filters before querying", async () => {
    expect((await GET(request("?from=2026-13-01"))).status).toBe(422);
    expect(mocks.getManagerSummary).not.toHaveBeenCalled();
  });
});
