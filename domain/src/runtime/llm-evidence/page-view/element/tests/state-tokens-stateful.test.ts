// The state a stateful control states is printed after its words, compactly
// (CC9, interface I5): `pressed`, `checked` and `unchecked`, `selected`. A state
// the control does not state prints nothing: unknown is absent. A toggle the
// page wrote as `aria-pressed="false"` prints nothing either -- the view has
// always left a false state unsaid (`state-tokens.test.ts`) -- but the same look
// still gives the control's own `unpressed` state in its `stateful` view
// (`../../../control-spot/control-view.ts`), which is what Core reads. Where
// the view prints a state, it is the word the view of the control says.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebLlmEvidenceElement } from "../../../elements";
import { webControlView } from "../../../control-spot";
import { webLlmStateTokens } from "../state-tokens";

const el = (fields: Partial<WebLlmEvidenceElement> & { tag: string }): WebLlmEvidenceElement => ({ target: "t1", ...fields });

test("a pressed toggle says so; one the page wrote as false, or that states nothing, prints nothing", () => {
  assert.deepEqual(webLlmStateTokens(el({ tag: "button", attributes: [["aria-pressed", "true"]] }), "button", undefined), ["pressed"]);
  assert.deepEqual(webLlmStateTokens(el({ tag: "button", attributes: [["aria-pressed", "false"]] }), "button", undefined), []);
  assert.deepEqual(webLlmStateTokens(el({ tag: "button", attributes: [["aria-pressed", "mixed"]] }), "button", undefined), [], "a state that is neither is not guessed");
  assert.deepEqual(webLlmStateTokens(el({ tag: "button" }), "button", undefined), []);
});

test("the printed state and the control's state word are one word", () => {
  const cases: Array<[WebLlmEvidenceElement, string]> = [
    [el({ tag: "button", attributes: [["aria-pressed", "true"]] }), "pressed"],
    [el({ tag: "input", checked: true }), "checked"],
    [el({ tag: "div", role: "switch", attributes: [["aria-checked", "false"]] }), "unchecked"]
  ];
  for (const [element, word] of cases) {
    const printed = webLlmStateTokens(element, "button", undefined);
    assert.ok(printed.includes(word), `${word} is printed: ${printed.join(" ")}`);
    assert.equal(webControlView(element, [element])?.state, word);
  }
});

test("a plain button is not stateful, and a checkbox that states nothing is stateful with no state", () => {
  const plain = el({ tag: "button", name: "Search catalogue" });
  assert.equal(webControlView(plain, [plain]), undefined);
  const box = el({ tag: "div", role: "checkbox" });
  assert.deepEqual(webControlView(box, [box]), { stateful: true });
  const mixed = el({ tag: "div", role: "checkbox", attributes: [["aria-checked", "mixed"]] });
  assert.deepEqual(webControlView(mixed, [mixed]), { stateful: true }, "unreadable state supplies neither shown nor ensures");
  const hidden = el({ tag: "button", hidden: true, attributes: [["aria-pressed", "true"]] });
  assert.equal(webControlView(hidden, [hidden]), undefined, "a hidden control is no control a person can press");
});

test("a press leaves the other state, set by the check node; selected and expanded add no node of their own", () => {
  const toggle = el({ tag: "button", attributes: [["aria-pressed", "false"]] });
  assert.deepEqual(webControlView(toggle, [toggle]), { stateful: true, state: "unpressed", shown: { via: "attribute", attribute: "aria-pressed", to: false }, ensures: { via: "attribute", attribute: "aria-pressed", to: true }, idempotentWith: "web.output.dom-check" });
  const tab = el({ tag: "div", role: "tab", attributes: [["aria-selected", "true"]] });
  assert.equal(webControlView(tab, [tab])?.state, "selected");
});

test("a control that shows its state in its words is read only against a signature learned from a press", () => {
  const save = el({ tag: "button", name: "Save to shelf" });
  const remove = el({ tag: "button", name: "Remove from shelf" });
  const learned = [{ via: "name" as const, gains: ["remove", "from"], loses: ["save", "to"] }];
  assert.equal(webControlView(save, [save]), undefined, "nothing learned");
  assert.deepEqual(webControlView(save, [save], learned), { stateful: true, state: "off", shown: { via: "name", gains: ["save", "to"], loses: ["remove", "from"] }, ensures: learned[0] });
  assert.deepEqual(webControlView(remove, [remove], learned), { stateful: true, state: "on", shown: learned[0], ensures: { via: "name", gains: ["save", "to"], loses: ["remove", "from"] } });
  const other = el({ tag: "button", name: "Share" });
  assert.equal(webControlView(other, [other], learned), undefined, "words that match neither side are not guessed");
  // A signature that gains or loses nothing is no toggle.
  assert.equal(webControlView(save, [save], [{ via: "name", gains: ["remove"], loses: [] }]), undefined);
});
