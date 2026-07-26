"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore } from "react";

import { getDictionary } from "@/lib/i18n/dictionaries";
import { localeFromPathname, localizePath, type Locale } from "@/lib/i18n/config";

type LocaleContextValue = Readonly<{
  locale: Locale;
  dictionary: ReturnType<typeof getDictionary>;
  setLocale: (locale: Locale) => void;
}>;

const LocaleContext = createContext<LocaleContextValue | null>(null);

function localeFromLocation(): Locale {
  return localeFromPathname(window.location.pathname);
}

function subscribe(onChange: () => void) {
  window.addEventListener("sut-locale-change", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("sut-locale-change", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

export function LocaleProvider({ children, initialLocale }: Readonly<{ children: React.ReactNode; initialLocale: Locale }>) {
  const locale = useSyncExternalStore<Locale>(subscribe, localeFromLocation, () => initialLocale);

  const setLocale = (nextLocale: Locale) => {
    window.localStorage.setItem("sut-locale", nextLocale);
    const url = new URL(window.location.href);
    window.location.assign(localizePath(`${url.pathname}${url.search}${url.hash}`, nextLocale));
  };

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo(() => ({ dictionary: getDictionary(locale), locale, setLocale }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
