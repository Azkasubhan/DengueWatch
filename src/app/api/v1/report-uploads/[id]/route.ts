import { z } from "zod";
import { createStorageAdmin, reportBucket } from "@/features/reports/data";
import {
  reportError,
  reportJson,
  residentContext,
  sameOrigin,
} from "@/features/reports/http";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return reportError(403, "FORBIDDEN", "Asal permintaan tidak valid.");
  const auth = await residentContext();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return reportError(404, "NOT_FOUND", "Foto tidak ditemukan.");
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
  // Delete the row first, conditionally. create_environmental_report locks upload rows
  // `for update`, so a concurrent submit either consumes the upload first (this matches no
  // row and the photo stays) or finds the row gone and fails with a 409 conflict.
  const deleted = await admin
    .from("report_uploads")
    .delete()
    .eq("id", id)
    .eq("created_by", auth.context!.userId)
    .is("consumed_at", null)
    .select("storage_path");
  if (deleted.error)
    return reportError(503, "SERVICE_UNAVAILABLE", "Foto belum dapat dihapus.");
  const storagePath = deleted.data?.[0]?.storage_path;
  if (!storagePath)
    return reportError(404, "NOT_FOUND", "Foto tidak ditemukan.");
  // The lease is already released; a failed object removal only leaves a private,
  // unreferenced object behind, so the release is still reported as done.
  await admin.storage.from(reportBucket).remove([storagePath]);
  return reportJson({ deleted: true });
}
