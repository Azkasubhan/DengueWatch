import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { getSafeRedirect } from "@/lib/auth/safeRedirect";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = getSafeRedirect(url.searchParams.get("next"));

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return NextResponse.redirect(new URL(next, url.origin));
      }
    } catch {
      // Redirect to a safe user-facing error below.
    }
  }

  return NextResponse.redirect(new URL("/login?error=callback", url.origin));
}
