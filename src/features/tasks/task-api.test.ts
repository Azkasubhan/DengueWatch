// @vitest-environment node
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AccessContext } from "@/features/areas/types";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  getAccessContext: vi.fn(),
  listTasks: vi.fn(),
  getTaskDetail: vi.fn(),
  storageUpload: vi.fn(),
  leaseUpdate: vi.fn(),
}));
vi.mock("@/integrations/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/lib/auth/context", () => ({
  getAccessContext: mocks.getAccessContext,
}));
vi.mock("@/features/tasks/data", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/tasks/data")>()),
  listTasks: mocks.listTasks,
  getTaskDetail: mocks.getTaskDetail,
}));
vi.mock("@/features/reports/data", () => ({
  reportBucket: "report-photos",
  createStorageAdmin: () => ({
    storage: {
      from: () => ({ upload: mocks.storageUpload, remove: vi.fn() }),
    },
    from: () => ({
      update: () => ({ eq: () => ({ eq: mocks.leaseUpdate }) }),
      delete: () => ({ eq: () => ({ eq: async () => ({ error: null }) }) }),
    }),
  }),
}));

import { POST as createTask } from "@/app/api/v1/reports/[id]/tasks/route";
import { GET as listRoute } from "@/app/api/v1/tasks/route";
import { GET as detailRoute } from "@/app/api/v1/tasks/[id]/route";
import { POST as startTask } from "@/app/api/v1/tasks/[id]/start/route";
import { POST as submitEvidence } from "@/app/api/v1/tasks/[id]/evidence/route";
import { POST as reviewEvidence } from "@/app/api/v1/tasks/[id]/review/route";
import { POST as cancelTask } from "@/app/api/v1/tasks/[id]/cancel/route";
import { POST as reopenTask } from "@/app/api/v1/tasks/[id]/reopen/route";
import { POST as uploadEvidence } from "@/app/api/v1/tasks/[id]/evidence-uploads/route";
import { toTask } from "@/features/tasks/data";

const areaId = "62000000-0000-4000-8000-000000000001";
const reportId = "63000000-0000-4000-8000-000000000001";
const taskId = "69000000-0000-4000-8000-000000000001";
const userId = "61000000-0000-4000-8000-000000000002";
const otherCadre = "61000000-0000-4000-8000-000000000003";
const uploadId = "64000000-0000-4000-8000-000000000001";

function context(
  role: AccessContext["role"],
  membershipType: AccessContext["memberships"][number]["membershipType"],
  verified = true,
): AccessContext {
  return {
    displayName: "Uji",
    role,
    userId,
    memberships: [
      {
        area: { code: "M6-A", id: areaId, isDemo: true, name: "Area Uji" },
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

function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new Request(`http://localhost${path}`, {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

const params = (id = taskId) => ({ params: Promise.resolve({ id }) });
const taskRow = {
  task_id: taskId,
  status: "in_progress",
  version: 2,
  report_status: "in_action",
  report_version: 3,
};
const validTask = {
  title: "Kuras wadah balai",
  description: "Kuras dan tutup wadah air di balai warga.",
  assignedTo: userId,
};
const createPath = `/api/v1/reports/${reportId}/tasks`;
const key = { "idempotency-key": "m6-key-task-0001" };

beforeEach(() => {
  vi.clearAllMocks();
  signIn(context("cadre", "assigned_cadre"));
  mocks.rpc.mockResolvedValue({ data: [taskRow], error: null });
  mocks.storageUpload.mockResolvedValue({ error: null });
  mocks.leaseUpdate.mockResolvedValue({ error: null });
});

describe("POST /api/v1/reports/:id/tasks", () => {
  it("rejects cross-origin requests", async () => {
    const response = await createTask(
      post(createPath, validTask, { ...key, origin: "https://evil.test" }),
      params(reportId),
    );
    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["unauthenticated", null, 401],
    ["resident", context("resident", "resident"), 403],
    ["manager", context("manager", "manager"), 403],
    ["unverified cadre", context("cadre", "assigned_cadre", false), 403],
  ] as const)("denies %s", async (_label, actor, status) => {
    signIn(actor);
    const response = await createTask(
      post(createPath, validTask, key),
      params(reportId),
    );
    expect(response.status).toBe(status);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("requires an Idempotency-Key", async () => {
    const response = await createTask(
      post(createPath, validTask),
      params(reportId),
    );
    expect(response.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...validTask, title: "Kur" }, "title"],
    [{ ...validTask, description: "pendek" }, "description"],
    [{ ...validTask, assignedTo: "me" }, "assignedTo"],
    [{ ...validTask, dueAt: "2026-11-05T10:00:00" }, "dueAt"],
    [{ ...validTask, isMandatory: "yes" }, "isMandatory"],
    [{ ...validTask, status: "completed" }, "body"],
  ])("rejects invalid payload %j", async (body, field) => {
    const response = await createTask(
      post(createPath, body, key),
      params(reportId),
    );
    expect(response.status).toBe(422);
    expect(Object.keys((await response.json()).error.fieldErrors)).toContain(
      field,
    );
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("creates through the RPC and returns camelCase", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ ...taskRow, status: "assigned", version: 1 }],
      error: null,
    });
    const response = await createTask(
      post(
        createPath,
        { ...validTask, dueAt: "2026-11-05T10:00:00+07:00" },
        key,
      ),
      params(reportId),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: {
        id: taskId,
        status: "assigned",
        version: 1,
        reportStatus: "in_action",
        reportVersion: 3,
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("create_action_task", {
      p_report_id: reportId,
      p_title: validTask.title,
      p_description: validTask.description,
      p_assigned_to: userId,
      p_due_at: "2026-11-05T10:00:00+07:00",
      p_is_mandatory: true,
      p_idempotency_key: "m6-key-task-0001",
    });
  });

  it.each([
    ["P0409", "idempotency conflict", 409, "IDEMPOTENCY_CONFLICT"],
    ["P0422", "invalid task assignee", 422, "VALIDATION_ERROR"],
    ["P0422", "invalid report transition", 422, "INVALID_TRANSITION"],
    ["P0404", "report not found", 404, "NOT_FOUND"],
  ])("maps %s %s", async (code, message, status, errorCode) => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code, message } });
    const response = await createTask(
      post(createPath, validTask, key),
      params(reportId),
    );
    expect(response.status).toBe(status);
    const text = await response.text();
    expect(JSON.parse(text).error.code).toBe(errorCode);
    expect(text).not.toContain(message);
  });
});

describe("task action routes", () => {
  const path = (action: string) => `/api/v1/tasks/${taskId}/${action}`;

  it("manager and resident cannot run task actions", async () => {
    for (const actor of [
      context("manager", "manager"),
      context("resident", "resident"),
    ]) {
      signIn(actor);
      const response = await startTask(
        post(path("start"), { expectedVersion: 1 }),
        params(),
      );
      expect(response.status).toBe(403);
    }
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("treats malformed task ids as not found", async () => {
    const response = await startTask(
      post("/api/v1/tasks/x/start", { expectedVersion: 1 }),
      params("x"),
    );
    expect(response.status).toBe(404);
  });

  it("forwards each action to its RPC", async () => {
    await startTask(post(path("start"), { expectedVersion: 1 }), params());
    await submitEvidence(
      post(path("evidence"), {
        uploadId,
        description: "  Wadah sudah dikuras dan ditutup.  ",
        expectedVersion: 2,
      }),
      params(),
    );
    await reviewEvidence(
      post(path("review"), { decision: "approve", expectedVersion: 3 }),
      params(),
    );
    await cancelTask(
      post(path("cancel"), {
        reason: "Ditangani pengelola fasilitas.",
        expectedVersion: 1,
      }),
      params(),
    );
    await reopenTask(
      post(path("reopen"), {
        reason: "Genangan muncul kembali.",
        expectedVersion: 4,
      }),
      params(),
    );
    expect(mocks.rpc.mock.calls).toEqual([
      ["start_action_task", { p_task_id: taskId, p_expected_version: 1 }],
      [
        "submit_task_evidence",
        {
          p_task_id: taskId,
          p_upload_id: uploadId,
          p_description: "Wadah sudah dikuras dan ditutup.",
          p_expected_version: 2,
        },
      ],
      [
        "review_task_evidence",
        {
          p_task_id: taskId,
          p_decision: "approve",
          p_reason: null,
          p_expected_version: 3,
        },
      ],
      [
        "cancel_action_task",
        {
          p_task_id: taskId,
          p_reason: "Ditangani pengelola fasilitas.",
          p_expected_version: 1,
        },
      ],
      [
        "reopen_action_task",
        {
          p_task_id: taskId,
          p_reason: "Genangan muncul kembali.",
          p_expected_version: 4,
        },
      ],
    ]);
  });

  it.each([
    ["start", { expectedVersion: "1" }],
    ["start", { expectedVersion: 1, status: "completed" }],
    ["evidence", { description: "Bukti tanpa foto.", expectedVersion: 2 }],
    ["review", { decision: "request_revision", expectedVersion: 3 }],
    ["review", { decision: "complete", expectedVersion: 3 }],
    ["cancel", { expectedVersion: 1 }],
    ["reopen", { reason: "Lagi", expectedVersion: 1 }],
  ])("rejects invalid %s payload %j", async (action, body) => {
    const handler = {
      start: startTask,
      evidence: submitEvidence,
      review: reviewEvidence,
      cancel: cancelTask,
      reopen: reopenTask,
    }[action]!;
    const response = await handler(post(path(action), body), params());
    expect(response.status).toBe(422);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["P0403", "self review not permitted", 403, "SELF_REVIEW_FORBIDDEN"],
    ["P0403", "task not assigned to user", 403, "NOT_ASSIGNEE"],
    ["P0403", "action not permitted", 403, "FORBIDDEN"],
    ["P0404", "task not found", 404, "NOT_FOUND"],
    ["P0409", "stale task version", 409, "STALE_VERSION"],
    ["P0409", "upload references unavailable", 409, "UPLOAD_UNAVAILABLE"],
    ["P0422", "invalid task transition", 422, "INVALID_TRANSITION"],
    ["P0422", "evidence unavailable", 422, "EVIDENCE_UNAVAILABLE"],
    [
      "42P01",
      'relation "public.action_tasks" does not exist',
      503,
      "SERVICE_UNAVAILABLE",
    ],
  ])(
    "maps %s %s to %i without leaking SQL",
    async (code, message, status, errorCode) => {
      mocks.rpc.mockResolvedValue({ data: null, error: { code, message } });
      const response = await reviewEvidence(
        post(path("review"), { decision: "approve", expectedVersion: 3 }),
        params(),
      );
      expect(response.status).toBe(status);
      const text = await response.text();
      expect(JSON.parse(text).error.code).toBe(errorCode);
      expect(text).not.toContain(message);
    },
  );
});

describe("task reads", () => {
  beforeEach(() => {
    mocks.listTasks.mockResolvedValue({ data: [], count: 0, error: null });
  });

  it("denies residents and unverified cadres", async () => {
    for (const actor of [
      context("resident", "resident"),
      context("cadre", "assigned_cadre", false),
    ]) {
      signIn(actor);
      const response = await listRoute(
        new Request("http://localhost/api/v1/tasks"),
      );
      expect(response.status).toBe(403);
    }
    expect(mocks.listTasks).not.toHaveBeenCalled();
  });

  it("lets managers read with filters", async () => {
    signIn(context("manager", "manager"));
    const response = await listRoute(
      new Request(
        `http://localhost/api/v1/tasks?status=awaiting_review,in_progress&reportId=${reportId}&page=2&limit=5`,
      ),
    );
    expect(response.status).toBe(200);
    expect(mocks.listTasks).toHaveBeenCalledWith(
      2,
      5,
      { status: ["awaiting_review", "in_progress"], reportId },
      userId,
    );
  });

  it.each(["status=draft", "assignee=someone", "limit=500", "extra=1"])(
    "rejects invalid query %s",
    async (query) => {
      const response = await listRoute(
        new Request(`http://localhost/api/v1/tasks?${query}`),
      );
      expect(response.status).toBe(422);
    },
  );

  it("returns 404 for tasks hidden by RLS", async () => {
    mocks.getTaskDetail.mockResolvedValue(null);
    const response = await detailRoute(
      new Request("http://localhost/"),
      params(),
    );
    expect(response.status).toBe(404);
  });

  it("maps rows to camelCase without exposing other profile ids", () => {
    const dto = toTask(
      {
        id: taskId,
        report_id: reportId,
        area_id: areaId,
        title: "Kuras wadah balai",
        description: "Kuras dan tutup wadah air di balai warga.",
        assigned_to: otherCadre,
        created_by: userId,
        status: "awaiting_review",
        is_mandatory: true,
        due_at: null,
        completed_at: null,
        version: 3,
        created_at: "2026-10-31T10:00:00Z",
        updated_at: "2026-10-31T11:00:00Z",
        reports: { public_reference: "DW-2026-000001" },
      },
      userId,
    );
    expect(dto).toMatchObject({
      reportId,
      reportReference: "DW-2026-000001",
      isMandatory: true,
      assignedToMe: false,
      createdByMe: true,
    });
    expect(JSON.stringify(dto)).not.toContain(otherCadre);
    expect(Object.keys(dto).every((name) => !name.includes("_"))).toBe(true);
  });
});

describe("POST /api/v1/tasks/:id/evidence-uploads", () => {
  const path = `/api/v1/tasks/${taskId}/evidence-uploads`;

  async function multipart(file: File, origin = "http://localhost") {
    const form = new FormData();
    form.append("photo", file);
    const encoded = new Request("http://localhost/", {
      method: "POST",
      body: form,
    });
    return new Request(`http://localhost${path}`, {
      method: "POST",
      headers: {
        origin,
        "content-type": encoded.headers.get("content-type")!,
      },
      body: await encoded.arrayBuffer(),
    });
  }

  async function samplePhoto() {
    const bytes = await readFile(
      resolve("assets/demo-reports/water-container.png"),
    );
    return new File([bytes], "bukti.png", { type: "image/png" });
  }

  it("denies managers before reading the file", async () => {
    signIn(context("manager", "manager"));
    const response = await uploadEvidence(
      await multipart(await samplePhoto()),
      params(),
    );
    expect(response.status).toBe(403);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects disguised files before reserving a lease", async () => {
    const fake = new File([new TextEncoder().encode("%PDF-1.7")], "x.png", {
      type: "image/png",
    });
    const response = await uploadEvidence(await multipart(fake), params());
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect((await response.json()).error.code).toBe("INVALID_IMAGE");
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.storageUpload).not.toHaveBeenCalled();
  });

  it("does not store bytes when the task lease is refused", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { code: "P0403", message: "task not assigned to user" },
    });
    const response = await uploadEvidence(
      await multipart(await samplePhoto()),
      params(),
    );
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("NOT_ASSIGNEE");
    expect(mocks.storageUpload).not.toHaveBeenCalled();
  });

  it("stores the re-encoded WebP at the RPC-issued path", async () => {
    const leasePath = `${userId}/${uploadId}.webp`;
    mocks.rpc.mockResolvedValue({
      data: [{ upload_id: uploadId, storage_path: leasePath }],
      error: null,
    });
    const response = await uploadEvidence(
      await multipart(await samplePhoto()),
      params(),
    );
    expect(response.status).toBe(201);
    const json = await response.json();
    expect(json.data).toMatchObject({ id: uploadId, mimeType: "image/webp" });
    expect(mocks.rpc).toHaveBeenCalledWith(
      "reserve_task_evidence_upload",
      expect.objectContaining({ p_task_id: taskId }),
    );
    expect(mocks.storageUpload).toHaveBeenCalledWith(
      leasePath,
      expect.anything(),
      expect.objectContaining({ contentType: "image/webp", upsert: false }),
    );
  });
});
