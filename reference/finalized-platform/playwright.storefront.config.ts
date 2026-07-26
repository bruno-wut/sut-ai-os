import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/storefront-e2e",
  reporter: "html",
  use: {
    baseURL: process.env.STOREFRONT_BASE_URL ?? "http://127.0.0.1:4321",
    channel: process.env.PLAYWRIGHT_CHANNEL,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  webServer: process.env.STOREFRONT_BASE_URL
    ? undefined
    : {
        command: "npm run dev --prefix website/astro-site -- --host 127.0.0.1 --port 4321",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        url: "http://127.0.0.1:4321",
      },
});
