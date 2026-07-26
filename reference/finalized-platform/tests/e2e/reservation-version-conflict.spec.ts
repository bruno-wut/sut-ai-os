import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test("reservation edit keeps the dialog open on a version conflict", async ({ page }) => {
  await page.goto("/test/reservation-version-conflict");

  await page.getByRole("button", { name: "Edit details" }).click();

  const editDialog = page.getByRole("dialog", { name: "Edit reservation details" });
  await expect(editDialog).toBeVisible();

  await editDialog.getByLabel("Internal note").fill("Updated preview note");
  await editDialog.getByLabel("Reason for edit").fill("Simulate stale version submit");
  await editDialog.getByRole("button", { name: "Save field edits" }).click();

  await expect(page.getByText("This reservation changed in another session. Refresh the page and try again.")).toBeVisible();
  await expect(editDialog).toBeVisible();
  await expect(page.getByText(/revision 4/i)).toBeVisible();
  await expect(page.locator(".internal-note p")).toHaveText("Preview note");

  const accessibilityResults = await new AxeBuilder({ page }).analyze();
  expect(accessibilityResults.violations).toEqual([]);
});
