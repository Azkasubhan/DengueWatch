import { z } from "zod";
import { createClient } from "@/integrations/supabase/server";
import {
  reviewDecisionRpc,
  reviewReportSchema,
} from "@/features/reports/validation";
import {
  managerContext,
  readJsonBody,
  reportError,
  reportJson,
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
  const auth = await managerContext();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return reportError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  const json = await readJsonBody(request, 8 * 1024);
  if (json.error) return json.error;
  const parsed = reviewReportSchema.safeParse(json.body);
  if (!parsed.success) return validationResponse(parsed.error);
  const input = parsed.data;
  if (input.decision === "duplicate" && input.duplicateOfReportId === id)
    return reportError(
      422,
      "VALIDATION_ERROR",
      "Laporan rujukan duplikat tidak valid.",
      { duplicateOfReportId: "Laporan tidak dapat menjadi duplikat dirinya." },
    );

  // Role, area, status, and version are enforced again inside the RPC.
  const client = await createClient();
  const result = await client.rpc("review_report", {
    p_report_id: id,
    p_decision: reviewDecisionRpc[input.decision],
    p_reason: input.reason ?? null,
    p_expected_version: input.expectedVersion,
    p_duplicate_of_report_id:
      input.decision === "duplicate" ? input.duplicateOfReportId : null,
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
