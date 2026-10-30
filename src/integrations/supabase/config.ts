export type SupabasePublicConfig = {
  publishableKey: string;
  url: string;
};

function isPlaceholder(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("replace") ||
    normalized.includes("placeholder") ||
    normalized.includes("your-project")
  );
}

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (
    !url ||
    !publishableKey ||
    isPlaceholder(url) ||
    isPlaceholder(publishableKey)
  ) {
    return null;
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
  } catch {
    return null;
  }

  return { url, publishableKey };
}

export function requireSupabasePublicConfig(): SupabasePublicConfig {
  const config = getSupabasePublicConfig();
  if (!config) {
    throw new Error("SUPABASE_CONFIGURATION_MISSING");
  }
  return config;
}
