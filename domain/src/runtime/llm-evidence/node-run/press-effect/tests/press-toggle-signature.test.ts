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
    signature: { via: "name", gains: ["unsave"], loses: ["save"] },
    beforeSignature: { via: "name", gains: ["save"], loses: ["unsave"] }
  });
});

test("an aria-pressed false to true press gives the attribute signature, idempotent with web.dom.check", () => {
  assert.deepEqual(webPressToggleSignature(CLICK, bound([like(false)]), bound([like(true)]), "t7"), {
    signature: { via: "attribute", attribute: "aria-pressed", to: true },
    beforeSignature: { via: "attribute", attribute: "aria-pressed", to: false },
    idempotentWith: "web.output.dom-check"
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

test("a span whose class gains a token gives the class signature; transient-only changes give none", () => {
  const heart = (classes: string): FixtureElement => ({ tag: "span", target: "t7", attributes: [["class", classes]] });
  assert.deepEqual(webPressToggleSignature(CLICK, bound([heart("heart")]), bound([heart("heart heartOn")]), "t7"), {
    signature: { via: "class", gains: ["heartOn"], loses: [] },
    beforeSignature: { via: "class", gains: [], loses: ["heartOn"] }
  });
  assert.equal(webPressToggleSignature(CLICK, bound([heart("heart")]), bound([heart("heart hover loading")]), "t7"), undefined);
});

test("an already-on first control reports actual on before and off after, without choosing intent", () => {
  assert.deepEqual(webPressToggleSignature(CLICK, bound([like(true)]), bound([like(false)]), "t7"), {
    signature: { via: "attribute", attribute: "aria-pressed", to: false },
    beforeSignature: { via: "attribute", attribute: "aria-pressed", to: true },
    idempotentWith: "web.output.dom-check"
  });
});

test("a wrapper above the pressed element within the control supplies the class change", () => {
  const packet = (wrap: string): FixtureElement[] => [
    { tag: "div", target: "t1", attributes: [["class", wrap]] },
    { tag: "span", target: "t7", parent: "t1", attributes: [["class", "icon"]] }
  ];
  assert.deepEqual(webPressToggleSignature(CLICK, bound(packet("w")), bound(packet("w saved")), "t7")?.signature, { via: "class", gains: ["saved"], loses: [] });
  const row = (cls: string): FixtureElement[] => [{ tag: "li", target: "t1", attributes: [["class", cls]] }, { tag: "span", target: "t7", parent: "t1", attributes: [["class", "icon"]] }];
  assert.equal(webPressToggleSignature(CLICK, bound(row("r")), bound(row("r selected")), "t7"), undefined);
});
