import { expect, test } from "@playwright/test";

test.describe("Astro storefront cross-browser rendering", () => {
  for (const route of ["/en/", "/en/rooms/", "/th/rooms/"]) {
    test(`${route} renders images without overflow or browser errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const failedImageRequests: string[] = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("requestfailed", (request) => {
        if (request.resourceType() === "image") {
          failedImageRequests.push(`${request.url()} — ${request.failure()?.errorText ?? "failed"}`);
        }
      });

      await page.goto(route, { waitUntil: "networkidle" });
      await page.locator("img").evaluateAll((images) => {
        for (const image of images) {
          image.setAttribute("loading", "eager");
          image.scrollIntoView({ block: "center" });
        }
      });
      await page.waitForTimeout(1500);

      const result = await page.locator("img").evaluateAll((images) => ({
        images: images.map((image) => ({
          alt: image.getAttribute("alt") ?? "",
          height: image instanceof HTMLImageElement ? image.naturalHeight : 0,
          width: image instanceof HTMLImageElement ? image.naturalWidth : 0,
        })),
        scrollWidth: document.documentElement.scrollWidth,
        viewportWidth: document.documentElement.clientWidth,
      }));

      expect(result.images.length).toBeGreaterThan(0);
      for (const image of result.images) {
        expect(image.alt, `${route} image alt`).not.toBe("");
        expect(image.width, `${route} image width`).toBeGreaterThan(0);
        expect(image.height, `${route} image height`).toBeGreaterThan(0);
      }
      expect(result.scrollWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
      expect(consoleErrors).toEqual([]);
      expect(failedImageRequests).toEqual([]);
    });
  }
});
