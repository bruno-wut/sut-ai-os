import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

initOpenNextCloudflareForDev();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "imagedelivery.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "assets.sriuthonghotels.com",
        pathname: "/**",
      },
    ],
  },
  poweredByHeader: false,
  reactStrictMode: true,
  typedRoutes: true,
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
