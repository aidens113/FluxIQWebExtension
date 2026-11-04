import assert from "node:assert/strict";
import test from "node:test";
import type { AskedChange } from "../asked/index.js";
import { siteChange } from "../change.js";
import { judgeSiteChange } from "../judge-change.js";
import { SITE_LASTING_VIEWS } from "../views/index.js";

const everythingStoreView = SITE_LASTING_VIEWS["everything-store"];

/** The kettle task, as the table holds it. */
const KETTLE: AskedChange = {
  acts: [
    { name: "Two kettles in the cart", change: { "cart:KETTLE:own": 2 } },
    { name: "Phone case moved to Save for later", change: { "cart:CASE:own": -1, "saved:CASE:own": 1 } },
  ],
  change: { "cart:KETTLE:own": 2, "cart:CASE:own": -1, "saved:CASE:own": 1 },
};
const BUY: AskedChange = { acts: [{ name: "One order placed", change: { orders: 1, "ordered:KETTLE:own": 1 } }], change: { orders: 1, "ordered:KETTLE:own": 1 } };
const NOTHING: AskedChange = { acts: [], change: {} };

test("the change equal to what was asked, once, holds", () => {
  const judged = judgeSiteChange(KETTLE, { "cart:KETTLE:own": 2, "cart:CASE:own": -1, "saved:CASE:own": 1 });
  assert.deepEqual(judged, { held: true, repeatedActs: [], missingActs: [], unaskedChanges: [] });
});

test("an act landed twice is reported by name, with what was asked and what landed", () => {
  const judged = judgeSiteChange(KETTLE, { "cart:KETTLE:own": 4, "cart:CASE:own": -1, "saved:CASE:own": 1 });
  assert.equal(judged.held, false);
  assert.deepEqual(judged.repeatedActs, [{ name: "Two kettles in the cart", asked: 2, landed: 4 }]);
  assert.deepEqual(judged.missingActs, []);
});

test("an order placed twice is a repeated act even when every line of it reads right", () => {
  const judged = judgeSiteChange(BUY, { orders: 2, "ordered:KETTLE:own": 2 });
  assert.deepEqual(judged.repeatedActs, [{ name: "One order placed", asked: 1, landed: 2 }]);
});

test("an act that did not land, or moved the wrong way, is missing and not repeated", () => {
  assert.deepEqual(judgeSiteChange(KETTLE, { "cart:KETTLE:own": 2 }).missingActs, ["Phone case moved to Save for later"]);
  assert.deepEqual(judgeSiteChange(BUY, { orders: -1 }).missingActs, ["One order placed"]);
});

test("a lasting change nobody asked for is named, on a task that asks for acts and on one that asks for none", () => {
  const judged = judgeSiteChange(KETTLE, { "cart:KETTLE:own": 2, "cart:CASE:own": -1, "saved:CASE:own": 1, "plus-trial": 1 });
  assert.equal(judged.held, false);
  assert.deepEqual(judged.unaskedChanges, ["plus-trial"]);
  assert.deepEqual(judgeSiteChange(NOTHING, { orders: 1 }).unaskedChanges, ["orders"]);
  assert.equal(judgeSiteChange(NOTHING, {}).held, true);
});

test("the change is judged from the attempt's own baseline, not from the seed: nine plus one is one (user, 2026-10-27)", () => {
  const line = (quantity: number) => ({ cart: [{ lineId: "L9", sku: "KETTLE", offerId: null, quantity, selected: true }], saved: [], orders: [] });
  const moved = siteChange(everythingStoreView(line(9)), everythingStoreView(line(10)));
  assert.deepEqual(moved, { "cart:KETTLE:own": 1 });
  assert.equal(judgeSiteChange({ acts: [{ name: "One more kettle", change: { "cart:KETTLE:own": 1 } }], change: { "cart:KETTLE:own": 1 } }, moved).held, true);
});

test("an act a build took back through the site's own controls nets out: what the site holds is the account", () => {
  const before = everythingStoreView({ cart: [], saved: [], orders: [] });
  const after = everythingStoreView({ cart: [{ lineId: "L3", sku: "KETTLE", offerId: null, quantity: 2, selected: true }], saved: [], orders: [] });
  assert.equal(judgeSiteChange({ acts: [{ name: "Two kettles", change: { "cart:KETTLE:own": 2 } }], change: { "cart:KETTLE:own": 2 } }, siteChange(before, after)).held, true);
});

test("a site's fixture noise moves nothing: consent, prompts, guards and the activity log are not lasting", () => {
  const seed = { consent: "pending", activity: [], guard: { searchLoads: [] }, cart: [], saved: [], orders: [], newsletter: "none" };
  const noisy = { ...seed, consent: "accepted", activity: ["consent accepted"], guard: { searchLoads: [1, 2, 3] } };
  assert.deepEqual(siteChange(everythingStoreView(seed), everythingStoreView(noisy)), {});
});
