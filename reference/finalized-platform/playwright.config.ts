import fs from "node:fs";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

for (const envFile of [".env.local", ".env.staging.local"]) {
  const envPath = path.resolve(process.cwd(), envFile);
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
}

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const targetsSharedRemoteEnvironment = Boolean(process.env.PLAYWRIGHT_BASE_URL);
const httpCredentials =
  process.env.STAGING_PREVIEW_USERNAME && process.env.STAGING_PREVIEW_PASSWORD
    ? {
        username: process.env.STAGING_PREVIEW_USERNAME,
        password: process.env.STAGING_PREVIEW_PASSWORD,
      }
    : undefined;

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI || targetsSharedRemoteEnvironment ? 2 : 0,
  // Remote staging tests share one hotel tenant and one temporary staff account.
  // Serialize them to prevent cross-test auth/data contention and edge overload.
  workers: process.env.CI || targetsSharedRemoteEnvironment ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "html",
  use: {
    baseURL,
    channel: process.env.PLAYWRIGHT_CHANNEL,
    httpCredentials,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile-chromium",
      use: { ...devices["Pixel 7"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
