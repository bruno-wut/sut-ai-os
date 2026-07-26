"use client";

import {
  Activity,
  CalendarRange,
  LayoutDashboard,
  ListChecks,
  Menu,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useLocale } from "@/components/localization/locale-provider";
import { localizePath } from "@/lib/i18n/config";
import { canManageHotelSetup, type StaffRole } from "@/lib/staff-roles";

const navigationItems = [
  { href: "/staff/dashboard", icon: LayoutDashboard, key: "operations" },
  { href: "/staff/inventory", icon: CalendarRange, key: "inventory" },
  { href: "/staff/reservations", icon: ListChecks, key: "reservations" },
  { href: "/staff/system-health", icon: Activity, key: "systemHealth" },
] as const;

function NavigationLinks({ ariaLabel, role, setupComplete }: Readonly<{ ariaLabel?: string; role: StaffRole; setupComplete: boolean }>) {
  const pathname = usePathname();
  const { dictionary, locale } = useLocale();

  return (
    <nav aria-label={ariaLabel ?? dictionary.staff.navigationLabel} className="staff-nav">
      {navigationItems.map(({ href, icon: Icon, key }) => {
        const localizedHref = localizePath(href, locale);
        const isCurrent = pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);
        const label = dictionary.staff[key];

        return (
          <Link
            aria-current={isCurrent ? "page" : undefined}
            className={`staff-nav__link${isCurrent ? " staff-nav__link--active" : ""}`}
            href={localizedHref}
            key={href}
          >
            <Icon aria-hidden="true" size={17} strokeWidth={1.7} />
            {label}
          </Link>
        );
      })}
      {canManageHotelSetup(role) ? (() => {
        const href = setupComplete ? "/staff/room-types" : "/staff/onboarding";
        const localizedHref = localizePath(href, locale);
        const isCurrent = pathname === localizedHref || pathname.startsWith(`${localizedHref}/`);
        return (
          <Link aria-current={isCurrent ? "page" : undefined} className={`staff-nav__link${isCurrent ? " staff-nav__link--active" : ""}`} href={localizedHref}>
            <Settings2 aria-hidden="true" size={17} strokeWidth={1.7} />
            {setupComplete ? dictionary.staff.roomTypes : dictionary.staff.hotelSetup}
          </Link>
        );
      })() : null}
    </nav>
  );
}

export function StaffNavigation({ role, setupComplete }: Readonly<{ role: StaffRole; setupComplete: boolean }>) {
  return <NavigationLinks role={role} setupComplete={setupComplete} />;
}

export function StaffMobileNavigation({ role, setupComplete }: Readonly<{ role: StaffRole; setupComplete: boolean }>) {
  const { dictionary } = useLocale();
  return (
    <details className="staff-mobile-nav">
      <summary>
        <Menu aria-hidden="true" size={17} />
        {dictionary.staff.menu}
      </summary>
      <div className="staff-mobile-nav__panel">
        <NavigationLinks ariaLabel="Mobile staff navigation" role={role} setupComplete={setupComplete} />
      </div>
    </details>
  );
}
