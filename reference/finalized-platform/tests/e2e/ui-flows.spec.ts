import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { signInAsStagingStaff } from "./support/staff-auth";

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

async function completeGuestDetails(page: Page) {
  await page.getByLabel("Full name").fill("Test Guest");
  await page.getByLabel("Email").fill("test@example.com");
  await page.getByLabel("Phone").fill("+66 81 234 5678");
  await page.getByRole("checkbox", { name: /I have read and agree to the Privacy Policy and Booking Terms/i }).check();
}

test.describe("fixture-backed UI flows", () => {
  test("room selection opens the checkout path", async ({ page }) => {
    await page.goto("/book");

    const classicRoom = page.getByRole("article").filter({
      has: page.getByRole("heading", { level: 3, name: "Classic Room" }),
    });
    await classicRoom.getByRole("button", { name: "Select this room" }).click();

    await expect(page.getByRole("complementary", { name: "Your selection" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Continue to checkout" })).toHaveAttribute(
      "href",
      /\/en\/checkout\?room=classic&/,
    );
  });

  test("checkout shows the busy state before redirecting to secure payment", async ({ page }) => {
    let releaseCheckout: (() => void) | null = null;
    const checkoutGate = new Promise<void>((resolve) => {
      releaseCheckout = resolve;
    });

    await page.route("**/api/stripe/checkout-session", async (route) => {
      await checkoutGate;
      await route.fulfill({
        body: JSON.stringify({ url: "/en/confirmation?mode=stripe&session_id=cs_test_secure123" }),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/en/checkout?room=classic");
    await expect(page.getByRole("heading", { level: 1, name: "Complete your booking" })).toBeVisible();

    await completeGuestDetails(page);
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await expect(page.getByText("Checking availability")).toBeVisible();
    releaseCheckout?.();
    await expect(page).toHaveURL(/\/en\/confirmation\?mode=stripe&session_id=cs_test_secure123$/);
    await expectNoAxeViolations(page);
  });

  test("pay-at-hotel checkout keeps booking and payment states separate", async ({ page }) => {
    await page.route("**/api/checkout/hold", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          hold: {
            holdToken: "11111111-1111-4111-8111-111111111111",
          },
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.route("**/api/checkout/pay-at-hotel", async (route) => {
      await route.fulfill({
        body: JSON.stringify({
          confirmationUrl: "/confirmation?mode=pay_at_hotel&hold_token=11111111-1111-4111-8111-111111111111",
        }),
        contentType: "application/json",
        status: 200,
      });
    });

    await page.goto("/en/checkout?room=classic");
    await completeGuestDetails(page);
    await page.getByRole("radio", { name: "Pay at the hotel" }).check();
    await expect(page.getByText("Total due at hotel")).toBeVisible();
    await page.getByRole("button", { name: "Confirm pay-at-hotel booking" }).click();
    await expect(page.getByText("Payment due at the hotel", { exact: false })).toBeVisible();
    await expect(page.getByText("Due at hotel", { exact: true })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("confirmation presents the completed platform booking state", async ({ page }) => {
    await page.goto("/confirmation");
    await expect(page.getByRole("heading", { level: 1, name: "Your stay is confirmed" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("onboarding route reflects the hotel's setup state safely", async ({ page }) => {
    await signInAsStagingStaff(page);
    await page.goto("/staff/onboarding");

    if (/\/staff\/room-types(?:[/?#]|$)/.test(page.url())) {
      await expect(page).toHaveURL(/\/staff\/room-types(?:[/?#]|$)/);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await expectNoAxeViolations(page);
      return;
    }

    await expect(page.getByRole("heading", { level: 2, name: "Hotel details" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Rooms and base rates" })).toBeVisible();
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page.getByRole("heading", { level: 2, name: "Review generation plan" })).toBeVisible();
    await expect(page.getByRole("checkbox", { name: "I have checked the real room categories, room numbers, and starting rates." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate inventory" })).toBeDisabled();
    await expectNoAxeViolations(page);
  });

  test("inventory editor requires an explicit close action", async ({ page }) => {
    await signInAsStagingStaff(page);
    await page.goto("/staff/inventory");
    const firstInventoryCell = page.getByRole("gridcell").first().getByRole("button");
    await firstInventoryCell.click();
    const inventoryEditor = page.getByRole("region", { name: "Edit inventory" });
    await expect(inventoryEditor).toBeVisible();
    await inventoryEditor.getByRole("button", { name: "Close" }).click();
    await expect(inventoryEditor).toBeHidden();
    await expectNoAxeViolations(page);
  });

  test("reservation queue handles an empty search safely", async ({ page }) => {
    await signInAsStagingStaff(page);
    await page.goto("/staff/reservations");
    const searchInput = page.getByRole("textbox", { name: "Search reservations" });
    await searchInput.pressSequentially("QA-NO-MATCH-RESERVATION");
    await expect(page.getByText("No reservations match these filters.")).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("reservation edits, overrides, cancellation, and field audit stay distinct", async ({ page }) => {
    await signInAsStagingStaff(page);
    await page.goto("/test/reservation-lifecycle");

    await page.getByRole("button", { name: "Edit details" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit reservation details" });
    await editDialog.getByLabel("Guest name").fill("Ploy Kanya");
    await editDialog.getByLabel("Internal note").fill("Late arrival after 22:00");
    await editDialog.getByLabel("Reason for edit").fill("Guest called front desk");
    await editDialog.getByRole("button", { name: "Save field edits" }).click();
    await expect(page.getByRole("cell", { name: "Guest name" })).toBeVisible();

    await page.getByRole("button", { name: "Adjust booking" }).click();
    const overrideDialog = page.getByRole("dialog", { name: "Adjust room, dates, or rate" });
    await overrideDialog.getByLabel("Assigned room").selectOption("preview-room-204");
    await overrideDialog.getByLabel("Nightly rate (THB)").fill("1500");
    await overrideDialog.getByLabel("Override reason").fill("Manager-approved room recovery");
    await overrideDialog.getByRole("button", { name: "Apply manager override" }).click();
    await expect(page.getByRole("cell", { name: "Assigned room" })).toBeVisible();
    await expect(page.getByRole("cell", { name: "Booking total" })).toBeVisible();

    await page.getByRole("button", { name: "Cancel reservation" }).click();
    const cancelDialog = page.getByRole("alertdialog", { name: "Cancel this reservation?" });
    await cancelDialog.getByLabel("Cancellation reason").fill("Guest requested cancellation");
    await cancelDialog.getByRole("button", { name: "Cancel and release rooms" }).click();
    await expect(page.getByText("Reservation cancelled · room nights released")).toBeVisible();
    await expect(page.getByRole("cell", { name: "Reservation status" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("System Health renders live operational status", async ({ page }) => {
    await signInAsStagingStaff(page);
    await page.goto("/staff/system-health");
    await expect(page.getByRole("heading", { level: 1, name: "System Health" })).toBeVisible();
    await expect(page.getByRole("region", { name: "System Health summary" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Operational readiness" })).toBeVisible();
    await expectNoAxeViolations(page);
  });
});
