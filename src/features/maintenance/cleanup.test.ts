// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  CleanupError,
  runScheduledCleanup,
} from "@/features/maintenance/cleanup";
import {
  query,
  queuedTables,
  type QueryMock,
  type QueryResult,
} from "@/test/supabaseQuery";

function fakeAdmin(
  tables: Record<string, QueryMock[]>,
  removeResult: QueryResult = {},
) {
  const remove = vi.fn(async () => ({
    data: null,
    error: null,
    ...removeResult,
  }));
  const admin = {
    from: vi.fn(queuedTables(tables)),
    storage: { from: vi.fn(() => ({ remove })) },
  };
  return { admin: admin as never, remove };
}

const now = new Date("2026-11-11T12:00:00Z");

describe("runScheduledCleanup", () => {
  it("deletes expired unconsumed leases first, then only their objects", async () => {
    const select = query({ data: [{ id: "u1" }, { id: "u2" }] });
    // u2 was consumed by a report meanwhile, so only u1 comes back from the delete.
    const del = query({ data: [{ storage_path: "user/u1.webp" }] });
    const ai = query({ data: [] });
    const { admin, remove } = fakeAdmin({
      report_uploads: [select, del],
      ai_analyses: [ai],
    });
    const result = await runScheduledCleanup(admin, now);
    expect(result).toEqual({
      uploads: { rows: 1, orphanedObjects: 0 },
      aiAnalyses: { rows: 0 },
    });
    expect(del.calls).toEqual(
      expect.arrayContaining([
        ["delete", []],
        ["in", ["id", ["u1", "u2"]]],
        ["is", ["consumed_at", null]],
        ["lt", ["expires_at", now.toISOString()]],
      ]),
    );
    expect(remove).toHaveBeenCalledExactlyOnceWith(["user/u1.webp"]);
  });

  it("does not touch storage when every lease was consumed meanwhile", async () => {
    const { admin, remove } = fakeAdmin({
      report_uploads: [query({ data: [{ id: "u1" }] }), query({ data: [] })],
      ai_analyses: [query({ data: [] })],
    });
    await runScheduledCleanup(admin, now);
    expect(remove).not.toHaveBeenCalled();
  });

  it("reports objects that could not be removed", async () => {
    const { admin } = fakeAdmin(
      {
        report_uploads: [
          query({ data: [{ id: "u1" }] }),
          query({ data: [{ storage_path: "user/u1.webp" }] }),
        ],
        ai_analyses: [query({ data: [] })],
      },
      { error: { message: "storage down" } },
    );
    const result = await runScheduledCleanup(admin, now);
    expect(result.uploads).toEqual({ rows: 1, orphanedObjects: 1 });
  });

  it("removes AI analyses older than 30 days", async () => {
    const select = query({ data: [{ id: "a1" }, { id: "a2" }] });
    const del = query({});
    const { admin } = fakeAdmin({
      report_uploads: [query({ data: [] })],
      ai_analyses: [select, del],
    });
    const result = await runScheduledCleanup(admin, now);
    expect(result.aiAnalyses).toEqual({ rows: 2 });
    expect(select.calls).toContainEqual([
      "lt",
      ["created_at", "2026-10-12T12:00:00.000Z"],
    ]);
    expect(del.calls).toContainEqual(["in", ["id", ["a1", "a2"]]]);
  });

  it("fails loudly on query errors", async () => {
    const { admin } = fakeAdmin({
      report_uploads: [query({ error: { message: "denied" } })],
    });
    await expect(runScheduledCleanup(admin, now)).rejects.toBeInstanceOf(
      CleanupError,
    );
  });
});
