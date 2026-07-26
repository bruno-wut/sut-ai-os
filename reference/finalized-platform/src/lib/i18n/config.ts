import type { Route } from "next";

export const locales = ["en", "th"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export function isLocale(value: string | null | undefined): value is Locale {
  return locales.includes(value as Locale);
}

export function localeFromPathname(pathname: string): Locale {
  const segment = pathname.split("/")[1];
  return isLocale(segment) ? segment : defaultLocale;
}

export function localizePath(pathname: string, locale: Locale): Route {
  const url = new URL(pathname, "https://sriuthonghotels.com");
  url.searchParams.delete("lang");
  const segments = url.pathname.split("/").filter(Boolean);
  if (isLocale(segments[0])) segments.shift();
  const localizedPath = `/${locale}/${segments.join("/")}`.replace(/\/$/, "") || `/${locale}`;
  return `${localizedPath}${url.search}${url.hash}` as Route;
}

export function stripLocaleFromPathname(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  if (isLocale(segments[0])) segments.shift();
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}
