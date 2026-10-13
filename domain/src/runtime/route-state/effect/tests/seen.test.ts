// Whether a lasting step's recorded effect appeared once the step answered
// success (`../seen.ts`, t476). The row that matters is the first: an Add to
// cart the page only woke on, with the support card over the page instead of
// the added panel, is `not_seen` -- in `run-mv5tusj4-b7ee0630` it was counted
// as done by the trial, the playback and the build's reset ledger. The others
// prove the rule says nothing without strong evidence: a later add whose panel
// words its quantity differently, an effect too small to judge, a step that
// moved to the page's path, and an effect this host does not read.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { MIN_ADDED_FOR_ABSENCE, webAutomationRouteEffect, webAutomationRouteEffectSeen } from "..";

function routeState(path: string, controls: readonly string[]): JsonObject {
  return { page: { location: `https://bigbox.test${path}`, path, controls: controls.join(" | ") } };
}

const PRODUCT = "/scenarios/bigbox-retail/ip/paper-towels/418830127";
const PRODUCT_CONTROLS = ["Search", "Cart", "6 Double Rolls $9.97", "12 Double Rolls $16.47", "Pickup", "Delivery", "Add to cart"];
/** What the recorded add opened: the added panel and its picks. */
const ADDED_PANEL = ["×", "View cart", "Continue shopping", "Qty 1 · Pickup", "Everyday Dinner Napkins", "Ultra Dish Soap"];
/** The support card that opens on a timer three seconds after a product page loads. */
const SUPPORT_CARD = ["Chat now", "Hi, I'm Val, ValueRidge's virtual assistant."];

/** The effect the build recorded for Add to cart: the panel it opened. */
const ADD_EFFECT = webAutomationRouteEffect(routeState(PRODUCT, PRODUCT_CONTROLS), routeState(PRODUCT, [...PRODUCT_CONTROLS, ...ADDED_PANEL]));

test("an Add to cart the page only woke on, with the support card in front instead of the added panel, is not seen", () => {
  assert.equal(webAutomationRouteEffectSeen(ADD_EFFECT, routeState(PRODUCT, [...PRODUCT_CONTROLS, ...SUPPORT_CARD])), "not_seen");
});

test("an add whose panel is up is seen", () => {
  assert.equal(webAutomationRouteEffectSeen(ADD_EFFECT, routeState(PRODUCT, [...PRODUCT_CONTROLS, ...ADDED_PANEL])), "seen");
});

test("a later add whose panel words its quantity differently is not judged: part of the effect is there", () => {
  const second = ADDED_PANEL.map((name) => (name === "Qty 1 · Pickup" ? "Qty 2 · Pickup" : name));
  assert.equal(webAutomationRouteEffectSeen(ADD_EFFECT, routeState(PRODUCT, [...PRODUCT_CONTROLS, ...second])), "unknown");
});

test("an effect that added fewer than the minimum control names says nothing by their absence", () => {
  const small = webAutomationRouteEffect(routeState(PRODUCT, PRODUCT_CONTROLS), routeState(PRODUCT, [...PRODUCT_CONTROLS, "Undo", "Saved"]));
  assert.equal((small.added as unknown[]).length < MIN_ADDED_FOR_ABSENCE, true);
  assert.equal(webAutomationRouteEffectSeen(small, routeState(PRODUCT, PRODUCT_CONTROLS)), "unknown");
});

test("a step that moved to the path the page is on is not judged absent, whatever its controls", () => {
  const CART = "/scenarios/bigbox-retail/cart";
  const moved = webAutomationRouteEffect(routeState(PRODUCT, PRODUCT_CONTROLS), routeState(CART, ["Remove", "Check out", "Pickup slots", "Continue shopping"]));
  assert.equal(webAutomationRouteEffectSeen(moved, routeState(CART, ["Your cart is empty", "Start shopping"])), "unknown");
  assert.equal(webAutomationRouteEffectSeen(moved, routeState(PRODUCT, PRODUCT_CONTROLS)), "not_seen", "still on the page it left, with none of what it reached");
});

test("an effect of another version, or malformed, is unknown", () => {
  const observed = routeState(PRODUCT, PRODUCT_CONTROLS);
  assert.equal(webAutomationRouteEffectSeen({ ...ADD_EFFECT, v: 99 }, observed), "unknown");
  assert.equal(webAutomationRouteEffectSeen({ ...ADD_EFFECT, added: [1, 2, 3] as unknown as string[] }, observed), "unknown");
  assert.equal(webAutomationRouteEffectSeen({ ...ADD_EFFECT, path: 7 }, observed), "unknown");
});
