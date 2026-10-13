// A press that changed nothing on the page is said to have had no effect, from
// two hand-built packets (t511): what counts as nothing, what counts as a real
// change however small, and the sentence the model reads.
//
// Classifieds step 0038 of `run-mv6qrcdu-a31b44b8`: the dialog's Apply was
// pressed, the dialog stayed open and nothing in it changed, and the only
// difference between the two looks was the scroll position -- which the old
// whole-packet comparison read as `pageChanged: true`.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmPageEvidence, WebLlmSnapshotBinding } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import { webRunnableNode } from "../../catalog";
import { webPressNoEffect } from "../no-effect";

const CLICK = webRunnableNode("web.output.dom-click")!;
const TYPE = webRunnableNode("web.output.dom-type")!;

function bound(elements: readonly FixtureElement[], page: Partial<WebLlmPageEvidence> = {}): WebLlmSnapshotBinding {
  return { evidence: fixturePacket(elements, { title: "Settings", ...page }), selectors: new Map(), records: new Map(), shadowHosts: new Map() } as WebLlmSnapshotBinding;
}

/** A page with a non-modal settings dialog open over it: a size select, Cancel and Save. */
const DIALOG: FixtureElement[] = [
  { tag: "h1", target: "t1", text: "Preferences" },
  { tag: "button", target: "t2", text: "Display: Medium", expanded: true },
  { tag: "div", target: "t3", name: "Display settings", isDialog: { modal: false }, parent: "t1" },
  { tag: "select", target: "t4", name: "Text size", parent: "t3", selectedValue: "large", options: [{ value: "medium", label: "Medium" }, { value: "large", label: "Large" }] },
  { tag: "button", target: "t5", text: "Cancel", parent: "t3" },
  { tag: "button", target: "t6", text: "Save", parent: "t3" }
];

/** The same page scrolled and redrawn: every box moved, nothing else did. */
function scrolled(elements: readonly FixtureElement[]): FixtureElement[] {
  return elements.map((element) => ({ ...element, box: { x: 10, y: 40, width: 200, height: 20 }, onViewport: element.target !== "t1" }));
}

test("a Save in an open dialog that left it open and the page only scrolled had no effect, and says the dialog is still open", () => {
  const before = bound(DIALOG, { viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 151 } });
  const after = bound(scrolled(DIALOG), { viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 170 } });
  const said = webPressNoEffect(CLICK, before, after, "t6");
  assert.ok(said !== undefined, "an unchanged page is a press with no effect");
  assert.match(said, /"Save" \(t6\)/u);
  assert.match(said, /nothing on the page changed/u);
  assert.match(said, /dialog t3 "Display settings" it is in is still open/u);
});

test("pressed twice, the sentence says both presses changed nothing", () => {
  const said = webPressNoEffect(CLICK, bound(DIALOG), bound(scrolled(DIALOG)), "t6", 2);
  assert.match(String(said), /pressed twice/u);
});

test("the pressed control taking focus is not an effect", () => {
  const after = bound(DIALOG.map((element) => (element.target === "t6" ? { ...element, focused: true as const } : element)));
  assert.ok(webPressNoEffect(CLICK, bound(DIALOG), after, "t6") !== undefined);
});

test("a press outside any dialog that changed nothing says so without a dialog", () => {
  const page: FixtureElement[] = [{ tag: "h1", target: "t1", text: "Preferences" }, { tag: "button", target: "t2", text: "Refresh" }];
  const said = webPressNoEffect(CLICK, bound(page), bound(page), "t2");
  assert.match(String(said), /"Refresh" \(t2\)/u);
  assert.doesNotMatch(String(said), /dialog/u);
});

test("the dialog closing is an effect", () => {
  const after = bound([DIALOG[0]!, { ...DIALOG[1]!, expanded: false }]);
  assert.equal(webPressNoEffect(CLICK, bound(DIALOG), after, "t6"), undefined);
});

test("a stateful attribute flipping is an effect: aria-pressed, aria-expanded, checked, a value", () => {
  const toggle: FixtureElement[] = [{ tag: "button", target: "t1", text: "Bold", attributes: [["aria-pressed", "false"]] }];
  assert.equal(webPressNoEffect(CLICK, bound(toggle), bound([{ ...toggle[0]!, attributes: [["aria-pressed", "true"]] }]), "t1"), undefined);
  const disclosure: FixtureElement[] = [{ tag: "button", target: "t1", text: "More", expanded: false }];
  assert.equal(webPressNoEffect(CLICK, bound(disclosure), bound([{ ...disclosure[0]!, expanded: true }]), "t1"), undefined);
  const box: FixtureElement[] = [{ tag: "input", target: "t1", inputType: "checkbox", name: "Remember me", checked: false }];
  assert.equal(webPressNoEffect(CLICK, bound(box), bound([{ ...box[0]!, checked: true }]), "t1"), undefined);
  const field: FixtureElement[] = [{ tag: "input", target: "t1", inputType: "number", name: "Quantity", value: "1" }, { tag: "button", target: "t2", text: "+" }];
  assert.equal(webPressNoEffect(CLICK, bound(field), bound([{ ...field[0]!, value: "2" }, field[1]!]), "t2"), undefined);
});

test("text that changed, a line that appeared, or an element with no words that appeared is an effect", () => {
  const page: FixtureElement[] = [{ tag: "span", target: "t1", text: "Saved 0 times" }, { tag: "button", target: "t2", text: "Save" }];
  assert.equal(webPressNoEffect(CLICK, bound(page), bound([{ ...page[0]!, text: "Saved 1 times" }, page[1]!]), "t2"), undefined);
  assert.equal(webPressNoEffect(CLICK, bound(page), bound([...page, { tag: "span", target: "t3", text: "Done" }]), "t2"), undefined);
  assert.equal(webPressNoEffect(CLICK, bound(page), bound([...page, { tag: "img", target: "t3" }]), "t2"), undefined);
});

test("another address, another title or another document is an effect", () => {
  const page: FixtureElement[] = [{ tag: "button", target: "t1", text: "Next" }];
  assert.equal(webPressNoEffect(CLICK, bound(page), bound(page, { location: "https://shop.test/store/s?k=kettle&page=2" }), "t1"), undefined);
  assert.equal(webPressNoEffect(CLICK, bound(page), bound(page, { title: "Settings (saved)" }), "t1"), undefined);
  assert.equal(webPressNoEffect(CLICK, bound(page, { navigation: { timeOrigin: 1 } }), bound(page, { navigation: { timeOrigin: 2 } }), "t1"), undefined);
});

test("nothing is said where it cannot be judged: a page still loading, a truncated capture, a page missing, a node that is not a press", () => {
  const page: FixtureElement[] = [{ tag: "button", target: "t1", text: "Save" }];
  assert.equal(webPressNoEffect(CLICK, bound(page), bound(page, { loading: { busy: true } }), "t1"), undefined);
  assert.equal(webPressNoEffect(CLICK, bound(page), bound(page, { loading: { pendingNavigation: true } }), "t1"), undefined);
  assert.equal(webPressNoEffect(CLICK, bound(page), bound(page, { truncated: true }), "t1"), undefined);
  assert.equal(webPressNoEffect(CLICK, bound(page), bound(page, { captureTruncated: true }), "t1"), undefined);
  assert.equal(webPressNoEffect(CLICK, undefined, bound(page), "t1"), undefined);
  assert.equal(webPressNoEffect(CLICK, bound(page), undefined, "t1"), undefined);
  assert.equal(webPressNoEffect(TYPE, bound(page), bound(page), "t1"), undefined);
});
