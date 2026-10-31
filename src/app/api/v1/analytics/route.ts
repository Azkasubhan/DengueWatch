import { decidePortalAccess } from "@/features/areas/access";
import { getManagerSummary } from "@/features/analytics/data";
import { summaryQuerySchema } from "@/features/analytics/validation";
import {
  reportError,
  reportJson,
  validationResponse,
} from "@/features/reports/http";
import { getAccessContext } from "@/lib/auth/context";

export async function GET(request: Request) {
  const access = await getAccessContext();
  if (access.kind === "unauthenticated")
    return reportError(401, "UNAUTHENTICATED", "Masuk untuk melanjutkan.");
  if (access.kind !== "authenticated")
    return reportError(503, "SERVICE_UNAVAILABLE", "Ringkasan belum tersedia.");
  if (decidePortalAccess(access.context, "manager").kind !== "allowed")
    return reportError(
      403,
      "FORBIDDEN",
      "Akun ini tidak memiliki izin melihat ringkasan.",
    );
  const parsed = summaryQuerySchema().safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsed.success) return validationResponse(parsed.error);
  const result = await getManagerSummary(parsed.data);
  if (result.error) {
    const code = (result.error as { code?: string }).code;
    if (code === "P0404")
      return reportError(404, "NOT_FOUND", "Wilayah tidak tersedia.");
    if (code === "P0403")
      return reportError(
        403,
        "FORBIDDEN",
        "Akun ini tidak memiliki izin melihat ringkasan.",
      );
    if (code === "P0422")
      return reportError(
        422,
        "VALIDATION_ERROR",
        "Rentang tanggal tidak valid.",
      );
    return reportError(503, "SERVICE_UNAVAILABLE", "Ringkasan belum tersedia.");
  }
  return reportJson({ data: result.data });
}
