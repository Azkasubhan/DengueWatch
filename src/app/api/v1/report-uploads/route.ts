import { randomUUID } from "node:crypto";
import { createStorageAdmin } from "@/features/reports/data";
import {
  reportError,
  reportJson,
  residentContext,
  sameOrigin,
} from "@/features/reports/http";
import {
  readPhotoUpload,
  storeReservedUpload,
} from "@/features/reports/upload";

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
  const photo = await readPhotoUpload(request);
  if (photo.error) return photo.error;
  const normalized = photo.image;
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
  if (reservation.error)
    return reportError(
      503,
      "SERVICE_UNAVAILABLE",
      "Foto belum dapat diunggah.",
    );
  const stored = await storeReservedUpload(
    admin,
    { id, path, userId },
    normalized.bytes,
  );
  if (stored) return stored;
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
