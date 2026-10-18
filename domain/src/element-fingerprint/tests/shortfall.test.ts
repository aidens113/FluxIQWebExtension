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

test("the same box with its label, or two classes, is saved; with one class and nothing else it is not (t442 F5)", () => {
  assert.equal(webElementIdentityShortfall({ tagName: "input", selector: "#fb1l6ufkg", label: "Quantity" }), undefined);
  assert.equal(webElementIdentityShortfall({ tagName: "input", selector: "#fb1l6ufkg", classNames: ["qty-input", "q7k2"] }), undefined);
  assert.notEqual(webElementIdentityShortfall({ tagName: "input", selector: "#fb1l6ufkg", classNames: ["qty-input"] }), undefined);
  assert.deepEqual(webElementIdentitySignals({ tagName: "input", id: "fb1l6ufkg", selector: "#fb1l6ufkg", label: "Quantity", classNames: ["qty-input"] }), ["kind", "words", "classNames"]);
});

// R4a and R4b (`r4b-coupon-step-identity.md`): crossborder's coupon was saved as `{div, class b}`, and the floor
// counted the tag and the one class as its two signals, so a wordless identity that also matched the collected
// coupon was saved. A lone class beside a bare tag is now one signal short; a second token, an explicit role or
// any other signal makes the class count again.
test("the coupon's tag and lone class are refused, and the class counts again beside anything more", () => {
  const coupon = { tagName: "div", selector: "div:nth-of-type(1) > div:nth-of-type(2)", classNames: ["b"], context: { shadowHosts: ["main > fb-store-coupon"] } };
  assert.deepEqual(webElementIdentitySignals(coupon), ["kind"]);
  assert.equal(webElementIdentityShortfall(coupon)?.code, WEB_ELEMENT_IDENTITY_SHORTFALL_CODE);
  // An implied role or an input type is still the tag's kind, not a second signal.
  assert.notEqual(webElementIdentityShortfall({ tagName: "button", implicitRole: "button", classNames: ["b"] }), undefined);
  assert.notEqual(webElementIdentityShortfall({ tagName: "input", inputType: "checkbox", classNames: ["b"] }), undefined);
  assert.deepEqual(webElementIdentitySignals({ ...coupon, classNames: ["b", "x"] }), ["kind", "classNames"]);
  assert.deepEqual(webElementIdentitySignals({ ...coupon, role: "button" }), ["kind", "classNames"]);
  assert.deepEqual(webElementIdentitySignals({ ...coupon, visibleText: "Get coupons" }), ["kind", "words", "classNames"]);
  assert.deepEqual(webElementIdentitySignals({ ...coupon, name: "coupon" }), ["kind", "name", "classNames"]);
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
  assert.deepEqual(webElementIdentitySignals({ tagName: "div", selector: "div.card > div.thumb", classNames: ["thumb", "lazy", "fade"] }), ["kind", "classNames"]);
  // One unquoted token beside a bare tag is the lone class F5 does not count (t442).
  assert.deepEqual(webElementIdentitySignals({ tagName: "div", selector: "div.card > div.thumb", classNames: ["thumb", "lazy"] }), ["kind"]);
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

// Lane 4 (`run-mvcwqwec-0aa4f98b`): a list row's wordless icon control, a `<span>` with one hashed class and an
// unlabelled `<svg>`, was refused at save because its only identity was the tag and the lone class. What it draws
// is the signal a person tells it apart by, so a drawing counts once -- and the lone class stays uncounted
// without one (t442 F5).
test("what a wordless control draws is one signal, and a lone class beside a bare tag is still none", () => {
  const icon = { tagName: "span", selector: "li:nth-of-type(2) > article > span:nth-of-type(1)", classNames: ["q8f2"], context: { record: { text: "Line Cook" } } };
  assert.deepEqual(webElementIdentitySignals(icon), ["kind"]);
  assert.equal(webElementIdentityShortfall(icon)?.code, WEB_ELEMENT_IDENTITY_SHORTFALL_CODE);

  // Kind and drawing are the two the floor asks for; beside the drawing the one class counts as well.
  assert.deepEqual(webElementIdentitySignals({ tagName: "span", drawing: "d1.1x9kq3" }), ["kind", "drawing"]);
  assert.equal(webElementIdentityShortfall({ tagName: "span", drawing: "d1.1x9kq3" }), undefined);
  assert.deepEqual(webElementIdentitySignals({ ...icon, drawing: "d1.1x9kq3" }), ["kind", "drawing", "classNames"]);
  assert.equal(webElementIdentityShortfall({ ...icon, drawing: "d1.1x9kq3" }), undefined);

  // A drawing alone, with no kind, is still one signal; a blank one is none.
  assert.notEqual(webElementIdentityShortfall({ drawing: "d1.1x9kq3" }), undefined);
  assert.deepEqual(webElementIdentitySignals({ ...icon, drawing: " " }), ["kind"]);
});
