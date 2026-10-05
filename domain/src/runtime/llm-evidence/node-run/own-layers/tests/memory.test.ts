// Which layers a press of this build opened (`../memory.ts`, t193 C17):
// a layer on the look after a press that was not one on the look before it,
// on the same page, remembered for the life of the build.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmPageEvidence } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import { createWebNodeOwnLayers } from "../memory";

const BUILD = { projectId: "project.one", flowId: "flow.one", sessionId: "session.one" };
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

test("a layer that appeared on another page, or with a look missing, is not remembered", () => {
  const layers = createWebNodeOwnLayers();
  layers.pressed(BUILD, page(PAGE), page([...CHOOSER, ...PAGE], "https://shop.test/other"));
  layers.pressed(BUILD, undefined, page([...CHOOSER, ...PAGE]));
  layers.pressed(BUILD, page(PAGE), undefined);
  assert.equal(layers.owns(BUILD, "t20"), false);
});

test("the build's opening call forgets what the last build opened; any other call keeps it", () => {
  const layers = createWebNodeOwnLayers();
  layers.pressed(BUILD, page(PAGE), page([...CHOOSER, ...PAGE]));
  layers.opening(BUILD, "call.press");
  assert.equal(layers.owns(BUILD, "t20"), true);
  layers.opening(BUILD, "initial.web.llm.run_node");
  assert.equal(layers.owns(BUILD, "t20"), false);
});
