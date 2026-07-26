import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { StaffShell } from "@/components/staff/staff-shell";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import "@/app/staff.css";

type StaffLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default async function StaffLayout({ children }: StaffLayoutProps) {
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    redirect("/login?reason=configuration_required");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: staffProfile } = await supabase
    .from("staff_profiles")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (!staffProfile) {
    redirect("/login?reason=staff_required");
  }

  return <StaffShell>{children}</StaffShell>;
}
