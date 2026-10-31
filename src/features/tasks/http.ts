import "server-only";

import { z, type ZodType } from "zod";
import { createClient } from "@/integrations/supabase/server";
import { decidePortalAccess } from "@/features/areas/access";
import {
  cadreContext,
  readJsonBody,
  reportError,
  reportJson,
  sameOrigin,
  validationResponse,
} from "@/features/reports/http";
import { getAccessContext } from "@/lib/auth/context";

// Task reads are open to verified cadres and managers; RLS scopes the rows.
export async function taskReaderContext() {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated")
    return {
      error: reportError(401, "UNAUTHENTICATED", "Masuk untuk melanjutkan."),
    };
  if (access.kind !== "authenticated")
    return {
      error: reportError(
        503,
        "SERVICE_UNAVAILABLE",
        "Layanan tugas belum tersedia.",
      ),
    };
  const role = access.context.role;
  if (
    role === "resident" ||
    decidePortalAccess(access.context, role).kind !== "allowed"
  )
    return {
      error: reportError(
        403,
        "FORBIDDEN",
        "Akun ini tidak memiliki izin melihat tugas.",
      ),
    };
  return { context: access.context };
}

export function parseTaskId(id: string) {
  return z.uuid().safeParse(id).success
    ? null
    : reportError(404, "NOT_FOUND", "Tugas tidak ditemukan.");
}

// Maps ActionLoop RPC SQLSTATEs without exposing database messages.
export function taskRpcError(error: { code?: string; message?: string }) {
  const message = error.message;
  switch (error.code) {
    case "P0401":
      return reportError(401, "UNAUTHENTICATED", "Masuk untuk melanjutkan.");
    case "P0403":
      if (message === "self review not permitted")
        return reportError(
          403,
          "SELF_REVIEW_FORBIDDEN",
          "Bukti harus diperiksa kader lain, bukan pengirimnya.",
        );
      if (message === "task not assigned to user")
        return reportError(
          403,
          "NOT_ASSIGNEE",
          "Hanya kader yang ditugaskan dapat melakukan tindakan ini.",
        );
      return reportError(
        403,
        "FORBIDDEN",
        "Akun ini tidak memiliki izin untuk tindakan ini.",
      );
    case "P0404":
      return message === "report not found"
        ? reportError(404, "NOT_FOUND", "Laporan tidak ditemukan.")
        : reportError(404, "NOT_FOUND", "Tugas tidak ditemukan.");
    case "P0409":
      if (message === "idempotency conflict")
        return reportError(
          409,
          "IDEMPOTENCY_CONFLICT",
          "Kunci permintaan sudah dipakai untuk data lain.",
        );
      if (message === "upload references unavailable")
        return reportError(
          409,
          "UPLOAD_UNAVAILABLE",
          "Foto bukti tidak tersedia untuk tugas ini. Unggah ulang foto.",
        );
      return reportError(
        409,
        "STALE_VERSION",
        "Tugas telah diperbarui. Muat ulang lalu coba lagi.",
      );
    case "P0422":
      if (
        message === "invalid task transition" ||
        message === "invalid report transition"
      )
        return reportError(
          422,
          "INVALID_TRANSITION",
          "Status tugas atau laporan tidak mengizinkan tindakan ini.",
        );
      if (message === "invalid task assignee")
        return reportError(
          422,
          "VALIDATION_ERROR",
          "Petugas tidak valid untuk wilayah ini.",
          { assignedTo: "Pilih kader terverifikasi di wilayah laporan." },
        );
      if (message === "evidence unavailable")
        return reportError(
          422,
          "EVIDENCE_UNAVAILABLE",
          "Bukti tidak tersedia sehingga tugas tidak dapat diselesaikan.",
        );
      return reportError(
        422,
        "VALIDATION_ERROR",
        "Periksa kembali data yang diisi.",
      );
    case "P0429":
      return reportError(
        429,
        "RATE_LIMIT",
        "Batas unggahan sementara tercapai. Coba lagi nanti.",
      );
    case "23514":
      return reportError(422, "INVALID_IMAGE", "Foto tidak dapat diproses.");
    default:
      return reportError(
        503,
        "SERVICE_UNAVAILABLE",
        "Permintaan belum dapat diproses. Coba lagi.",
      );
  }
}

type TaskRpcRow = {
  task_id: string;
  status: string;
  version: number;
  report_status: string;
  report_version: number;
};

export function taskMutationJson(
  data: TaskRpcRow[] | null,
  status = 200,
): Response {
  const row = data?.[0];
  if (!row) return taskRpcError({});
  return reportJson(
    {
      data: {
        id: row.task_id,
        status: row.status,
        version: row.version,
        reportStatus: row.report_status,
        reportVersion: row.report_version,
      },
    },
    status,
  );
}

// Shared POST flow for versioned task actions; the RPC re-checks every rule.
export async function runTaskAction<T>(
  request: Request,
  params: Promise<{ id: string }>,
  schema: ZodType<T>,
  rpc: string,
  args: (id: string, input: T) => Record<string, unknown>,
) {
  if (!sameOrigin(request))
    return reportError(403, "FORBIDDEN", "Asal permintaan tidak valid.");
  const auth = await cadreContext();
  if (auth.error) return auth.error;
  const { id } = await params;
  const invalidId = parseTaskId(id);
  if (invalidId) return invalidId;
  const json = await readJsonBody(request, 8 * 1024);
  if (json.error) return json.error;
  const parsed = schema.safeParse(json.body);
  if (!parsed.success) return validationResponse(parsed.error);
  const client = await createClient();
  const result = await client.rpc(rpc, args(id, parsed.data));
  if (result.error) return taskRpcError(result.error);
  return taskMutationJson(result.data);
}
