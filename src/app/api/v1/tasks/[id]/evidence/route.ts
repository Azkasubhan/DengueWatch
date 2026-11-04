import { runTaskAction } from "@/features/tasks/http";
import { submitEvidenceSchema } from "@/features/tasks/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runTaskAction(
    request,
    params,
    submitEvidenceSchema,
    "submit_task_evidence",
    (id, input) => ({
      p_task_id: id,
      p_upload_id: input.uploadId,
      p_description: input.description,
      p_expected_version: input.expectedVersion,
    }),
    "cadre",
  );
}
