import { randomUUID } from "node:crypto";
import { createStorageAdmin, reportBucket } from "@/features/reports/data";
import {
  ImageValidationError,
  normalizeReportImage,
} from "@/features/reports/image";
import {
  readLimitedBody,
  reportError,
  reportJson,
  residentContext,
  sameOrigin,
} from "@/features/reports/http";

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return reportError(403, "FORBIDDEN", "Asal permintaan tidak valid.");
  const auth = await residentContext();
  if (auth.error) return auth.error;
  const userId = auth.context!.userId;
  if (
    !auth.context!.memberships.some(
      (m) => m.membershipType === "resident" && m.verifiedAt && m.area,
    )
  ) {
    return reportError(
      403,
      "FORBIDDEN",
      "Keanggotaan wilayah belum terverifikasi.",
    );
  }
  if (
    !request.headers.get("content-type")?.startsWith("multipart/form-data;")
  ) {
    return reportError(
      415,
      "UNSUPPORTED_MEDIA_TYPE",
      "Kirim satu foto melalui form upload.",
    );
  }
  let file: FormDataEntryValue | null;
  try {
    const bytes = await readLimitedBody(request, 6 * 1024 * 1024);
    const parsed = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type")! },
      body: bytes,
    }).formData();
    file = parsed.get("photo");
    if (
      Array.from(parsed.keys()).some((key) => key !== "photo") ||
      parsed.getAll("photo").length !== 1
    ) {
      return reportError(422, "VALIDATION_ERROR", "Kirim tepat satu foto.");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE")
      return reportError(413, "FILE_TOO_LARGE", "Foto maksimal 5 MiB.");
    return reportError(400, "MALFORMED_BODY", "Form upload tidak valid.");
  }
  if (!(file instanceof File))
    return reportError(422, "VALIDATION_ERROR", "Pilih foto terlebih dahulu.");
  let normalized;
  try {
    normalized = await normalizeReportImage(file);
  } catch (error) {
    if (error instanceof ImageValidationError)
      return reportError(error.status, "INVALID_IMAGE", error.message);
    return reportError(422, "INVALID_IMAGE", "Foto tidak dapat diproses.");
  }
  let admin;
  try {
    admin = createStorageAdmin();
  } catch {
    return reportError(
      503,
      "SERVICE_UNAVAILABLE",
      "Penyimpanan foto belum tersedia.",
    );
  }
  const id = randomUUID();
  const path = `${userId}/${id}.webp`;
  const reservation = await admin.from("report_uploads").insert({
    id,
    created_by: userId,
    storage_path: path,
    mime_type: normalized.mimeType,
    byte_size: normalized.byteSize,
    width: normalized.width,
    height: normalized.height,
  });
  if (reservation.error?.code === "P0429")
    return reportError(
      429,
      "RATE_LIMIT",
      "Batas unggahan sementara tercapai. Coba lagi nanti.",
    );
  if (reservation.error)
    return reportError(
      503,
      "SERVICE_UNAVAILABLE",
      "Foto belum dapat diunggah.",
    );
  const uploaded = await admin.storage
    .from(reportBucket)
    .upload(path, normalized.bytes, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: "0",
    });
  if (uploaded.error) {
    await admin
      .from("report_uploads")
      .delete()
      .eq("id", id)
      .eq("created_by", userId);
    return reportError(
      503,
      "UPLOAD_FAILED",
      "Foto belum dapat diunggah. Coba lagi.",
    );
  }
  const marked = await admin
    .from("report_uploads")
    .update({ uploaded_at: new Date().toISOString() })
    .eq("id", id)
    .eq("created_by", userId);
  if (marked.error) {
    await admin.storage.from(reportBucket).remove([path]);
    await admin
      .from("report_uploads")
      .delete()
      .eq("id", id)
      .eq("created_by", userId);
    return reportError(
      503,
      "UPLOAD_FAILED",
      "Foto belum dapat disiapkan. Coba lagi.",
    );
  }
  return reportJson(
    {
      id,
      mimeType: normalized.mimeType,
      byteSize: normalized.byteSize,
      width: normalized.width,
      height: normalized.height,
    },
    201,
  );
}
