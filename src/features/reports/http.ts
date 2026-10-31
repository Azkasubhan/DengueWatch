import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { getAccessContext } from "@/lib/auth/context";

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
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
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
