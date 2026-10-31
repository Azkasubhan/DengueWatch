// Public origin of a request. In production APP_BASE_URL is authoritative, so spoofed Host
// or X-Forwarded-* headers cannot change it; without a valid value it fails closed (null).
// Elsewhere `next start`/`next dev` build request.url from the bind address, so the
// browser-facing origin comes from the Host/X-Forwarded-* headers set by the trusted proxy.
export function requestOrigin(request: Request): string | null {
  if (process.env.NODE_ENV === "production") {
    try {
      const configured = new URL(process.env.APP_BASE_URL ?? "");
      return configured.protocol === "https:" || configured.protocol === "http:"
        ? configured.origin
        : null;
    } catch {
      return null;
    }
  }
  const url = new URL(request.url);
  const first = (name: string) =>
    request.headers.get(name)?.split(",")[0]?.trim() || null;
  const host = first("x-forwarded-host") ?? first("host") ?? url.host;
  const proto = first("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (proto !== "http" && proto !== "https") return url.origin;
  try {
    const origin = new URL(`${proto}://${host}`);
    return origin.host === host.toLowerCase() ? origin.origin : url.origin;
  } catch {
    return url.origin;
  }
}
