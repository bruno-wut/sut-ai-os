import { defineConfig } from "astro/config";
import partytown from "@astrojs/partytown";

export default defineConfig({
  integrations: [
    partytown({
      config: {
        debug: false,
        forward: ["dataLayer.push", "fbq"]
      }
    })
  ],
  site: "https://sriuthonggrand.com"
});
