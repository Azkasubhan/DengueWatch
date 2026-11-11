// @vitest-environment node
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessContext } from "@/features/areas/types";
import { query, queuedTables, type QueryMock } from "@/test/supabaseQuery";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  getAccessContext: vi.fn(),
  tables: {} as Record<string, QueryMock[]>,
  upload: vi.fn(),
  remove: vi.fn(),
  adminAvailable: true,
}));
vi.mock("@/lib/auth/context", () => ({
  getAccessContext: mocks.getAccessContext,
}));
vi.mock("@/features/reports/data", () => ({
  reportBucket: "report-photos",
  createStorageAdmin: () => {
    if (!mocks.adminAvailable) throw new Error("STORAGE_CONFIGURATION_MISSING");
    return {
      from: (table: string) => queuedTables(mocks.tables)(table),
      storage: {
        from: () => ({ upload: mocks.upload, remove: mocks.remove }),
      },
    };
  },
}));

import { POST } from "@/app/api/v1/report-uploads/route";
import { DELETE } from "@/app/api/v1/report-uploads/[id]/route";

const userId = "51000000-0000-4000-8000-000000000001";
const areaId = "52000000-0000-4000-8000-000000000001";
const uploadId = "54000000-0000-4000-8000-000000000001";

function context(
  role: AccessContext["role"] = "resident",
  verified = true,
): AccessContext {
  return {
    displayName: "Warga Uji",
    role,
    userId,
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

function signIn(value: AccessContext) {
  mocks.getAccessContext.mockResolvedValue({
    kind: "authenticated",
    context: value,
  });
}

async function png(width = 32, height = 24) {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 30, g: 120, b: 90 },
    },
  })
    .png()
    .toBuffer();
}

function uploadRequest(
  file: Blob | null,
  { origin = "http://localhost", name = "foto.png" } = {},
) {
  const form = new FormData();
  if (file) form.set("photo", file, name);
  return new Request("http://localhost/api/v1/report-uploads", {
    method: "POST",
    headers: { origin },
    body: form,
  });
}

function deleteRequest(id = uploadId, origin = "http://localhost") {
  return DELETE(
    new Request(`http://localhost/api/v1/report-uploads/${id}`, {
      method: "DELETE",
      headers: { origin },
    }),
    { params: Promise.resolve({ id }) },
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.tables = {};
  mocks.adminAvailable = true;
  mocks.upload.mockResolvedValue({ data: {}, error: null });
  mocks.remove.mockResolvedValue({ data: [], error: null });
  signIn(context());
});

describe("POST /api/v1/report-uploads", () => {
  it("normalizes a photo to WebP, reserves a lease, and stores it privately", async () => {
    const insert = query();
    const mark = query();
    mocks.tables = { report_uploads: [insert, mark] };
    const response = await POST(
      uploadRequest(new Blob([await png()], { type: "image/png" })),
    );
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({
      mimeType: "image/webp",
      width: 32,
      height: 24,
    });
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    const [row] = insert.calls.find(([name]) => name === "insert")![1] as [
      Record<string, unknown>,
    ];
    expect(row).toMatchObject({
      id: body.id,
      created_by: userId,
      storage_path: `${userId}/${body.id}.webp`,
      mime_type: "image/webp",
    });
    expect(mocks.upload).toHaveBeenCalledWith(
      `${userId}/${body.id}.webp`,
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/webp", upsert: false }),
    );
    expect(mark.calls.map(([name]) => name)).toContain("update");
  });

  it("rolls back the lease when storage rejects the object", async () => {
    const removeLease = query();
    mocks.tables = { report_uploads: [query(), removeLease] };
    mocks.upload.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    const response = await POST(
      uploadRequest(new Blob([await png()], { type: "image/png" })),
    );
    expect(response.status).toBe(503);
    expect(removeLease.calls).toContainEqual(["delete", []]);
  });

  it("rejects disguised files before reserving anything", async () => {
    const response = await POST(
      uploadRequest(new Blob(["<svg onload=alert(1)>"], { type: "image/png" })),
    );
    expect(response.status).toBe(415);
    expect((await response.json()).error.code).toBe("INVALID_IMAGE");
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("rejects requests without exactly one photo or above the size limit", async () => {
    expect((await POST(uploadRequest(null))).status).toBe(422);
    const tooLarge = new Blob([new Uint8Array(6 * 1024 * 1024 + 1)], {
      type: "image/png",
    });
    expect((await POST(uploadRequest(tooLarge))).status).toBe(413);
    const json = new Request("http://localhost/api/v1/report-uploads", {
      method: "POST",
      headers: {
        origin: "http://localhost",
        "content-type": "application/json",
      },
      body: "{}",
    });
    expect((await POST(json)).status).toBe(415);
  });

  it("enforces origin, role, and a verified membership", async () => {
    const photo = new Blob([await png()], { type: "image/png" });
    expect(
      (await POST(uploadRequest(photo, { origin: "https://evil.test" })))
        .status,
    ).toBe(403);
    signIn(context("cadre"));
    expect((await POST(uploadRequest(photo))).status).toBe(403);
    signIn(context("resident", false));
    expect((await POST(uploadRequest(photo))).status).toBe(403);
    mocks.getAccessContext.mockResolvedValueOnce({ kind: "unauthenticated" });
    expect((await POST(uploadRequest(photo))).status).toBe(401);
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it("fails closed when the storage key is not configured", async () => {
    mocks.adminAvailable = false;
    const response = await POST(
      uploadRequest(new Blob([await png()], { type: "image/png" })),
    );
    expect(response.status).toBe(503);
  });
});

describe("DELETE /api/v1/report-uploads/:id", () => {
  it("deletes the owner's unconsumed lease first, then its object", async () => {
    const del = query({
      data: [{ storage_path: `${userId}/${uploadId}.webp` }],
    });
    mocks.tables = { report_uploads: [del] };
    const response = await deleteRequest();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ deleted: true });
    expect(del.calls).toEqual(
      expect.arrayContaining([
        ["delete", []],
        ["eq", ["id", uploadId]],
        ["eq", ["created_by", userId]],
        ["is", ["consumed_at", null]],
      ]),
    );
    expect(mocks.remove).toHaveBeenCalledExactlyOnceWith([
      `${userId}/${uploadId}.webp`,
    ]);
  });

  it("keeps the object when a report consumed the upload first", async () => {
    // The conditional delete matches nothing once create_environmental_report set consumed_at.
    mocks.tables = { report_uploads: [query({ data: [] })] };
    const response = await deleteRequest();
    expect(response.status).toBe(404);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("does not remove the object when the row delete fails", async () => {
    mocks.tables = { report_uploads: [query({ error: { message: "down" } })] };
    expect((await deleteRequest()).status).toBe(503);
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("rejects invalid IDs, foreign origins, and non-residents", async () => {
    expect((await deleteRequest("not-a-uuid")).status).toBe(404);
    expect((await deleteRequest(uploadId, "https://evil.test")).status).toBe(
      403,
    );
    signIn(context("manager"));
    expect((await deleteRequest()).status).toBe(403);
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
