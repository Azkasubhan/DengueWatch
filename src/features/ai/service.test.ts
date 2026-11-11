// @vitest-environment node
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { query, queuedTables, type QueryMock } from "@/test/supabaseQuery";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  download: vi.fn(),
  tables: {} as Record<string, QueryMock[]>,
}));
vi.mock("@/integrations/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
vi.mock("@/features/reports/data", () => ({
  reportBucket: "report-photos",
  createStorageAdmin: () => ({
    from: (table: string) => queuedTables(mocks.tables)(table),
    storage: { from: () => ({ download: mocks.download }) },
  }),
}));

import { analyzeReportPhoto } from "@/features/ai/service";
import { AiRequestError } from "@/features/ai/config";
import { AiProviderError, type AiAdapter } from "@/features/ai/gemini";

const userId = "51000000-0000-4000-8000-000000000001";
const areaId = "52000000-0000-4000-8000-000000000001";
const uploadId = "54000000-0000-4000-8000-000000000001";

const suggestion = {
  visibleObjects: ["wadah air terbuka"],
  suggestedCategory: "water_container",
  draftDescription:
    "Foto menunjukkan wadah terbuka berisi air yang perlu diperiksa.",
  suggestedPrecaution: "Kosongkan dan tutup wadah jika aman dilakukan.",
  requiresHumanVerification: true,
  limitations: "Foto tidak dapat memastikan adanya jentik.",
};

let webp: Buffer;
let saved: QueryMock;

function uploadRow(overrides: Record<string, unknown> = {}) {
  return {
    storage_path: `${userId}/${uploadId}.webp`,
    mime_type: "image/webp",
    byte_size: webp.length,
    width: 16,
    height: 12,
    uploaded_at: "2026-11-11T02:00:00Z",
    consumed_at: null,
    expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    ...overrides,
  };
}

function prepare(row: Record<string, unknown> | null) {
  saved = query({ data: [{ id: "analysis-1" }] });
  mocks.tables = {
    report_uploads: [query({ data: row })],
    ai_analyses: [saved],
  };
}

const adapter = (analyze: AiAdapter["analyze"]): AiAdapter => ({ analyze });
const okAdapter = adapter(async () => ({ text: JSON.stringify(suggestion) }));

function run(withAdapter: AiAdapter = okAdapter) {
  return analyzeReportPhoto({ userId, areaId, uploadId, adapter: withAdapter });
}

async function expectRequestError(
  promise: Promise<unknown>,
  status: number,
  code: string,
) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(AiRequestError);
  expect(error).toMatchObject({ status, code });
}

function savedUpdate() {
  return saved.calls.find(([name]) => name === "update")![1][0] as Record<
    string,
    unknown
  >;
}

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubEnv("GEMINI_MODEL", "gemini-test-model");
  webp = await sharp({
    create: { width: 16, height: 12, channels: 3, background: "white" },
  })
    .webp()
    .toBuffer();
  mocks.rpc.mockResolvedValue({ data: "analysis-1", error: null });
  mocks.download.mockResolvedValue({
    data: new Blob([new Uint8Array(webp)]),
    error: null,
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("analyzeReportPhoto", () => {
  it("returns a validated suggestion and records success", async () => {
    prepare(uploadRow());
    await expect(run()).resolves.toEqual({
      analysisId: "analysis-1",
      suggestion,
    });
    expect(savedUpdate()).toMatchObject({
      status: "success",
      error_code: null,
    });
  });

  it("reports an expired upload as not found, not as unsafe AI output", async () => {
    prepare(uploadRow({ expires_at: "2026-01-01T00:00:00Z" }));
    const analyze = vi.fn(okAdapter.analyze);
    await expectRequestError(run(adapter(analyze)), 404, "NOT_FOUND");
    expect(analyze).not.toHaveBeenCalled();
    expect(savedUpdate()).toMatchObject({
      status: "error",
      error_code: "NOT_FOUND",
    });
  });

  it("reports a consumed or missing upload as not found", async () => {
    prepare(uploadRow({ consumed_at: "2026-11-11T02:30:00Z" }));
    await expectRequestError(run(), 404, "NOT_FOUND");
    prepare(null);
    await expectRequestError(run(), 404, "NOT_FOUND");
  });

  it("reports a storage outage as AI unavailable", async () => {
    prepare(uploadRow());
    mocks.download.mockResolvedValueOnce({
      data: null,
      error: { message: "x" },
    });
    await expectRequestError(run(), 503, "AI_UNAVAILABLE");
    expect(savedUpdate()).toMatchObject({
      status: "error",
      error_code: "AI_UNAVAILABLE",
    });
  });

  it("reports stored bytes that do not match the lease as an invalid image", async () => {
    prepare(uploadRow({ byte_size: webp.length + 1 }));
    await expectRequestError(run(), 422, "INVALID_IMAGE");
  });

  it("keeps AI_INVALID_OUTPUT for model output that fails validation", async () => {
    prepare(uploadRow());
    const unsafe = adapter(async () => ({
      text: JSON.stringify({ ...suggestion, extra: "100% ada jentik" }),
    }));
    await expectRequestError(run(unsafe), 502, "AI_INVALID_OUTPUT");
    expect(savedUpdate()).toMatchObject({ status: "rejected" });
  });

  it("maps provider timeouts", async () => {
    prepare(uploadRow());
    const slow = adapter(async () => {
      throw new AiProviderError("TIMEOUT");
    });
    await expectRequestError(run(slow), 503, "AI_TIMEOUT");
    expect(savedUpdate()).toMatchObject({ status: "timeout" });
  });

  it("maps reservation failures without running the model", async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0409" } });
    await expectRequestError(run(), 409, "CONCURRENT_REQUEST");
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: "P0403" } });
    await expectRequestError(run(), 403, "FORBIDDEN");
    expect(mocks.download).not.toHaveBeenCalled();
  });
});
