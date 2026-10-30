"use client";

import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicConfig } from "@/integrations/supabase/config";

export function createClient() {
  const { publishableKey, url } = requireSupabasePublicConfig();
  return createBrowserClient(url, publishableKey);
}
