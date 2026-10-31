import { z } from "zod";
import { getAccessContext } from "@/lib/auth/context";
import { getReportDetail } from "@/features/reports/data";
import { reportError, reportJson } from "@/features/reports/http";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await getAccessContext();
  if (auth.kind === "unauthenticated")
    return reportError(401, "UNAUTHENTICATED", "Masuk untuk melanjutkan.");
  if (auth.kind !== "authenticated")
    return reportError(
      503,
      "SERVICE_UNAVAILABLE",
      "Layanan laporan belum tersedia.",
    );
  const { id } = await params;
  if (!z.uuid().safeParse(id).success)
    return reportError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
  try {
    const detail = await getReportDetail(id);
    if (detail.report.error)
      return reportError(
        503,
        "SERVICE_UNAVAILABLE",
        "Detail laporan belum tersedia.",
      );
    if (!detail.report.data)
      return reportError(404, "NOT_FOUND", "Laporan tidak ditemukan.");
    if (
      !detail.images ||
      !detail.events ||
      detail.images.error ||
      detail.events.error
    )
      return reportError(
        503,
        "SERVICE_UNAVAILABLE",
        "Detail laporan belum tersedia.",
      );
    return reportJson({
      data: {
        ...detail.report.data,
        images: detail.images.data,
        events: detail.events.data,
      },
    });
  } catch {
    return reportError(
      503,
      "SERVICE_UNAVAILABLE",
      "Foto laporan belum tersedia.",
    );
  }
}
