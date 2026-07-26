import { expect, test } from "@playwright/test";

test.describe("8A cross-browser rendering", () => {
  test("IBE room cards render images without responsive overflow or browser errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      const failure = request.failure()?.errorText ?? "failed";
      const expectedAbort =
        (failure === "net::ERR_ABORTED" && request.url().includes("?_rsc=")) ||
        (failure === "NS_BINDING_ABORTED" && request.url().includes("/_next/image?"));
      if (expectedAbort) return;
      failedRequests.push(`${request.method()} ${request.url()} — ${failure}`);
    });

    await page.goto("/en/book", { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(750);

    const result = await page.locator(".room-card").evaluateAll((cards) => ({
      cards: cards.length,
      images: cards.map((card) => {
        const image = card.querySelector("img");
        const bounds = card.getBoundingClientRect();
        return {
          alt: image?.getAttribute("alt") ?? "",
          height: image instanceof HTMLImageElement ? image.naturalHeight : 0,
          src: image?.getAttribute("src") ?? "",
          width: image instanceof HTMLImageElement ? image.naturalWidth : 0,
          cardRight: bounds.right,
        };
      }),
      viewportWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
    }));

    expect(result.cards).toBeGreaterThanOrEqual(6);
    expect(result.images).toHaveLength(result.cards);
    for (const image of result.images) {
      expect(image.alt).not.toBe("");
      expect(image.width, `${image.alt} image width`).toBeGreaterThan(0);
      expect(image.height, `${image.alt} image height`).toBeGreaterThan(0);
      expect(image.src, `${image.alt} source`).toContain("/_next/image");
      expect(image.cardRight, `${image.alt} overflow`).toBeLessThanOrEqual(result.viewportWidth + 1);
    }
    expect(result.scrollWidth).toBeLessThanOrEqual(result.viewportWidth + 1);
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
  });
});
