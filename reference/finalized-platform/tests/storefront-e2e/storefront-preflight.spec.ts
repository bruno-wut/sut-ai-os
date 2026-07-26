import { expect, test } from "@playwright/test";

async function expectNoHorizontalOverflow(page: import("@playwright/test").Page) {
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

test.describe("storefront launch preflight", () => {
  test("Thai guest pages remain inside a 320px viewport", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });

    for (const path of ["/th/", "/th/rooms/", "/th/news/"]) {
      await page.goto(path);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("the reservation drawer and date picker retain keyboard focus", async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await page.goto("/th/");
    await page.getByRole("button", { name: /book|จอง/i }).first().click();
    const drawer = page.locator("[data-reserve-drawer]");
    await expect(drawer).toHaveAttribute("aria-hidden", "false");

    await page.keyboard.press("Tab");
    await expect(drawer).toContainText(/dates|วัน/i);
    await page.locator("[data-reserve-drawer] [data-booking-toggle='dates']").click();
    const datePicker = page.locator("[data-reserve-drawer] [data-booking-popover='dates']");
    await expect(datePicker).toBeVisible();

    for (let index = 0; index < 12; index += 1) {
      await page.keyboard.press("Tab");
      await expect.poll(() => page.evaluate(() => document.activeElement?.closest("[data-reserve-drawer]") !== null)).toBe(true);
    }

    await page.keyboard.press("Escape");
    await expect(datePicker).toBeHidden();
  });
});
