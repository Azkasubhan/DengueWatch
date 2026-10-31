import "server-only";

import type { createStorageAdmin } from "@/features/reports/data";
import { reportBucket } from "@/features/reports/data";
import {
  ImageValidationError,
  normalizeReportImage,
} from "@/features/reports/image";
import { readLimitedBody, reportError } from "@/features/reports/http";

type NormalizedImage = Awaited<ReturnType<typeof normalizeReportImage>>;

// Shared M3 pipeline: one multipart photo, signature check, WebP re-encode without metadata.
export async function readPhotoUpload(
  request: Request,
): Promise<{ image: NormalizedImage; error?: never } | { error: Response }> {
  if (
    !request.headers.get("content-type")?.startsWith("multipart/form-data;")
  ) {
    return {
      error: reportError(
        415,
        "UNSUPPORTED_MEDIA_TYPE",
        "Kirim satu foto melalui form upload.",
      ),
    };
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
      return {
        error: reportError(422, "VALIDATION_ERROR", "Kirim tepat satu foto."),
      };
    }
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE")
      return {
        error: reportError(413, "FILE_TOO_LARGE", "Foto maksimal 5 MiB."),
      };
    return {
      error: reportError(400, "MALFORMED_BODY", "Form upload tidak valid."),
    };
  }
  if (!(file instanceof File))
    return {
      error: reportError(
        422,
        "VALIDATION_ERROR",
        "Pilih foto terlebih dahulu.",
      ),
    };
  try {
    return { image: await normalizeReportImage(file) };
  } catch (error) {
    if (error instanceof ImageValidationError)
      return {
        error: reportError(error.status, "INVALID_IMAGE", error.message),
      };
    return {
      error: reportError(422, "INVALID_IMAGE", "Foto tidak dapat diproses."),
    };
  }
}

// Stores bytes for a reserved lease, then marks it uploaded; rolls back on failure.
export async function storeReservedUpload(
  admin: ReturnType<typeof createStorageAdmin>,
  lease: { id: string; path: string; userId: string },
  bytes: NormalizedImage["bytes"],
) {
  const removeLease = () =>
    admin
      .from("report_uploads")
      .delete()
      .eq("id", lease.id)
      .eq("created_by", lease.userId);
  const uploaded = await admin.storage
    .from(reportBucket)
    .upload(lease.path, bytes, {
      contentType: "image/webp",
      upsert: false,
      cacheControl: "0",
    });
  if (uploaded.error) {
    await removeLease();
    return reportError(
      503,
      "UPLOAD_FAILED",
      "Foto belum dapat diunggah. Coba lagi.",
    );
  }
  const marked = await admin
    .from("report_uploads")
    .update({ uploaded_at: new Date().toISOString() })
    .eq("id", lease.id)
    .eq("created_by", lease.userId);
  if (marked.error) {
    await admin.storage.from(reportBucket).remove([lease.path]);
    await removeLease();
    return reportError(
      503,
      "UPLOAD_FAILED",
      "Foto belum dapat disiapkan. Coba lagi.",
    );
  }
  return null;
}
