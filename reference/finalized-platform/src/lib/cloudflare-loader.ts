type CloudflareLoaderProps = Readonly<{
  quality?: number;
  src: string;
  width: number;
}>;

export default function cloudflareLoader({ src, width, quality }: CloudflareLoaderProps) {
  const r2Domain = process.env.NEXT_PUBLIC_R2_CUSTOM_DOMAIN;
  const isLocalImage = src.startsWith("/images/");
  const isCdnCgi = src.includes("/cdn-cgi/image/");
  const isImageDelivery = src.includes("imagedelivery.net");

  if (isLocalImage && r2Domain) {
    const qualityString = quality ? `,quality=${quality}` : "";
    return `https://${r2Domain}/cdn-cgi/image/width=${width}${qualityString},format=auto/library${src}`;
  }

  if (!isCdnCgi && !isImageDelivery) {
    return src;
  }

  if (isCdnCgi) {
    try {
      const url = new URL(src, src.startsWith("/") ? "https://localhost" : undefined);
      const match = url.pathname.match(/^\/cdn-cgi\/image\/([^/]+)\/(.*)$/);
      
      if (!match) return src;
      
      const paramsStr = match[1];
      const imagePath = match[2];
      
      const params = paramsStr.split(',').reduce((acc: Record<string, string>, param: string) => {
        const [key, value] = param.split('=');
        if (key) acc[key] = value;
        return acc;
      }, {});
      
      params.width = width.toString();
      if (quality) params.quality = quality.toString();
      params.format = params.format || 'auto';
      
      const newParamsStr = Object.entries(params).map(([k, v]) => `${k}=${v}`).join(',');
      
      url.pathname = `/cdn-cgi/image/${newParamsStr}/${imagePath}`;
      return url.toString().replace("https://localhost", ""); // Remove dummy domain if relative
    } catch {
      return src;
    }
  }

  if (isImageDelivery) {
    try {
      const url = new URL(src);
      const parts = url.pathname.split('/').filter(Boolean);
      
      if (parts.length >= 2) {
        const imageId = parts[1];
        const qualityString = quality ? `,quality=${quality}` : "";
        return `https://${r2Domain}/cdn-cgi/image/width=${width}${qualityString},format=auto/${imageId}`;
      }
    } catch {
      // Fallthrough
    }
    
    // Fallback to original imagedelivery logic
    const baseSrc = src.replace(/\/(?:public|width=\d+(?:,quality=\d+)?\/public)$/, "");
    const qualityString = quality ? `,quality=${quality}` : "";
    return `${baseSrc}/width=${width}${qualityString}/public`;
  }

  return src;
}
