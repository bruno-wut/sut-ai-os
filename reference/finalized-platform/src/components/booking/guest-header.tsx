"use client";

import { LockKeyhole } from "lucide-react";
import Link from "next/link";

import { LanguageSwitcher } from "@/components/localization/language-switcher";
import { useLocale } from "@/components/localization/locale-provider";
import { BrandWordmark } from "@/components/shared/brand-wordmark";
import { HOTEL_FACTS } from "@/lib/hotel-facts";
import { localizePath } from "@/lib/i18n/config";
import { SITE_CONFIG } from "@/lib/site-config";

function isStagingHost(hostname: string) {
  return /(?:staging-preview-|pages\.dev|localhost|netlify|preview)/i.test(hostname);
}

export function GuestHeader() {
  const { dictionary, locale } = useLocale();
  const copy = dictionary.guest;
  const websitePath = `/${locale}/`;

  function handleHotelWebsiteClick(event: React.MouseEvent<HTMLAnchorElement>) {
    if (typeof window === "undefined" || !isStagingHost(window.location.hostname)) return;

    event.preventDefault();
    window.location.href = `${SITE_CONFIG.brand.stagingSiteUrl}${websitePath}`;
  }

  return (
    <header className="guest-header">
      <div className="guest-header__side">
        <span className="guest-header__secure">
          <LockKeyhole aria-hidden="true" size={14} strokeWidth={1.5} />
          {copy.secure}
        </span>
      </div>
      <Link
        aria-label={copy.bookingHome}
        className="guest-header__brand"
        href={localizePath("/book", locale)}
      >
        <BrandWordmark priority />
      </Link>
      <div className="guest-header__side">
        <LanguageSwitcher compact />
        <a
          aria-label={copy.hotelWebsiteLabel}
          className="guest-header__link"
          onClick={handleHotelWebsiteClick}
          href={`${HOTEL_FACTS.websiteUrl}/${locale}/`}
        >
          {copy.hotelWebsite}
        </a>
        <Link className="guest-header__link" href={localizePath("/lookup", locale)}>
          {copy.findBooking}
        </Link>
        <a className="guest-header__link" href="tel:+6635502293">
          {copy.contactHotel}
        </a>
      </div>
    </header>
  );
}
