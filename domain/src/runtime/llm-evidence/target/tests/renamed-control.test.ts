import assert from "node:assert/strict";
import test from "node:test";
import { validateWebRuntimeTargetOverrideEvidence } from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import type { WebLlmPageEvidence } from "../../sanitize";
import type { AutomationStudioRuntimeTargetOverrideFailedAction } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";

// A control the site renamed (t446), and the same words standing elsewhere.
// Paid run R4b's redesign renamed its recorded pressable `<div>` and dropped
// its test id and class; the in-run repair naming the new one was refused as
// unanchored, because only a kept name or a form tied a rename to the
// recording. These pages are a recipe site's action bar drawn the same way:
// `<div>`s the page listens on, in `main`, and no form. Each recorded element is
// the step as a build saves it from the packet.

type Element = JsonObject;

const page = (interactiveElements: Element[]) => sanitizeWebLlmSnapshotWithBindings({ url: "http://127.0.0.1:4173/recipes/lemon-tart", interactiveElements });
const click = (element: Element): AutomationStudioRuntimeTargetOverrideFailedAction => ({ nodeId: "recorded.click", definitionId: "builtin.policy.action", outputId: "web.dom.click", recordedTarget: { element } });
const override = (handle: string) => ({ handles: { element: handle } });
const refused = (reason: string) => ({ status: "absent", reason });

const MAIN = { landmark: "main" };

/** A `<div>` the page draws as a control: it listens for a click and sets a pointer, with a generated class. */
const pressable = (label: string, context: Element, attributes: Element = {}): Element => ({
  tagName: "div", selector: `[data-label="${label}"]`, text: label, visibleText: label, hasClickHandler: true, cursor: "pointer", context,
  attributes: { class: `css-${label.length}x${label.charCodeAt(0)}`, ...attributes }
});
const inList = (label: string): Element => pressable(label, { landmark: "main", listPosition: { index: 1, total: 1 } });

const RECORDED = click({
  tagName: "div", testId: "save-to-cookbook", classNames: ["css-0dtygkz"], visibleText: "Save to cookbook", context: MAIN,
  attributes: { "data-testid": "save-to-cookbook", class: "css-0dtygkz" }
});

/** Every handle the packet issued for an element with these words. */
function handlesNamed(evidence: WebLlmPageEvidence, words: string): string[] {
  return evidence.elements.filter((element) => element.name === words || element.text === words).map((element) => element.target);
}

function handleNamed(evidence: WebLlmPageEvidence, words: string): string {
  const found = handlesNamed(evidence, words);
  assert.equal(found.length, 1, `the packet describes exactly one "${words}"`);
  return found[0]!;
}

function judge(elements: Element[], words: string, recorded = RECORDED) {
  const { evidence, selectors } = page(elements);
  return validateWebRuntimeTargetOverrideEvidence(evidence, override(handleNamed(evidence, words)), recorded, selectors);
}

test("a renamed control of the same kind in the same place, keeping the recorded action, is the recorded control", () => {
  const result = judge([pressable("Servings", MAIN), pressable("Save to collection", MAIN), pressable("Print recipe", MAIN)], "Save to collection");
  assert.equal(result.status, "resolved", JSON.stringify(result));
});

test("a control of another purpose in the recorded place is refused", () => {
  const bar = [pressable("Save to collection", MAIN), pressable("Print recipe", MAIN), pressable("Share now", MAIN), pressable("Delete recipe", MAIN)];
  for (const words of ["Print recipe", "Share now", "Delete recipe"]) {
    assert.deepEqual(judge(bar, words), refused("target_unanchored"), words);
  }
  // An account control in the banner is neither the place nor the action.
  assert.deepEqual(judge([pressable("Sign out", { landmark: "banner" }), pressable("Print recipe", MAIN)], "Sign out"), refused("target_unanchored"));
  // A one-word name has no action left to keep once it is renamed.
  const recordedSave = click({ tagName: "div", testId: "save", classNames: ["css-1"], visibleText: "Save", context: MAIN, attributes: { "data-testid": "save", class: "css-1" } });
  assert.deepEqual(judge([pressable("Store", MAIN)], "Store", recordedSave), refused("target_unanchored"));
  // A conjunction is not the renamed thing a recorded action acts on.
  assert.deepEqual(judge([pressable("Save to and", MAIN)], "Save to and"), refused("target_unanchored"));
});

test("two controls in the place that both keep the recorded action do not say which was renamed", () => {
  const bar = [pressable("Save to collection", MAIN), pressable("Save to planner", MAIN)];
  for (const words of ["Save to collection", "Save to planner"]) {
    assert.deepEqual(judge(bar, words), refused("target_unanchored"), words);
  }
  // Nor is a control renamed while the recorded name is still on a control in the place.
  const stillThere = [pressable("Save to collection", MAIN), { tagName: "button", selector: "#keep", text: "Save to cookbook", accessibleName: "Save to cookbook", implicitRole: "button", context: MAIN, attributes: { type: "button" } }];
  assert.deepEqual(judge(stillThere, "Save to collection"), refused("target_unanchored"));
});

test("a rename keeps the recorded kind, and a test id that differs from the recorded one is another control", () => {
  const asButton = { tagName: "button", selector: "#save", text: "Save to collection", accessibleName: "Save to collection", implicitRole: "button", context: MAIN, attributes: { type: "button" } };
  assert.deepEqual(judge([asButton], "Save to collection"), refused("target_unanchored"));
  assert.deepEqual(judge([pressable("Save to collection", MAIN, { "data-testid": "save-to-shopping-list" })], "Save to collection"), refused("target_not_equivalent"));
  // A form the recording stated must still hold it.
  const recordedInForm = click({ tagName: "div", testId: "save-to-cookbook", classNames: ["css-0"], visibleText: "Save to cookbook", context: { landmark: "main", formId: "recipe-form" }, attributes: { "data-testid": "save-to-cookbook", class: "css-0" } });
  assert.deepEqual(judge([pressable("Save to collection", MAIN)], "Save to collection", recordedInForm), refused("target_unanchored"));
});

test("the renamed words elsewhere are refused, and do not stop the one in the recorded place", () => {
  // One page each: two copies that differ only by place are twins, refused before place is asked.
  for (const elsewhere of [pressable("Save to collection", { landmark: "complementary" }), inList("Save to collection")]) {
    assert.deepEqual(judge([pressable("Print recipe", MAIN), elsewhere], "Save to collection"), refused("target_unanchored"), JSON.stringify(elsewhere.context));
  }
  // A list row's control with the same words is not a rival to the one in the
  // recorded place. (An exact twin of it -- the same tag, words and no other
  // difference than its place -- is refused before this, as indistinguishable.)
  const rowLink: Element = { tagName: "a", selector: "li a", href: "http://127.0.0.1:4173/collections", text: "Save to collection", visibleText: "Save to collection", accessibleName: "Save to collection", implicitRole: "link", context: { landmark: "main", listPosition: { index: 1, total: 1 } } };
  const withMain = page([pressable("Save to collection", MAIN), pressable("Print recipe", MAIN), rowLink]);
  const inMain = withMain.evidence.elements.find((element) => (element.name === "Save to collection" || element.text === "Save to collection") && element.tag === "div")!;
  assert.equal(validateWebRuntimeTargetOverrideEvidence(withMain.evidence, override(inMain.target), RECORDED, withMain.selectors).status, "resolved");
});

test("the recorded words kept whole, in another landmark or a list row, are a same-named control elsewhere", () => {
  for (const elsewhere of [pressable("Save to cookbook", { landmark: "complementary" }), inList("Save to cookbook")]) {
    assert.deepEqual(judge([elsewhere, pressable("Print recipe", MAIN)], "Save to cookbook"), refused("target_not_equivalent"), JSON.stringify(elsewhere.context));
  }
  // In the recorded place, it is the recorded control, as before.
  assert.equal(judge([pressable("Save to cookbook", MAIN)], "Save to cookbook").status, "resolved");
});
