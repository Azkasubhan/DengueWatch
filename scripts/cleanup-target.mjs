import assert from "node:assert/strict";

// Cleanup runs against local Supabase by default. A hosted run needs ALLOW_HOSTED_CLEANUP=true
// and CLEANUP_PROJECT_REF matching the URL, so a wrong env file cannot target another project.
export function assertCleanupTarget(url) {
  const { hostname, protocol } = new URL(url);
  if (["localhost", "127.0.0.1"].includes(hostname)) return;
  assert(
    process.env.ALLOW_HOSTED_CLEANUP === "true",
    "Hosted cleanup requires ALLOW_HOSTED_CLEANUP=true.",
  );
  const ref = process.env.CLEANUP_PROJECT_REF ?? "";
  assert(
    /^[a-z0-9]{20}$/.test(ref) &&
      protocol === "https:" &&
      hostname === `${ref}.supabase.co`,
    "NEXT_PUBLIC_SUPABASE_URL does not match CLEANUP_PROJECT_REF.",
  );
}

// CLEANUP_DRY_RUN=true reports what would be removed without deleting anything.
export const dryRun = process.env.CLEANUP_DRY_RUN === "true";
