// t470: the ways out a client pressed are kept on this domain's server half under a random reference, bounded, one
// registry per FluxIQ instance.

import assert from "node:assert/strict";
import test from "node:test";
import { createWebAutomationClearedWayOuts, webAutomationClearedWayOutsOf } from "..";

const wayOut = (n: number) => ({ url: `https://shop.test/${n}`, element: { tagName: "button", visibleText: "OK" } });

test("a kept way out is found by its reference, as a copy, and an unknown reference finds nothing", () => {
  const registry = createWebAutomationClearedWayOuts();
  const reference = registry.keep(wayOut(1));
  assert.match(reference, /^way-out\.[0-9a-f]{32}$/u);
  const found = registry.get(reference)!;
  assert.deepEqual(found, wayOut(1));
  found.element.visibleText = "changed";
  assert.deepEqual(registry.get(reference), wayOut(1));
  assert.equal(registry.get("way-out.unknown"), undefined);
  assert.notEqual(registry.keep(wayOut(1)), reference);
});

test("the oldest ways out are let go past the bound", () => {
  const registry = createWebAutomationClearedWayOuts();
  const references = Array.from({ length: 257 }, (_, n) => registry.keep(wayOut(n)));
  assert.equal(registry.get(references[0]!), undefined);
  assert.deepEqual(registry.get(references[256]!), wayOut(256));
});

test("each owner has a registry of its own, the same one every time", () => {
  const one = {}, two = {};
  const reference = webAutomationClearedWayOutsOf(one).keep(wayOut(1));
  assert.deepEqual(webAutomationClearedWayOutsOf(one).get(reference), wayOut(1));
  assert.equal(webAutomationClearedWayOutsOf(two).get(reference), undefined);
});
