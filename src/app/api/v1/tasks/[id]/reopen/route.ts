import { runTaskAction } from "@/features/tasks/http";
import { taskReasonSchema } from "@/features/tasks/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return runTaskAction(
    request,
    params,
    taskReasonSchema,
    "reopen_action_task",
    (id, input) => ({
      p_task_id: id,
      p_reason: input.reason,
      p_expected_version: input.expectedVersion,
    }),
  );
}
