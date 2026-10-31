export const controlClass =
  "min-h-11 w-full rounded-[var(--radius-control)] border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] aria-[invalid=true]:border-[var(--danger)]";

export type ReportActionResult =
  | { kind: "ok"; data?: { id?: string } }
  | { kind: "conflict"; message: string }
  | { kind: "invalid"; message: string; fieldErrors: Record<string, string> }
  | { kind: "error"; message: string };

// Posts a versioned report action; the server re-checks every rule.
export async function postReportAction(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<ReportActionResult> {
  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  } catch {
    return { kind: "error", message: "Koneksi terputus. Coba lagi." };
  }
  if (response.ok)
    return {
      kind: "ok",
      data: (await response.json().catch(() => null))?.data,
    };
  const payload = await response.json().catch(() => null);
  const message: string =
    payload?.error?.message ?? "Permintaan belum dapat diproses. Coba lagi.";
  if (response.status === 409) return { kind: "conflict", message };
  if (response.status === 422)
    return {
      kind: "invalid",
      message,
      fieldErrors: payload?.error?.fieldErrors ?? {},
    };
  return { kind: "error", message };
}

export function reasonError(value: string) {
  const length = value.trim().length;
  if (length < 10) return "Tulis minimal 10 karakter.";
  if (length > 500) return "Maksimal 500 karakter.";
  return null;
}
