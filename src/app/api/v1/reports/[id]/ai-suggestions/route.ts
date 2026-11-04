import { z } from "zod";
import { getReportAiSuggestions } from "@/features/reports/data";
import {
  managerContext,
  reportError,
  reportJson,
  reviewRpcError,
} from "@/features/reports/http";

type SuggestionRow = {
  analysis_id: string;
  suggested_category: string;
  visible_objects: string[];
  draft_description: string;
  suggested_precaution: string;
  limitations: string;
  analyzed_at: string;
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await managerContext();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return reportError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  const result = await getReportAiSuggestions(id);
  if (result.error) return reviewRpcError(result.error);
  // AI output stays a suggestion; the manager makes the decision.
  return reportJson({
    data: ((result.data ?? []) as SuggestionRow[]).map((row) => ({
      analysisId: row.analysis_id,
      suggestedCategory: row.suggested_category,
      visibleObjects: row.visible_objects,
      draftDescription: row.draft_description,
      suggestedPrecaution: row.suggested_precaution,
      limitations: row.limitations,
      analyzedAt: row.analyzed_at,
      requiresHumanVerification: true,
    })),
  });
}
