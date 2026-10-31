import { listTasks } from "@/features/tasks/data";
import { taskReaderContext } from "@/features/tasks/http";
import { taskListQuerySchema } from "@/features/tasks/validation";
import {
  reportError,
  reportJson,
  validationResponse,
} from "@/features/reports/http";

export async function GET(request: Request) {
  const auth = await taskReaderContext();
  if (auth.error) return auth.error;
  const parsed = taskListQuerySchema.safeParse(
    Object.fromEntries(new URL(request.url).searchParams.entries()),
  );
  if (!parsed.success) return validationResponse(parsed.error);
  const { page, limit, ...filters } = parsed.data;
  const result = await listTasks(page, limit, filters, auth.context.userId);
  if (result.error)
    return reportError(
      503,
      "SERVICE_UNAVAILABLE",
      "Daftar tugas belum tersedia.",
    );
  return reportJson({
    data: result.data,
    pagination: { page, limit, total: result.count ?? 0 },
  });
}
