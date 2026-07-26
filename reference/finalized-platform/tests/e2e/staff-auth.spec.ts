import { expect, test } from "@playwright/test";

for (const path of ["/dashboard", "/settings", "/staff/dashboard"]) {
  test(`unauthenticated ${path} navigation is redirected before rendering`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/login\?/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  });
}
