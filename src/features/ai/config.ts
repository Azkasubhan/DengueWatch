import "server-only";

export class AiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
  ) {
    super(code);
  }
}

export function aiConfiguration(testAdapterAvailable = false) {
  const model = process.env.GEMINI_MODEL?.trim();
  const key = process.env.GEMINI_API_KEY;
  if (
    ((!key || /replace|placeholder/i.test(key)) && !testAdapterAvailable) ||
    !model ||
    !/^[a-zA-Z0-9._-]{1,100}$/.test(model)
  )
    throw new AiRequestError(503, "AI_UNAVAILABLE");
  const rawTimeout = Number(process.env.AI_REQUEST_TIMEOUT_MS ?? "15000");
  const timeoutMs =
    Number.isInteger(rawTimeout) && rawTimeout >= 1000 && rawTimeout <= 30000
      ? rawTimeout
      : 15000;
  return { model, timeoutMs };
}
