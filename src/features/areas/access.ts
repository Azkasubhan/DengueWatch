import type {
  AccessContext,
  MembershipType,
  Role,
} from "@/features/areas/types";

export type PortalAccessDecision =
  | { kind: "allowed"; membershipType: MembershipType }
  | { kind: "forbidden" }
  | { kind: "pending"; membershipType: MembershipType };

const portalMembership: Record<Role, MembershipType> = {
  resident: "resident",
  cadre: "assigned_cadre",
  manager: "manager",
};

export function decidePortalAccess(
  context: Pick<AccessContext, "memberships" | "role">,
  requiredRole: Role,
): PortalAccessDecision {
  if (context.role !== requiredRole) {
    return { kind: "forbidden" };
  }

  const membershipType = portalMembership[requiredRole];
  const isVerified = context.memberships.some(
    (membership) =>
      membership.membershipType === membershipType &&
      Boolean(membership.verifiedAt) &&
      Boolean(membership.area),
  );

  return isVerified
    ? { kind: "allowed", membershipType }
    : { kind: "pending", membershipType };
}

export function getVerifiedAreas(
  context: Pick<AccessContext, "memberships">,
  membershipType: MembershipType,
) {
  return context.memberships
    .filter(
      (membership) =>
        membership.membershipType === membershipType &&
        Boolean(membership.verifiedAt) &&
        Boolean(membership.area),
    )
    .flatMap((membership) => (membership.area ? [membership.area] : []));
}

export function getDefaultPortal(role: Role) {
  switch (role) {
    case "cadre":
      return "/kader/ringkasan";
    case "manager":
      return "/pengelola/ringkasan";
    case "resident":
      return "/app/beranda";
  }
}
