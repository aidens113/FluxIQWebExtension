// The effect a Flow node keeps of what its step did to the page, and whether
// that effect is already on the page a run observes when the step cannot run
// (t243, "the step's own effect is already on the page").
//
// The proofs are that a store the site already chose is recognised as the
// store step's effect even with the picker the run opened still in front; that
// an add-to-cart whose cart panel is absent (out of stock) is not; that an
// effect which added nothing says nothing; that a navigation's effect needs
// the same path shape; and that an effect carries no page text and stays
// inside Core's 2,048-character bound.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationRouteEffect, webAutomationRouteEffectHolds } from "..";

function routeState(page: { path?: string; location?: string; title?: string; dialog?: string; blockedBy?: string; controls?: readonly string[] }): JsonObject {
  const value: JsonObject = {};
  if (page.location !== undefined) value.location = page.location;
  if (page.path !== undefined) value.path = page.path;
  if (page.title !== undefined) value.title = page.title;
  if (page.dialog !== undefined) value.dialog = page.dialog;
  if (page.blockedBy !== undefined) value.blockedBy = page.blockedBy;
  if (page.controls !== undefined && page.controls.length > 0) value.controls = page.controls.join(" | ");
  return { page: value };
}

const HOME = "https://bigbox.test/scenarios/bigbox-retail/";
const HOME_PATH = "/scenarios/bigbox-retail/";
const HOME_CONTROLS = ["Search", "Weekly ad", "Household Essentials", "Grocery", "Sign in", "Cart"];
const FLYOUT_CONTROLS = ["×", "Pickup", "Delivery", "Set as my store"];
const PICKER_BLOCKER = "Pickup or delivery? store picker";

test("a store the site already chose is the store step's effect, even with the picker the run opened in front", () => {
  // bigbox-retail store-remembered: the recorded choose-millbrook ran on the
  // picker the run opened, and left the home page with the chip naming Millbrook.
  const before = routeState({
    location: HOME,
    path: HOME_PATH,
    title: "ValueRidge",
    blockedBy: PICKER_BLOCKER,
    controls: [...HOME_CONTROLS, "Pickup or delivery? Carden Falls Supercenter", ...FLYOUT_CONTROLS, "Set as my store", "Set as my store"]
  });
  const after = routeState({ location: HOME, path: HOME_PATH, title: "ValueRidge", controls: [...HOME_CONTROLS, "Pickup or delivery? Millbrook Crossing Supercenter"] });
  // The remembered store: the picker is open again, the chip already reads
  // Millbrook and Millbrook's card has no Set as my store button to press.
  const observed = routeState({
    location: HOME,
    path: HOME_PATH,
    title: "ValueRidge",
    blockedBy: PICKER_BLOCKER,
    controls: [...HOME_CONTROLS, "Pickup or delivery?  Millbrook Crossing Supercenter ", ...FLYOUT_CONTROLS]
  });
  const effect = webAutomationRouteEffect(before, after);
  assert.equal(effect.v, "web-effect.v1");
  assert.equal((effect.added as string[]).length, 1);
  assert.ok((effect.removed as string[]).length >= 1);
  assert.equal("path" in effect, false);
  assert.equal(webAutomationRouteEffectHolds(effect, observed), true);
  // The page the step started on does not show what it added.
  assert.equal(webAutomationRouteEffectHolds(effect, before), false);
});

test("an add-to-cart whose cart panel is not on the page does not hold (out of stock)", () => {
  const productControls = ["Search", "Add to cart", "Quantity", "Pickup", "Delivery"];
  const before = routeState({ path: "/scenarios/bigbox-retail/p/1042", controls: productControls });
  const after = routeState({ path: "/scenarios/bigbox-retail/p/1042", controls: [...productControls, "View cart", "Continue shopping"] });
  const effect = webAutomationRouteEffect(before, after);
  assert.equal((effect.added as string[]).length, 2);
  const outOfStock = routeState({ path: "/scenarios/bigbox-retail/p/2077", controls: ["Search", "Quantity", "Pickup", "Delivery", "Notify me"] });
  assert.equal(webAutomationRouteEffectHolds(effect, outOfStock), false);
  // Half the effect is not the effect.
  const halfway = routeState({ path: "/scenarios/bigbox-retail/p/2077", controls: ["Search", "View cart"] });
  assert.equal(webAutomationRouteEffectHolds(effect, halfway), false);
  const added = routeState({ path: "/scenarios/bigbox-retail/p/2077", controls: ["Search", "View cart", "Continue shopping"] });
  assert.equal(webAutomationRouteEffectHolds(effect, added), true);
});

test("an effect that added nothing says nothing, so it never holds", () => {
  const before = routeState({ path: "/cart", controls: ["Remove item", "Proceed to checkout"] });
  const after = routeState({ path: "/cart", controls: ["Proceed to checkout"] });
  const effect = webAutomationRouteEffect(before, after);
  assert.deepEqual(effect.added, []);
  assert.equal((effect.removed as string[]).length, 1);
  assert.equal(webAutomationRouteEffectHolds(effect, after), false);
  assert.equal(webAutomationRouteEffectHolds(webAutomationRouteEffect(after, after), after), false);
});

test("a navigation's effect holds only on the same path shape", () => {
  const before = routeState({ path: "/cart", controls: ["Proceed to checkout"] });
  const after = routeState({ path: "/checkout/7781", controls: ["Place order", "Edit address"] });
  const effect = webAutomationRouteEffect(before, after);
  assert.equal(typeof effect.path, "string");
  assert.equal(webAutomationRouteEffectHolds(effect, routeState({ path: "/checkout/9902", controls: ["Place order", "Edit address", "Apply voucher"] })), true);
  assert.equal(webAutomationRouteEffectHolds(effect, routeState({ path: "/cart/review", controls: ["Place order", "Edit address"] })), false);
});

test("an effect of another version, or a malformed one, never holds", () => {
  const before = routeState({ path: "/p/1", controls: ["Add to cart"] });
  const after = routeState({ path: "/p/1", controls: ["Add to cart", "View cart"] });
  const effect = webAutomationRouteEffect(before, after);
  assert.equal(webAutomationRouteEffectHolds({ ...effect, v: "web-effect.v0" }, after), false);
  assert.equal(webAutomationRouteEffectHolds({ ...effect, added: "View cart" }, after), false);
  assert.equal(webAutomationRouteEffectHolds({ ...effect, path: 7 }, after), false);
  assert.equal(webAutomationRouteEffectHolds({}, after), false);
});

test("an effect holds hashes only, never page text, keeps the 16 smallest and stays under 2,048 characters", () => {
  // Its one part that is not a hash is where the step went (t1083): an address, its query left out, never page text.
  const before = routeState({ location: "https://shop.test/journeys/mykonos", path: "/journeys/mykonos", title: "Mykonos planner", controls: Array.from({ length: 300 }, (_, index) => `Wishlist holiday ${index}`) });
  const after = routeState({
    location: "https://shop.test/basket/summer-checkout",
    path: "/basket/summer-checkout",
    title: "Summer basket",
    dialog: "Unlock your summer journey",
    controls: Array.from({ length: 300 }, (_, index) => `Proceed to checkout voucher ${index}`)
  });
  const effect = webAutomationRouteEffect(before, after);
  const json = JSON.stringify(effect);
  assert.ok(json.length < 2_048, `effect is ${json.length} characters`);
  assert.equal(effect.destination, "/basket/summer-checkout");
  const { destination: _destination, ...hashed } = effect;
  assert.doesNotMatch(JSON.stringify(hashed), /mykonos|journey|wishlist|holiday|summer|unlock|basket|proceed|checkout|voucher|planner|shop/iu);
  const added = effect.added as string[];
  const removed = effect.removed as string[];
  assert.equal(added.length, 16);
  assert.equal(removed.length, 16);
  assert.deepEqual(added, [...added].sort());
  assert.ok([...added, ...removed].every((hash) => /^[0-9a-f]{8}$/u.test(hash)));
  assert.match(String(effect.path), /^[0-9a-f]{8}$/u);
  assert.match(String(effect.from), /^[0-9a-f]{8}$/u);
  // Both marked samples full too (t1062): names under their headings, hashes only.
  const marked = effect.marked as { added: string[]; removed: string[] };
  assert.equal(marked.added.length, 16);
  assert.equal(marked.removed.length, 16);
  assert.ok([...marked.added, ...marked.removed].every((hash) => /^[0-9a-f]{8}$/u.test(hash)));
  assert.deepEqual(Object.keys(effect).sort(), ["added", "destination", "from", "marked", "path", "removed", "v"]);
  assert.equal(webAutomationRouteEffectHolds(effect, after), true);
});

// Where a step that moved the page started and went (t1083). `from` lets `../seen.ts` tell a page that left
// without arriving (kestrel `run-mwz2jc4w-0c207128`, a search that landed on a robot check) from one still where
// the step found it; `destination` lets a run that passed the step over still reach where it went (bigbox
// `run-mwz29d50-c3a32a9c`, the drawer's "View cart").
test("a step that moved the page keeps where it started and where it went; one that did not keeps neither", () => {
  const product = routeState({ location: "https://bigbox.test/ip/towels/418830166", path: "/ip/towels/418830166", controls: ["Add to cart", "View cart"] });
  const cart = routeState({ location: "https://bigbox.test/cart?coupon=SPRING#lines", path: "/cart", controls: ["Check out", "Remove"] });
  const moved = webAutomationRouteEffect(product, cart);
  assert.equal(moved.from, webAutomationRouteEffect(cart, product).path, "the start's path shape, as a route signature writes it");
  assert.notEqual(moved.from, moved.path);
  assert.equal(moved.destination, "/cart", "the path only: its query and fragment are not the route");
  const stayed = webAutomationRouteEffect(product, routeState({ location: "https://bigbox.test/ip/towels/418830166", path: "/ip/towels/418830166", controls: ["Add to cart", "View cart", "Continue shopping"] }));
  assert.equal(stayed.path, undefined);
  assert.equal(stayed.from, undefined);
  assert.equal(stayed.destination, undefined);
});

test("a step that went to another origin keeps that origin with the path", () => {
  const shop = routeState({ location: "https://shop.test/checkout", path: "/checkout", controls: ["Pay with wallet"] });
  const wallet = routeState({ location: "https://pay.example/approve?session=withheld", path: "/approve", controls: ["Approve", "Cancel"] });
  assert.equal(webAutomationRouteEffect(shop, wallet).destination, "https://pay.example/approve");
});

test("a destination that would take the effect past Core's bound is left out, and the rest of the effect is kept", () => {
  const long = `/${"segment-".repeat(260)}`;
  const before = routeState({ location: "https://shop.test/cart", path: "/cart", controls: ["Check out"] });
  const after = routeState({ location: `https://shop.test${long}`, path: long, controls: ["Pay", "Back"] });
  const effect = webAutomationRouteEffect(before, after);
  assert.equal(effect.destination, undefined);
  assert.equal(typeof effect.path, "string");
  assert.ok(JSON.stringify(effect).length <= 2_048);
});
