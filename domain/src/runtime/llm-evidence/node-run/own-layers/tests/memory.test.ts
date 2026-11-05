// Which layers a press of this build opened (`../memory.ts`, t193 C17):
// a layer on the look after a press that was not one on the look before it,
// on the same page, remembered for the life of the build.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmPageEvidence } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import { createWebNodeBuildStatePersistence, type WebNodeBuildKey } from "../../build-state";
import { coreBuildStateStore } from "../../build-state/tests/core-store";
import { createWebNodeOwnLayers } from "../memory";

const BUILD: WebNodeBuildKey = { projectId: "project.one", flowId: "flow.one", buildId: "build.one", callScope: undefined };
const OTHER = { ...BUILD, flowId: "flow.two" };
const PAGE: FixtureElement[] = [{ tag: "button", target: "t10", text: "Pickup or delivery?", box: { x: 10, y: 10, width: 100, height: 20 } }];
const CHOOSER: FixtureElement[] = [
  { tag: "div", target: "t20", text: "Stores near Carden Falls", frontLayer: true, box: { x: 0, y: 0, width: 400, height: 300 } },
  { tag: "button", target: "t21", text: "Set as my store", parent: "t20" }
];
const CONSENT: FixtureElement[] = [
  { tag: "div", target: "t1", text: "We value your privacy", isDialog: { modal: true, kind: "consent" } },
  { tag: "button", target: "t2", text: "Reject all", inDialog: "t1" }
];

function page(elements: readonly FixtureElement[], location?: string): WebLlmPageEvidence {
  return fixturePacket(elements, location === undefined ? {} : { location });
}

test("a layer that a press opened on the same page is the build's own; one already there is not", () => {
  const layers = createWebNodeOwnLayers();
  layers.pressed(BUILD, page([...CONSENT, ...PAGE]), page([...CONSENT, ...CHOOSER, ...PAGE]));
  assert.equal(layers.owns(BUILD, "t20"), true);
  assert.equal(layers.owns(BUILD, "t1"), false);
  // Another build of the process did not open it.
  assert.equal(layers.owns(OTHER, "t20"), false);
});

// A timed popup that opens in the instant after a press (bigbox's email offer, a consent wall that waits) is
// not the build's own: a layer the capture recognised by kind is an interruption by what it is.
test("a layer recognised by kind is never the build's own, even when it appeared right after a press", () => {
  const layers = createWebNodeOwnLayers();
  const OFFER: FixtureElement[] = [
    { tag: "div", target: "t30", text: "Get 10% off your first order", kind: "promotion", box: { x: 0, y: 0, width: 300, height: 200 } },
    { tag: "a", target: "t31", text: "No thanks", parent: "t30" }
  ];
  layers.pressed(BUILD, page(PAGE), page([...CONSENT, ...OFFER, ...PAGE]));
  assert.equal(layers.owns(BUILD, "t1"), false);
  assert.equal(layers.owns(BUILD, "t30"), false);
});

// The shape of `run-mw3o6pgv-ffa1a04c`: a press opened a dialog, and in the same instant an unmarked modal
// prompt and its cover stood over it. Only the dialog is the press's. Nothing here names any site's words.
const OPENED: FixtureElement[] = [
  { tag: "div", target: "t40", text: "A chooser", isDialog: { modal: false }, box: { x: 100, y: 100, width: 400, height: 300 } },
  { tag: "input", target: "t41", label: "A field", parent: "t40", coveredBy: ["t50"], box: { x: 120, y: 120, width: 100, height: 20 } }
];
const OVER_IT: FixtureElement[] = [
  { tag: "div", target: "t50", frontLayer: true, covers: ["t41"], coversCount: 1, box: { x: 0, y: 0, width: 1280, height: 720 } },
  { tag: "div", target: "t51", text: "A question", isDialog: { modal: true }, box: { x: 200, y: 200, width: 200, height: 100 } },
  { tag: "button", target: "t52", text: "The way out", inDialog: "t51", box: { x: 220, y: 220, width: 50, height: 20 } }
];

test("of two layers one press raised, the one standing over the other's controls is not the build's own", () => {
  const layers = createWebNodeOwnLayers();
  layers.pressed(BUILD, page(PAGE), page([...PAGE, ...OPENED, ...OVER_IT]));
  assert.equal(layers.owns(BUILD, "t40"), true);
  assert.equal(layers.owns(BUILD, "t50"), false);
  assert.equal(layers.owns(BUILD, "t51"), false);
});

test("a dialog and the backdrop under it are one press's, though the backdrop's box holds what the dialog covers", () => {
  const layers = createWebNodeOwnLayers();
  const BACKDROP: FixtureElement[] = [
    { tag: "div", target: "t60", frontLayer: true, covers: ["t61"], coversCount: 1, box: { x: 0, y: 0, width: 1280, height: 720 } },
    { tag: "a", target: "t61", text: "Behind it all", coveredBy: ["t60", "t62"], box: { x: 300, y: 300, width: 40, height: 20 } },
    { tag: "div", target: "t62", text: "A chooser", isDialog: { modal: true }, box: { x: 200, y: 200, width: 400, height: 300 } },
    { tag: "button", target: "t63", text: "Choose", inDialog: "t62", box: { x: 220, y: 220, width: 50, height: 20 } }
  ];
  layers.pressed(BUILD, page(PAGE), page([...PAGE, ...BACKDROP]));
  assert.equal(layers.owns(BUILD, "t60"), true);
  assert.equal(layers.owns(BUILD, "t62"), true);
});

test("one new layer and nothing else new stays the press's, as it was: what opened on a timer then cannot be told from it", () => {
  const layers = createWebNodeOwnLayers();
  layers.pressed(BUILD, page(PAGE), page([...PAGE, ...CHOOSER]));
  assert.equal(layers.owns(BUILD, "t20"), true);
});

test("a layer that appeared on another page, or with a look missing, is not remembered", () => {
  const layers = createWebNodeOwnLayers();
  layers.pressed(BUILD, page(PAGE), page([...CHOOSER, ...PAGE], "https://shop.test/other"));
  layers.pressed(BUILD, undefined, page([...CHOOSER, ...PAGE]));
  layers.pressed(BUILD, page(PAGE), undefined);
  assert.equal(layers.owns(BUILD, "t20"), false);
});

test("Core's opening of a fresh round forgets what the build opened; a continuing round or any other call keeps it", () => {
  const layers = createWebNodeOwnLayers();
  layers.pressed(BUILD, page(PAGE), page([...CHOOSER, ...PAGE]));
  layers.opening(BUILD, undefined);
  layers.opening(BUILD, "continuing");
  assert.equal(layers.owns(BUILD, "t20"), true);
  layers.opening(BUILD, "fresh");
  assert.equal(layers.owns(BUILD, "t20"), false);
});

test("a host restarted mid-build still knows the layers its build opened, and a fresh round forgets them in the store too (t728)", async () => {
  const store = coreBuildStateStore();
  const persistence = createWebNodeBuildStatePersistence(() => store);
  createWebNodeOwnLayers(persistence).pressed(BUILD, page(PAGE), page([...CHOOSER, ...PAGE]));
  await persistence.settled();

  const restarted = createWebNodeOwnLayers(createWebNodeBuildStatePersistence(() => store));
  assert.equal(restarted.owns(BUILD, "t20"), false);
  await restarted.restore(BUILD);
  assert.equal(restarted.owns(BUILD, "t20"), true);

  const again = createWebNodeBuildStatePersistence(() => store);
  createWebNodeOwnLayers(again).opening(BUILD, "fresh");
  await again.settled();
  const forgotten = createWebNodeOwnLayers(createWebNodeBuildStatePersistence(() => store));
  await forgotten.restore(BUILD);
  assert.equal(forgotten.owns(BUILD, "t20"), false);
});
