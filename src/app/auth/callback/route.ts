import { NextResponse } from "next/server";
import { createClient } from "@/integrations/supabase/server";
import { getSafeRedirect } from "@/lib/auth/safeRedirect";
import { requestOrigin } from "@/lib/http/requestOrigin";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = getSafeRedirect(url.searchParams.get("next"));
  const origin = requestOrigin(request);
  // Without a valid canonical origin, a relative Location avoids sending users to the
  // internal bind address.
  const redirectTo = (path: string) =>
    origin
      ? NextResponse.redirect(new URL(path, origin))
      : new NextResponse(null, { status: 307, headers: { Location: path } });

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return redirectTo(next);
      }
    } catch {
      // Redirect to a safe user-facing error below.
    }
  }

  return redirectTo("/login?error=callback");
}
