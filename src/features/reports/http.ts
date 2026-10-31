import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { decidePortalAccess } from "@/features/areas/access";
import { getAccessContext } from "@/lib/auth/context";
import { requestOrigin } from "@/lib/http/requestOrigin";

export function reportJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export function reportError(
  status: number,
  code: string,
  message: string,
  fieldErrors?: Record<string, string>,
) {
  return reportJson(
    {
      error: {
        code,
        message,
        ...(fieldErrors ? { fieldErrors } : {}),
        requestId: randomUUID(),
      },
    },
    status,
  );
}

export function validationResponse(error: ZodError) {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const name = issue.path.join(".") || "body";
    fields[name] ??= issue.message;
  }
  return reportError(
    422,
    "VALIDATION_ERROR",
    "Periksa kembali data yang diisi.",
    fields,
  );
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = requestOrigin(request);
  if (!origin || !expected) return false;
  try {
    return new URL(origin).origin === expected;
  } catch {
    return false;
  }
}

export async function residentContext() {
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
        "Layanan laporan belum tersedia.",
      ),
    };
  if (access.context.role !== "resident")
    return {
      error: reportError(
        403,
        "FORBIDDEN",
        "Akun ini tidak memiliki izin membuat laporan.",
      ),
    };
  return { context: access.context };
}

// Reviews require role cadre plus a verified assigned_cadre membership.
export async function cadreContext() {
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
        "Layanan laporan belum tersedia.",
      ),
    };
  if (decidePortalAccess(access.context, "cadre").kind !== "allowed")
    return {
      error: reportError(
        403,
        "FORBIDDEN",
        "Akun ini tidak memiliki izin memeriksa laporan.",
      ),
    };
  return { context: access.context };
}

// Maps M5 RPC SQLSTATEs without exposing database messages.
export function reviewRpcError(error: { code?: string; message?: string }) {
  switch (error.code) {
    case "P0401":
      return reportError(401, "UNAUTHENTICATED", "Masuk untuk melanjutkan.");
    case "P0403":
      return reportError(
        403,
        "FORBIDDEN",
        "Akun ini tidak memiliki izin untuk tindakan ini.",
      );
    case "P0404":
      return reportError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
    case "P0409":
      return reportError(
        409,
        "STALE_VERSION",
        "Laporan telah diperbarui. Muat ulang lalu coba lagi.",
      );
    case "P0422":
      if (error.message === "invalid report transition")
        return reportError(
          422,
          "INVALID_TRANSITION",
          "Status laporan tidak dapat diubah dengan tindakan ini.",
        );
      if (error.message === "invalid duplicate target")
        return reportError(
          422,
          "VALIDATION_ERROR",
          "Laporan rujukan duplikat tidak valid.",
          {
            duplicateOfReportId:
              "Pilih laporan yang lebih awal di wilayah yang sama.",
          },
        );
      return reportError(
        422,
        "VALIDATION_ERROR",
        "Periksa kembali data yang diisi.",
      );
    default:
      return reportError(
        503,
        "SERVICE_UNAVAILABLE",
        "Permintaan belum dapat diproses. Coba lagi.",
      );
  }
}

export async function readJsonBody(
  request: Request,
  limit: number,
): Promise<{ body: unknown; error?: never } | { error: Response }> {
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return {
      error: reportError(415, "UNSUPPORTED_MEDIA_TYPE", "Gunakan JSON."),
    };
  try {
    return {
      body: JSON.parse(
        (await readLimitedBody(request, limit)).toString("utf8"),
      ),
    };
  } catch (error) {
    return {
      error:
        error instanceof Error && error.message === "BODY_TOO_LARGE"
          ? reportError(413, "BODY_TOO_LARGE", "Data terlalu besar.")
          : reportError(400, "MALFORMED_BODY", "JSON tidak valid."),
    };
  }
}

export async function readLimitedBody(request: Request, limit: number) {
  if (!request.body) throw new Error("EMPTY_BODY");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new Error("BODY_TOO_LARGE");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}
