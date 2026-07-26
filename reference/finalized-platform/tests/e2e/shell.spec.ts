import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { signInAsStagingStaff } from "./support/staff-auth";

test.describe("application shells", () => {
  test("guest booking shell exposes fixture rooms responsively", async ({ page }) => {
    await page.goto("/book");

    await expect(
      page.getByRole("heading", { level: 1, name: "Reserve your room" }),
    ).toBeVisible();
    await expect(page.getByText(/availability/i).first()).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Choose your room" })).toBeVisible();

    const documentWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const viewportWidth = page.viewportSize()?.width;

    expect(documentWidth).toBeLessThanOrEqual(viewportWidth ?? documentWidth);

    const accessibilityResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityResults.violations).toEqual([]);
  });

  test("staff shell exposes navigation and System Health state", async ({ page }) => {
    await signInAsStagingStaff(page);
    await page.goto("/staff/dashboard");

    await expect(
      page.getByRole("heading", { level: 1, name: "Today's operations" }),
    ).toBeVisible();
    await expect(
      page.getByText("Hotel system connected").first(),
    ).toBeVisible();
    if ((page.viewportSize()?.width ?? 0) <= 780) {
      await page.getByText("Menu", { exact: true }).click();
    }

    await expect(page.getByRole("link", { name: "Room status" }).first()).toHaveAttribute(
      "href",
      "/en/staff/inventory",
    );

    const accessibilityResults = await new AxeBuilder({ page }).analyze();
    expect(accessibilityResults.violations).toEqual([]);
  });
});
