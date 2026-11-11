// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessContext } from "@/features/areas/types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getAccessContext: vi.fn(),
}));
vi.mock("@/integrations/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/auth/context", () => ({
  getAccessContext: mocks.getAccessContext,
}));

import { POST } from "@/app/api/v1/reports/route";

const areaId = "52000000-0000-4000-8000-000000000001";
const otherAreaId = "52000000-0000-4000-8000-000000000002";
const uploadId = "54000000-0000-4000-8000-000000000001";
const key = "create-report-key-0001";

function context(
  role: AccessContext["role"] = "resident",
  verified = true,
): AccessContext {
  return {
    displayName: "Warga Uji",
    role,
    userId: "51000000-0000-4000-8000-000000000001",
    memberships: [
      {
        area: { code: "UJI-A", id: areaId, isDemo: true, name: "Area Uji" },
        areaId,
        membershipType: "resident",
        verifiedAt: verified ? "2026-10-31T00:00:00Z" : null,
      },
    ],
  };
}

const validBody = {
  areaId,
  category: "water_container",
  description: "Ember terbuka berisi air hujan di halaman.",
  imageUploadIds: [uploadId],
  location: null,
};

function post(
  body: unknown = validBody,
  {
    origin = "http://localhost",
    contentType = "application/json",
    idempotencyKey = key,
  }: { origin?: string; contentType?: string; idempotencyKey?: string } = {},
) {
  return new Request("http://localhost/api/v1/reports", {
    method: "POST",
    headers: {
      origin,
      "content-type": contentType,
      "idempotency-key": idempotencyKey,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const createdRow = {
  id: "53000000-0000-4000-8000-000000000001",
  public_reference: "DW-2026-000001",
  status: "pending_verification",
  submitted_at: "2026-11-11T03:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getAccessContext.mockResolvedValue({
    kind: "authenticated",
    context: context(),
  });
  mocks.rpc.mockResolvedValue({ data: [createdRow], error: null });
});

describe("POST /api/v1/reports", () => {
  it("creates a report without observation fields and maps the row to camelCase", async () => {
    const response = await POST(post());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: {
        id: createdRow.id,
        publicReference: "DW-2026-000001",
        status: "pending_verification",
        submittedAt: "2026-11-11T03:00:00Z",
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("create_environmental_report", {
      p_area_id: areaId,
      p_category: "water_container",
      p_description: validBody.description,
      p_visible_objects: null,
      p_prevention_advice: null,
      p_latitude: null,
      p_longitude: null,
      p_location_note: null,
      p_upload_ids: [uploadId],
      p_idempotency_key: key,
    });
  });

  it("passes optional observation fields and location through to the RPC", async () => {
    const response = await POST(
      post({
        ...validBody,
        visibleObjects: "Ember terbuka berisi air",
        preventionAdvice: "Kuras dan tutup ember seminggu sekali.",
        location: { latitude: -6.2, longitude: 106.8, note: "Dekat pos" },
      }),
    );
    expect(response.status).toBe(201);
    expect(mocks.rpc.mock.calls[0]![1]).toMatchObject({
      p_visible_objects: "Ember terbuka berisi air",
      p_prevention_advice: "Kuras dan tutup ember seminggu sekali.",
      p_latitude: -6.2,
      p_longitude: 106.8,
      p_location_note: "Dekat pos",
    });
  });

  it("rejects cross-origin requests before authentication", async () => {
    const response = await POST(
      post(validBody, { origin: "https://evil.example" }),
    );
    expect(response.status).toBe(403);
    expect(mocks.getAccessContext).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires a session and the resident role", async () => {
    mocks.getAccessContext.mockResolvedValueOnce({ kind: "unauthenticated" });
    expect((await POST(post())).status).toBe(401);
    mocks.getAccessContext.mockResolvedValueOnce({
      kind: "authenticated",
      context: context("cadre"),
    });
    expect((await POST(post())).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects non-JSON bodies, invalid keys, malformed JSON, and unknown fields", async () => {
    expect(
      (await POST(post(validBody, { contentType: "text/plain" }))).status,
    ).toBe(415);
    expect(
      (await POST(post(validBody, { idempotencyKey: "short" }))).status,
    ).toBe(422);
    expect((await POST(post("{not json"))).status).toBe(400);
    expect(
      (await POST(post({ ...validBody, status: "verified" }))).status,
    ).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("refuses areas without a verified resident membership", async () => {
    expect(
      (await POST(post({ ...validBody, areaId: otherAreaId }))).status,
    ).toBe(403);
    mocks.getAccessContext.mockResolvedValueOnce({
      kind: "authenticated",
      context: context("resident", false),
    });
    expect((await POST(post())).status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["P0403", 403, "FORBIDDEN"],
    ["P0409", 409, "CONFLICT"],
    ["P0422", 422, "VALIDATION_ERROR"],
    // e.g. a broken function body referencing a missing column
    ["42703", 503, "SERVICE_UNAVAILABLE"],
  ])("maps RPC error %s to HTTP %i", async (code, status, errorCode) => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { code, message: 'column "secret_internal" does not exist' },
    });
    const response = await POST(post());
    expect(response.status).toBe(status);
    const body = await response.json();
    expect(body.error.code).toBe(errorCode);
    expect(JSON.stringify(body)).not.toContain("secret_internal");
  });
});
