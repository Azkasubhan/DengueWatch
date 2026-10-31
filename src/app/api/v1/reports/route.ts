import { createClient } from "@/integrations/supabase/server";
import {
  createReportSchema,
  idempotencyKeySchema,
  reportListQuerySchema,
} from "@/features/reports/validation";
import { listReports } from "@/features/reports/data";
import {
  readLimitedBody,
  reportError,
  reportJson,
  residentContext,
  sameOrigin,
  validationResponse,
} from "@/features/reports/http";
import { getAccessContext } from "@/lib/auth/context";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return reportError(403, "FORBIDDEN", "Asal permintaan tidak valid.");
  const auth = await residentContext();
  if (auth.error) return auth.error;
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reportError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Gunakan JSON untuk data laporan.",
    );
  const key = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!key.success)
    return reportError(422, "VALIDATION_ERROR", "Idempotency-Key tidak valid.");
  let body;
  try {
    body = JSON.parse(
      (await readLimitedBody(request, 16 * 1024)).toString("utf8"),
    );
  } catch (error) {
    return error instanceof Error && error.message === "BODY_TOO_LARGE"
      ? reportError(413, "BODY_TOO_LARGE", "Data laporan terlalu besar.")
      : reportError(400, "MALFORMED_BODY", "JSON tidak valid.");
  }
  const parsed = createReportSchema.safeParse(body);
  if (!parsed.success) return validationResponse(parsed.error);
  const { areaId, category, description, imageUploadIds, location } =
    parsed.data;
  if (
    !auth.context!.memberships.some(
      (m) =>
        m.areaId === areaId &&
        m.membershipType === "resident" &&
        m.verifiedAt &&
        m.area,
    )
  ) {
    return reportError(
      403,
      "FORBIDDEN",
      "Wilayah tidak tersedia untuk akun ini.",
    );
  }
  const client = await createClient();
  const result = await client.rpc("create_environmental_report", {
    p_area_id: areaId,
    p_category: category,
    p_description: description,
    p_latitude: location?.latitude ?? null,
    p_longitude: location?.longitude ?? null,
    p_location_note: location?.note ?? null,
    p_upload_ids: imageUploadIds,
    p_idempotency_key: key.data,
  });
  if (result.error) {
    if (result.error.code === "P0403")
      return reportError(
        403,
        "FORBIDDEN",
        "Wilayah tidak tersedia untuk akun ini.",
      );
    if (result.error.code === "P0409")
      return reportError(
        409,
        "CONFLICT",
        "Foto atau kunci permintaan telah digunakan.",
      );
    if (result.error.code === "P0429")
      return reportError(
        429,
        "RATE_LIMIT",
        "Batas laporan sementara tercapai. Coba lagi nanti.",
      );
    if (result.error.code === "P0422")
      return reportError(
        422,
        "VALIDATION_ERROR",
        "Periksa kembali data laporan.",
      );
    return reportError(
      503,
      "SERVICE_UNAVAILABLE",
      "Laporan belum dapat disimpan. Coba lagi.",
    );
  }
  return reportJson({ data: result.data?.[0] }, 201);
}

export async function GET(request: Request) {
  const auth = await getAccessContext();
  if (auth.kind === "unauthenticated")
    return reportError(401, "UNAUTHENTICATED", "Masuk untuk melanjutkan.");
  if (auth.kind !== "authenticated")
    return reportError(
      503,
      "SERVICE_UNAVAILABLE",
      "Layanan laporan belum tersedia.",
    );
  const query = new URL(request.url).searchParams;
  const parsed = reportListQuerySchema.safeParse(
    Object.fromEntries(query.entries()),
  );
  if (!parsed.success) return validationResponse(parsed.error);
  const { page, limit, category } = parsed.data;
  const result = await listReports(page, limit, category);
  if (result.error)
    return reportError(
      503,
      "SERVICE_UNAVAILABLE",
      "Daftar laporan belum tersedia.",
    );
  return reportJson({
    data: result.data,
    pagination: { page, limit, total: result.count ?? 0 },
  });
}
