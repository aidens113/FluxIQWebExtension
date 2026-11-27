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
import { KESTREL_CHECK, KESTREL_HOME, KESTREL_RESULTS, KESTREL_SEARCH_EFFECT } from "./kestrel-pages";

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

// A stepper's Next adds too few names for their absence to say anything, so whether the page still stands where the
// step found it is read from the names under their headings (t1062, company-website `run-mwxixc4p-b7945aed`: a Next
// carried from the first attempt was held on every replay of the saved Flow).
const WIZARD = "/scenarios/demo-shop/checkout";
const SHELL = ["Home", "Help", "Chat"];
const FIRST_STEP = [...SHELL, "[Choose a size] Next"];
const SECOND_STEP = [...SHELL, "[Choose a colour] Back", "Next"];
const NEXT_EFFECT = webAutomationRouteEffect(routeState(WIZARD, FIRST_STEP), routeState(WIZARD, SECOND_STEP));

test("a stepper's Next on a page still at the step it was made on is not seen, though it added one name", () => {
  assert.equal(Array.isArray(NEXT_EFFECT.added) && NEXT_EFFECT.added.length < MIN_ADDED_FOR_ABSENCE, true);
  assert.equal(webAutomationRouteEffectSeen(NEXT_EFFECT, routeState(WIZARD, FIRST_STEP)), "not_seen");
});

test("the same Next on the step it moved to is seen", () => {
  assert.equal(webAutomationRouteEffectSeen(NEXT_EFFECT, routeState(WIZARD, SECOND_STEP)), "seen");
});

test("a page showing part of what the Next brought under its heading is not judged", () => {
  const halfway = [...SHELL, "[Choose a size] Next", "[Choose a colour] Swatches"];
  const mixed = webAutomationRouteEffect(routeState(WIZARD, FIRST_STEP), routeState(WIZARD, [...SHELL, "[Choose a colour] Swatches", "Back", "Next"]));
  assert.equal(webAutomationRouteEffectSeen(mixed, routeState(WIZARD, halfway)), "unknown");
});

test("a step that took nothing away from under its heading keeps no marked sample, and is judged as before", () => {
  const add = webAutomationRouteEffect(routeState(PRODUCT, PRODUCT_CONTROLS), routeState(PRODUCT, [...PRODUCT_CONTROLS, "View cart"]));
  assert.equal(add.marked, undefined);
  assert.equal(webAutomationRouteEffectSeen(add, routeState(PRODUCT, PRODUCT_CONTROLS)), "unknown");
});

// A step that moved the page, met on neither the page it started on nor the one it went to (t1083, K1). Kestrel
// `run-mwz2jc4w-0c207128`, attempt 2: the search typed with `submit` landed on the site's robot check, a third
// address that lets the visitor on by itself, and each of the six looks the effect wait took read `not_seen`, so the
// replay stopped on a search that had been sent.
test("kestrel run-mwz2jc4w: the robot check a search landed on is not absence; the results are seen and the home page is not", () => {
  // Signed before t1083: no `from`, so "left" is read from none of what the search took away being shown.
  assert.equal(KESTREL_SEARCH_EFFECT.from, undefined);
  for (let look = 0; look < 6; look += 1) assert.equal(webAutomationRouteEffectSeen(KESTREL_SEARCH_EFFECT, KESTREL_CHECK), "unknown");
  assert.equal(webAutomationRouteEffectSeen(KESTREL_SEARCH_EFFECT, KESTREL_RESULTS), "seen");
  assert.equal(webAutomationRouteEffectSeen(KESTREL_SEARCH_EFFECT, KESTREL_HOME), "not_seen", "still where the search was typed, with nothing it brought");
});

test("an effect that keeps `from` reads a page on its start as there, and one on a third address as between", () => {
  const HOME = "/scenarios/auction-marketplace/";
  const RESULTS = "/scenarios/auction-marketplace/sch/i.html";
  const search = webAutomationRouteEffect(routeState(HOME, ["Search for anything", "Search", "Daily Deals", "Kestrel 35S rangefinder camera"]), routeState(RESULTS, ["Search for anything", "Search", "Auction", "Buy it now", "Sort: Best Match", "Save this search"]));
  assert.equal(typeof search.from, "string");
  const check = routeState("/scenarios/auction-marketplace/splashui/challenge", ["[Checking your browser before you continue] Continue"]);
  assert.equal(webAutomationRouteEffectSeen(search, check), "unknown");
  // On its start, even with none of what it took away shown (the page re-rendered): still where the step found it.
  assert.equal(webAutomationRouteEffectSeen(search, routeState(HOME, ["Search for anything", "Search"])), "not_seen");
  // A third address that still shows what the step took away from its start is not one it left for.
  assert.equal(webAutomationRouteEffectSeen(search, routeState("/scenarios/auction-marketplace/help", ["Search for anything", "Search", "Daily Deals", "Kestrel 35S rangefinder camera"])), "not_seen");
});

test("an Add to cart, which moved nowhere, is judged as before whatever the page shows of the product page", () => {
  assert.equal(ADD_EFFECT.path, undefined);
  assert.equal(ADD_EFFECT.from, undefined);
  assert.equal(webAutomationRouteEffectSeen(ADD_EFFECT, routeState(PRODUCT, SUPPORT_CARD)), "not_seen");
});
