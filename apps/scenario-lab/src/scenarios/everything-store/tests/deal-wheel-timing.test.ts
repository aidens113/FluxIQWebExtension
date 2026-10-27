import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { BROWSER_KIT as kit } from "./browser-kit.js";

/**
 * The wheel is up as the results render, not on a timer after them, so no
 * press on a results page can land before it and slip past the promotion.
 */
describe("the deal wheel opens with the results page", () => {
  after(() => kit.closeBrowser());

  it("is already up, with the page inert, once the first result card is present", async () => {
    const session = await kit.openStore("deal-wheel");
    try {
      const { page } = session;
      await kit.settleIn(page);
      await kit.search(page, "wireless earbuds");
      await page.locator(`[data-component="search-result"][data-sku]`).first().waitFor();
      assert.equal(await page.getByTestId("deal-wheel").count(), 1, "the wheel is present the moment a result card is");
      assert.equal(await page.locator("[inert]").count(), 1, "the page root is inert");
      assert.equal(await page.getByRole("link", { name: "Brightaisle Plus" }).evaluate((link) => link.closest("[inert]") !== null), true, "the Plus filter sits under the inert root");
    } finally { await session.close(); }
  });
});
