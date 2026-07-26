import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { StaffPageHeader } from "@/components/staff/staff-page-header";
import type { Route } from "next";
import { redirect } from "next/navigation";

import { getCurrentStaffRole } from "@/lib/staff-access";
import { canManageHotelSetup } from "@/lib/staff-roles";
import { getCurrentHotelSetupState } from "@/lib/hotel-setup-state";

export default async function OnboardingPage() {
  const [role, setupState] = await Promise.all([getCurrentStaffRole(), getCurrentHotelSetupState()]);
  if (!role || !canManageHotelSetup(role)) redirect("/staff/dashboard");
  if (setupState.setupComplete) redirect("/staff/room-types" as Route);

  return (
    <>
      <StaffPageHeader description="Configure the hotel, physical rooms, and baseline rates before creating the first inventory calendar." eyebrow="Initial hotel configuration" title="Hotel setup" />
      <OnboardingWizard />
    </>
  );
}
