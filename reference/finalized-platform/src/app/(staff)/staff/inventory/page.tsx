import { headers } from "next/headers";

import { InventoryLedger } from "@/components/staff/inventory-ledger";
import { StaffPageHeader } from "@/components/staff/staff-page-header";
import { getStaffInventoryData } from "@/lib/staff-inventory-data";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getCurrentStaffRole } from "@/lib/staff-access";
import { canEditInventory } from "@/lib/staff-roles";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const [inventory, role] = await Promise.all([getStaffInventoryData(), getCurrentStaffRole()]);

  const headerStore = await headers();
  const requestedLocale = headerStore.get("x-sut-locale");
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  const dictionary = getDictionary(locale);
  const copy = dictionary.staffInventory;

  return (
    <>
      <StaffPageHeader
        description={copy.description}
        eyebrow={inventory.connected ? copy.eyebrowConnected : copy.eyebrowOffline}
        title={copy.title}
      />
      <InventoryLedger
        canEdit={Boolean(role && canEditInventory(role))}
        connected={inventory.connected}
        reconciliationIssueCount={inventory.reconciliationIssueCount}
        roomTypes={inventory.roomTypes}
      />
    </>
  );
}
