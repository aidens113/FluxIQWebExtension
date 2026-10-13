// A signed effect leaves out what the page changes by itself (t496, `../sign.ts`,
// `../self-changes.ts`).
//
// The shape of `run-mv6eq215-a986f1f3`: the act was made from a look that caught
// a rotating banner on its second slide, and the act reloaded the page, which put
// the banner back on its first. Signed from those two states alone, the first
// slide's link reads as added, and the effect holds only while that slide is up.
// Told what the page was seen changing with nothing done to it, the signer keeps
// only what the act did, which holds on every slide. An act that changed only
// such names keeps the effect it had: an effect that added nothing never holds.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationRouteEffect, webAutomationRouteEffectHolds, webAutomationRouteSelfChanges } from "..";

const PATH = "/";
const NAV = ["All recipes", "Search", "Sign in"];
const SLIDES = ["Read this week's pick", "Browse the archive", "Meet the cooks"];

function page(controls: readonly string[]): JsonObject {
  return { page: { path: PATH, controls: controls.join(" | ") } };
}

function units(metric: boolean, slide: number): JsonObject {
  return page([...NAV, SLIDES[slide]!, metric ? "Units: metric" : "Units: imperial", ...(metric ? [] : ["Use metric units"])]);
}

/** What the page did between the look (first slide) and the capture the act was made from (second slide). */
function selfChanging(): ReadonlySet<string> {
  const { appeared, disappeared } = webAutomationRouteSelfChanges(units(false, 0), units(false, 1));
  return new Set([...appeared, ...disappeared]);
}

test("signed from the act's two states alone, a banner the reload reset reads as added, and holds on one slide only", () => {
  const effect = webAutomationRouteEffect(units(false, 1), units(true, 0));
  assert.equal((effect.added as string[]).length, 2);
  assert.deepEqual([0, 1, 2].map((slide) => webAutomationRouteEffectHolds(effect, units(true, slide))), [true, false, false]);
});

test("told what the page changes by itself, the effect keeps only what the act did, and holds on every slide where it shows", () => {
  const effect = webAutomationRouteEffect(units(false, 1), units(true, 0), selfChanging());
  assert.equal(effect.v, "web-effect.v1");
  assert.equal((effect.added as string[]).length, 1, "the units chip");
  assert.deepEqual([0, 1, 2].map((slide) => webAutomationRouteEffectHolds(effect, units(true, slide))), [true, true, true]);
  assert.deepEqual([0, 1, 2].map((slide) => webAutomationRouteEffectHolds(effect, units(false, slide))), [false, false, false]);
  // Nor is the banner what the act took away.
  assert.equal((effect.removed as string[]).length, 2, "the imperial chip and the switch");
});

test("an act that changed only what the page changes by itself keeps the effect it has", () => {
  // A press of the banner's own arrow: all it changed is the slide.
  const before = page([...NAV, SLIDES[0]!]);
  const after = page([...NAV, SLIDES[1]!]);
  const signed = webAutomationRouteEffect(before, after);
  assert.deepEqual(webAutomationRouteEffect(before, after, selfChanging()), signed);
  assert.equal((signed.added as string[]).length, 1);
});

test("what the page changed is read whole, never sampled", () => {
  const many = Array.from({ length: 40 }, (_, index) => `Story ${index}`);
  const changes = webAutomationRouteSelfChanges(page(NAV), page([...NAV, ...many]));
  assert.equal(changes.appeared.length, 40);
  assert.equal(changes.disappeared.length, 0);
});
