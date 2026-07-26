import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const storefrontDist = join(process.cwd(), "website", "astro-site", "dist");
const requireContentFreeze = process.argv.includes("--require-content-freeze");
const productionHost = "https://sriuthonggrand.com";
const prohibitedHosts = ["staging-preview-", "sri-u-thong-storefront-staging.pages.dev"];
const freezeMarkers = ["placeholder", "editable placeholder", "room names and details below are editable"];

function listHtmlFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listHtmlFiles(path) : entry.name.endsWith(".html") ? [path] : [];
  });
}

function fail(message) {
  console.error(`Storefront validation failed: ${message}`);
  process.exitCode = 1;
}

if (!existsSync(storefrontDist)) {
  fail("website/astro-site/dist is missing. Run the Astro build first.");
} else {
  const htmlFiles = listHtmlFiles(storefrontDist);
  const localizedNewsFiles = htmlFiles.filter((path) => /[\\/]((en)|(th))[\\/]news[\\/]/.test(path));

  if (!localizedNewsFiles.length) {
    fail("no localized news pages were built");
  }

  for (const file of htmlFiles) {
    const html = readFileSync(file, "utf8");
    const displayPath = file.slice(storefrontDist.length).replaceAll("\\", "/");

    if (html.includes("<link rel=\"canonical\"") && !html.includes(productionHost)) {
      fail(`${displayPath} has a canonical URL outside ${productionHost}`);
    }

    if (/[\\/]((en)|(th))[\\/]news[\\/]/.test(file)) {
      for (const required of [
        'rel="canonical"',
        'hreflang="en"',
        'hreflang="th"',
        'property="og:title"',
        'property="og:description"',
        'property="og:image"',
      ]) {
        if (!html.includes(required)) fail(`${displayPath} is missing ${required}`);
      }
    }

    for (const prohibitedHost of prohibitedHosts) {
      if (html.includes(prohibitedHost)) fail(`${displayPath} still references ${prohibitedHost}`);
    }

    if (requireContentFreeze) {
      // Form controls legitimately use the HTML `placeholder` attribute; remove
      // those attribute values before checking visible/content-freeze markers.
      const normalized = html.toLowerCase().replace(/\splaceholder\s*=\s*(["']).*?\1/g, "");
      const marker = freezeMarkers.find((value) => normalized.includes(value));
      if (marker) fail(`${displayPath} still contains the content-freeze marker "${marker}"`);
    }
  }
}

if (!process.exitCode) {
  console.log(`Storefront validation passed${requireContentFreeze ? " with content-freeze markers excluded" : ""}.`);
}
