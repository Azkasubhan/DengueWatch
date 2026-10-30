export const roles = ["resident", "cadre", "manager"] as const;
export type Role = (typeof roles)[number];

export const membershipTypes = [
  "resident",
  "assigned_cadre",
  "manager",
] as const;
export type MembershipType = (typeof membershipTypes)[number];

export type AreaSummary = {
  code: string;
  id: string;
  isDemo: boolean;
  name: string;
};

export type AreaMembership = {
  area: AreaSummary | null;
  areaId: string;
  membershipType: MembershipType;
  verifiedAt: string | null;
};

export type AccessContext = {
  displayName: string;
  memberships: AreaMembership[];
  role: Role;
  userId: string;
};
