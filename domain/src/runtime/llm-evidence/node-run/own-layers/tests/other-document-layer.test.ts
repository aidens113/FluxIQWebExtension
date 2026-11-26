// A layer that rose in another document is not opened by a press made inside a child frame
// (`../opened-by.ts`, t1062). Generic fixtures in the shape of `run-mwxh0jy6-91aad522`: a press of
// an embedded widget's Next inside its iframe, and an offer the top page raises on a timer rising
// in the same instant, tied to nothing. Remembered as the press's own, the offer's close became a
// required step, and every later attempt on a site that remembered the close stopped on it.

import assert from "node:assert/strict";
import test from "node:test";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import type { WebNodeBuildKey } from "../../build-state";
import { createWebNodeOwnLayers } from "../memory";
import type { WebNodeLayerAct } from "../act";

const BUILD: WebNodeBuildKey = { projectId: "project.one", flowId: "flow.one", buildId: "build.one", callScope: undefined };
const WIDGET_FRAME = 4;

/** The top page, and the widget's step inside its frame with its Next. */
const PAGE: FixtureElement[] = [
  { tag: "a", target: "t1", text: "Home", box: { x: 20, y: 20, width: 60, height: 20 } },
  { tag: "h2", target: "t10", text: "Pick one", frameId: WIDGET_FRAME, box: { x: 300, y: 300, width: 200, height: 30 } },
  { tag: "button", target: "t11", text: "Next", frameId: WIDGET_FRAME, box: { x: 600, y: 500, width: 80, height: 30 } }
];

/** An offer the top page raised on a timer, drawn far from the widget and naming nothing. */
const TOP_OFFER: FixtureElement[] = [
  { tag: "div", target: "t30", frontLayer: true, box: { x: 340, y: 100, width: 600, height: 400 } },
  { tag: "div", target: "t31", text: "Hear about deals", parent: "t30", box: { x: 360, y: 120, width: 300, height: 20 } },
  { tag: "div", target: "t32", text: "Close", parent: "t30", box: { x: 900, y: 110, width: 30, height: 30 } }
];

/** A dialog the widget opened in its own document, also tied to nothing. */
const WIDGET_DIALOG: FixtureElement[] = [
  { tag: "div", target: "t40", frontLayer: true, frameId: WIDGET_FRAME, box: { x: 320, y: 320, width: 300, height: 200 } },
  { tag: "div", target: "t41", text: "Confirm the branch", parent: "t40", frameId: WIDGET_FRAME, box: { x: 340, y: 340, width: 200, height: 20 } }
];

const PRESS_IN_FRAME: WebNodeLayerAct = { handle: "t11", actionType: "web.dom.click", parameters: { target: { handle: "t11" } } };

function owned(act: WebNodeLayerAct, before: readonly FixtureElement[], after: readonly FixtureElement[], layer: string): boolean {
  const layers = createWebNodeOwnLayers();
  layers.acted(BUILD, fixturePacket(before), fixturePacket(after), act);
  return layers.owns(BUILD, layer);
}

test("a top-page layer that rose as a press was made inside a child frame is not the press's own", () => {
  assert.equal(owned(PRESS_IN_FRAME, PAGE, [...PAGE, ...TOP_OFFER], "t30"), false);
});

test("a layer the press's own frame raised, tied to nothing, is still the press's own", () => {
  assert.equal(owned(PRESS_IN_FRAME, PAGE, [...PAGE, ...WIDGET_DIALOG], "t40"), true);
});

test("both rising at once: only the frame's own layer is the press's", () => {
  const after = [...PAGE, ...TOP_OFFER, ...WIDGET_DIALOG];
  assert.equal(owned(PRESS_IN_FRAME, PAGE, after, "t40"), true);
  assert.equal(owned(PRESS_IN_FRAME, PAGE, after, "t30"), false);
});

test("a press in the top document still owns an untied layer of the top document", () => {
  const press: WebNodeLayerAct = { handle: "t1", actionType: "web.dom.click", parameters: { target: { handle: "t1" } } };
  assert.equal(owned(press, PAGE, [...PAGE, ...TOP_OFFER], "t30"), true);
});
