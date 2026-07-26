"use client";

import type { ReactNode } from "react";

import { GuestHeader } from "@/components/booking/guest-header";
import { useLocale } from "@/components/localization/locale-provider";
import { SITE_CONFIG } from "@/lib/site-config";

type GuestLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function GuestLayout({ children }: GuestLayoutProps) {
  const { dictionary } = useLocale();
  const copy = dictionary.guest;
  return (
    <div className="guest-shell">
      <a className="skip-link" href="#guest-content">
        {copy.skip}
      </a>
      <GuestHeader />
      {children}
      <footer className="guest-footer">
        <div className="guest-footer__inner">
          <p>{"\u00A9"} 2026 {SITE_CONFIG.brand.hotelName}</p>
          <p>{copy.address}</p>
          <div className="flex flex-col md:flex-row gap-4 items-center justify-center">
            <p>
              <a href={SITE_CONFIG.contact.phoneHref}>{SITE_CONFIG.contact.phoneDisplay}</a>
            </p>
            <button 
              onClick={() => (window as any).openCookieSettings?.()} 
              className="text-sm underline hover:text-[#30443b] transition-colors"
            >
              ตั้งค่าคุกกี้ / Cookie Settings
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
