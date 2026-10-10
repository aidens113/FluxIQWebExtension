// A recorded element read off the wire into a saved step's identity (t425):
// every signal the recorder captured, less what the control held.

import assert from "node:assert/strict";
import test from "node:test";
import { webElementFingerprintFromDescriptor } from "..";

test("a recorded text field keeps its whole description and none of what was typed into it", () => {
  const fingerprint = webElementFingerprintFromDescriptor({
    tagName: "input",
    selector: "#q",
    xpath: "/html/body/form/input",
    id: "q",
    classNames: ["search-box", "wide"],
    name: "q",
    inputType: "search",
    value: "Voltbay USB-C hub",
    text: "Voltbay USB-C hub",
    accessibleName: "Search",
    label: "Search the store",
    implicitRole: "searchbox",
    attributes: { id: "q", name: "q", class: "search-box wide", placeholder: "What are you looking for?", value: "Voltbay USB-C hub" },
    context: { formId: "search", landmark: "search" },
    bounds: { x: 1, y: 2, width: 3, height: 4 }
  });
  assert.deepEqual(fingerprint, {
    selector: "#q",
    xpath: "/html/body/form/input",
    id: "q",
    classNames: ["search-box", "wide"],
    tagName: "input",
    implicitRole: "searchbox",
    name: "q",
    inputType: "search",
    accessibleName: "Search",
    label: "Search the store",
    attributes: { id: "q", name: "q", class: "search-box wide", placeholder: "What are you looking for?" },
    context: { formId: "search", landmark: "search" }
  });
});

test("a recorded secret control carries its label and structure and none of its words", () => {
  const fingerprint = webElementFingerprintFromDescriptor({
    tagName: "input",
    selector: "#pw",
    id: "pw",
    inputType: "password",
    accessibleName: "Password",
    label: "Password",
    attributes: { id: "pw", type: "password", autocomplete: "current-password" }
  });
  assert.equal(fingerprint?.accessibleName, undefined);
  assert.equal(fingerprint?.label, "Password");
  assert.equal(fingerprint?.id, "pw");
});

test("a value that is no element is no fingerprint", () => {
  assert.equal(webElementFingerprintFromDescriptor(undefined), undefined);
  assert.equal(webElementFingerprintFromDescriptor("button"), undefined);
});
