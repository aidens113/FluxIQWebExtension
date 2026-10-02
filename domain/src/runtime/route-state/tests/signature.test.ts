// The route signature a Flow node keeps of the page it started on, and the
// comparison Core asks of two of them when a step cannot run (t243).
//
// The proofs are that the same page matches exactly, that a popup layer is
// never the page without it, that two pages of one kind share a path shape
// while different paths do not, that control overlap below a half does not
// match, that a page with more controls than the sketch holds is still judged
// deterministically and near the exact overlap, and that a signature carries
// no page text and stays inside Core's 2,048-character bound.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { compareWebAutomationRouteSignatures, webAutomationRouteSignature } from "..";

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

const CART_CONTROLS = ["Proceed to checkout", "Remove item", "Quantity", "Keep shopping", "Apply voucher"];

test("the same page matches itself with closeness 1", () => {
  const state = routeState({ location: "https://shop.test/cart", path: "/cart", title: "Your cart", controls: CART_CONTROLS });
  const recorded = webAutomationRouteSignature(state);
  const observed = webAutomationRouteSignature(state);
  assert.deepEqual(compareWebAutomationRouteSignatures(recorded, observed), { matches: true, closeness: 1 });
});

test("a page with a popup in front never matches the same page without it", () => {
  const plain = webAutomationRouteSignature(routeState({ path: "/cart", controls: CART_CONTROLS }));
  const popup = webAutomationRouteSignature(routeState({ path: "/cart", dialog: "Join our newsletter", controls: CART_CONTROLS }));
  const blocked = webAutomationRouteSignature(routeState({ path: "/cart", blockedBy: "Cookie consent", controls: CART_CONTROLS }));
  assert.equal(compareWebAutomationRouteSignatures(popup, plain).matches, false);
  assert.equal(compareWebAutomationRouteSignatures(plain, popup).matches, false);
  assert.equal(compareWebAutomationRouteSignatures(blocked, plain).matches, false);
  assert.equal(compareWebAutomationRouteSignatures(popup, blocked).matches, false);
});

test("two product pages share a path shape, and a long opaque segment is one shape", () => {
  const first = webAutomationRouteSignature(routeState({ path: "/p/123", controls: ["Add to basket"] }));
  const second = webAutomationRouteSignature(routeState({ path: "/P/456/", controls: ["Add  to   basket "] }));
  assert.equal(first.path, second.path);
  assert.deepEqual(compareWebAutomationRouteSignatures(first, second), { matches: true, closeness: 1 });
  const longA = webAutomationRouteSignature(routeState({ path: "/order/abcdefghijklmnopqrstuvwxyz" }));
  const longB = webAutomationRouteSignature(routeState({ path: "/order/zyxwvutsrqponmlkjihgfedcbaxx" }));
  assert.equal(longA.path, longB.path);
});

test("the path falls back to the location's pathname", () => {
  const fromPath = webAutomationRouteSignature(routeState({ path: "/cart", controls: CART_CONTROLS }));
  const fromLocation = webAutomationRouteSignature(routeState({ location: "https://shop.test/cart?ref=7", controls: CART_CONTROLS }));
  assert.equal(fromLocation.path, fromPath.path);
});

test("different paths do not match, however alike the controls", () => {
  const cart = webAutomationRouteSignature(routeState({ path: "/cart", controls: CART_CONTROLS }));
  const wishlist = webAutomationRouteSignature(routeState({ path: "/wishlist", controls: CART_CONTROLS }));
  const result = compareWebAutomationRouteSignatures(cart, wishlist);
  assert.equal(result.matches, false);
  assert.equal(result.closeness, 1);
});

test("control overlap below a half does not match", () => {
  const recorded = webAutomationRouteSignature(routeState({ path: "/cart", controls: ["a1", "a2", "a3", "a4", "a5", "a6", "s1", "s2"] }));
  const observed = webAutomationRouteSignature(routeState({ path: "/cart", controls: ["b1", "b2", "b3", "b4", "b5", "b6", "s1", "s2"] }));
  const result = compareWebAutomationRouteSignatures(recorded, observed);
  assert.equal(result.closeness, 2 / 14);
  assert.equal(result.matches, false);
  const half = compareWebAutomationRouteSignatures(
    webAutomationRouteSignature(routeState({ path: "/cart", controls: ["a", "b", "c", "d"] })),
    webAutomationRouteSignature(routeState({ path: "/cart", controls: ["a", "b", "c", "d", "e", "f", "g", "h"] }))
  );
  assert.deepEqual(half, { matches: true, closeness: 0.5 });
});

test("an empty control set is exact: both empty is 1, one empty is 0", () => {
  const empty = webAutomationRouteSignature(routeState({ path: "/cart" }));
  const full = webAutomationRouteSignature(routeState({ path: "/cart", controls: CART_CONTROLS }));
  assert.deepEqual(compareWebAutomationRouteSignatures(empty, empty), { matches: true, closeness: 1 });
  assert.deepEqual(compareWebAutomationRouteSignatures(empty, full), { matches: false, closeness: 0 });
});

test("with more than 64 controls the estimate is deterministic and close to the exact Jaccard", () => {
  const shared = Array.from({ length: 150 }, (_, index) => `Shared control ${index}`);
  const onlyRecorded = Array.from({ length: 50 }, (_, index) => `Recorded control ${index}`);
  const onlyObserved = Array.from({ length: 50 }, (_, index) => `Observed control ${index}`);
  const recorded = webAutomationRouteSignature(routeState({ path: "/catalogue", controls: [...shared, ...onlyRecorded] }));
  const observed = webAutomationRouteSignature(routeState({ path: "/catalogue", controls: [...onlyObserved, ...shared].reverse() }));
  assert.equal((recorded.controls as unknown[]).length, 64);
  assert.equal(recorded.count, 200);
  const first = compareWebAutomationRouteSignatures(recorded, observed);
  const again = compareWebAutomationRouteSignatures(webAutomationRouteSignature(routeState({ path: "/catalogue", controls: [...shared, ...onlyRecorded] })), observed);
  assert.deepEqual(again, first);
  const exact = 150 / 250;
  assert.ok(Math.abs(first.closeness - exact) <= 0.15, `estimate ${first.closeness} is not near ${exact}`);
  assert.equal(first.matches, first.closeness >= 0.5);
});

test("a signature that is not web-route.v1 never matches", () => {
  const cart = webAutomationRouteSignature(routeState({ path: "/cart", controls: CART_CONTROLS }));
  assert.deepEqual(compareWebAutomationRouteSignatures({ ...cart, v: "web-route.v0" }, cart), { matches: false, closeness: 0 });
  assert.deepEqual(compareWebAutomationRouteSignatures(cart, {}), { matches: false, closeness: 0 });
});

test("a signature holds hashes only, never page text, and stays under 2,048 characters", () => {
  const controls = Array.from({ length: 400 }, (_, index) => `Wishlist button number ${index} for Mykonos holiday`);
  const signature = webAutomationRouteSignature(routeState({
    location: "https://shop.test/journeys/mykonos-summer?session=xyz",
    path: "/journeys/mykonos-summer",
    title: "Mykonos journey planner",
    dialog: "Unlock your summer journey",
    blockedBy: "Consent overlay",
    controls: [...controls, "Proceed to checkout"]
  }));
  const json = JSON.stringify(signature);
  assert.ok(json.length < 2_048, `signature is ${json.length} characters`);
  assert.doesNotMatch(json, /mykonos|journey|wishlist|button|holiday|summer|unlock|consent|overlay|proceed|checkout|planner|session|shop/iu);
  assert.equal(signature.v, "web-route.v1");
  assert.match(String(signature.path), /^[0-9a-f]{8}$/u);
  assert.match(String(signature.layers), /^[0-9a-f]{8}$/u);
  assert.ok((signature.controls as string[]).every((hash) => /^[0-9a-f]{8}$/u.test(hash)));
  assert.equal(signature.count, 401);
  assert.equal(webAutomationRouteSignature(routeState({ path: "/cart" })).layers, "");
});
