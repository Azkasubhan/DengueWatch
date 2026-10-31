import { analyzeReportSchema } from "@/features/ai/schema";
import { AiRequestError } from "@/features/ai/config";
import { analyzeReportPhoto } from "@/features/ai/service";
import { localTestAdapter } from "@/features/ai/test-adapter";
import {
  readLimitedBody,
  reportError,
  reportJson,
  residentContext,
  sameOrigin,
  validationResponse,
} from "@/features/reports/http";

export const maxDuration = 40;

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return reportError(403, "FORBIDDEN", "Asal permintaan tidak valid.");
  const auth = await residentContext();
  if (auth.error) return auth.error;
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reportError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Gunakan JSON untuk permintaan AI.",
    );
  let body: unknown;
  try {
    body = JSON.parse((await readLimitedBody(request, 2048)).toString("utf8"));
  } catch (error) {
    return error instanceof Error && error.message === "BODY_TOO_LARGE"
      ? reportError(413, "BODY_TOO_LARGE", "Permintaan terlalu besar.")
      : reportError(400, "MALFORMED_BODY", "JSON tidak valid.");
  }
  const parsed = analyzeReportSchema.safeParse(body);
  if (!parsed.success) return validationResponse(parsed.error);
  const { areaId, uploadId } = parsed.data;
  if (
    !auth.context!.memberships.some(
      (member) =>
        member.areaId === areaId &&
        member.membershipType === "resident" &&
        member.verifiedAt &&
        member.area,
    )
  )
    return reportError(
      403,
      "FORBIDDEN",
      "Wilayah tidak tersedia untuk akun ini.",
    );
  try {
    const result = await analyzeReportPhoto({
      userId: auth.context!.userId,
      areaId,
      uploadId,
      adapter:
        localTestAdapter(request.headers.get("x-ai-test-scenario")) ??
        undefined,
      signal: request.signal,
    });
    return reportJson({ data: result });
  } catch (error) {
    if (error instanceof AiRequestError) {
      const messages: Record<string, string> = {
        FORBIDDEN: "Wilayah tidak tersedia untuk akun ini.",
        NOT_FOUND: "Foto tidak ditemukan atau sudah kedaluwarsa.",
        RATE_LIMIT:
          "Batas bantuan AI tercapai. Coba lagi nanti atau lanjutkan manual.",
        CONCURRENT_REQUEST:
          "Analisis sebelumnya masih berjalan. Tunggu sebentar.",
        INVALID_IMAGE:
          "Foto belum dapat dianalisis. Anda dapat melanjutkan manual.",
        AI_TIMEOUT:
          "Analisis AI terlalu lama. Anda tetap dapat melanjutkan laporan secara manual.",
        AI_INVALID_OUTPUT:
          "Saran AI tidak aman atau tidak valid. Anda tetap dapat melanjutkan laporan secara manual.",
      };
      return reportError(
        error.status,
        error.code,
        messages[error.code] ??
          "Analisis AI tidak tersedia. Anda tetap dapat melanjutkan laporan secara manual.",
      );
    }
    return reportError(
      503,
      "AI_UNAVAILABLE",
      "Analisis AI tidak tersedia. Anda tetap dapat melanjutkan laporan secara manual.",
    );
  }
}
