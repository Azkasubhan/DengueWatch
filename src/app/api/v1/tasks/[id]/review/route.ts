import { runTaskAction } from "@/features/tasks/http";
import { reviewEvidenceSchema } from "@/features/tasks/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runTaskAction(
    request,
    params,
    reviewEvidenceSchema,
    "review_task_evidence",
    (id, input) => ({
      p_task_id: id,
      p_evidence_id: input.evidenceId,
      p_decision: input.decision,
      p_reason: input.reason ?? null,
      p_expected_version: input.expectedVersion,
    }),
    "manager",
  );
}
