import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { STORE_PATHS } from "../catalog/index.js";
import { routeStore } from "../route.js";
import { everythingStoreScenario as scenario } from "../scenario.js";
import type { StoreState } from "../state/index.js";
import { BROWSER_KIT as kit } from "./browser-kit.js";

const context = { runToken: "everything-store-unit-token", seed: 241 };
const STRICT = "default-src 'none'; script-src 'none'; connect-src 'none'; img-src 'self'";
const fresh = () => scenario.createState(scenario.seed);
const apply = (state: StoreState, operation: string, payload: unknown = {}) => scenario.mutate(state, operation, payload);
/** The returning shopper's cart, checked out as the store opens checkout, and placed. */
const ordered = () => apply(apply(fresh(), "start-checkout", { pipeline: "cart" }), "place-order");
const receiptOf = (state: StoreState, orderId: string) => {
  const url = new URL(STORE_PATHS.receipt(orderId), "http://127.0.0.1");
  return routeStore(state, { subpath: url.pathname.slice(STORE_PATHS.base.length + 1), query: url.searchParams, method: "GET" }, context, 0);
};

describe("the printable order receipt", () => {
  it("is served for a placed order under a policy that lets no script run and nothing load but the store's own images", () => {
    const state = ordered();
    const order = state.orders[0];
    assert.ok(order);
    const response = receiptOf(state, order.orderId);
    assert.equal(response?.status, 200);
    assert.equal(response?.headers?.["content-security-policy"], STRICT);
    assert.equal(response?.mutation, undefined, "reading a receipt changes nothing");
    const body = response?.body ?? "";
    assert.ok(body.includes(order.orderId));
    assert.match(body, /Order total:/u);
    assert.match(body, /Visa ending in 4417/u);
    assert.match(body, /418 Larkspur Ave/u);
    assert.equal((body.match(/<tr data-line>/gu) ?? []).length, order.lines.length);
    for (const line of order.lines) assert.ok(body.includes(STORE_PATHS.image(line.sku)), line.sku);
  });

  it("carries one inline script that would reveal its print button, which the page serves hidden", () => {
    const state = ordered();
    const body = receiptOf(state, state.orders[0]?.orderId ?? "")?.body ?? "";
    assert.equal((body.match(/<script\b/gu) ?? []).length, 1);
    assert.match(body, /<button type="button" data-print hidden>Print this page for your records<\/button>/u);
    assert.match(body, /<p data-print-hint>/u);
  });

  it("answers an order the account never placed with the store's not-found receipt, under the same policy", () => {
    const response = receiptOf(fresh(), "114-0000000-0000000");
    assert.equal(response?.status, 404);
    assert.equal(response?.headers?.["content-security-policy"], STRICT);
    assert.match(response?.body ?? "", /We couldn't find that order/u);
  });

  it("reads as a store's receipt, with no test vocabulary", () => {
    const state = ordered();
    const visible = (receiptOf(state, state.orders[0]?.orderId ?? "")?.body ?? "").replace(/<script[\s\S]*?<\/script>/gu, "").replace(/<[^>]+>/gu, " ");
    assert.doesNotMatch(visible, /synthetic|fixture|secret|sensitive|test|planted|scenario|probe/iu);
  });
});

describe("in a real browser", { concurrency: true }, () => {
  // Suite-level, not file-level: a file-level `after` waits for the process to go idle, which an open browser never lets it do.
  after(() => kit.closeBrowser());

  it("the receipt's own script never runs, and run by hand on the same page it reveals the button", async () => {
    const session = await kit.openStore();
    try {
      const { page, lab } = session;
      await kit.control(lab, "/api/everything-store/start-checkout", { pipeline: "cart" });
      await kit.control(lab, "/api/everything-store/place-order", {});
      const [order] = (await kit.storeState(lab)).orders as Array<{ orderId: string }>;
      assert.ok(order);
      const response = await page.goto(`${lab.origin}${STORE_PATHS.receipt(order.orderId)}`);
      assert.equal(response?.headers()["content-security-policy"], STRICT);
      await page.getByRole("heading", { level: 1 }).waitFor();
      assert.equal(await page.locator("[data-print]").isVisible(), false, "the print button stays hidden");
      assert.equal(await page.locator("[data-print-hint]").isVisible(), true, "the print hint stays");
      assert.equal(await page.evaluate("document.documentElement.className"), "");
      // Images from the store itself still load under the policy.
      await page.waitForFunction("[...document.images].every((image) => image.complete && image.naturalWidth > 0)");

      // The control: the page's own inline script, run by the test on the same
      // receipt (Playwright's evaluate is not subject to the page's policy), does
      // reveal the button. So the button stayed hidden because the policy stopped
      // the script, not because the script does nothing. The page stays the
      // store's receipt throughout; no page of the test's own is opened.
      const inline = await page.locator("script:not([src])").evaluateAll((scripts) => scripts.map((script) => script.textContent ?? ""));
      assert.equal(inline.length, 1, "the receipt carries exactly one inline script");
      await page.evaluate(inline[0]!);
      assert.equal(await page.locator("[data-print]").isVisible(), true, "run, the script reveals the button");
      assert.equal(await page.locator("[data-print-hint]").isVisible(), false);
    } finally {
      await session.close();
    }
  });
});
