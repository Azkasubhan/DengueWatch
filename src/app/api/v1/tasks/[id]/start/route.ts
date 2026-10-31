import { runTaskAction } from "@/features/tasks/http";
import { expectedVersionSchema } from "@/features/tasks/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runTaskAction(
    request,
    params,
    expectedVersionSchema,
    "start_action_task",
    (id, input) => ({
      p_task_id: id,
      p_expected_version: input.expectedVersion,
    }),
  );
}
