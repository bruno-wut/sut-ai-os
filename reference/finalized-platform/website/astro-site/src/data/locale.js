import { astroSiteConfig } from "./siteConfig.js";

export function getLocale(url) {
  const segment = url.pathname.split("/").filter(Boolean)[0];
  if (segment === "en" || segment === "th") return segment;
  return url.searchParams.get("lang") === "th" ? "th" : "en";
}

export function withLocale(href, locale) {
  if (!href || href.startsWith("tel:") || href.startsWith("mailto:") || href.startsWith("http") || href.startsWith("#")) return href;
  const [path, hash = ""] = href.split("#");
  const url = new URL(path, astroSiteConfig.canonicalSiteUrl);
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments[0] === "en" || segments[0] === "th") segments.shift();
  const localizedPath = `/${locale}/${segments.join("/")}${url.pathname.endsWith("/") ? "/" : ""}`.replace(/\/+$/, "/");
  return `${localizedPath}${url.search}${hash ? `#${hash}` : ""}`;
}
