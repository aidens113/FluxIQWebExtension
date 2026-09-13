// The one key a recorded control's run-time requests are made under. A withheld
// secret and a chosen file both name the control by it, so a supplier derives
// one key from the recorded element whichever request it is answering.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationOutputPayload } from "../payloads";
import { webAutomationRecordedElementKey } from "../recorded-element-key";
import { webAutomationSecretBindingPath, webAutomationSecretStatePath } from "../secret-binding";
import { webAutomationUploadBindingPath, webAutomationUploadStatePath } from "../upload-binding";

/** A password control as the recorder describes one, with its value withheld: no `inputValue` at all. */
const withheldPasswordEntry = {
  element: {
    selector: "[data-testid=\"password\"]",
    tagName: "input",
    inputType: "password",
    attributes: { "data-testid": "password", type: "password", autocomplete: "current-password" }
  },
  visualTarget: { namespace: "web", statePath: "web.elements.password", selector: "[data-testid=\"password\"]" }
};

test("the key comes from identity the node already carries, richest first", () => {
  const key = (payload: Record<string, unknown>) => webAutomationRecordedElementKey(payload as never);
  // The assigned state path wins: it is the only identity already made unique
  // across the page's controls, suffix included.
  assert.equal(key(withheldPasswordEntry), "password");
  assert.equal(key({ ...withheldPasswordEntry, visualTarget: { statePath: "web.elements.password.2" } }), "password-2");
  // Then the author-written identifier, then the selector.
  assert.equal(key({ element: withheldPasswordEntry.element }), "password");
  assert.equal(key({ element: { selector: "form > input:nth-child(2)" } }), "form-input-nth-child-2");
  // Nothing at all is no request; such a payload has no selector either, so it
  // never becomes an executable action.
  assert.equal(key({}), undefined);
});

test("a withheld secret and a chosen file are each asked for under the key this rule derives", () => {
  const attachment = {
    element: { selector: "#attachment", tagName: "input", inputType: "file", id: "attachment" },
    visualTarget: { namespace: "web", statePath: "web.elements.attachment", selector: "#attachment" }
  };
  const uploadKey = webAutomationRecordedElementKey(attachment);
  assert.equal(uploadKey, "attachment");
  assert.equal(webAutomationUploadBindingPath(webAutomationOutputPayload("web.dom.upload", attachment).upload), webAutomationUploadStatePath("attachment"));
  const secretKey = webAutomationRecordedElementKey(withheldPasswordEntry);
  assert.equal(webAutomationSecretBindingPath(webAutomationOutputPayload("web.dom.type", withheldPasswordEntry).text), webAutomationSecretStatePath(secretKey ?? "(no key)"));
});
