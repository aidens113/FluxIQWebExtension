// Whether a press cleared a layer that covered the page (t787 fix 1), from
// hand-built packets: a layer that covered controls before the press, held the
// pressed control, and covers nothing after it, with the control gone.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import { webRunnableNode } from "../../catalog";
import { webPressClearedLayer } from "../cleared-layer";

const CLICK = webRunnableNode("web.output.dom-click")!;
const NAVIGATE = webRunnableNode("web.output.browser-navigate")!;

function bound(elements: readonly FixtureElement[], page: Partial<WebLlmPageEvidence> = {}): WebLlmSnapshotBinding {
  return { evidence: fixturePacket(elements, page), selectors: new Map(), records: new Map(), shadowHosts: new Map() } as WebLlmSnapshotBinding;
}

const GRID: FixtureElement[] = [
  { tag: "a", target: "t10", name: "Item one", coveredBy: ["t1"] },
  { tag: "a", target: "t11", name: "Item two" }
];
/** A panel with no name, covering the grid, whose only control has no words: what a site's own side panel looks like. */
const PANEL: FixtureElement[] = [
  { tag: "div", target: "t1", frontLayer: true, covers: ["t10"], coversCount: 14 },
  { tag: "button", target: "t2", parent: "t1" }
];
const covering = { blockedBy: [{ target: "t1", blocks: 14 }] };

test("a press of a layer's own control that leaves the layer covering nothing reports the layer cleared, by its handle", () => {
  const cleared = webPressClearedLayer(CLICK, bound([...GRID, ...PANEL], covering), bound([...GRID, { tag: "div", target: "t1", frontLayer: true }], { blockedBy: [{ target: "t1" }] }), "t2");
  assert.deepEqual(cleared, { signature: { layer: { tag: "div" }, control: { tag: "button" } }, control: "t2" });
  // Gone from the page altogether reads the same.
  assert.equal(webPressClearedLayer(CLICK, bound([...GRID, ...PANEL], covering), bound(GRID), "t2")?.control, "t2");
});

test("the signature names the layer's kind, role and name where the page gives them, and never a locator", () => {
  const offer: FixtureElement[] = [
    { tag: "div", target: "t1", kind: "promotion", name: "Ten percent off", covers: ["t10"] },
    { tag: "button", target: "t2", parent: "t1", name: "No thanks" }
  ];
  const cleared = webPressClearedLayer(CLICK, bound([...GRID, ...offer], { blockedBy: [{ target: "t1", blocks: 1, role: "region" }] }), bound(GRID), "t2");
  assert.deepEqual(cleared?.signature, { layer: { tag: "div", role: "region", kind: "promotion", name: "Ten percent off" }, control: { tag: "button", name: "No thanks" } });
  assert.equal(JSON.stringify(cleared).includes("selector"), false);
});

test("a press that clears nothing reports nothing", () => {
  const before = bound([...GRID, ...PANEL], covering);
  // The page's own control: it is in no layer.
  assert.equal(webPressClearedLayer(CLICK, before, bound([...GRID, ...PANEL], covering), "t11"), undefined);
  // The layer's control, but the layer still covers what it covered.
  assert.equal(webPressClearedLayer(CLICK, before, bound([...GRID, PANEL[0]!], covering), "t2"), undefined);
  // The layer went, but its control is still shown: pressing it whenever it shows would press it again.
  assert.equal(webPressClearedLayer(CLICK, before, bound([...GRID, PANEL[1]!]), "t2"), undefined);
  // A layer that covered nothing to begin with is no cover.
  assert.equal(webPressClearedLayer(CLICK, bound([...GRID, ...PANEL], { blockedBy: [{ target: "t1", blocks: 0 }] }), bound(GRID), "t2"), undefined);
});

test("a layer the build's own press opened, another page, a navigation or no handle reports nothing", () => {
  const before = bound([...GRID, ...PANEL], covering);
  assert.equal(webPressClearedLayer(CLICK, before, bound(GRID), "t2", (layer) => layer === "t1"), undefined);
  assert.equal(webPressClearedLayer(CLICK, before, bound(GRID, { location: "https://shop.test/elsewhere" }), "t2"), undefined);
  assert.equal(webPressClearedLayer(NAVIGATE, before, bound(GRID), "t2"), undefined);
  assert.equal(webPressClearedLayer(CLICK, before, bound(GRID), undefined), undefined);
  assert.equal(webPressClearedLayer(CLICK, undefined, bound(GRID), "t2"), undefined);
});
