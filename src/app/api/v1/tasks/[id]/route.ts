import { getTaskDetail } from "@/features/tasks/data";
import { parseTaskId, taskReaderContext } from "@/features/tasks/http";
import { reportError, reportJson } from "@/features/reports/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await taskReaderContext();
  if (auth.error) return auth.error;
  const { id } = await params;
  const invalidId = parseTaskId(id);
  if (invalidId) return invalidId;
  try {
    const task = await getTaskDetail(id, auth.context.userId);
    if (!task) return reportError(404, "NOT_FOUND", "Tugas tidak ditemukan.");
    return reportJson({ data: task });
  } catch {
    return reportError(
      503,
      "SERVICE_UNAVAILABLE",
      "Detail tugas belum tersedia.",
    );
  }
}
