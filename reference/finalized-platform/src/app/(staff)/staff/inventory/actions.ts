"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";

const inventoryUpdateSchema = z.object({
  date: z.iso.date(),
  isAvailable: z.enum(["true", "false"]),
  nightlyRate: z.coerce.number().min(0).max(1_000_000),
  reason: z.string().trim().min(10).max(500),
  roomTypeId: z.uuid(),
});

export type InventoryUpdateState = Readonly<{
  error: string | null;
  success: string | null;
}>;

function nextDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

export async function updateInventoryDay(
  _state: InventoryUpdateState,
  formData: FormData,
): Promise<InventoryUpdateState> {
  const parsed = inventoryUpdateSchema.safeParse({
    date: formData.get("date"),
    isAvailable: formData.get("isAvailable"),
    nightlyRate: formData.get("nightlyRate"),
    reason: formData.get("reason"),
    roomTypeId: formData.get("roomTypeId"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid rate, sale status, and reason of at least 10 characters.", success: null };
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return { error: "Inventory service is unavailable.", success: null };

  const result = await supabase.rpc("bulk_update_inventory", {
    p_clear_group_block: false,
    p_end_date_exclusive: nextDate(parsed.data.date),
    p_group_block_id: null,
    p_is_available: parsed.data.isAvailable === "true",
    p_nightly_price: parsed.data.nightlyRate,
    p_reason: parsed.data.reason,
    p_room_ids: null,
    p_room_type_id: parsed.data.roomTypeId,
    p_start_date: parsed.data.date,
  });

  if (result.error) {
    const denied = result.error.code === "42501" || /cannot edit inventory|active staff profile/i.test(result.error.message);
    return {
      error: denied ? "Your staff role cannot modify inventory." : result.error.message,
      success: null,
    };
  }

  revalidatePath("/staff/inventory");
  return { error: null, success: "Inventory updated and audit history recorded." };
}
