import type { ReactNode } from "react";
import { headers } from "next/headers";

import { BrandWordmark } from "@/components/shared/brand-wordmark";
import { LanguageSwitcher } from "@/components/localization/language-switcher";
import {
  StaffMobileNavigation,
  StaffNavigation,
} from "@/components/staff/staff-navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { logoutStaff } from "@/app/(staff)/staff/actions";
import { isStaffRole } from "@/lib/staff-roles";

type StaffShellProps = Readonly<{
  children: ReactNode;
}>;

export async function StaffShell({ children }: StaffShellProps) {
  const supabase = await createSupabaseServerClient();
  const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };
  const connected = Boolean(data.user);
  const { data: profile } = data.user && supabase
    ? await supabase.from("staff_profiles").select("role, hotel_id").eq("user_id", data.user.id).eq("is_active", true).maybeSingle()
    : { data: null };
  const role = isStaffRole(profile?.role) ? profile.role : "front_desk";
  const { data: hotel } = profile?.hotel_id && supabase
    ? await supabase.from("hotel_settings").select("setup_completed_at").eq("id", profile.hotel_id).maybeSingle()
    : { data: null };
  const { count: activeRoomTypeCount } = profile?.hotel_id && supabase
    ? await supabase.from("room_types").select("id", { count: "exact", head: true }).eq("hotel_id", profile.hotel_id).eq("is_active", true)
    : { count: 0 };
  const setupComplete = Boolean(hotel?.setup_completed_at) || (activeRoomTypeCount ?? 0) > 0;

  const headerStore = await headers();
  const requestedLocale = headerStore.get("x-sut-locale");
  const locale = isLocale(requestedLocale) ? requestedLocale : "en";
  const dictionary = getDictionary(locale);
  const copy = dictionary.staff;

  return (
    <div className="staff-shell">
      <a className="skip-link" href="#staff-content">
        {copy.skipLink}
      </a>
      <aside className="staff-sidebar">
        <div className="staff-sidebar__brand">
          <BrandWordmark priority />
        </div>
        <p className="staff-sidebar__label">{copy.operationsLabel}</p>
        <StaffNavigation role={role} setupComplete={setupComplete} />
        <div className="staff-sidebar__footer">
          <strong>{copy.hotelName}</strong>
          {copy.operationalDay}
          <form action={logoutStaff}>
            <button className="staff-logout" type="submit">{copy.logout}</button>
          </form>
        </div>
      </aside>
      <div className="staff-main">
        <header className="staff-topbar">
          <p className="staff-topbar__hotel">{copy.operationsLabel}</p>
          <div className="staff-topbar__meta">
            <LanguageSwitcher compact />
            <span className="status-dot" />
            {connected ? copy.connected : copy.unavailable}
            <form action={logoutStaff}>
              <button className="staff-logout staff-logout--compact" type="submit">{copy.logout}</button>
            </form>
            <StaffMobileNavigation role={role} setupComplete={setupComplete} />
          </div>
        </header>
        <main className="staff-content" id="staff-content">
          {children}
        </main>
      </div>
    </div>
  );
}
