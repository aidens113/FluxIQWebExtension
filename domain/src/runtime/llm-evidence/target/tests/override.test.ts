import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot, validateWebRuntimeTargetOverrideEvidence } from "../..";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";
import type { AutomationStudioRuntimeTargetOverrideTarget } from "fluxiq/automation-studio";

const target = (handles: Record<string, string>): AutomationStudioRuntimeTargetOverrideTarget => ({ handles });
const NOT_REPAIRABLE = { status: "absent", reason: "action_not_repairable" } as const;

/**
 * What the failed node addressed, which Core passes beside its identity: the
 * check has to know the recorded control to tell a renamed one from another
 * one. `tests/target-equivalence.test.ts` drives that judgement; here it is
 * the control each fixture's action was recorded against, so these stay about
 * the handle.
 */
const recordedName = (tagName: string, accessibleName: string) => ({ element: { tagName, accessibleName } });

// The packet and the binding behind it. The packet is what a model reads and
// has carried no selector since `.v2`; the binding is what the domain kept, and
// is what puts the selector hint back into a resolved repair.
const formBinding = (): ReturnType<typeof sanitizeWebLlmSnapshotWithBindings> => sanitizeWebLlmSnapshotWithBindings({
  url: "https://example.test/form",
  interactiveElements: [
    { tagName: "textarea", selector: "#name", name: "Name" },
    { tagName: "select", selector: "#plan", name: "Plan", options: [{ value: "team", label: "Team" }] },
    { tagName: "button", selector: "#unique", name: "Unique" },
  ],
});

test("resolves a repair from the opaque handle the model was shown, fingerprint first", () => {
  const { evidence, selectors } = formBinding();
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type", recordedTarget: recordedName("textarea", "Name") };

  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t1" }), typeAction, selectors), {
    status: "resolved",
    target: {
      handles: { element: "t1" },
      handleResolution: "named",
      tagName: "textarea",
      accessibleName: "Name",
      selector: "#name",
    },
    // What the repair names, for a permission request: the name as the packet
    // printed it, and one plain word for what it is.
    control: { name: "Name", kind: "textarea" },
  });

  // The identity is the name, the role and the tag. The selector is carried as
  // one more signal, which is what makes this a repair that survives a page
  // renumbering its DOM rather than a selector swap under a new name.
  const resolved = validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t3" }), { nodeId: "submit", definitionId: "web.output.dom-click", recordedTarget: recordedName("button", "Unique") }, selectors);
  assert.equal(resolved.status, "resolved");
  assert.deepEqual(resolved.status === "resolved" ? resolved.target : undefined, {
    handles: { element: "t3" },
    handleResolution: "named",
    tagName: "button",
    accessibleName: "Unique",
    selector: "#unique",
  });
});

// Nothing stands in for a handle that did not stand. The single compatible
// element used to, which made the domain the author of a repair the model
// never proposed: the customer search for a revenue field the page no longer
// had (`run-mu4ybggw-b8a18765`, live repair campaign 2026-09-17).
test("refuses a handle the verb cannot use rather than putting the one compatible element in its place", () => {
  const { evidence, selectors } = formBinding();
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type", recordedTarget: recordedName("textarea", "Name") };
  // `t2` is the select: a real handle, but not one typing can use, and
  // the textarea beside it is not what the model asked for.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t2" }), typeAction, selectors), { status: "absent", reason: "handle_incompatible" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t9" }), typeAction, selectors), { status: "absent", reason: "handle_not_issued" });
});

test("a string that is a valid CSS selector is just an unminted handle: it never addresses the page", () => {
  // `p.decoy` is the exact selector of the second element, and `span` matches
  // the third. Handed back as handles, neither addresses the element it names:
  // a handle is only a key in the map this domain minted, and those two are not
  // in it. None of them is a repair, and the one clickable element is not
  // offered up in their place.
  const { evidence, selectors } = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "button", selector: "#wanted", name: "Wanted" },
      { tagName: "p", selector: "p.decoy", name: "Decoy" },
      { tagName: "span", selector: "span", name: "Other" },
    ],
  });
  const clickAction = { nodeId: "submit", definitionId: "web.output.dom-click", recordedTarget: recordedName("button", "Wanted") };
  for (const invented of ["p.decoy", "span", "wanted", "button", "div.btn", "b2"]) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: invented }), clickAction, selectors), { status: "absent", reason: "handle_not_issued" }, invented);
  }
});

// Every refusal names which case it was, in Core's closed vocabulary. A bare
// `absent` described an invented parameter, a handle never shown and an action
// the domain cannot repair in the same word, and a refused live repair could
// not say which (`run-mu4rpka7-845d919a`).
test("refuses a parameter the action never declared, as not offered", () => {
  const { evidence, selectors } = formBinding();
  const clickAction = { nodeId: "submit", definitionId: "web.output.dom-click", recordedTarget: recordedName("button", "Unique") };
  const notOffered = { status: "absent", reason: "parameter_not_offered" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ item: "t3" }), clickAction, selectors), notOffered);
  // Beside the right one, too: the model was working from something it was not shown.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t3", extra: "t1" }), clickAction, selectors), notOffered);
});

test("refuses a handle map that names no parameter, as a required one missing", () => {
  const { evidence, selectors } = formBinding();
  const clickAction = { nodeId: "submit", definitionId: "web.output.dom-click", recordedTarget: recordedName("button", "Unique") };
  assert.deepEqual(
    validateWebRuntimeTargetOverrideEvidence(evidence, { handles: {} } as AutomationStudioRuntimeTargetOverrideTarget, clickAction, selectors),
    { status: "absent", reason: "parameter_missing" }
  );
});

test("refuses a target that is not a map of parameters to handles, as malformed", () => {
  const { evidence, selectors } = formBinding();
  const clickAction = { nodeId: "submit", definitionId: "web.output.dom-click", recordedTarget: recordedName("button", "Unique") };
  const malformed = { status: "absent", reason: "target_malformed" };
  const targets: unknown[] = [
    {},
    { handles: [] },
    { handles: "t3" },
    { handles: { element: 3 } },
    { handles: { element: "" } },
    { selector: "#unique" },
  ];
  for (const candidate of targets) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, candidate as AutomationStudioRuntimeTargetOverrideTarget, clickAction, selectors), malformed, JSON.stringify(candidate));
  }
});

test("refuses a handle the packet issued twice, as ambiguous", () => {
  const { evidence, selectors } = formBinding();
  // Only a packet that was altered after it was issued can name one handle twice.
  const doubled = { ...evidence, elements: [...evidence.elements, { ...evidence.elements[2]!, name: "Other" }] };
  assert.deepEqual(
    validateWebRuntimeTargetOverrideEvidence(doubled, target({ element: "t3" }), { nodeId: "submit", definitionId: "web.output.dom-click", recordedTarget: recordedName("button", "Unique") }, selectors),
    { status: "ambiguous", reason: "handle_ambiguous" }
  );
});

test("refuses a handle naming something the verb cannot use, and one the packet never issued, by name", () => {
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type", recordedTarget: recordedName("textarea", "Name") };
  const page = sanitizeWebLlmSnapshot({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "input", selector: "#first", name: "First" },
      { tagName: "textarea", selector: "#second", name: "Second" },
      { tagName: "button", selector: "#go", name: "Go" },
    ],
  });
  // `t3` is real, and it is a button: typing cannot use it.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(page, target({ element: "t3" }), typeAction), { status: "absent", reason: "handle_incompatible" });
  // A handle the packet never issued, on the same page.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(page, target({ element: "t9" }), typeAction), { status: "absent", reason: "handle_not_issued" });
});

test("an action with nothing to re-point says so in Core's word, whatever the target names", () => {
  const { evidence, selectors } = formBinding();
  const navigate = { nodeId: "n", definitionId: "web.output.browser-navigate", recordedTarget: recordedName("a", "Next") };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t3" }), navigate, selectors), NOT_REPAIRABLE);
  // The action is judged before the target is read, so a malformed one gets the same answer.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, {} as AutomationStudioRuntimeTargetOverrideTarget, navigate, selectors), NOT_REPAIRABLE);
});

// A recorded action is a `builtin.policy.action` node whatever it does, so the
// verb that failed is the output it dispatches, which Core passes as
// `outputId`. Read from the definition id alone, every recorded Flow's repair
// was refused -- the live repair lane's included.
test("a recorded action is repaired as the verb its output names", () => {
  const { evidence, selectors } = formBinding();
  const recordedClick = { nodeId: "save", definitionId: "builtin.policy.action", outputId: "web.dom.click", recordedTarget: recordedName("button", "Unique") };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t3" }), recordedClick, selectors), {
    status: "resolved",
    target: { handles: { element: "t3" }, handleResolution: "named", tagName: "button", accessibleName: "Unique", selector: "#unique" },
    control: { name: "Unique", kind: "button" },
  });
  // The output decides the role: a recorded type cannot land on the button it
  // was pointed at, and nothing else is put there for it.
  const recordedType = { nodeId: "name", definitionId: "builtin.policy.action", outputId: "web.dom.type", recordedTarget: recordedName("textarea", "Name") };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t3" }), recordedType, selectors), { status: "absent", reason: "handle_incompatible" });
  // A created node names its output as well, and the two agree.
  const createdClick = { nodeId: "submit", definitionId: "web.output.dom-click", outputId: "web.dom.click", recordedTarget: recordedName("button", "Unique") };
  assert.equal(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t3" }), createdClick, selectors).status, "resolved");
});

test("a failed action whose output names no repairable web verb, or contradicts its node, is refused", () => {
  const { evidence, selectors } = formBinding();
  const refusedIdentities = [
    // A recorded action Core could name no output for says nothing about its verb.
    { nodeId: "save", definitionId: "builtin.policy.action" },
    { nodeId: "save", definitionId: "builtin.policy.action", outputId: "vendor.output.press" },
    { nodeId: "save", definitionId: "builtin.policy.action", outputId: "web.browser.navigate" },
    // A node definition id is not an output id.
    { nodeId: "save", definitionId: "builtin.policy.action", outputId: "web.output.dom-click" },
    // A web output node whose output id names another verb.
    { nodeId: "submit", definitionId: "web.output.dom-click", outputId: "web.dom.type" },
    // A node that is neither a recorded action nor that output's own node.
    { nodeId: "ask", definitionId: "builtin.llm.prompt", outputId: "web.dom.click" },
  ];
  for (const failedAction of refusedIdentities) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t3" }), failedAction, selectors), NOT_REPAIRABLE, JSON.stringify(failedAction));
  }
});

test("without the binding the repair is fingerprint-only, which is weaker rather than wrong", () => {
  const { evidence } = formBinding();
  // A packet that outlived the binding that issued its handles -- reloaded from
  // a stored run, say. It still names what the element is and what it is called,
  // which is what Core's matcher weights highest; it just cannot add the hint.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t1" }), { nodeId: "name", definitionId: "web.output.dom-type", recordedTarget: recordedName("textarea", "Name") }), {
    status: "resolved",
    target: { handles: { element: "t1" }, handleResolution: "named", tagName: "textarea", accessibleName: "Name" },
    control: { name: "Name", kind: "textarea" },
  });
});

test("refuses a repair when nothing compatible was described, and says so rather than naming a handle", () => {
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type", recordedTarget: recordedName("textarea", "Name") };
  const noTypeable = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "select", selector: "#plan" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(noTypeable, target({ element: "t9" }), typeAction), { status: "absent", reason: "no_compatible_element" });
  // Named, and still nothing: the select is real but typing cannot use it.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(noTypeable, target({ element: "t1" }), typeAction), { status: "absent", reason: "no_compatible_element" });
  const twoTypeable = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "input", selector: "#first" }, { tagName: "textarea", selector: "#second" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(twoTypeable, target({ element: "t9" }), typeAction), { status: "absent", reason: "handle_not_issued" });
});

test("carries a child-frame element's frame beside the selector that works inside it", () => {
  const { evidence, selectors } = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/checkout",
    interactiveElements: [
      { tagName: "input", selector: "frame[3] >> #card-name", name: "Name on card", attributes: { "data-fluxiq-frame-id": "3" } },
    ],
  });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t1" }), { nodeId: "card", definitionId: "web.output.dom-type", recordedTarget: recordedName("input", "Name on card") }, selectors), {
    status: "resolved",
    target: {
      handles: { element: "t1" },
      handleResolution: "named",
      tagName: "input",
      accessibleName: "Name on card",
      selector: "#card-name",
      metadata: { browserFrameId: 3 },
    },
    control: { name: "Name on card", kind: "input" },
  });
});

// A catalogue page: a row the capture reported a list position for, and a
// price inside it. Everything a list extraction's repair used to name.
const catalogueBinding = (): ReturnType<typeof sanitizeWebLlmSnapshotWithBindings> => sanitizeWebLlmSnapshotWithBindings({
  url: "https://example.test/catalogue",
  interactiveElements: [
    { tagName: "a", selector: ".row:nth-child(1)", name: "Widget", context: { listPosition: { index: 1, total: 2 } } },
    { tagName: "span", selector: ".row:nth-child(1) .price", name: "10.00" },
  ],
});

// D-4. A list extraction's repair used to resolve its row and fields to a keyed
// map of fingerprints, which Core saved into the node's `target` -- and the
// extract node never reads `target`: it reads its `extractList` request. The
// repair was "applied" and the run went exactly as before. Until an extraction
// is repaired by re-issuing that request, it is refused outright instead.
test("a list extraction is refused as not repairable, whatever it names, before any handle is resolved", () => {
  const { evidence, selectors } = catalogueBinding();
  const extraction = { nodeId: "rows", definitionId: "web.output.dom-extract_list", recordedTarget: recordedName("a", "Widget") };
  const proposals: Array<Record<string, string>> = [
    { item: "t1", "field.price": "t2" },
    { item: "t1" },
    { item: "t2" },
    { "field.price": "t2" },
    { element: "t1" },
  ];
  for (const handles of proposals) {
    assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target(handles), extraction, selectors), NOT_REPAIRABLE, JSON.stringify(handles));
  }
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, {} as AutomationStudioRuntimeTargetOverrideTarget, extraction, selectors), NOT_REPAIRABLE);
  // A recorded extraction names its verb only through the output it
  // dispatches, and a created one names it on both sides. Each is refused the
  // same way, whatever the target names.
  const identities = [
    { nodeId: "rows", definitionId: "builtin.policy.action", outputId: "web.dom.extract_list" },
    { nodeId: "rows", definitionId: "web.output.dom-extract_list", outputId: "web.dom.extract_list" },
    // An extraction node whose output id claims a click is a contradiction, not a click.
    { nodeId: "rows", definitionId: "web.output.dom-extract_list", outputId: "web.dom.click" },
  ];
  for (const failedAction of identities) {
    for (const handles of [{ item: "t1" }, { element: "t1" }]) {
      assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target(handles), failedAction, selectors), NOT_REPAIRABLE, `${JSON.stringify(failedAction)} ${JSON.stringify(handles)}`);
    }
  }
});

test("a click on a list row still resolves flat, with the row's position as metadata", () => {
  const { evidence, selectors } = catalogueBinding();
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t1" }), { nodeId: "open", definitionId: "web.output.dom-click", recordedTarget: recordedName("a", "Widget") }, selectors), {
    status: "resolved",
    target: {
      handles: { element: "t1" },
      handleResolution: "named",
      tagName: "a",
      accessibleName: "Widget",
      selector: ".row:nth-child(1)",
      metadata: { listIndex: 1, listTotal: 2 },
    },
    control: { name: "Widget", kind: "link" },
  });
});

// -- The full fingerprint, and the save-time guard (t425) ---------------------
// A repair is saved onto the Flow (`edit_action_target`), so it carries every
// signal the packet published for its control -- not four of them -- and a
// control it could find by one attribute alone is refused.

test("a repair carries every signal the packet published for its control, and never its contents", () => {
  const { evidence, selectors } = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/item",
    interactiveElements: [
      {
        tagName: "input",
        selector: "#fb8y7yz1",
        inputType: "text",
        label: "Quantity",
        value: "1",
        attributes: { id: "fb8y7yz1", class: "qty-input form-control", type: "text", inputmode: "numeric", name: "qty", "data-testid": "quantity", value: "1", style: "width: 3em" },
      },
    ],
  });
  const typeAction = { nodeId: "quantity", definitionId: "web.output.dom-type", recordedTarget: { element: { tagName: "input", label: "Quantity", selector: "#fb1l6ufkg" } } };
  const resolved = validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t1" }), typeAction, selectors);
  assert.equal(resolved.status, "resolved", JSON.stringify(resolved));
  const repaired = resolved.status === "resolved" ? resolved.target as Record<string, unknown> : {};
  assert.equal(repaired.label, "Quantity");
  assert.equal(repaired.id, "fb8y7yz1");
  assert.equal(repaired.name, "qty");
  assert.equal(repaired.testId, "quantity");
  assert.deepEqual(repaired.classNames, ["qty-input", "form-control"]);
  assert.equal(repaired.inputType, undefined, "a text field's default type is no signal; the packet leaves it out");
  assert.equal(repaired.selector, "#fb8y7yz1");
  // The identifying attributes only, in the builder's one list: never the box's value, its input mode or a style.
  assert.deepEqual(repaired.attributes, { name: "qty", "data-testid": "quantity" });
  assert.equal(JSON.stringify(repaired).includes("\"1\""), false, "what the box holds is not its identity");
});

test("a repair to a control found by one attribute alone is refused as one that cannot be told apart", () => {
  // A wordless button known only by the id its selector is addressed through.
  // It is the one button of the form the recording's was in, so the repair is
  // anchored (`./equivalence.ts`) -- and would still be found by that id alone.
  const { evidence, selectors } = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/promo",
    interactiveElements: [{ tagName: "button", selector: "#x9k2", attributes: { id: "x9k2" }, context: { formId: "promo" }, hasClickHandler: true }],
  });
  const clickAction = { nodeId: "dismiss", definitionId: "web.output.dom-click", recordedTarget: { element: { tagName: "button", id: "x9k2", selector: "#x9k2", context: { formId: "promo" } } } };
  const verdict = validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "t1" }), clickAction, selectors);
  assert.deepEqual(verdict, { status: "ambiguous", reason: "target_indistinguishable" });

  // The same button with its words is the same repair, and is saved.
  const named = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/promo",
    interactiveElements: [{ tagName: "button", selector: "#x9k2", visibleText: "No thanks", attributes: { id: "x9k2" }, context: { formId: "promo" }, hasClickHandler: true }],
  });
  assert.equal(validateWebRuntimeTargetOverrideEvidence(named.evidence, target({ element: "t1" }), clickAction, named.selectors).status, "resolved");
});
