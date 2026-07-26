import { describe, expect, it } from "vitest";

import {
  canEditInventory,
  canManageHotelSetup,
  canRecoverSystemHealth,
  isStaffRole,
} from "@/lib/staff-roles";

describe("staff role capabilities", () => {
  it("keeps front desk inventory read-only", () => {
    expect(canEditInventory("front_desk")).toBe(false);
    expect(canEditInventory("revenue_manager")).toBe(true);
    expect(canEditInventory("manager")).toBe(true);
    expect(canEditInventory("admin")).toBe(true);
  });

  it("restricts hotel setup and recovery operations to managers", () => {
    expect(canManageHotelSetup("revenue_manager")).toBe(false);
    expect(canManageHotelSetup("front_desk")).toBe(false);
    expect(canManageHotelSetup("manager")).toBe(true);
    expect(canManageHotelSetup("admin")).toBe(true);
    expect(canRecoverSystemHealth("front_desk")).toBe(false);
    expect(canRecoverSystemHealth("manager")).toBe(true);
  });

  it("recognises every database staff role", () => {
    expect(isStaffRole("revenue_manager")).toBe(true);
    expect(isStaffRole("owner")).toBe(false);
  });
});
