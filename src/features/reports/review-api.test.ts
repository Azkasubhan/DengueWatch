// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessContext } from "@/features/areas/types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getAccessContext: vi.fn(),
  listReports: vi.fn(),
  getReportAiSuggestions: vi.fn(),
}));
vi.mock("@/integrations/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/auth/context", () => ({
  getAccessContext: mocks.getAccessContext,
}));
vi.mock("@/features/reports/data", () => ({
  listReports: mocks.listReports,
  getReportAiSuggestions: mocks.getReportAiSuggestions,
}));

import { POST as review } from "@/app/api/v1/reports/[id]/review/route";
import { POST as addInformation } from "@/app/api/v1/reports/[id]/add-information/route";
import { GET as aiSuggestions } from "@/app/api/v1/reports/[id]/ai-suggestions/route";
import { GET as listRoute } from "@/app/api/v1/reports/route";

const reportId = "53000000-0000-4000-8000-000000000001";
const otherId = "53000000-0000-4000-8000-000000000002";
const areaId = "52000000-0000-4000-8000-000000000001";

function context(
  role: AccessContext["role"],
  membershipType: AccessContext["memberships"][number]["membershipType"],
  verified = true,
): AccessContext {
  return {
    displayName: "Uji",
    role,
    userId: "51000000-0000-4000-8000-000000000003",
    memberships: [
      {
        area: { code: "M5-A", id: areaId, isDemo: true, name: "Area Uji" },
        areaId,
        membershipType,
        verifiedAt: verified ? "2026-10-31T00:00:00Z" : null,
      },
    ],
  };
}

function signIn(value: AccessContext | null) {
  mocks.getAccessContext.mockResolvedValue(
    value
      ? { kind: "authenticated", context: value }
      : { kind: "unauthenticated" },
  );
}

function post(path: string, body: unknown, origin = "http://localhost") {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const params = (id = reportId) => ({ params: Promise.resolve({ id }) });
const reviewPath = `/api/v1/reports/${reportId}/review`;
const updatedRow = {
  report_id: reportId,
  status: "verified",
  version: 2,
  updated_at: "2026-10-31T10:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  signIn(context("manager", "manager"));
  mocks.rpc.mockResolvedValue({ data: [updatedRow], error: null });
});

describe("POST /api/v1/reports/:id/review authorization", () => {
  it("rejects cross-origin requests before reading auth", async () => {
    const response = await review(
      post(reviewPath, {}, "https://evil.test"),
      params(),
    );
    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["unauthenticated", null, 401],
    ["resident", context("resident", "resident"), 403],
    ["cadre", context("cadre", "assigned_cadre"), 403],
    ["unverified manager", context("manager", "manager", false), 403],
  ] as const)("denies %s", async (_label, actor, status) => {
    signIn(actor);
    const response = await review(
      post(reviewPath, { decision: "verify", expectedVersion: 1 }),
      params(),
    );
    expect(response.status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("treats malformed ids as not found", async () => {
    const response = await review(
      post("/api/v1/reports/abc/review", {
        decision: "verify",
        expectedVersion: 1,
      }),
      params("abc"),
    );
    expect(response.status).toBe(404);
  });
});

describe("POST /api/v1/reports/:id/review validation", () => {
  it.each([
    [{ decision: "reject", expectedVersion: 1 }, "reason"],
    [
      { decision: "request_information", reason: "pendek", expectedVersion: 1 },
      "reason",
    ],
    [{ decision: "verify", expectedVersion: "1" }, "expectedVersion"],
    [{ decision: "verify", expectedVersion: 0 }, "expectedVersion"],
    [
      {
        decision: "duplicate",
        reason: "Objek sama dengan laporan sebelumnya.",
        expectedVersion: 1,
      },
      "duplicateOfReportId",
    ],
    [
      {
        decision: "verify",
        expectedVersion: 1,
        duplicateOfReportId: otherId,
      },
      "body",
    ],
    [{ decision: "approve", expectedVersion: 1 }, "decision"],
  ])("rejects %j", async (body, field) => {
    const response = await review(post(reviewPath, body), params());
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.error.code).toBe("VALIDATION_ERROR");
    expect(Object.keys(json.error.fieldErrors)).toContain(field);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a report marked as its own duplicate", async () => {
    const response = await review(
      post(reviewPath, {
        decision: "duplicate",
        reason: "Objek sama dengan laporan sebelumnya.",
        expectedVersion: 1,
        duplicateOfReportId: reportId,
      }),
      params(),
    );
    expect(response.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires JSON", async () => {
    const request = new Request(`http://localhost${reviewPath}`, {
      method: "POST",
      headers: { origin: "http://localhost", "content-type": "text/plain" },
      body: "verify",
    });
    expect((await review(request, params())).status).toBe(415);
  });
});

describe("POST /api/v1/reports/:id/review RPC", () => {
  it("verifies through the RPC and returns camelCase", async () => {
    const response = await review(
      post(reviewPath, { decision: "verify", expectedVersion: 1 }),
      params(),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        id: reportId,
        status: "verified",
        version: 2,
        updatedAt: "2026-10-31T10:00:00Z",
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("review_report", {
      p_report_id: reportId,
      p_decision: "verify",
      p_reason: null,
      p_expected_version: 1,
      p_duplicate_of_report_id: null,
    });
  });

  it("maps duplicate to the mark_duplicate RPC decision", async () => {
    await review(
      post(reviewPath, {
        decision: "duplicate",
        reason: "  Objek sama dengan laporan sebelumnya.  ",
        expectedVersion: 3,
        duplicateOfReportId: otherId,
      }),
      params(),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("review_report", {
      p_report_id: reportId,
      p_decision: "mark_duplicate",
      p_reason: "Objek sama dengan laporan sebelumnya.",
      p_expected_version: 3,
      p_duplicate_of_report_id: otherId,
    });
  });

  it.each([
    ["P0401", "authentication required", 401, "UNAUTHENTICATED"],
    ["P0403", "review not permitted", 403, "FORBIDDEN"],
    ["P0404", "report not found", 404, "NOT_FOUND"],
    ["P0409", "stale report version", 409, "STALE_VERSION"],
    ["P0422", "invalid report transition", 422, "INVALID_TRANSITION"],
    ["P0422", "invalid duplicate target", 422, "VALIDATION_ERROR"],
    ["P0422", "invalid review reason", 422, "VALIDATION_ERROR"],
    [
      "42P01",
      'relation "public.reports" does not exist',
      503,
      "SERVICE_UNAVAILABLE",
    ],
  ])("maps %s %s to %i", async (code, message, status, errorCode) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message } });
    const response = await review(
      post(reviewPath, { decision: "verify", expectedVersion: 1 }),
      params(),
    );
    expect(response.status).toBe(status);
    const text = await response.text();
    expect(JSON.parse(text).error.code).toBe(errorCode);
    expect(text).not.toContain(message);
  });
});

describe("POST /api/v1/reports/:id/add-information", () => {
  const path = `/api/v1/reports/${reportId}/add-information`;
  const body = {
    note: "Foto tambahan sudah saya ambil dari dekat.",
    expectedVersion: 2,
  };

  it("only lets residents call it", async () => {
    const response = await addInformation(post(path, body), params());
    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("forwards the owner note to the RPC", async () => {
    signIn(context("resident", "resident"));
    mocks.rpc.mockResolvedValue({
      data: [{ ...updatedRow, status: "pending_verification", version: 3 }],
      error: null,
    });
    const response = await addInformation(post(path, body), params());
    expect(response.status).toBe(200);
    expect((await response.json()).data.status).toBe("pending_verification");
    expect(mocks.rpc).toHaveBeenCalledWith("add_report_information", {
      p_report_id: reportId,
      p_note: body.note,
      p_expected_version: 2,
    });
  });

  it("rejects short notes and maps stale versions", async () => {
    signIn(context("resident", "resident"));
    expect(
      (await addInformation(post(path, { ...body, note: "oke" }), params()))
        .status,
    ).toBe(422);
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0409", message: "stale report version" },
    });
    expect((await addInformation(post(path, body), params())).status).toBe(409);
  });
});

describe("GET /api/v1/reports/:id/ai-suggestions", () => {
  const request = () => new Request("http://localhost/");

  it("denies cadres", async () => {
    signIn(context("cadre", "assigned_cadre"));
    expect((await aiSuggestions(request(), params())).status).toBe(403);
    expect(mocks.getReportAiSuggestions).not.toHaveBeenCalled();
  });

  it("hides out-of-scope reports as not found", async () => {
    mocks.getReportAiSuggestions.mockResolvedValue({
      data: null,
      error: { code: "P0404", message: "report not found" },
    });
    expect((await aiSuggestions(request(), params())).status).toBe(404);
  });

  it("returns suggestions marked for human verification", async () => {
    mocks.getReportAiSuggestions.mockResolvedValue({
      data: [
        {
          analysis_id: otherId,
          suggested_category: "discarded_tire",
          visible_objects: ["ban bekas"],
          draft_description: "Ban bekas tampak menampung air.",
          suggested_precaution: "Kosongkan air.",
          limitations: "Satu foto.",
          analyzed_at: "2026-10-31T09:00:00Z",
        },
      ],
      error: null,
    });
    const json = await (await aiSuggestions(request(), params())).json();
    expect(json.data).toEqual([
      {
        analysisId: otherId,
        suggestedCategory: "discarded_tire",
        visibleObjects: ["ban bekas"],
        draftDescription: "Ban bekas tampak menampung air.",
        suggestedPrecaution: "Kosongkan air.",
        limitations: "Satu foto.",
        analyzedAt: "2026-10-31T09:00:00Z",
        requiresHumanVerification: true,
      },
    ]);
  });
});

describe("GET /api/v1/reports queue filters", () => {
  beforeEach(() => {
    mocks.listReports.mockResolvedValue({ data: [], count: 0, error: null });
  });

  it("keeps the resident list call unchanged without filters", async () => {
    signIn(context("resident", "resident"));
    const response = await listRoute(
      new Request("http://localhost/api/v1/reports"),
    );
    expect(response.status).toBe(200);
    expect(mocks.listReports).toHaveBeenCalledWith(1, 10, {});
  });

  it("forwards queue filters for an assigned area", async () => {
    const response = await listRoute(
      new Request(
        `http://localhost/api/v1/reports?status=pending_verification,needs_information&areaId=${areaId}&category=discarded_tire&submittedFrom=2026-10-01&submittedTo=2026-10-31&page=2&limit=20`,
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.listReports).toHaveBeenCalledWith(2, 20, {
      status: ["pending_verification", "needs_information"],
      areaId,
      category: "discarded_tire",
      submittedFrom: "2026-10-01",
      submittedTo: "2026-10-31",
    });
  });

  it("refuses areas outside the caller's verified memberships", async () => {
    const response = await listRoute(
      new Request(`http://localhost/api/v1/reports?areaId=${otherId}`),
    );
    expect(response.status).toBe(403);
    expect(mocks.listReports).not.toHaveBeenCalled();
  });

  it.each([
    "status=open",
    "status=verified,verified",
    "submittedFrom=2026-02-30",
    "submittedFrom=2026-10-31&submittedTo=2026-10-01",
    "areaId=area-a",
  ])("rejects invalid query %s", async (query) => {
    const response = await listRoute(
      new Request(`http://localhost/api/v1/reports?${query}`),
    );
    expect(response.status).toBe(422);
  });
});
