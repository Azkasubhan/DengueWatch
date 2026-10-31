import { createClient } from "@/integrations/supabase/server";
import { createStorageAdmin } from "@/features/reports/data";
import {
  cadreContext,
  reportError,
  reportJson,
  sameOrigin,
} from "@/features/reports/http";
import {
  readPhotoUpload,
  storeReservedUpload,
} from "@/features/reports/upload";
import { parseTaskId, taskRpcError } from "@/features/tasks/http";

// Evidence uploads are bound to one in-progress task of the calling assignee.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return reportError(403, "FORBIDDEN", "Asal permintaan tidak valid.");
  const auth = await cadreContext();
  if (auth.error) return auth.error;
  const { id } = await params;
  const invalidId = parseTaskId(id);
  if (invalidId) return invalidId;
  const photo = await readPhotoUpload(request);
  if (photo.error) return photo.error;
  const image = photo.image;
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
  // The RPC checks assignee, area membership, and task status before reserving.
  const client = await createClient();
  const reservation = await client.rpc("reserve_task_evidence_upload", {
    p_task_id: id,
    p_byte_size: image.byteSize,
    p_width: image.width,
    p_height: image.height,
  });
  if (reservation.error) return taskRpcError(reservation.error);
  const lease = reservation.data?.[0] as
    { upload_id: string; storage_path: string } | undefined;
  if (!lease) return taskRpcError({});
  const stored = await storeReservedUpload(
    admin,
    {
      id: lease.upload_id,
      path: lease.storage_path,
      userId: auth.context.userId,
    },
    image.bytes,
  );
  if (stored) return stored;
  return reportJson(
    {
      data: {
        id: lease.upload_id,
        mimeType: image.mimeType,
        byteSize: image.byteSize,
        width: image.width,
        height: image.height,
      },
    },
    201,
  );
}
