const DEFAULT_REDIRECT = "/app/beranda";

export function getSafeRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_REDIRECT,
) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  try {
    const parsed = new URL(value, "https://denguewatch.local");
    if (parsed.origin !== "https://denguewatch.local") {
      return fallback;
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
