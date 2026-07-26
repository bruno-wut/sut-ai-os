"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { useLocale } from "@/components/localization/locale-provider";
import { localizePath } from "@/lib/i18n/config";

export function LanguageSwitcher({ compact = false }: Readonly<{ compact?: boolean }>) {
  const { dictionary, locale } = useLocale();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);

  const search = searchParams.toString();
  const currentPath = `${pathname}${search ? `?${search}` : ""}${hash}`;
  const thaiHref = localizePath(currentPath, "th");
  const englishHref = localizePath(currentPath, "en");

  return (
    <div
      className={compact ? "language-switcher language-switcher--compact" : "language-switcher"}
    >
      <span className="sr-only">{dictionary.language.switchLabel}</span>
      <a
        aria-current={locale === "th" ? "page" : undefined}
        aria-label={dictionary.language.switchToThai}
        className={`language-switcher__link${locale === "th" ? " is-active" : ""}`}
        href={thaiHref}
      >
        TH
      </a>
      <span aria-hidden="true" className="language-switcher__divider">|</span>
      <a
        aria-current={locale === "en" ? "page" : undefined}
        aria-label={dictionary.language.switchToEnglish}
        className={`language-switcher__link${locale === "en" ? " is-active" : ""}`}
        href={englishHref}
      >
        EN
      </a>
    </div>
  );
}
