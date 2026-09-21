import assert from "node:assert/strict";
import test from "node:test";
import { validateWebRuntimeTargetOverrideEvidence } from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import type { WebLlmPageEvidence } from "../../sanitize";
import type { AutomationStudioRuntimeTargetOverrideFailedAction } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";

// Whether the control a model named is the failed action's own, as far as the
// page can show it. The live repair campaign of 2026-09-17
// (`test-runs/campaigns/2026-09-17T02-23-20-255Z`) had six tasks whose correct
// answer was a refusal, and each ended in a proposed target override: the check
// asked only whether the model had been shown a control the verb could use.
// Each page below is the fixture's markup as the content script describes it
// (tag, name, role, placement, attributes), and each recorded element is the
// control the recording addressed, in the recorder's own shape.

/** One element as the content script describes it, which is what the sanitizer reads. */
type Element = JsonObject;

const page = (path: string, interactiveElements: Element[]) => sanitizeWebLlmSnapshotWithBindings({ url: `http://127.0.0.1:4173${path}`, interactiveElements });

/** The handle the packet issued for the one element `pick` selects. */
function handleOf(evidence: WebLlmPageEvidence, pick: (element: WebLlmPageEvidence["elements"][number]) => boolean): string {
  const found = evidence.elements.filter(pick);
  assert.equal(found.length, 1, "the packet describes exactly one such element");
  return found[0]!.target;
}

const click = (element: Element): AutomationStudioRuntimeTargetOverrideFailedAction => ({ nodeId: "recorded.click", definitionId: "builtin.policy.action", outputId: "web.dom.click", recordedTarget: { element } });
const type = (element: Element): AutomationStudioRuntimeTargetOverrideFailedAction => ({ nodeId: "recorded.type", definitionId: "builtin.policy.action", outputId: "web.dom.type", recordedTarget: { element } });
const override = (handle: string) => ({ handles: { element: handle } });
const refused = (status: "absent" | "ambiguous", reason: string) => ({ status, reason });

const button = (testId: string, label: string, context: Element, attributes: Element = {}): Element => ({
  tagName: "button", selector: `[data-testid="${testId}"]`, testId, text: label, visibleText: label, accessibleName: label, implicitRole: "button", context,
  attributes: { "data-testid": testId, ...attributes }
});

// ambiguous-targets-refuse-unnamed-continue (`run-mu4y6zyc-2b986fca`,
// `web.target.ambiguous`): the recording's two panels merged into one unnamed
// group, so nothing on the page prefers one Continue over the other.
test("refuses either of two Continue buttons nothing tells apart, as indistinguishable", () => {
  const placement = { landmark: "main", heading: "Ambiguous targets" };
  const unnamedContinue = (index: number): Element => ({
    tagName: "button", selector: `main > div > button:nth-of-type(${index})`, text: "Continue", visibleText: "Continue", accessibleName: "Continue",
    implicitRole: "button", context: placement, attributes: { class: "ui-button" }
  });
  const email = (testId: string): Element => ({ tagName: "input", selector: `[data-testid="${testId}"]`, inputType: "text", accessibleName: "Email", label: "Email", implicitRole: "textbox", context: placement, attributes: { "data-testid": testId } });
  const { evidence, selectors } = page("/scenarios/ambiguous-targets/", [unnamedContinue(1), unnamedContinue(2), email("email-primary"), email("email-secondary")]);
  const recordedPrimary = click(button("choice-primary", "Continue", { landmark: "region", landmarkName: "Primary", heading: "Ambiguous targets" }, { "data-choice": "primary" }));

  const continues = evidence.elements.filter((element) => element.name === "Continue").map((element) => element.target);
  assert.equal(continues.length, 2);
  for (const handle of continues) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(handle), recordedPrimary, selectors), refused("ambiguous", "target_indistinguishable"), handle);
  }
});

// failure-surfaces-refuse-deleted-item (`run-mu4y93bn-1a2e059b`,
// `web.target.not_found`): a deletion notice stands where the control was, and
// every button left on the page was there beside it when it was recorded.
test("refuses any button left on a page whose recorded item was deleted, as unanchored", () => {
  const placement = { landmark: "main", heading: "Failure surfaces" };
  const { evidence, selectors } = page("/scenarios/failure-surfaces/", [
    button("disabled-target", "Disabled", placement, { disabled: "" }),
    { tagName: "p", selector: "[data-testid=\"detach-target-removed\"]", testId: "detach-target-removed", text: "This item was deleted. Nothing here replaces it.", visibleText: "This item was deleted. Nothing here replaces it.", implicitRole: "paragraph", context: placement, attributes: { "data-testid": "detach-target-removed" } },
    button("dead-link", "Link that goes nowhere", placement),
    button("close-surface", "Page closure marker", placement),
    { tagName: "p", selector: "[data-testid=\"result\"]", testId: "result", text: "Ready", visibleText: "Ready", implicitRole: "paragraph", context: placement, attributes: { "data-testid": "result", "aria-live": "polite" } }
  ]);
  const recordedDetach = click(button("detach-target", "Detach me", placement));

  for (const name of ["Disabled", "Link that goes nowhere", "Page closure marker"]) {
    const handle = handleOf(evidence, (element) => element.name === name);
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(handle), recordedDetach, selectors), refused("absent", "target_unanchored"), name);
  }
  // The notice itself is not something a click acts on, and nothing stands in for it.
  const notice = handleOf(evidence, (element) => element.text?.startsWith("This item was deleted") === true || element.name?.startsWith("This item was deleted") === true);
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(notice), recordedDetach, selectors), refused("absent", "handle_incompatible"));
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.99"), recordedDetach, selectors), refused("absent", "handle_not_issued"));
});

// failure-surfaces-refuse-guarded-link (`run-mu4ya9vt-cad840da`,
// `web.navigation.unexpected`): the failure packet is the link guard's
// interstitial, whose one clickable control is its own way back. A handle the
// packet never issued used to be replaced by that link, as the only element a
// click could use. Core refuses this failure class before asking; the domain
// refuses the link on its own as well.
test("refuses the link guard's way back, and never substitutes it for a handle it did not issue", () => {
  const placement = { landmark: "main", heading: "Blocked by your workspace" };
  const { evidence, selectors } = page("/scenarios/failure-surfaces/blocked?to=https%3A%2F%2Fpartner.example.invalid%2Frecords%2F4821", [
    { tagName: "h1", selector: "[data-testid=\"access-blocked\"]", testId: "access-blocked", text: "Blocked by your workspace", visibleText: "Blocked by your workspace", accessibleName: "Blocked by your workspace", implicitRole: "heading", context: { landmark: "main" }, attributes: { "data-testid": "access-blocked" } },
    { tagName: "code", selector: "[data-testid=\"blocked-destination\"]", testId: "blocked-destination", text: "https://partner.example.invalid/records/4821", visibleText: "https://partner.example.invalid/records/4821", implicitRole: "code", context: placement, attributes: { "data-testid": "blocked-destination" } },
    { tagName: "a", selector: "[data-testid=\"back-to-surfaces\"]", testId: "back-to-surfaces", href: "http://127.0.0.1:4173/scenarios/failure-surfaces/", text: "Back to the record", visibleText: "Back to the record", accessibleName: "Back to the record", implicitRole: "link", context: { landmark: "navigation", heading: "Blocked by your workspace" }, attributes: { "data-testid": "back-to-surfaces", href: "/scenarios/failure-surfaces/" } }
  ]);
  const recordedDetach = click(button("detach-target", "Detach me", { landmark: "main", heading: "Failure surfaces" }, { "data-blocked-url": "https://partner.example.invalid/records/4821" }));

  const back = handleOf(evidence, (element) => element.tag === "a");
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(back), recordedDetach, selectors), refused("absent", "target_not_equivalent"));
  for (const invented of ["target.99", "#detach-target", "Detach me"]) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(invented), recordedDetach, selectors), refused("absent", "handle_not_issued"), invented);
  }
});

// admin-console-refuse-read-only-edit (`run-mu4ybggw-b8a18765`,
// `web.target.not_found`): the revenue editor is gone, the revenue shows as
// text, and the page's one fillable control is the customer search. A model
// that named the revenue text had the search box put in its place.
test("never types the recorded revenue into the search box, named or substituted", () => {
  const detail = { landmark: "region", landmarkName: "Customer detail", heading: "Acme Corp" };
  const { evidence, selectors } = page("/scenarios/admin-console/records/CUS-0042", [
    { tagName: "input", selector: "#record-search", id: "record-search", testId: "record-search", inputType: "search", accessibleName: "Search customers", label: "Search customers", implicitRole: "searchbox", hasValue: false, context: { landmark: "region", landmarkName: "Customers", heading: "Customers" }, attributes: { id: "record-search", type: "search", autocomplete: "off", placeholder: "Search by company", "data-testid": "record-search" } },
    button("record-row", "Acme Corp", { landmark: "region", landmarkName: "Customers", heading: "Customers", listPosition: { index: 1, total: 1 } }),
    { tagName: "p", selector: "[data-testid=\"read-only-banner\"]", testId: "read-only-banner", text: "Read-only access — ask a workspace owner to make changes", visibleText: "Read-only access — ask a workspace owner to make changes", implicitRole: "paragraph", context: detail, attributes: { "data-testid": "read-only-banner" } },
    { tagName: "dd", selector: "[data-testid=\"field-mrr\"]", testId: "field-mrr", text: "$12,400.00", visibleText: "$12,400.00", implicitRole: "definition", context: detail, attributes: { "data-testid": "field-mrr" } }
  ]);
  const recordedEditor = type({
    tagName: "input", selector: "[data-testid=\"field-mrr-input\"]", testId: "field-mrr-input", inputType: "text", accessibleName: "Monthly recurring revenue",
    implicitRole: "textbox", context: detail, attributes: { "data-testid": "field-mrr-input", type: "text", inputmode: "decimal" }
  });

  const search = handleOf(evidence, (element) => element.inputType === "search");
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(search), recordedEditor, selectors), refused("absent", "target_not_equivalent"));
  const revenue = handleOf(evidence, (element) => element.tag === "dd");
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(revenue), recordedEditor, selectors), refused("absent", "handle_incompatible"));
});

// navigation-refuse-retired-page (`run-mu4yd33n-5555aa0a`,
// `web.navigation.unexpected`): the recorded link now lands on a not-found
// notice, whose one link goes back to the start.
test("refuses the not-found page's way back as the recorded link, named or substituted", () => {
  const { evidence, selectors } = page("/scenarios/navigation/link-retired", [
    { tagName: "h1", selector: "[data-testid=\"link-retired\"]", testId: "link-retired", text: "Page not found", visibleText: "Page not found", accessibleName: "Page not found", implicitRole: "heading", context: { landmark: "main" }, attributes: { "data-testid": "link-retired" } },
    { tagName: "a", selector: "[data-testid=\"back-to-start\"]", testId: "back-to-start", href: "http://127.0.0.1:4173/scenarios/navigation/start", text: "Back to the start page", visibleText: "Back to the start page", accessibleName: "Back to the start page", implicitRole: "link", context: { landmark: "navigation", heading: "Page not found" }, attributes: { "data-testid": "back-to-start", href: "/scenarios/navigation/start" } }
  ]);
  const recordedLink = click({
    tagName: "a", selector: "[data-testid=\"full-navigation\"]", testId: "full-navigation", href: "http://127.0.0.1:4173/scenarios/navigation/second",
    text: "Second page", visibleText: "Second page", accessibleName: "Second page", implicitRole: "link", context: { landmark: "navigation", heading: "Start page" },
    attributes: { "data-testid": "full-navigation", href: "/scenarios/navigation/second" }
  });

  const back = handleOf(evidence, (element) => element.tag === "a");
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(back), recordedLink, selectors), refused("absent", "target_unanchored"));
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.99"), recordedLink, selectors), refused("absent", "handle_not_issued"));
});

// The rules on their own.

const RECORDED_SAVE = button("save-changes", "Save changes", { formId: "settings-form", heading: "General" }, { type: "submit" });

test("a shortened label still names the recorded control; a label that keeps only a later word does not", () => {
  const { evidence, selectors } = page("/toolbar", [
    button("save", "Save", { landmark: "main" }),
    button("changes", "Changes", { landmark: "main" })
  ]);
  const recorded = click(button("save-changes", "Save changes", { landmark: "main" }));
  const save = validateWebRuntimeTargetOverrideEvidence(evidence, override(handleOf(evidence, (element) => element.name === "Save")), recorded, selectors);
  assert.equal(save.status, "resolved");
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(handleOf(evidence, (element) => element.name === "Changes")), recorded, selectors), refused("absent", "target_unanchored"));
  // Case and spacing are not a difference.
  const exact = page("/toolbar", [button("save", "  SAVE   changes ", { landmark: "main" })]);
  assert.equal(validateWebRuntimeTargetOverrideEvidence(exact.evidence, override("target.1"), recorded, exact.selectors).status, "resolved");
});

test("the one control of its kind in the recorded form stands in for a renamed one, and two do not", () => {
  const form = { formId: "settings-form", heading: "General" };
  const alone = page("/settings", [button("apply", "Apply changes", form, { type: "submit" }), button("reset", "Discard changes", form, { type: "reset" })]);
  assert.equal(validateWebRuntimeTargetOverrideEvidence(alone.evidence, override(handleOf(alone.evidence, (element) => element.name === "Apply changes")), click(RECORDED_SAVE), alone.selectors).status, "resolved");

  const two = page("/settings", [button("apply", "Apply changes", form, { type: "submit" }), button("draft", "Keep as draft", form, { type: "submit" })]);
  for (const name of ["Apply changes", "Keep as draft"]) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(two.evidence, override(handleOf(two.evidence, (element) => element.name === name)), click(RECORDED_SAVE), two.selectors), refused("absent", "target_unanchored"), name);
  }
  // Another form's only submit is not in the recorded one.
  const elsewhere = page("/settings", [button("apply", "Apply changes", { formId: "billing-form" }, { type: "submit" })]);
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(elsewhere.evidence, override("target.1"), click(RECORDED_SAVE), elsewhere.selectors), refused("absent", "target_unanchored"));
});

test("a control that joins another action to the recorded one is a different action, even in the recorded form", () => {
  const form = { formId: "settings-form", heading: "General" };
  for (const label of ["Save changes and exit", "Save & close", "Save changes then publish", "Apply and close", "Save + continue"]) {
    const { evidence, selectors } = page("/settings", [button("other", label, form)]);
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.1"), click(RECORDED_SAVE), selectors), refused("absent", "target_not_equivalent"), label);
  }
  // A recorded control that already joined two keeps its own name.
  const { evidence, selectors } = page("/settings", [button("other", "Save and close", form)]);
  const recordedCompound = click(button("save-close", "Save and close", form));
  assert.equal(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.1"), recordedCompound, selectors).status, "resolved");
});

// order-operations-repair-relabelled-dispatch (live, 2026-09-21): the recorded
// "Dispatch run" was redesigned as "Pick and pack". The conjunction alone used
// to refuse it as a second action. A conjunction joins another action to the
// recorded one only where the recorded action is one of its parts; a name that
// shares none is one control's name, and is judged by what anchors it.
test("a conjunction inside one control's name is not a second action; the recorded action with another joined still is", () => {
  const header = { landmark: "banner", heading: "Orders" };
  const recordedDispatch = click(button("dispatch-run", "Dispatch run", header, { type: "button" }));
  const renamed = page("/orders", [button("pick", "Pick and pack", header, { type: "button" }), button("export", "Export", header, { type: "button" })]);
  const pick = validateWebRuntimeTargetOverrideEvidence(renamed.evidence, override(handleOf(renamed.evidence, (element) => element.name === "Pick and pack")), recordedDispatch, renamed.selectors);
  // One action: what refuses it now is that nothing on the page ties it to the
  // recording -- not a test id, not its name, not a form -- which is the truth.
  assert.deepEqual(pick, refused("absent", "target_unanchored"));

  // The recorded action with another joined to it is still two, whichever side
  // the recorded action is on, and whether the recording's name was cut or kept.
  for (const label of ["Dispatch run and export", "Export and dispatch run", "Dispatch and export", "Dispatch run then print labels"]) {
    const joined = page("/orders", [button("joined", label, header, { type: "button" })]);
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(joined.evidence, override("target.1"), recordedDispatch, joined.selectors), refused("absent", "target_not_equivalent"), label);
  }

  // A compound name that is the recorded compound name, or it shortened, is the recorded control.
  const recordedCompound = click(button("pick-pack", "Pick and pack orders", header, { type: "button" }));
  const shortened = page("/orders", [button("pick", "Pick and pack", header, { type: "button" })]);
  assert.equal(validateWebRuntimeTargetOverrideEvidence(shortened.evidence, override("target.1"), recordedCompound, shortened.selectors).status, "resolved");
});

test("a reset is not a submit, a link is not a button, and one kind of text field is not another", () => {
  const form = { formId: "settings-form" };
  const cases: Array<[string, Element, AutomationStudioRuntimeTargetOverrideFailedAction]> = [
    ["a reset for a submit", button("save", "Save changes", form, { type: "reset" }), click(RECORDED_SAVE)],
    ["a link for a button", { tagName: "a", selector: "#save", href: "http://127.0.0.1:4173/saved", text: "Save changes", accessibleName: "Save changes", context: form }, click(RECORDED_SAVE)],
    ["a checkbox for a button", { tagName: "input", selector: "#save", inputType: "checkbox", accessibleName: "Save changes", context: form, attributes: { type: "checkbox" } }, click(RECORDED_SAVE)],
    ["an email field for a text field", { tagName: "input", selector: "#name", inputType: "email", accessibleName: "Name", context: form, attributes: { type: "email" } }, type({ tagName: "input", inputType: "text", accessibleName: "Name", context: form })],
    ["a field with an explicit role for another", { tagName: "div", selector: "#save", role: "switch", accessibleName: "Save changes", context: form }, click(RECORDED_SAVE)]
  ];
  for (const [label, element, failedAction] of cases) {
    const { evidence, selectors } = page("/settings", [element]);
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.1"), failedAction, selectors), refused("absent", "target_not_equivalent"), label);
  }
});

test("a button whose type the recording did not keep is compared as either kind of button", () => {
  // A created node's element carries no attributes, so a reset it names is
  // still the reset the model was shown.
  const { evidence, selectors } = page("/settings", [button("reset", "Discard changes", { formId: "settings-form" }, { type: "reset" })]);
  const created = click({ tagName: "button", accessibleName: "Discard changes", context: { formId: "settings-form" } });
  assert.equal(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.1"), created, selectors).status, "resolved");
});

test("twins that differ only by their place in a list are indistinguishable, even named as recorded", () => {
  const row = (index: number): Element => ({
    tagName: "button", selector: `li:nth-child(${index}) button`, text: "Add to cart", visibleText: "Add to cart", accessibleName: "Add to cart",
    implicitRole: "button", context: { landmark: "main", listPosition: { index, total: 2 } }, attributes: {}
  });
  const { evidence, selectors } = page("/catalogue", [row(1), row(2)]);
  const recorded = click(button("add-to-cart", "Add to cart", { landmark: "main", listPosition: { index: 2, total: 2 } }));
  for (const handle of ["target.1", "target.2"]) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override(handle), recorded, selectors), refused("ambiguous", "target_indistinguishable"), handle);
  }
});

test("a node that was repaired is judged against its repair, not its recording", () => {
  const { evidence, selectors } = page("/settings", [button("apply", "Apply changes", { landmark: "main" }, { type: "submit" })]);
  const recordedOnly = click(RECORDED_SAVE);
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.1"), recordedOnly, selectors), refused("absent", "target_unanchored"));
  const repaired: AutomationStudioRuntimeTargetOverrideFailedAction = {
    ...recordedOnly,
    recordedTarget: {
      element: RECORDED_SAVE,
      target: { handles: { element: "target.2" }, handleResolution: "named", tagName: "button", accessibleName: "Apply changes", metadata: { controlType: "submit", formId: "settings-form" } }
    }
  };
  assert.equal(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.1"), repaired, selectors).status, "resolved");
});

test("a name the packet cut at its bound is not compared as the whole name", () => {
  const long = `Save ${"x".repeat(400)}`;
  const { evidence, selectors } = page("/settings", [button("save", long, { landmark: "main" })]);
  assert.equal(evidence.elements[0]?.name?.length, 300);
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.1"), click(button("save", long, { landmark: "main" })), selectors), refused("absent", "target_unanchored"));
});

test("refuses every repair when nothing says what the failed action addressed", () => {
  const { evidence, selectors } = page("/settings", [button("save", "Save changes", { formId: "settings-form" }, { type: "submit" })]);
  const unknown = refused("absent", "recorded_target_unknown");
  const identities: AutomationStudioRuntimeTargetOverrideFailedAction[] = [
    { nodeId: "save", definitionId: "web.output.dom-click" },
    { nodeId: "save", definitionId: "web.output.dom-click", recordedTarget: {} },
    // A location is not an identity.
    { nodeId: "save", definitionId: "web.output.dom-click", recordedTarget: { element: { selector: "#save" }, target: { selector: "#save" } } }
  ];
  for (const failedAction of identities) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.1"), failedAction, selectors), unknown, JSON.stringify(failedAction));
  }
  // What the target says is still judged first: an invented handle is refused as one.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, override("target.9"), identities[0]!, selectors), refused("absent", "handle_not_issued"));
});
