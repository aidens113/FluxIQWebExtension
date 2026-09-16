import assert from "node:assert/strict";
import test from "node:test";
import { sanitizeWebLlmSnapshot, validateWebRuntimeTargetOverrideEvidence } from "..";
import { sanitizeWebLlmSnapshotWithBindings } from "../sanitize";
import type { AutomationStudioRuntimeTargetOverrideTarget } from "fluxiq/automation-studio";

const target = (handles: Record<string, string>): AutomationStudioRuntimeTargetOverrideTarget => ({ handles });

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
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type" };

  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.1" }), typeAction, selectors), {
    status: "resolved",
    target: {
      handles: { element: "target.1" },
      handleResolution: "named",
      tagName: "textarea",
      accessibleName: "Name",
      selector: "#name",
    },
  });

  // The identity is the name, the role and the tag. The selector is carried as
  // one more signal, which is what makes this a repair that survives a page
  // renumbering its DOM rather than a selector swap under a new name.
  const resolved = validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.3" }), { nodeId: "submit", definitionId: "web.output.dom-click" }, selectors);
  assert.equal(resolved.status, "resolved");
  assert.deepEqual(resolved.status === "resolved" ? resolved.target : undefined, {
    handles: { element: "target.3" },
    handleResolution: "named",
    tagName: "button",
    accessibleName: "Unique",
    selector: "#unique",
  });
});

test("falls back to the only compatible element when the handle is wrong, and says it did", () => {
  const { evidence, selectors } = formBinding();
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type" };
  // `target.2` is the select: a real handle, but not one typing can use.
  const wrongKind = validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.2" }), typeAction, selectors);
  assert.deepEqual(wrongKind, {
    status: "resolved",
    target: {
      handles: { element: "target.1" },
      handleResolution: "inferred",
      tagName: "textarea",
      accessibleName: "Name",
      selector: "#name",
      proposedHandles: { element: "target.2" },
    },
  });
});

test("a string that is a valid CSS selector is just an unminted handle: it never addresses the page", () => {
  // `p.decoy` is the exact selector of the second element, and `span` matches
  // the third. Handed back as handles, neither addresses the element it names:
  // a handle is only a key in the map this domain minted, and those two are not
  // in it. The repair lands on the one clickable element instead, and says so.
  const { evidence, selectors } = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/form",
    interactiveElements: [
      { tagName: "button", selector: "#wanted", name: "Wanted" },
      { tagName: "p", selector: "p.decoy", name: "Decoy" },
      { tagName: "span", selector: "span", name: "Other" },
    ],
  });
  const clickAction = { nodeId: "submit", definitionId: "web.output.dom-click" };
  for (const invented of ["p.decoy", "span", "wanted", "button", "div.btn", "b2"]) {
    const validation = validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: invented }), clickAction, selectors);
    assert.equal(validation.status, "resolved", invented);
    const resolvedTarget = validation.status === "resolved" ? validation.target : undefined;
    assert.deepEqual(resolvedTarget?.handles, { element: "target.1" }, invented);
    assert.equal(resolvedTarget?.handleResolution, "inferred", invented);
    assert.equal(resolvedTarget?.selector, "#wanted", invented);
  }
});

test("refuses a parameter the action never declared, and an action with no repairable parameters", () => {
  const { evidence, selectors } = formBinding();
  const clickAction = { nodeId: "submit", definitionId: "web.output.dom-click" };
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ item: "target.3" }), clickAction, selectors), { status: "absent" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.3", extra: "target.1" }), clickAction, selectors), { status: "absent" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.3" }), { nodeId: "n", definitionId: "web.output.browser-navigate" }, selectors), { status: "absent" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, { handles: {} } as AutomationStudioRuntimeTargetOverrideTarget, clickAction, selectors), { status: "absent" });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, {} as AutomationStudioRuntimeTargetOverrideTarget, clickAction, selectors), { status: "absent" });
});

test("without the binding the repair is fingerprint-only, which is weaker rather than wrong", () => {
  const { evidence } = formBinding();
  // A packet that outlived the binding that issued its handles -- reloaded from
  // a stored run, say. It still names what the element is and what it is called,
  // which is what Core's matcher weights highest; it just cannot add the hint.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.1" }), { nodeId: "name", definitionId: "web.output.dom-type" }), {
    status: "resolved",
    target: { handles: { element: "target.1" }, handleResolution: "named", tagName: "textarea", accessibleName: "Name" },
  });
});

test("refuses a repair when nothing compatible was described, and refuses to guess between several", () => {
  const typeAction = { nodeId: "name", definitionId: "web.output.dom-type" };
  const noTypeable = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "select", selector: "#plan" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(noTypeable, target({ element: "target.9" }), typeAction), { status: "absent" });
  const twoTypeable = sanitizeWebLlmSnapshot({ url: "https://example.test/form", interactiveElements: [{ tagName: "input", selector: "#first" }, { tagName: "textarea", selector: "#second" }] });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(twoTypeable, target({ element: "target.9" }), typeAction), { status: "ambiguous" });
});

test("carries a child-frame element's frame beside the selector that works inside it", () => {
  const { evidence, selectors } = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/checkout",
    interactiveElements: [
      { tagName: "input", selector: "frame[3] >> #card-name", name: "Name on card", attributes: { "data-fluxiq-frame-id": "3" } },
    ],
  });
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ element: "target.1" }), { nodeId: "card", definitionId: "web.output.dom-type" }, selectors), {
    status: "resolved",
    target: {
      handles: { element: "target.1" },
      handleResolution: "named",
      tagName: "input",
      accessibleName: "Name on card",
      selector: "#card-name",
      metadata: { browserFrameId: 3 },
    },
  });
});

test("a list extraction repairs its row and its fields through the same contract", () => {
  const { evidence, selectors } = sanitizeWebLlmSnapshotWithBindings({
    url: "https://example.test/catalogue",
    interactiveElements: [
      { tagName: "a", selector: ".row:nth-child(1)", name: "Widget", context: { listPosition: { index: 1, total: 2 } } },
      { tagName: "span", selector: ".row:nth-child(1) .price", name: "10.00" },
    ],
  });
  const extraction = { nodeId: "rows", definitionId: "web.output.dom-extract_list" };
  const validation = validateWebRuntimeTargetOverrideEvidence(evidence, target({ item: "target.1", "field.price": "target.2" }), extraction, selectors);
  assert.equal(validation.status, "resolved");
  const resolvedTarget = validation.status === "resolved" ? validation.target : undefined;
  assert.deepEqual(resolvedTarget?.handles, { item: "target.1", "field.price": "target.2" });
  assert.equal(resolvedTarget?.handleResolution, "named");
  // More than one parameter, so the fingerprints are keyed rather than flat.
  assert.equal(resolvedTarget?.selector, undefined);
  assert.deepEqual(resolvedTarget?.targets, {
    item: { tagName: "a", accessibleName: "Widget", selector: ".row:nth-child(1)", metadata: { listIndex: 1, listTotal: 2 } },
    "field.price": { tagName: "span", accessibleName: "10.00", selector: ".row:nth-child(1) .price" },
  });
  // The row must be something the capture reported a list position for. An
  // extraction never takes the flat form, whatever its parameter count: its
  // parameters are not the node's `target`, so keying them is the only shape
  // that says which fingerprint repairs which.
  assert.deepEqual(validateWebRuntimeTargetOverrideEvidence(evidence, target({ item: "target.2" }), extraction, selectors), {
    status: "resolved",
    target: {
      handles: { item: "target.1" },
      handleResolution: "inferred",
      targets: { item: { tagName: "a", accessibleName: "Widget", selector: ".row:nth-child(1)", metadata: { listIndex: 1, listTotal: 2 } } },
      proposedHandles: { item: "target.2" },
    },
  });
});
