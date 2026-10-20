// t470: the ways out a client pressed are kept on this domain's server half under a random reference, bounded, one
// registry per FluxIQ instance.

import assert from "node:assert/strict";
import test from "node:test";
import { createWebAutomationClearedWayOuts, webAutomationClearedWayOutsOf } from "..";
import { coreBuildStateOwner, coreBuildStateStore } from "../../runtime/llm-evidence/node-run/build-state/tests/core-store";

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

// t728: a way out pressed for a Flow is kept with that Flow in Core's durable build state, so a restarted host still
// finds it for the Flow's trials and later runs.
const FLOW = { projectId: "project.social", flowId: "flow.requests" };

test("a way out kept for a Flow is found after a restart, for that Flow only, and none without one", async () => {
  const store = coreBuildStateStore();
  const before = createWebAutomationClearedWayOuts(() => store);
  const reference = before.keep(wayOut(1), FLOW);
  const unscoped = before.keep(wayOut(2));
  await before.settled();

  const after = createWebAutomationClearedWayOuts(() => store);
  assert.equal(after.get(reference), undefined);
  assert.deepEqual(await after.find(reference, FLOW), wayOut(1));
  assert.equal(await after.find(reference, { ...FLOW, flowId: "flow.other" }), undefined);
  assert.equal(await after.find(reference), undefined);
  assert.equal(await after.find(unscoped, FLOW), undefined);
});

test("a host restarted twice keeps what each kept before it, newest within the bound", async () => {
  const store = coreBuildStateStore();
  const first = createWebAutomationClearedWayOuts(() => store);
  const references = Array.from({ length: 200 }, (_, n) => first.keep(wayOut(n), FLOW));
  await first.settled();
  const second = createWebAutomationClearedWayOuts(() => store);
  references.push(...Array.from({ length: 100 }, (_, n) => second.keep(wayOut(200 + n), FLOW)));
  await second.settled();

  const third = createWebAutomationClearedWayOuts(() => store);
  assert.deepEqual(await third.find(references[299]!, FLOW), wayOut(299));
  assert.deepEqual(await third.find(references[150]!, FLOW), wayOut(150));
  // Past the bound of 256, the oldest went first.
  assert.equal(await third.find(references[0]!, FLOW), undefined);
});

test("a way out too large to store is still named in this process, and the Flow's record keeps the rest", async () => {
  const store = coreBuildStateStore();
  const registry = createWebAutomationClearedWayOuts(() => store);
  const kept = registry.keep(wayOut(1), FLOW);
  const large = { url: "https://shop.test/large", element: { tagName: "button", visibleText: "x".repeat(70 * 1024) } };
  const huge = registry.keep(large, FLOW);
  await registry.settled();
  assert.deepEqual(registry.get(huge), large);

  const restarted = createWebAutomationClearedWayOuts(() => store);
  assert.deepEqual(await restarted.find(kept, FLOW), wayOut(1));
  assert.equal(await restarted.find(huge, FLOW), undefined);
});

test("an owner carrying Core's store keeps its ways out there, for another owner over the same storage to find", async () => {
  const storage = coreBuildStateOwner();
  const reference = webAutomationClearedWayOutsOf(storage).keep(wayOut(7), FLOW);
  await webAutomationClearedWayOutsOf(storage).settled();
  const restarted = coreBuildStateOwner(storage.programs.automationStudio.domainBuildState);
  assert.deepEqual(await webAutomationClearedWayOutsOf(restarted).find(reference, FLOW), wayOut(7));
});
