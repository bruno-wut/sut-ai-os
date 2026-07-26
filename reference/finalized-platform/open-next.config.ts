import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Next.js 16 defaults to Turbopack. OpenNext 1.20.1 does not normalize
// Windows trace paths before inlining Turbopack server chunks, which can
// produce an empty runtime chunk map and HTTP 500s on every SSR route.
// The package build script deliberately uses Next's supported Webpack build.
export default defineCloudflareConfig();
