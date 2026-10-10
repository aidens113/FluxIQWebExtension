// The save-time guard (t425): a control found by one attribute alone is not
// saved. Two independent signals besides its address is the floor.

import assert from "node:assert/strict";
import test from "node:test";
import { WEB_ELEMENT_IDENTITY_SHORTFALL_CODE, webElementIdentityShortfall, webElementIdentitySignals } from "..";

test("R4a's quantity box, a tag beside a selector through a regenerated id, is refused", () => {
  // `run-mv2pgqkj-f3552c70`: the step's whole identity.
  const shortfall = webElementIdentityShortfall({ tagName: "input", selector: "#fb1l6ufkg" });
  assert.equal(shortfall?.code, WEB_ELEMENT_IDENTITY_SHORTFALL_CODE);
  assert.match(shortfall?.reason ?? "", /too little to be found again/u);
  // The id the selector is addressed through is the same token said twice, not a second signal.
  assert.deepEqual(webElementIdentitySignals({ tagName: "input", id: "fb1l6ufkg", selector: "#fb1l6ufkg" }), ["kind"]);
  assert.notEqual(webElementIdentityShortfall({ tagName: "input", id: "fb1l6ufkg", selector: "#fb1l6ufkg" }), undefined);
  assert.notEqual(webElementIdentityShortfall({ tagName: "input", id: "fb1l6ufkg", selector: "input[id=\"fb1l6ufkg\"]" }), undefined);
});

test("the same box with its label, or its class, is saved", () => {
  assert.equal(webElementIdentityShortfall({ tagName: "input", selector: "#fb1l6ufkg", label: "Quantity" }), undefined);
  assert.equal(webElementIdentityShortfall({ tagName: "input", selector: "#fb1l6ufkg", classNames: ["qty-input"] }), undefined);
  assert.deepEqual(webElementIdentitySignals({ tagName: "input", id: "fb1l6ufkg", selector: "#fb1l6ufkg", label: "Quantity", classNames: ["qty-input"] }), ["kind", "words", "classNames"]);
});

test("one wording said twice is one signal, and the kind is one signal however it is said", () => {
  assert.deepEqual(webElementIdentitySignals({ tagName: "button", role: "button", visibleText: "Save", accessibleName: " save " }), ["kind", "words"]);
  assert.deepEqual(webElementIdentitySignals({ tagName: "button", visibleText: "Save", accessibleName: "Save changes" }), ["kind", "words", "words"]);
  assert.equal(webElementIdentityShortfall({ tagName: "button", visibleText: "Save" }), undefined);
  // Words alone, with no kind, are still one signal.
  assert.notEqual(webElementIdentityShortfall({ visibleText: "Save" }), undefined);
});

test("a class token the selector does not quote still counts; one it does is the address", () => {
  assert.deepEqual(webElementIdentitySignals({ tagName: "div", selector: "div.card > div.thumb", classNames: ["thumb"] }), ["kind"]);
  assert.deepEqual(webElementIdentitySignals({ tagName: "div", selector: "div.card > div.thumb", classNames: ["thumb", "lazy"] }), ["kind", "classNames"]);
  assert.deepEqual(webElementIdentitySignals({ tagName: "input", selector: "input[name='email']", name: "email", testId: "email-field" }), ["kind", "testId"]);
  assert.deepEqual(webElementIdentitySignals({ tagName: "input", selector: "#\\31 23", id: "123" }), ["kind"], "an escaped id is the id it names");
});

test("where a control sat narrows the search and names no control, so it does not count", () => {
  const signals = webElementIdentitySignals({
    tagName: "button",
    selector: "li:nth-of-type(3) > button",
    href: "/stores/3",
    context: { record: { text: "Millbrook" }, formId: "chooser", listPosition: { index: 3, total: 4 }, shadowHosts: ["store-picker"] }
  });
  assert.deepEqual(signals, ["kind"]);
});
