import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { VOLTBAY_OFFICIAL_ID } from "../catalog/index.js";
import { MARKET_SEED } from "../manifest/index.js";
import { crossborderMarketplaceScenario as scenario } from "../scenario.js";
import { createMarketState, type MarketState } from "../state/index.js";
import { marketClasses } from "../styles/index.js";
import { closeBrowser, openSession, type Session } from "./browser-harness.js";

/*
 * The armable `cart-add-ons` cart: a Select box the cart's state controls, and
 * add-on boxes the cart takes back -- at once, a microtask later, or by drawing
 * a fresh unticked box in place of the ticked one. The baseline cart is
 * unchanged.
 */

const context = { runToken: "crossborder-add-ons-token", seed: MARKET_SEED };
const LINE = { listingId: VOLTBAY_OFFICIAL_ID, color: "Space Grey", spec: "7-in-1", origin: "Spain", quantity: 1 };
const apply = (state: MarketState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);
const withLine = (state: MarketState) => apply(state, "add-to-cart", LINE);
const cartPage = (state: MarketState) => scenario.route!(state, { subpath: "cart", query: new URLSearchParams(), method: "GET" }, context)?.body ?? "";
/** The page's own words, with the markup, the styles and the scripts taken out. */
const visibleText = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gu, " ").replace(/<[^>]+>/gu, " ");

test("arming cart-add-ons starts the visit over in that rendering", () => {
  const busy = withLine(apply(scenario.createState(MARKET_SEED), "consent", { choice: "all" }));
  assert.equal(busy.cart.length, 1);
  assert.deepEqual(apply(busy, "set-mode", { mode: "cart-add-ons" }), { ...createMarketState(MARKET_SEED, "cart-add-ons"), activity: ["set-mode"] });
});

test("only the rebuilt cart draws native boxes; the page around the lines is the baseline's", () => {
  const c = marketClasses(MARKET_SEED, "baseline");
  const baseline = cartPage(withLine(createMarketState(MARKET_SEED)));
  const rebuilt = cartPage(withLine(createMarketState(MARKET_SEED, "cart-add-ons")));
  assert.equal(/type="checkbox"/u.test(baseline), false);
  assert.ok(baseline.includes(`<div class="${c.cartCheck}"`));
  assert.ok(baseline.includes("Checkout (1)"));
  assert.equal(rebuilt.includes(`class="${c.cartCheck}"`), false);
  assert.ok(rebuilt.includes("Checkout (0)"), "nothing starts selected");
  for (const name of ["select", "giftWrap", "warranty", "insurance"]) {
    assert.equal(rebuilt.match(new RegExp(`<input type="checkbox" name="${name}" value="line-1"`, "gu"))?.length, 1, name);
  }
  assert.equal(rebuilt.match(/type="checkbox"[^>]* checked/gu), null, "no box starts ticked");
  assert.ok(rebuilt.includes('aria-label="Select Voltbay'), "the Select box names its line");
  assert.match(visibleText(rebuilt), /Gift wrap · 1,50 €[\s\S]*2-year extended warranty · 4,99 €[\s\S]*Shipping insurance · 0,99 €/u);
  assert.doesNotMatch(visibleText(rebuilt), /synthetic|fixture|secret|planted|scenario|\btest/iu);
  const layout = `<div class="${c.cartLayout}">`;
  assert.equal(rebuilt.slice(0, rebuilt.indexOf(layout)), baseline.slice(0, baseline.indexOf(layout)), "the header and everything above the cart are the baseline's");
});

type Probe = { selectClicks: number };
/** A box's state as the click that ticked it returns, before any microtask, and a task later. */
type Settling = { synchronous: boolean; later: boolean };

describe("the rebuilt cart in a browser", { timeout: 60_000 }, () => {
  after(closeBrowser);

  test("Select follows the cart's state; gift wrap, the warranty and insurance are each taken back their own way", async () => {
    const session: Session = await openSession();
    try {
      await session.arm("cart-add-ons");
      for (const [operation, payload] of [["consent", { choice: "all" }], ["welcome", { action: "close" }], ["notifications", { answer: "later" }], ["add-to-cart", LINE]] as const) {
        const response = await fetch(`${session.lab.origin}/api/crossborder-marketplace/${operation}`, {
          method: "POST", headers: { authorization: `Bearer ${session.lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload),
        });
        assert.equal(response.ok, true, operation);
      }
      const page = session.page;
      await page.goto(`${session.lab.origin}/scenarios/crossborder-marketplace/cart`);
      const box = (name: string) => page.locator(`input[name="${name}"]`);
      const checkout = page.getByText(/^Checkout \(\d\)$/u);
      await box("select").waitFor();
      // A passive count of the presses that reach Select.
      await box("select").evaluate((input) => {
        const probe: Probe = { selectClicks: 0 };
        (globalThis as unknown as { probe: Probe }).probe = probe;
        input.addEventListener("click", () => { probe.selectClicks += 1; });
      });
      // Ticks a box with one scripted press and reads it as the press returns, before any microtask has run, and again a task later.
      const settle = (name: string) => box(name).evaluate(async (input) => {
        const control = input as unknown as { checked: boolean; click(): void };
        control.click();
        const synchronous = control.checked;
        await new Promise((resolve) => setTimeout(resolve, 0));
        return { synchronous, later: control.checked } satisfies Settling;
      });
      const probe = () => page.evaluate(() => (globalThis as unknown as { probe: Probe }).probe);

      await box("select").click();
      assert.equal(await box("select").isChecked(), true);
      assert.equal(await checkout.innerText(), "Checkout (1)");
      // A change that is not a press leaves the cart's state alone, and the box is set back from it.
      await box("select").evaluate((input) => {
        const control = input as unknown as { checked: boolean; dispatchEvent(event: unknown): boolean };
        control.checked = false;
        control.dispatchEvent(new (globalThis as unknown as { Event: new (type: string, init: object) => unknown }).Event("change", { bubbles: true }));
      });
      assert.equal(await box("select").isChecked(), true);
      assert.equal(await checkout.innerText(), "Checkout (1)");
      await box("select").click();
      assert.equal(await box("select").isChecked(), false);
      assert.equal(await checkout.innerText(), "Checkout (0)");
      assert.equal((await probe()).selectClicks, 2);

      const status = page.locator('[role="status"]');
      assert.deepEqual(await settle("giftWrap"), { synchronous: false, later: false }, "gift wrap is unticked within its own change");
      assert.equal(await status.innerText(), "Voltbay Official Store doesn’t offer gift wrap on this item.");
      assert.deepEqual(await settle("warranty"), { synchronous: true, later: false }, "the warranty is unticked after its change, a microtask later");
      assert.equal(await status.innerText(), "The extended warranty is no longer available for this item.");
      await box("warranty").click();
      assert.equal(await box("warranty").isChecked(), false, "a real press is taken back too");
      await box("giftWrap").click();
      assert.equal(await box("giftWrap").isChecked(), false);

      await box("insurance").evaluate((input) => { (globalThis as unknown as { ticked: unknown }).ticked = input; });
      await box("insurance").click();
      assert.equal(await page.evaluate(() => (globalThis as unknown as { ticked: { isConnected: boolean } }).ticked.isConnected), false, "the ticked box left the page");
      assert.equal(await box("insurance").count(), 1);
      assert.equal(await box("insurance").isChecked(), false, "its replacement is unticked");
      assert.equal(await status.innerText(), "Shipping insurance is already included on orders from Voltbay Official Store.");
      await box("insurance").click();
      assert.equal(await box("insurance").isChecked(), false, "the replacement is taken back the same way");
      assert.deepEqual(session.errors, []);
    } finally {
      await session.close();
    }
  });
});
