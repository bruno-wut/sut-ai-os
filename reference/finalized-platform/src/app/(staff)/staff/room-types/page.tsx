import { redirect } from "next/navigation";

import { RoomTypeManagement } from "@/components/staff/room-type-management";
import { StaffPageHeader } from "@/components/staff/staff-page-header";
import { getCurrentHotelSetupState } from "@/lib/hotel-setup-state";
import { getCurrentStaffRole } from "@/lib/staff-access";
import { getStaffRoomTypeConfigurations } from "@/lib/staff-room-type-data";
import { canManageHotelSetup } from "@/lib/staff-roles";

export const dynamic = "force-dynamic";

export default async function RoomTypesPage() {
  const [role, setupState] = await Promise.all([getCurrentStaffRole(), getCurrentHotelSetupState()]);
  if (!role || !canManageHotelSetup(role)) redirect("/staff/dashboard");
  if (!setupState.setupComplete) redirect("/staff/onboarding");

  const roomTypes = await getStaffRoomTypeConfigurations();

  return (
    <>
      <StaffPageHeader
        description="Publish room photos, descriptions, amenities, extra-bed policies, and website allocation without regenerating inventory."
        eyebrow="Guest room configuration"
        title="Room types"
      />
      <RoomTypeManagement roomTypes={roomTypes} />
    </>
  );
}
