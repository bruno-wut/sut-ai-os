import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
}

test.describe("booking, payment, and staff lifecycle acceptance", () => {
  test("guest can move from booking search to pay-at-hotel confirmation and booking lookup", async ({ page }) => {
    let checkoutHref = "";

    await test.step("select a room from booking search", async () => {
      await page.goto("/book");

      await page.getByRole("article").first().getByRole("button", { name: "Select this room" }).click();
      await expect(page.getByRole("complementary", { name: "Your selection" })).toBeVisible();
      const checkoutLink = page.getByRole("link", { name: "Continue to checkout" });
      await expect(checkoutLink).toBeVisible();
      checkoutHref = (await checkoutLink.getAttribute("href")) ?? "";
    });

    await test.step("complete a pay-at-hotel booking", async () => {
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

      await page.goto(checkoutHref);

      await expect(page.getByText("Service charge (10%)")).toBeVisible();
      await expect(page.getByText("VAT (7%)")).toBeVisible();
      await expect(page.getByText("from 12:00 PM", { exact: false })).toBeVisible();
      await page.getByLabel("Full name").fill("Narin S.");
      await page.getByLabel("Email").fill("guest@example.com");
      await page.getByLabel("Phone").fill("+66 81 234 5678");
      await page.getByRole("radio", { name: "Pay at the hotel" }).check();
      await page.getByRole("checkbox", { name: /I have read and agree to the Privacy Policy and Booking Terms/i }).check();
      await page.getByRole("button", { name: "Confirm pay-at-hotel booking" }).click();
    });

    await test.step("see pay-at-hotel confirmation state", async () => {
      await expect(page.getByRole("heading", { level: 1, name: "Your stay is confirmed" })).toBeVisible();
      await expect(page.getByText("Due at hotel", { exact: true })).toBeVisible();
    });

    await test.step("look up the booking safely", async () => {
      await page.route("**/api/booking-lookup", async (route) => {
        await route.fulfill({
          body: JSON.stringify({
            booking: {
              bookingReferenceId: "WEB-260720-014",
              checkInDate: "2026-07-20",
              checkOutDate: "2026-07-22",
              hotel: {
                address: "19 Nangpim Road, Suphanburi, Thailand 72000",
                name: "Sri U-Thong Grand Hotel",
                phone: "+66 35 501 290-3",
              },
              paymentMode: "pay_at_hotel",
              paymentSummary: "Payment due at hotel",
              reservationNumber: "WEB-260720-014",
              roomCategory: "Deluxe Room x 1",
              rooms: 1,
              status: "pending",
              statusLabel: "Booking received",
              updatedAt: "2026-07-20T03:42:00.000Z",
            },
          }),
          contentType: "application/json",
          status: 200,
        });
      });

      await page.goto("/lookup");
      await page.getByLabel("Booking Reference").fill("WEB-260720-014");
      await page.getByLabel("Email Address").fill("guest@example.com");
      await page.getByRole("button", { name: "Find Reservation" }).click();

      await expect(page.getByRole("heading", { level: 2, name: "Booking received" })).toBeVisible();
      await expect(page.getByText("Due at hotel", { exact: false })).toBeVisible();
      await expect(page.getByText("No internal notes shown")).not.toBeVisible();
      await expectNoAxeViolations(page);
    });
  });

  test("guest can show Stripe payment confirmation lifecycle", async ({ page }) => {
    await test.step("verify processing then confirmed payment lifecycle", async () => {
      await page.goto("/confirmation?mode=stripe&reservation=WEB-20300110-00000001");

      await expect(page.getByRole("heading", { level: 1, name: "Your stay is confirmed" })).toBeVisible();
      await expect(page.getByText("Collected online", { exact: true })).toBeVisible();
      await expect(page.getByText("Confirmation email")).toBeVisible();
      await expect(page.getByText("Hotel confirmed")).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });

  test("staff can process, adjust, and cancel reservations with audit-friendly lifecycle messaging", async ({ page }) => {
    await test.step("process a pending reservation through PMS and payment collection", async () => {
      await page.goto("/test/reservation-lifecycle");

      await expect(page.getByText("Room shuffle required before arrival")).toBeVisible();
      await page.getByRole("button", { name: "Mark entered in PMS" }).click();
      await expect(page.getByText("confirmation notification queued", { exact: false })).toBeVisible();
      await expect(page.locator(".payment-badge", { hasText: "Pay at hotel" })).toBeVisible();
    });

    await test.step("edit, override, and cancel a reservation with explicit lifecycle notices", async () => {
      await page.goto("/test/reservation-lifecycle");

      await page.getByRole("button", { name: "Edit details" }).click();
      const editDialog = page.getByRole("dialog", { name: "Edit reservation details" });
      await editDialog.getByLabel("Guest name").fill("Ploy Kanya");
      await editDialog.getByLabel("Internal note").fill("Late arrival after 22:00");
      await editDialog.getByLabel("Reason for edit").fill("Guest called front desk");
      await editDialog.getByRole("button", { name: "Save field edits" }).click();
      await expect(page.getByText("Reservation saved")).toBeVisible();

      await page.getByRole("button", { name: "Adjust booking" }).click();
      const overrideDialog = page.getByRole("dialog", { name: "Adjust room, dates, or rate" });
      await overrideDialog.getByLabel("Assigned room").selectOption("204");
      await overrideDialog.getByLabel("Nightly rate (THB)").fill("1500");
      await overrideDialog.getByLabel("Override reason").fill("Manager-approved room recovery");
      await overrideDialog.getByRole("button", { name: "Apply manager override" }).click();
      await expect(page.getByRole("status").filter({ hasText: "flagged for payment review" })).toBeVisible();

      await page.getByRole("button", { name: "Cancel reservation" }).click();
      const cancelDialog = page.getByRole("alertdialog", { name: "Cancel this reservation?" });
      await cancelDialog.getByLabel("Cancellation reason").fill("Guest requested cancellation");
      await cancelDialog.getByRole("button", { name: "Cancel and release rooms" }).click();
      await expect(page.getByText("Reservation cancelled", { exact: false })).toBeVisible();
      await expect(page.locator(".status-pill--cancelled")).toBeVisible();
      await expectNoAxeViolations(page);
    });
  });
});
