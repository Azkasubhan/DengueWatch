import "server-only";

import { z } from "zod";
import { createClient } from "@/integrations/supabase/server";
import type { AccessContext } from "@/features/areas/types";

const profileSchema = z.object({
  display_name: z.string(),
  id: z.uuid(),
  role: z.enum(["resident", "cadre", "manager"]),
});

const areaSchema = z.object({
  code: z.string(),
  id: z.uuid(),
  is_demo: z.boolean(),
  name: z.string(),
});

const membershipSchema = z.object({
  area_id: z.uuid(),
  areas: areaSchema.nullable(),
  membership_type: z.enum(["resident", "assigned_cadre", "manager"]),
  verified_at: z.string().nullable(),
});

export type AccessContextResult =
  | { kind: "authenticated"; context: AccessContext }
  | { kind: "incomplete" }
  | { kind: "unauthenticated" }
  | { kind: "unavailable" };

export async function getAccessContext(): Promise<AccessContextResult> {
  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return { kind: "unavailable" };
  }

  const { data: claimData, error: claimError } =
    await supabase.auth.getClaims();
  const userId = claimData?.claims?.sub;
  if (claimError || typeof userId !== "string") {
    return { kind: "unauthenticated" };
  }

  const [profileResult, membershipResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id,display_name,role")
      .eq("id", userId)
      .single(),
    supabase
      .from("area_memberships")
      .select("area_id,membership_type,verified_at,areas(id,code,name,is_demo)")
      .eq("profile_id", userId),
  ]);

  if (profileResult.error || membershipResult.error) {
    return { kind: "incomplete" };
  }

  const profile = profileSchema.safeParse(profileResult.data);
  const memberships = z
    .array(membershipSchema)
    .safeParse(membershipResult.data);
  if (!profile.success || !memberships.success) {
    return { kind: "incomplete" };
  }

  return {
    kind: "authenticated",
    context: {
      displayName: profile.data.display_name,
      memberships: memberships.data.map((membership) => ({
        area: membership.areas
          ? {
              code: membership.areas.code,
              id: membership.areas.id,
              isDemo: membership.areas.is_demo,
              name: membership.areas.name,
            }
          : null,
        areaId: membership.area_id,
        membershipType: membership.membership_type,
        verifiedAt: membership.verified_at,
      })),
      role: profile.data.role,
      userId: profile.data.id,
    },
  };
}
