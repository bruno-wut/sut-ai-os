import { expect, type Page } from "@playwright/test";

type StaffCookie = Awaited<ReturnType<ReturnType<Page["context"]>["cookies"]>>[number];

let cachedStaffCookies: StaffCookie[] | null = null;

export async function signInAsStagingStaff(page: Page) {
  const email = process.env.STAGING_E2E_STAFF_EMAIL;
  const password = process.env.STAGING_E2E_STAFF_PASSWORD;

  if (!email || !password) {
    throw new Error("STAGING_E2E_STAFF_EMAIL and STAGING_E2E_STAFF_PASSWORD are required for protected staff E2E scenarios.");
  }

  if (cachedStaffCookies?.length) {
    await page.context().addCookies(cachedStaffCookies);
    await page.goto("/staff/dashboard");
    if (/\/staff\/dashboard$/.test(page.url())) return;
    cachedStaffCookies = null;
  }

  await page.goto("/login?next=/staff/dashboard");
  await page.getByLabel("Staff email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in securely" }).click();
  await expect(page).toHaveURL(/\/staff\/dashboard$/, { timeout: 30_000 });
  cachedStaffCookies = await page.context().cookies();
}
