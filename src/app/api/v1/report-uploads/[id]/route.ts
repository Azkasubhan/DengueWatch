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
  const row = await admin
    .from("report_uploads")
    .select("storage_path,consumed_at")
    .eq("id", id)
    .eq("created_by", auth.context!.userId)
    .maybeSingle();
  if (row.error)
    return reportError(503, "SERVICE_UNAVAILABLE", "Foto belum dapat dihapus.");
  if (!row.data || row.data.consumed_at)
    return reportError(404, "NOT_FOUND", "Foto tidak ditemukan.");
  const removed = await admin.storage
    .from(reportBucket)
    .remove([row.data.storage_path]);
  if (removed.error)
    return reportError(503, "SERVICE_UNAVAILABLE", "Foto belum dapat dihapus.");
  const deleted = await admin
    .from("report_uploads")
    .delete()
    .eq("id", id)
    .is("consumed_at", null);
  if (deleted.error)
    return reportError(503, "SERVICE_UNAVAILABLE", "Foto belum dapat dihapus.");
  return reportJson({ deleted: true });
}
