import { getCollection } from "astro:content";
import { cloudflareDeliveryUrlFromId, r2DeliveryUrlFromObjectKey, resolveCloudflareImageSource, isCloudflareImageUrl } from "./cloudflareImages.js";

let imageLibraryPromise;
let pageMediaPromise;
let galleriesPromise;

function getCloudflareR2Domain() {
  return (
    import.meta.env.PUBLIC_R2_CUSTOM_DOMAIN ??
    import.meta.env.R2_CUSTOM_DOMAIN ??
    import.meta.env.NEXT_PUBLIC_R2_CUSTOM_DOMAIN ??
    null
  );
}

async function getImageLibraryEntry() {
  const entries = await (imageLibraryPromise ??= getCollection("imageLibrary"));
  const entry = entries.find((item) => item.id === "library");

  if (!entry) {
    throw new Error("Missing image library entry at src/content/images/library.json");
  }

  return entry;
}

async function getPageMediaEntries() {
  return (pageMediaPromise ??= getCollection("pageMedia"));
}

async function getGalleryEntries() {
  return (galleriesPromise ??= getCollection("galleries"));
}

export async function getImageLibraryMap() {
  const entry = await getImageLibraryEntry();
  return new Map(entry.data.images.map((image) => [image.key, image]));
}

export async function getManagedImage(key, overrides = {}) {
  const imageLibrary = await getImageLibraryMap();
  const image = imageLibrary.get(key);

  if (!image) {
    throw new Error(`Image "${key}" is not defined in src/content/images/library.json`);
  }

  const domain = getCloudflareR2Domain();
  const src = resolveCloudflareImageSource(image, domain);

  if (!src) {
    throw new Error(
      `Image "${key}" has no usable Cloudflare delivery URL or local fallback.`
    );
  }

  return {
    ...image,
    ...overrides,
    alt: overrides.alt ?? image.altText,
    src,
    cloudflareId: image.cloudflareId ?? null,
    r2ObjectKey: image.r2ObjectKey ?? null,
    r2Url: image.r2ObjectKey ? r2DeliveryUrlFromObjectKey(image.r2ObjectKey, domain) : null,
    deliveryUrl: image.deliveryUrl ?? (image.cloudflareId ? cloudflareDeliveryUrlFromId(image.cloudflareId, domain) : null),
    usesCloudflare: isCloudflareImageUrl(src)
  };
}

export async function getPageMedia(id) {
  const entries = await getPageMediaEntries();
  const entry = entries.find((item) => item.id === id);

  if (!entry) {
    throw new Error(`Missing page media entry "${id}" in src/content/page-media/`);
  }

  return entry.data;
}

export async function getGalleryData(id) {
  const entries = await getGalleryEntries();
  const entry = entries.find((item) => item.id === id);

  if (!entry) {
    throw new Error(`Missing gallery entry "${id}" in src/content/galleries/`);
  }

  return entry.data;
}
