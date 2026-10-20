import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { HOUSEHOLD, STORE_PATHS } from "../catalog/index.js";
import { routeStore } from "../route.js";
import { everythingStoreScenario as scenario } from "../scenario.js";
import { storeModes, type StoreState } from "../state/index.js";
import { BROWSER_KIT as kit } from "./browser-kit.js";

const context = { runToken: "everything-store-unit-token", seed: 241 };
const fresh = () => scenario.createState(scenario.seed);
const armed = () => scenario.mutate(fresh(), "set-mode", { mode: "help-and-offers" });
const cartPage = (state: StoreState) => routeStore(state, { subpath: "cart", query: new URLSearchParams(), method: "GET" }, context, 0)?.body ?? "";
const visibleText = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gu, "").replace(/<[^>]+>/gu, " ");

describe("the cart's help and offers area", () => {
  it("is a mode the store can be armed into, and arming starts the account over", () => {
    assert.ok((storeModes as readonly string[]).includes("help-and-offers"));
    assert.deepEqual({ ...armed(), mode: "baseline" }, fresh());
  });

  it("is drawn on the cart page only when armed, and every other page is unchanged", () => {
    assert.match(cartPage(armed()), /<h2 id="help-offers">Help and offers<\/h2>/u);
    assert.doesNotMatch(cartPage(fresh()), /help-offers|data-help-tab|data-faq/u);
    const strip = (html: string) => html.replace(/"mode":"[a-z-]+"/gu, "");
    assert.equal(strip(scenario.render(armed(), context)), strip(scenario.render(fresh(), context)), "the home page");
    const product = (state: StoreState) => routeStore(state, { subpath: STORE_PATHS.product({ slug: "x", sku: "B0TWGOOSE9" }).slice(STORE_PATHS.base.length + 1), query: new URLSearchParams(), method: "GET" }, context, 0)?.body ?? "";
    assert.equal(strip(product(armed())), strip(product(fresh())), "a product page");
  });

  it("holds the help topics, the delivery questions under their pinned bar, the deals strip, the promo and the also-viewed pager", () => {
    const html = cartPage(armed());
    assert.match(html, /<a href="#delivery-questions">Read our delivery questions<\/a>/u);
    assert.deepEqual([...html.matchAll(/<a href="(#help-[a-z]+)" data-help-tab>([^<]+)<\/a>/gu)].map((match) => `${match[1]} ${match[2]}`), ["#help-delivery Delivery", "#help-returns Returns", "#help-gifts Gift options"]);
    assert.equal((html.match(/data-help-panel hidden/gu) ?? []).length, 2, "only the first topic is open");
    assert.equal((html.match(/data-faq /gu) ?? []).length, 6);
    assert.match(html, /How do I cancel an order\?<\/button><p hidden>/u);
    assert.match(html, /Still need help\? <a href="#contact-us">Contact us<\/a>/u);
    assert.doesNotMatch(html.replace(/<script[\s\S]*?<\/script>/gu, ""), /data-deal-clock|data-claim-deal/u, "no deal without the descaler in the cart");
    assert.deepEqual([...html.matchAll(/<a href="(\?dept=[a-z]+)" data-deal-filter>/gu)].map((match) => match[1]), ["?dept=home", "?dept=electronics", "?dept=office"]);
    assert.match(html, /<p data-deal-count>12 deals picked for you<\/p>/u);
    assert.match(html, /<a href="#promo-terms" data-promo-terms>See terms<\/a>/u);
    assert.match(html, /<a href="\?viewed=2" data-viewed-page>Page 2<\/a>/u);
  });

  it("shows the lightning deal, and its clocks, only for a cart holding the descaler", () => {
    const html = cartPage(scenario.mutate(armed(), "add-to-cart", { sku: HOUSEHOLD.descaler.sku, quantity: 1 }));
    assert.match(html, /<span data-deal-clock>Ends in 14:59\.9<\/span>/u);
    assert.match(html, /<a href="#claim-deal" class="[^"]+" data-claim-deal>Claim deal<\/a>/u);
  });

  it("reads as a store's page, with no test vocabulary", () => {
    assert.doesNotMatch(visibleText(cartPage(armed())), /synthetic|fixture|secret|sensitive|\btest|planted|scenario/iu);
  });
});

describe("in a real browser", { concurrency: true }, () => {
  // Suite-level, not file-level: a file-level `after` waits for the process to go idle, which an open browser never lets it do.
  after(() => kit.closeBrowser());

  it("answers each link the way the store's scripts were written, and pins its bar over the last question", async () => {
    const session = await kit.openStore("help-and-offers");
    try {
      const { page, lab } = session;
      await kit.control(lab, "/api/everything-store/consent", { choice: "accept" });
      await kit.control(lab, "/api/everything-store/dismiss-nudge", { nudge: "app-banner" });
      await kit.control(lab, "/api/everything-store/dismiss-nudge", { nudge: "notifications" });
      await kit.control(lab, "/api/everything-store/add-to-cart", { sku: HOUSEHOLD.descaler.sku, quantity: 1 });
      await page.goto(`${lab.origin}${STORE_PATHS.cart}`);
      const cart = page.url();

      await page.getByRole("link", { name: "Returns", exact: true }).click();
      assert.equal(await page.getByText(/^Most items can be returned/u).isVisible(), true);
      assert.equal(await page.getByText(/^Orders placed by 2 pm/u).isVisible(), false);

      const home = page.getByRole("link", { name: "Home & Kitchen", exact: true });
      await home.click();
      assert.equal(await home.getAttribute("aria-current"), "true");
      await page.getByText("3 deals in Home & Kitchen", { exact: true }).waitFor();

      await page.getByRole("link", { name: "See terms", exact: true }).click();
      await page.getByRole("link", { name: "Page 2", exact: true }).click();
      assert.equal(await page.locator("[data-also-viewed]").getAttribute("aria-busy"), "true");
      const claim = page.getByRole("link", { name: "Claim deal", exact: true });
      await claim.click();
      assert.equal(await claim.locator("span").count(), 1, "the press left its ripple");
      assert.equal(page.url(), cart, "no link moved the address");

      const timer = page.locator("[data-deal-timer]");
      const before = await timer.textContent();
      await kit.pause(400);
      assert.notEqual(await timer.textContent(), before, "the deal clock ticks");

      // The last question sits under the pinned bar once its list is scrolled as far as it goes.
      const last = page.getByRole("button", { name: "How do I cancel an order?" });
      await last.evaluate((element) => element.scrollIntoView({ block: "center" }));
      const box = await last.boundingBox();
      assert.ok(box);
      const covering = await page.evaluate(`(() => { const hit = document.elementFromPoint(${box.x + box.width / 2}, ${box.y + box.height / 2}); return hit ? hit.textContent.trim() : ""; })()`);
      assert.equal(covering, "Still need help? Contact us");

      await page.getByRole("link", { name: "Read our delivery questions" }).click();
      assert.equal(page.url(), `${cart}#delivery-questions`);
    } finally {
      await session.close();
    }
  });
});
