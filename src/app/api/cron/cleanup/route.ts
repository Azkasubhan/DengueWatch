import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createStorageAdmin } from "@/features/reports/data";
import {
  CleanupError,
  runScheduledCleanup,
} from "@/features/maintenance/cleanup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "Cache-Control": "no-store" };

// Vercel Cron sends `Authorization: Bearer <CRON_SECRET>`. Without a strong secret the
// endpoint stays closed, so it can never be triggered anonymously.
function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return null;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(
    digest(request.headers.get("authorization") ?? ""),
    digest(`Bearer ${secret}`),
  );
}

export async function GET(request: Request) {
  const allowed = authorized(request);
  if (allowed === null)
    return NextResponse.json(
      { error: { code: "SERVICE_UNAVAILABLE" } },
      { status: 503, headers: noStore },
    );
  if (!allowed)
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED" } },
      { status: 401, headers: noStore },
    );
  try {
    const result = await runScheduledCleanup(createStorageAdmin());
    return NextResponse.json({ data: result }, { headers: noStore });
  } catch (error) {
    return NextResponse.json(
      {
        error: {
          code:
            error instanceof CleanupError ? error.message : "CLEANUP_FAILED",
        },
      },
      { status: 503, headers: noStore },
    );
  }
}
