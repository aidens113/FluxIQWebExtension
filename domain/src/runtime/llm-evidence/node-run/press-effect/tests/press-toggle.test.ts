// What a press did to the choice of the control it pressed, as the statement
// Core pairs presses by (t174-w103): the control's handle and which way it
// went. Live run `run-murwd8le-79e735a8` kept Space Grey off and brought Space
// Grey on in as an opener of Add to cart; `run-musp8nz1-dbd3905a` added both
// presses itself. Core takes such a pair out of the Flow
// (`AS/runtime/flow-draft/reversal.ts`) once it is told which control each
// press flipped and which way.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmSnapshotBinding, WebLlmPageEvidence } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import { webRunnableNode } from "../../catalog";
import { webPressToggle } from "../toggle";

const CLICK = webRunnableNode("web.output.dom-click")!;
const NAVIGATE = webRunnableNode("web.output.browser-navigate")!;

function bound(elements: readonly FixtureElement[], page: Partial<WebLlmPageEvidence> = {}): WebLlmSnapshotBinding {
  return { evidence: fixturePacket(elements, page), selectors: new Map(), records: new Map(), shadowHosts: new Map() } as WebLlmSnapshotBinding;
}

const grey = (marked: boolean): FixtureElement => ({ tag: "div", target: "t941", text: "Space Grey", cursor: "pointer", marked: marked ? true : undefined });
const silver = (marked: boolean): FixtureElement => ({ tag: "div", target: "t942", text: "Silver", cursor: "pointer", marked: marked ? true : undefined });
const box = (checked: boolean): FixtureElement => ({ tag: "input", target: "t950", inputType: "checkbox", name: "Gift wrap", checked });

test("pressing the marked colour flips it off, under its handle", () => {
  assert.deepEqual(webPressToggle(CLICK, bound([grey(true), silver(false)]), bound([grey(false), silver(false)]), "t941"), { key: "t941", to: "off" });
});

test("pressing an option that was not chosen flips it on; a checkbox ticked off flips it off", () => {
  assert.deepEqual(webPressToggle(CLICK, bound([grey(true), silver(false)]), bound([grey(false), silver(true)]), "t942"), { key: "t942", to: "on" });
  assert.deepEqual(webPressToggle(CLICK, bound([box(true)]), bound([box(false)]), "t950"), { key: "t950", to: "off" });
});

test("a choice left as it was, a navigation, another location or no handle says nothing", () => {
  const before = bound([grey(true), silver(false)]);
  assert.equal(webPressToggle(CLICK, before, bound([grey(true), silver(false)]), "t941"), undefined);
  assert.equal(webPressToggle(NAVIGATE, before, bound([grey(false), silver(false)]), "t941"), undefined);
  assert.equal(webPressToggle(CLICK, before, bound([grey(false), silver(false)], { location: "https://shop.test/cart" }), "t941"), undefined);
  assert.equal(webPressToggle(CLICK, before, bound([grey(false), silver(false)]), undefined), undefined);
  // The handle on one side only: nothing to compare.
  assert.equal(webPressToggle(CLICK, before, bound([silver(false)]), "t941"), undefined);
  assert.equal(webPressToggle(CLICK, undefined, bound([grey(false)]), "t941"), undefined);
});
