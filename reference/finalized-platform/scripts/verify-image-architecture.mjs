import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const libraryPath = path.join(projectRoot, "website/astro-site/src/content/images/library.json");
const library = JSON.parse(await readFile(libraryPath, "utf8"));
const requiredRoomObjects = new Set([
  "library/images/grand-superior-room.jpg",
  "library/images/grand-deluxe-room.jpg",
  "library/images/grand-suite-room.jpg",
]);
const mappedObjects = new Set();
const errors = [];

for (const image of library.images ?? []) {
  if (!image.key || !image.altText) errors.push("Every image mapping needs key and altText.");
  if (!image.r2ObjectKey) continue;
  if (!/^library\/images\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(image.r2ObjectKey)) {
    errors.push(`${image.key}: invalid R2 object key ${image.r2ObjectKey}`);
  }
  if (mappedObjects.has(image.r2ObjectKey)) errors.push(`${image.key}: duplicate R2 object key`);
  mappedObjects.add(image.r2ObjectKey);
}

for (const objectKey of requiredRoomObjects) {
  if (!mappedObjects.has(objectKey)) errors.push(`Missing Astro mapping for ${objectKey}`);
}

if (process.argv.includes("--remote")) {
  const domain = process.env.NEXT_PUBLIC_R2_CUSTOM_DOMAIN || "assets.sriuthonghotels.com";
  for (const objectKey of mappedObjects) {
    const response = await fetch(`https://${domain}/${objectKey}`, { method: "HEAD" });
    if (!response.ok || !response.headers.get("content-type")?.startsWith("image/")) {
      errors.push(`${objectKey}: remote check returned ${response.status} ${response.headers.get("content-type") ?? "unknown"}`);
    }
  }
}

if (errors.length) {
  for (const error of errors) console.error(`IMAGE ARCHITECTURE ERROR: ${error}`);
  process.exitCode = 1;
} else {
  console.log(`Image architecture verified: ${mappedObjects.size} R2 mappings; ${requiredRoomObjects.size} required room images present.`);
}
