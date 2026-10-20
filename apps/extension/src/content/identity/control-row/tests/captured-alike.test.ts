// What one capture knows about a control's alike controls (t733): nothing
// outside a scope, and inside one the alike controls of its own root and every
// element's descendant count. The markup is a made-up cart.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { withSelectorMemo } from "../../../selector";
import { el, installStubDocument, stubDocument, type StubElement } from "../../../tests/stub-dom";
import { capturedAlike } from "../captured-alike";

const asElement = (element: StubElement): Element => element as unknown as Element;

function install(t: TestContext, ...children: StubElement[]): void {
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, ...children)));
  installStubDocument(t, document);
}

test("outside a capture scope nothing is indexed", (t) => {
  const select = el("select", { "aria-label": "Qty" });
  install(t, select);
  assert.equal(capturedAlike(asElement(select)), undefined);
});

test("inside a scope a control's alike controls are those of its kind and name in its own root", (t) => {
  const lightSelects = [0, 1].map(() => el("select", { "aria-label": "Qty" }));
  const otherName = el("select", { "aria-label": "Size" });
  const sameNameOtherKind = el("button", {}, "Qty");
  const host = el("div", { class: "host" });
  const shadowSelect = el("select", { "aria-label": "Qty" });
  host.attachShadow().append(el("div", {}, shadowSelect));
  install(t, el("div", { class: "cart" }, ...lightSelects.map((select) => el("div", { class: "line" }, select)), otherName, sameNameOtherKind), host);
  withSelectorMemo(() => {
    const light = capturedAlike(asElement(lightSelects[0] as StubElement));
    assert.equal(light?.name, "Qty");
    assert.deepEqual([...(light?.members ?? [])], lightSelects, "the shadow root's select and the button named alike are not in the group");
    const shadow = capturedAlike(asElement(shadowSelect));
    assert.deepEqual([...(shadow?.members ?? [])], [shadowSelect]);
  });
});

test("inside a scope every element of the root has its descendant count, and a nameless control has no alike", (t) => {
  const nameless = el("button", {});
  const line = el("div", { class: "line" }, el("a", { href: "/soap" }, el("b", {}, "Soap")), nameless);
  const cart = el("div", { class: "cart" }, line, el("div", { class: "line" }));
  install(t, cart);
  withSelectorMemo(() => {
    const captured = capturedAlike(asElement(nameless));
    assert.equal(captured?.name, undefined);
    assert.equal(captured?.members.size, 0);
    assert.equal(captured?.descendants(asElement(nameless)), 0);
    assert.equal(captured?.descendants(asElement(line)), 3, "the link, its bold words and the button");
    assert.equal(captured?.descendants(asElement(cart)), 5);
  });
});
