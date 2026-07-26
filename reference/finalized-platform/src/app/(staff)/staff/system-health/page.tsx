import { StaffPageHeader } from "@/components/staff/staff-page-header";
import { SystemHealthDashboard } from "@/components/system-health/system-health-dashboard";
import { getSystemHealthData } from "@/lib/system-health-data";
import { getCurrentStaffRole } from "@/lib/staff-access";
import { canRecoverSystemHealth } from "@/lib/staff-roles";

export default async function SystemHealthPage() {
  const [systemHealth, role] = await Promise.all([getSystemHealthData(), getCurrentStaffRole()]);

  return (
    <>
      <StaffPageHeader
        description="Track worker heartbeat, notification retries, stale leases, dead letters, and scheduler readiness."
        eyebrow="Manager tools · live monitor"
        title="System Health"
      />
      <SystemHealthDashboard canRecover={Boolean(role && canRecoverSystemHealth(role))} systemHealth={systemHealth} />
    </>
  );
}
