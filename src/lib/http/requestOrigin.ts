const loopbackHosts = ["localhost", "127.0.0.1"];

const vercelHost = (value: string | undefined) =>
  value && /^[a-z0-9.-]+$/i.test(value)
    ? `https://${value.toLowerCase()}`
    : null;

// Origins Vercel assigns to this deployment through system environment variables set by the
// platform, never by the request. Only these exact hosts are trusted: allowing any
// *.vercel.app origin would let every other Vercel project send requests to this API.
export function vercelOrigins(): string[] {
  if (process.env.VERCEL !== "1") return [];
  return [
    process.env.VERCEL_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
  ]
    .map(vercelHost)
    .filter((origin): origin is string => origin !== null);
}

// Without APP_BASE_URL a Vercel deployment uses its own host: the production domain for
// production deployments, the branch (or unique) URL for previews.
function vercelDefaultOrigin(): string | null {
  if (process.env.VERCEL !== "1") return null;
  return process.env.VERCEL_ENV === "production"
    ? vercelHost(process.env.VERCEL_PROJECT_PRODUCTION_URL)
    : vercelHost(process.env.VERCEL_BRANCH_URL || process.env.VERCEL_URL);
}

// Canonical public origin from APP_BASE_URL. Production requires HTTPS (plain HTTP only on
// loopback for a local `pnpm start`); anything else returns null so callers fail closed.
export function appOrigin(): string | null {
  const production = process.env.NODE_ENV === "production";
  const candidate =
    process.env.APP_BASE_URL ||
    vercelDefaultOrigin() ||
    (production ? "" : "http://localhost:3000");
  try {
    const url = new URL(candidate);
    if (
      url.protocol === "https:" ||
      (url.protocol === "http:" &&
        (!production || loopbackHosts.includes(url.hostname)))
    )
      return url.origin;
  } catch {
    // Invalid values fall through to null.
  }
  return null;
}

// Public origin of a request. In production APP_BASE_URL is authoritative, so spoofed Host
// or X-Forwarded-* headers cannot change it; on Vercel a request served on one of this
// deployment's own hosts (preview, branch, production domain) keeps that origin. Elsewhere
// `next start`/`next dev` build request.url from the bind address, so the browser-facing
// origin comes from the Host/X-Forwarded-* headers set by the trusted proxy.
export function requestOrigin(request: Request): string | null {
  if (process.env.NODE_ENV === "production") {
    const own = new URL(request.url).origin;
    return vercelOrigins().includes(own) ? own : appOrigin();
  }
  const url = new URL(request.url);
  const first = (name: string) =>
    request.headers.get(name)?.split(",")[0]?.trim() || null;
  const host = first("x-forwarded-host") ?? first("host") ?? url.host;
  const proto = first("x-forwarded-proto") ?? url.protocol.slice(0, -1);
  if (proto !== "http" && proto !== "https") return url.origin;
  // URL drops the scheme's default port, so compare against the normalized form.
  const expectedHost = host
    .toLowerCase()
    .replace(proto === "https" ? /:443$/ : /:80$/, "");
  try {
    const origin = new URL(`${proto}://${host}`);
    return origin.host === expectedHost ? origin.origin : url.origin;
  } catch {
    return url.origin;
  }
}
