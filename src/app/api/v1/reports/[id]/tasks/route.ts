import { z } from "zod";
import { createClient } from "@/integrations/supabase/server";
import {
  cadreContext,
  readJsonBody,
  reportError,
  sameOrigin,
  validationResponse,
} from "@/features/reports/http";
import { idempotencyKeySchema } from "@/features/reports/validation";
import { taskMutationJson, taskRpcError } from "@/features/tasks/http";
import { createTaskSchema } from "@/features/tasks/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return reportError(403, "FORBIDDEN", "Asal permintaan tidak valid.");
  const auth = await cadreContext();
  if (auth.error) return auth.error;
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return reportError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  const key = idempotencyKeySchema.safeParse(
    request.headers.get("idempotency-key"),
  );
  if (!key.success)
    return reportError(422, "VALIDATION_ERROR", "Idempotency-Key tidak valid.");
  const json = await readJsonBody(request, 8 * 1024);
  if (json.error) return json.error;
  const parsed = createTaskSchema.safeParse(json.body);
  if (!parsed.success) return validationResponse(parsed.error);
  const input = parsed.data;

  // Report status, area scope, and assignee rules are enforced by the RPC.
  const client = await createClient();
  const result = await client.rpc("create_action_task", {
    p_report_id: id,
    p_title: input.title,
    p_description: input.description,
    p_assigned_to: input.assignedTo,
    p_due_at: input.dueAt,
    p_is_mandatory: input.isMandatory,
    p_idempotency_key: key.data,
  });
  if (result.error) return taskRpcError(result.error);
  return taskMutationJson(result.data, 201);
}
