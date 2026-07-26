export const DEFAULT_R2_MEDIA_DOMAIN = "assets.sriuthonghotels.com";
export const R2_IMAGE_PREFIX = "library/images/";

export function getR2MediaDomain() {
  return process.env.NEXT_PUBLIC_R2_CUSTOM_DOMAIN || DEFAULT_R2_MEDIA_DOMAIN;
}

export function r2ImageUrl(objectName: string) {
  const normalizedName = objectName.replace(/^\/+/, "");
  const objectKey = normalizedName.startsWith(R2_IMAGE_PREFIX)
    ? normalizedName
    : `${R2_IMAGE_PREFIX}${normalizedName}`;
  return `https://${getR2MediaDomain()}/${objectKey}`;
}

export function normalizeR2ImageSource(source: string) {
  if (source.startsWith("/images/")) {
    return r2ImageUrl(source.slice("/images/".length));
  }

  const transformedPath = source.match(
    /(?:https?:\/\/[^/]+)?\/cdn-cgi\/image\/[^/]+\/(library\/images\/[^?#]+)/,
  )?.[1];

  return transformedPath ? `https://${getR2MediaDomain()}/${transformedPath}` : source;
}

export function isApprovedRoomImageSource(source: string) {
  try {
    const url = new URL(source);
    return (
      url.protocol === "https:" &&
      (url.hostname === getR2MediaDomain() || url.hostname === "imagedelivery.net") &&
      (url.hostname !== getR2MediaDomain() || url.pathname.startsWith(`/${R2_IMAGE_PREFIX}`))
    );
  } catch {
    return /^\/images\/[A-Za-z0-9._/-]+$/.test(source);
  }
}

export const ROOM_IMAGE_PRESETS = [
  r2ImageUrl("grand-superior-room.jpg"),
  r2ImageUrl("grand-deluxe-room.jpg"),
  r2ImageUrl("grand-suite-room.jpg"),
] as const;
