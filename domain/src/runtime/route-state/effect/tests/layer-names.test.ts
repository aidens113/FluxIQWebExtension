// A signed effect leaves out the controls of a layer the page raised by itself (t499, `../sign.ts`), and keeps them
// when they are all the act added: then the layer is what the act opened.
//
// Which controls those are is read off the capture's own layer marks
// (`../../../llm-evidence/plan-resolution/self-changing/page-raised.ts`), held through the evidence runtime in
// `../../../llm-evidence/plan-resolution/tests/act-effect.test.ts`. Here the signer's rule over route states, and the
// hashing of a layer's names (`../layer-only.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webAutomationRouteEffect, webAutomationRouteEffectHolds, webAutomationRouteLayerOnlyHashes } from "..";

const NAV = ["All recipes", "Jump to method"];
const BUBBLE = ["Need help? ×", "×"];

function page(controls: readonly string[]): JsonObject {
  return { page: { path: "/recipes/lemon-tart", controls: controls.join(" | ") } };
}

/** The hashes of `names` as a signed effect holds them. */
function hashes(names: readonly string[]): ReadonlySet<string> {
  return webAutomationRouteLayerOnlyHashes(names, []);
}

test("a layer's names are hashed as the route state's controls are, and a name the page also shows elsewhere is the page's", () => {
  const listed = webAutomationRouteEffect(page([]), page(["  Need   HELP? ×", "×"]));
  assert.deepEqual([...hashes(BUBBLE)].sort(), listed.added, "normalised as a controls entry is");
  assert.deepEqual([...webAutomationRouteLayerOnlyHashes(BUBBLE, ["×", ...NAV])], [...hashes(["Need help? ×"])]);
  assert.equal(webAutomationRouteLayerOnlyHashes([], NAV).size, 0);
});

test("the controls of a layer the page raised are not what the act added, and the effect holds with the layer closed", () => {
  const before = page([...NAV, "My box: empty", "Save to my box"]);
  const after = page([...NAV, "My box: 1 recipe", ...BUBBLE]);
  const plain = webAutomationRouteEffect(before, after);
  assert.equal((plain.added as string[]).length, 3);
  const effect = webAutomationRouteEffect(before, after, undefined, hashes(BUBBLE));
  assert.equal(effect.v, "web-effect.v1");
  assert.deepEqual(effect.added, [...hashes(["My box: 1 recipe"])]);
  assert.deepEqual(effect.removed, plain.removed, "what the act took away is signed as before");
  assert.equal(webAutomationRouteEffectHolds(effect, page([...NAV, "My box: 1 recipe"])), true);
  assert.equal(webAutomationRouteEffectHolds(effect, page([...NAV, "My box: empty", "Save to my box", ...BUBBLE])), false);
});

test("an act that added nothing but the layer opened it, and keeps it", () => {
  const before = page([...NAV, "Chat with us"]);
  const after = page([...NAV, "Chat with us", ...BUBBLE]);
  assert.deepEqual(webAutomationRouteEffect(before, after, undefined, hashes(BUBBLE)), webAutomationRouteEffect(before, after));
});

test("what the page changes by itself is still left out when the layer is kept", () => {
  const before = page([...NAV, "Read this week's pick"]);
  const after = page([...NAV, "Browse the archive", ...BUBBLE]);
  const selfChanging = new Set([...hashes(["Read this week's pick"]), ...hashes(["Browse the archive"])]);
  const effect = webAutomationRouteEffect(before, after, selfChanging, hashes(BUBBLE));
  assert.deepEqual(effect.added, [...hashes(BUBBLE)].sort());
});

test("with no layer named the signer is unchanged, as the host's own `signRouteEffect` calls it", () => {
  const before = page([...NAV, "My box: empty", "Save to my box"]);
  const after = page([...NAV, "My box: 1 recipe", ...BUBBLE]);
  assert.deepEqual(webAutomationRouteEffect(before, after, undefined, new Set()), webAutomationRouteEffect(before, after));
});
