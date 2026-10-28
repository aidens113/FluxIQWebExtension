// The `toggle` output of a press (t775): the signature of what it did to its own control.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmSnapshotBinding, WebLlmPageEvidence } from "../../../sanitize";
import { fixturePacket, type FixtureElement } from "../../../page-view/tests/packet-fixture";
import { webRunnableNode } from "../../catalog";
import { webPressToggleSignature } from "../toggle-signature";

const CLICK = webRunnableNode("web.output.dom-click")!;
const NAVIGATE = webRunnableNode("web.output.browser-navigate")!;

function bound(elements: readonly FixtureElement[], page: Partial<WebLlmPageEvidence> = {}): WebLlmSnapshotBinding {
  return { evidence: fixturePacket(elements, page), selectors: new Map(), records: new Map(), shadowHosts: new Map() } as WebLlmSnapshotBinding;
}

const save = (name: string): FixtureElement => ({ tag: "button", target: "t7", name, text: name });
const like = (pressed: boolean): FixtureElement => ({ tag: "button", target: "t7", name: "Like", attributes: [["aria-pressed", String(pressed)]] });

test("Save Senior Engineer becoming Unsave Senior Engineer gains unsave and loses save", () => {
  assert.deepEqual(webPressToggleSignature(CLICK, bound([save("Save Senior Engineer")]), bound([save("Unsave Senior Engineer")]), "t7"), {
    signature: { via: "name", gains: ["unsave"], loses: ["save"] }
  });
});

test("an aria-pressed false to true press gives the attribute signature, idempotent with web.dom.check", () => {
  assert.deepEqual(webPressToggleSignature(CLICK, bound([like(false)]), bound([like(true)]), "t7"), {
    signature: { via: "attribute", attribute: "aria-pressed", to: true },
    idempotentWith: "web.dom.check"
  });
});

test("a native checkbox ticked gives the checked attribute signature", () => {
  const box = (checked: boolean): FixtureElement => ({ tag: "input", target: "t7", inputType: "checkbox", name: "Gift wrap", checked });
  assert.deepEqual(webPressToggleSignature(CLICK, bound([box(false)]), bound([box(true)]), "t7")?.signature, { via: "attribute", attribute: "checked", to: true });
});

test("no change, a gone target, another page, a navigation or no handle says nothing", () => {
  const before = bound([save("Save Senior Engineer")]);
  assert.equal(webPressToggleSignature(CLICK, before, bound([save("Save Senior Engineer")]), "t7"), undefined);
  assert.equal(webPressToggleSignature(CLICK, before, bound([{ tag: "button", target: "t8", name: "Other" }]), "t7"), undefined);
  assert.equal(webPressToggleSignature(CLICK, before, bound([save("Unsave Senior Engineer")], { location: "https://shop.test/cart" }), "t7"), undefined);
  assert.equal(webPressToggleSignature(NAVIGATE, before, bound([save("Unsave Senior Engineer")]), "t7"), undefined);
  assert.equal(webPressToggleSignature(CLICK, before, bound([save("Unsave Senior Engineer")]), undefined), undefined);
});
