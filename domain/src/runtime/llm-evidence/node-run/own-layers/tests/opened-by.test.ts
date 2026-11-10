// Which new layers an act opened (`../opened-by.ts`, t885): one tied to the acted
// control is the act's whatever the act; an untied one is only a commit's. Generic
// fixtures in the shape of `run-mwa9oytn-d866da84` (a card that rose on a timer as a
// field was typed in): no site's words.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmPageEvidence } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import type { WebNodeBuildKey } from "../../build-state";
import { createWebNodeOwnLayers } from "../memory";
import type { WebNodeLayerAct } from "../act";

const BUILD: WebNodeBuildKey = { projectId: "project.one", flowId: "flow.one", buildId: "build.one", callScope: undefined };
const FIELD_BOX = { x: 40, y: 600, width: 120, height: 30 };
const FIELD: FixtureElement = { tag: "input", target: "t10", label: "Highest", box: FIELD_BOX };
const PAGE: FixtureElement[] = [FIELD, { tag: "button", target: "t11", text: "Apply", box: { x: 170, y: 600, width: 40, height: 30 } }];

/** A card raised on a timer, drawn far from the field and naming nothing. */
const CARD: FixtureElement[] = [
  { tag: "div", target: "t30", frontLayer: true, box: { x: 24, y: 186, width: 340, height: 130 } },
  { tag: "div", target: "t31", text: "Hear about deals", parent: "t30", box: { x: 40, y: 200, width: 300, height: 20 } },
  { tag: "div", target: "t32", text: "Later", parent: "t30", box: { x: 40, y: 270, width: 60, height: 30 } }
];
/** A suggestion list hanging from the field's lower edge, with no relation written. */
const HANGING: FixtureElement[] = [
  { tag: "ul", target: "t40", frontLayer: true, box: { x: 40, y: 632, width: 160, height: 90 } },
  { tag: "li", target: "t41", text: "A suggestion", parent: "t40", box: { x: 40, y: 640, width: 160, height: 24 } }
];

const typed = (parameters: Record<string, unknown> = {}): WebNodeLayerAct => ({ handle: "t10", actionType: "web.dom.type", parameters: { target: { handle: "t10" }, text: "10", ...parameters } });
const PRESS: WebNodeLayerAct = { handle: "t11", actionType: "web.dom.click", parameters: { target: { handle: "t11" } } };

function page(elements: readonly FixtureElement[]): WebLlmPageEvidence {
  return fixturePacket(elements);
}

function owned(act: WebNodeLayerAct, before: readonly FixtureElement[], after: readonly FixtureElement[], layer: string): boolean {
  const layers = createWebNodeOwnLayers();
  layers.acted(BUILD, page(before), page(after), act);
  return layers.owns(BUILD, layer);
}

// (a) The crossborder shape: typing, and an unrelated card rose in the same instant.
test("a cover that rose as a field was typed in, tied to nothing about the field, is not the build's own", () => {
  assert.equal(owned(typed(), PAGE, [...PAGE, ...CARD], "t30"), false);
});

test("nor after any other act that only sets a value: clearing it, choosing an option, setting a box", () => {
  for (const actionType of ["web.dom.clear", "web.dom.select", "web.dom.check"]) {
    assert.equal(owned({ handle: "t10", actionType, parameters: { target: { handle: "t10" } } }, PAGE, [...PAGE, ...CARD], "t30"), false, actionType);
  }
});

// (b) Layers the typed value does open stay the build's own.
test("a suggestion list hanging from the typed field's edge is the typing's own, with no relation written", () => {
  assert.equal(owned(typed(), PAGE, [...PAGE, ...HANGING], "t40"), true);
});

test("a list the typed field names by aria-controls is the typing's own, wherever it is drawn", () => {
  const field = { ...FIELD, attributes: [["role", "combobox"], ["aria-controls", "ideas"]] as Array<[string, string]> };
  const list: FixtureElement[] = [
    { tag: "div", target: "t50", frontLayer: true, box: { x: 600, y: 100, width: 200, height: 200 } },
    { tag: "ul", target: "t51", parent: "t50", attributes: [["id", "ideas"]], box: { x: 600, y: 100, width: 200, height: 200 } },
    { tag: "li", target: "t52", text: "An idea", parent: "t51", box: { x: 600, y: 100, width: 200, height: 24 } }
  ];
  assert.equal(owned(typed(), [field, ...PAGE.slice(1)], [field, ...PAGE.slice(1), ...list], "t50"), true);
});

test("a layer the typed field says it expanded is the typing's own", () => {
  const closed = { ...FIELD, attributes: [["aria-expanded", "false"]] as Array<[string, string]>, revealKind: "disclosure" as const, expanded: false };
  const open = { ...closed, attributes: [["aria-expanded", "true"]] as Array<[string, string]>, expanded: true };
  assert.equal(owned(typed(), [closed, ...PAGE.slice(1)], [open, ...PAGE.slice(1), ...CARD], "t30"), true);
});

test("a confirm that a typed value sends its form into is the typing's own: sending is a commit", () => {
  const CONFIRM: FixtureElement[] = [
    { tag: "div", target: "t60", text: "Are you sure?", isDialog: { modal: true }, box: { x: 400, y: 200, width: 300, height: 150 } },
    { tag: "button", target: "t61", text: "Yes", inDialog: "t60", box: { x: 420, y: 300, width: 60, height: 30 } }
  ];
  assert.equal(owned(typed({ submit: true }), PAGE, [...PAGE, ...CONFIRM], "t60"), true);
  assert.equal(owned(typed(), PAGE, [...PAGE, ...CONFIRM], "t60"), false);
});

test("a press still owns the lone layer that rose after it, tied or not (t193)", () => {
  assert.equal(owned(PRESS, PAGE, [...PAGE, ...CARD], "t30"), true);
});

test("of two layers that rose as a field was typed in, only the one tied to the field is the typing's own", () => {
  const layers = createWebNodeOwnLayers();
  layers.acted(BUILD, page(PAGE), page([...PAGE, ...HANGING, ...CARD]), typed());
  assert.equal(layers.owns(BUILD, "t40"), true);
  assert.equal(layers.owns(BUILD, "t30"), false);
});

test("a cover standing over the typed field is not anchored to it, even one whose edge meets it", () => {
  const over: FixtureElement[] = [{ tag: "div", target: "t70", frontLayer: true, box: { x: 0, y: 590, width: 1280, height: 200 } }];
  assert.equal(owned(typed(), PAGE, [...PAGE, ...over], "t70"), false);
  const besideCovering: FixtureElement[] = [{ tag: "div", target: "t71", frontLayer: true, box: { x: 40, y: 632, width: 160, height: 90 } }];
  const coveredField = { ...FIELD, coveredBy: ["t71"] };
  assert.equal(owned(typed(), PAGE, [coveredField, ...PAGE.slice(1), ...besideCovering], "t71"), false);
});
