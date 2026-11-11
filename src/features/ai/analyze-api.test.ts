// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessContext } from "@/features/areas/types";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getAccessContext: vi.fn(),
  analyzeReportPhoto: vi.fn(),
}));
vi.mock("@/lib/auth/context", () => ({
  getAccessContext: mocks.getAccessContext,
}));
vi.mock("@/features/ai/service", () => ({
  analyzeReportPhoto: mocks.analyzeReportPhoto,
}));

import { POST } from "@/app/api/v1/ai/analyze-report/route";
import { AiRequestError } from "@/features/ai/config";

const userId = "51000000-0000-4000-8000-000000000001";
const areaId = "52000000-0000-4000-8000-000000000001";
const otherAreaId = "52000000-0000-4000-8000-000000000002";
const uploadId = "54000000-0000-4000-8000-000000000001";

function context(role: AccessContext["role"] = "resident"): AccessContext {
  return {
    displayName: "Warga Uji",
    role,
    userId,
    memberships: [
      {
        area: { code: "UJI-A", id: areaId, isDemo: true, name: "Area Uji" },
        areaId,
        membershipType: "resident",
        verifiedAt: "2026-10-31T00:00:00Z",
      },
    ],
  };
}

function post(
  body: unknown = { areaId, uploadId },
  { origin = "http://localhost", contentType = "application/json" } = {},
) {
  return new Request("http://localhost/api/v1/ai/analyze-report", {
    method: "POST",
    headers: { origin, "content-type": contentType },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAccessContext.mockResolvedValue({
    kind: "authenticated",
    context: context(),
  });
  mocks.analyzeReportPhoto.mockResolvedValue({
    analysisId: "analysis-1",
    suggestion: { suggestedCategory: "water_container" },
  });
});

describe("POST /api/v1/ai/analyze-report", () => {
  it("analyzes the resident's own upload in a verified area", async () => {
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        analysisId: "analysis-1",
        suggestion: { suggestedCategory: "water_container" },
      },
    });
    expect(mocks.analyzeReportPhoto).toHaveBeenCalledWith(
      expect.objectContaining({ userId, areaId, uploadId }),
    );
  });

  it("rejects foreign origins, other roles, and unverified areas before analysis", async () => {
    expect(
      (await POST(post(undefined, { origin: "https://evil.test" }))).status,
    ).toBe(403);
    expect((await POST(post({ areaId: otherAreaId, uploadId }))).status).toBe(
      403,
    );
    mocks.getAccessContext.mockResolvedValueOnce({
      kind: "authenticated",
      context: context("cadre"),
    });
    expect((await POST(post())).status).toBe(403);
    mocks.getAccessContext.mockResolvedValueOnce({ kind: "unauthenticated" });
    expect((await POST(post())).status).toBe(401);
    expect(mocks.analyzeReportPhoto).not.toHaveBeenCalled();
  });

  it("validates the request body", async () => {
    expect(
      (await POST(post(undefined, { contentType: "text/plain" }))).status,
    ).toBe(415);
    expect((await POST(post("{oops"))).status).toBe(400);
    expect((await POST(post({ areaId, uploadId: "x" }))).status).toBe(422);
    expect((await POST(post("x".repeat(3000)))).status).toBe(413);
    expect(mocks.analyzeReportPhoto).not.toHaveBeenCalled();
  });

  it.each([
    ["NOT_FOUND", 404, "Foto tidak ditemukan atau sudah kedaluwarsa."],
    ["INVALID_IMAGE", 422, "Foto belum dapat dianalisis"],
    ["AI_UNAVAILABLE", 503, "Analisis AI tidak tersedia"],
    ["AI_TIMEOUT", 503, "Analisis AI terlalu lama"],
    ["AI_INVALID_OUTPUT", 502, "Saran AI tidak aman atau tidak valid"],
    ["CONCURRENT_REQUEST", 409, "Analisis sebelumnya masih berjalan"],
  ])("maps %s to HTTP %i with its own message", async (code, status, text) => {
    mocks.analyzeReportPhoto.mockRejectedValueOnce(
      new AiRequestError(status, code),
    );
    const response = await POST(post());
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.error.code).toBe(code);
    expect(body.error.message).toContain(text);
  });

  it("hides unexpected errors behind a generic 503", async () => {
    mocks.analyzeReportPhoto.mockRejectedValueOnce(new Error("key=secret"));
    const response = await POST(post());
    expect(response.status).toBe(503);
    expect(JSON.stringify(await response.json())).not.toContain("secret");
  });
});
