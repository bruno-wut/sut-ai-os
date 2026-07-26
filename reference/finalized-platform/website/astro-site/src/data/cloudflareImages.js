const responsiveWidths = [480, 800, 1200, 1600];
const DEFAULT_FALLBACK_PUBLIC_PATH = "/images/grand-exterior.jpg";

export function getDefaultCloudflareImageSource() {
  return DEFAULT_FALLBACK_PUBLIC_PATH;
}

export function cloudflareDeliveryUrlFromId(imageId, domain) {
  if (!imageId || !domain) return null;
  return `https://${domain}/cdn-cgi/image/format=auto/library/${imageId}`;
}

export function r2DeliveryUrlFromObjectKey(objectKey, domain) {
  if (!objectKey || !domain) return null;
  return `https://${domain}/${objectKey.replace(/^\/+/, "")}`;
}

export function isCloudflareImageUrl(src) {
  if (!src) return false;

  try {
    const url = new URL(src);
    return url.pathname.includes("/cdn-cgi/image/");
  } catch {
    return false;
  }
}

export function cloudflareImageUrl(src, width, quality = 82) {
  if (!isCloudflareImageUrl(src)) return src;

  try {
    const url = new URL(src);
    
    const match = url.pathname.match(/^\/cdn-cgi\/image\/([^/]+)\/(.*)$/);
    if (!match) return src;
    
    let paramsStr = match[1];
    const imagePath = match[2];
    
    const params = paramsStr.split(',').reduce((acc, param) => {
      const [key, value] = param.split('=');
      if (key) acc[key] = value;
      return acc;
    }, {});
    
    params.width = width;
    if (quality) params.quality = quality;
    
    const newParamsStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(',');
    url.pathname = `/cdn-cgi/image/${newParamsStr}/${imagePath}`;
    
    return url.toString();
  } catch {
    return src;
  }
}

export function cloudflareImageSrcSet(src, widths = responsiveWidths, quality = 82) {
  if (!isCloudflareImageUrl(src)) return undefined;

  return widths
    .map((width) => `${cloudflareImageUrl(src, width, quality)} ${width}w`)
    .join(", ");
}

export function resolveCloudflareImageSource(image, domain) {
  if (!image) return getDefaultCloudflareImageSource(domain);

  if (typeof image === "string") {
    return image || getDefaultCloudflareImageSource(domain);
  }

  if (image.r2ObjectKey && domain) {
    return r2DeliveryUrlFromObjectKey(image.r2ObjectKey, domain);
  }

  if (image.deliveryUrl) {
    return image.deliveryUrl;
  }

  if (image.localFallback) {
    return image.localFallback;
  }

  if (image.cloudflareId && domain) {
    return cloudflareDeliveryUrlFromId(image.cloudflareId, domain);
  }

  return getDefaultCloudflareImageSource(domain);
}

export { responsiveWidths };
