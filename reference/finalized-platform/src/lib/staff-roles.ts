export const STAFF_ROLES = ["admin", "manager", "front_desk", "revenue_manager"] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

export function canEditInventory(role: StaffRole) {
  return role === "admin" || role === "manager" || role === "revenue_manager";
}

export function canManageHotelSetup(role: StaffRole) {
  return role === "admin" || role === "manager";
}

export function canRecoverSystemHealth(role: StaffRole) {
  return role === "admin" || role === "manager";
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && STAFF_ROLES.includes(value as StaffRole);
}
