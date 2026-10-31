import { z } from "zod";
import { createClient } from "@/integrations/supabase/server";
import { addReportInformationSchema } from "@/features/reports/validation";
import {
  readJsonBody,
  reportError,
  reportJson,
  residentContext,
  reviewRpcError,
  sameOrigin,
  validationResponse,
} from "@/features/reports/http";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return reportError(403, "FORBIDDEN", "Asal permintaan tidak valid.");
  const auth = await residentContext();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return reportError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  const json = await readJsonBody(request, 8 * 1024);
  if (json.error) return json.error;
  const parsed = addReportInformationSchema.safeParse(json.body);
  if (!parsed.success) return validationResponse(parsed.error);

  // Ownership, membership, status, and version are enforced inside the RPC.
  const client = await createClient();
  const result = await client.rpc("add_report_information", {
    p_report_id: id,
    p_note: parsed.data.note,
    p_expected_version: parsed.data.expectedVersion,
  });
  if (result.error) return reviewRpcError(result.error);
  const row = result.data?.[0];
  if (!row) return reviewRpcError({});
  return reportJson({
    data: {
      id: row.report_id,
      status: row.status,
      version: row.version,
      updatedAt: row.updated_at,
    },
  });
}
