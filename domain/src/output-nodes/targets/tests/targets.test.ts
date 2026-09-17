// T1 coverage of the identity signals a target carries.
//
// `testId`, `accessibleName` and `label` are Core's element-fingerprint
// signals by name (`fingerprinting/element-fingerprint.ts`), and among its
// highest weighted: `testId` 28, `accessibleName` 24, `label` 20, against 14
// for a selector. A target that omits them can only be matched on its selector
// and text, which is what makes a superficial DOM change break a workflow.

import assert from "node:assert/strict";
import test from "node:test";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputPayload } from "../..";
import { adaptedTargetSupersedesRecording, elementFingerprint, outputTargetFromPayload } from "../targets";

test("identity signals are read from the descriptor's own fields", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    tagName: "button",
    testId: "save-button",
    accessibleName: "Save changes",
    label: "Save"
  });
  assert.equal(fingerprint?.testId, "save-button");
  assert.equal(fingerprint?.accessibleName, "Save changes");
  assert.equal(fingerprint?.label, "Save");
});

test("a recording made before the producer emitted the fields still resolves them from attributes", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    tagName: "button",
    attributes: { "data-testid": "save-button", "aria-label": "Save changes" }
  });
  assert.equal(fingerprint?.testId, "save-button");
  assert.equal(fingerprint?.accessibleName, "Save changes");
});

test("the test id falls back through the attribute names the selector prefers", () => {
  assert.equal(elementFingerprint({ selector: "#a", attributes: { "data-test": "alpha" } })?.testId, "alpha");
  assert.equal(elementFingerprint({ selector: "#a", attributes: { "data-cy": "beta" } })?.testId, "beta");
  // The element's own field wins over any attribute.
  assert.equal(elementFingerprint({ selector: "#a", testId: "own", attributes: { "data-testid": "attribute" } })?.testId, "own");
});

test("an element with no identity signals gains no empty ones", () => {
  const fingerprint = elementFingerprint({ selector: "#plain", tagName: "div" });
  assert.deepEqual(fingerprint, { selector: "#plain", tagName: "div" });
});

test("the signals survive into the dispatched target", () => {
  const target = outputTargetFromPayload({
    selector: "#save",
    element: { selector: "#save", tagName: "button", testId: "save-button", accessibleName: "Save changes" }
  });
  assert.equal((target?.element as { testId?: string }).testId, "save-button");
  assert.equal((target?.element as { accessibleName?: string }).accessibleName, "Save changes");
});

// Which element identity the wire target carries, once Core has had the
// parameters.
//
// `prepareElementTargetAction` (`runtime/io-policy.ts`) runs on every policy
// output dispatch and rewrites `parameters.target`. Whether that rewrite is an
// improvement or a loss depends on whether Core matched a runtime candidate,
// and `selectedCandidate` is the only thing that says which happened. The three
// tests below are the three states a dispatch can be in; the rule is the one
// `client/gateway-mapping.ts` applies to the declared `command.element`, so the
// two ends of a dispatch describe the same element.

/** Everything the recorder captures for a well-described control. */
const recordedElement = {
  selector: "#save-settings",
  xpath: "/html/body/main/form/button",
  tagName: "button",
  id: "save-settings",
  text: "Save changes",
  testId: "save-changes",
  accessibleName: "Save changes",
  label: "Save",
  visibleText: "Save changes",
  implicitRole: "button",
  classNames: ["btn", "btn-primary"],
  attributes: { id: "save-settings", "data-testid": "save-changes" }
};

const signalCount = (target: ReturnType<typeof outputTargetFromPayload>): number => Object.keys((target?.element ?? {}) as object).length;

test("Core passed the target through untouched: the recorded identity is the dispatched one", () => {
  const target = outputTargetFromPayload({ selector: "#save-settings", element: recordedElement });
  assert.equal(signalCount(target), 12);
  assert.equal((target?.element as { testId?: string }).testId, "save-changes");
});

test("Core matched nothing: the recorded identity beats its own lossy re-derivation", () => {
  // Exactly what `normalizeAutomationStudioElementTarget` returns for these
  // parameters, measured by executing it: it reads only the parameters' own
  // top-level keys, never `parameters.element`, so the fingerprint it writes
  // back is two fields and the target carries no `element` at all. Preferring
  // it collapsed the wire target to a bare selector on every dispatch.
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { kind: "element", fingerprint: { selector: "#save-settings", statePath: "web.elements.save.changes" }, source: "runtime" }
  });
  assert.equal(signalCount(target), 12, "all twelve recorded signals reach the wire, not just the selector");
  assert.equal((target?.element as { testId?: string }).testId, "save-changes");
  assert.equal((target?.element as { accessibleName?: string }).accessibleName, "Save changes");
  assert.equal((target?.element as { implicitRole?: string }).implicitRole, "button");
  // Unchanged: the adapted fingerprint still resolves the selector.
  assert.equal(target?.selector, "#save-settings");
});

test("Core matched a candidate: the drift-corrected candidate beats the recorded identity", () => {
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: {
      kind: "element",
      fingerprint: { selector: "#save-settings" },
      candidates: [
        { candidateId: "candidate.stale", selector: "#save-settings-old", tagName: "button" },
        { candidateId: "candidate.current", selector: "#settings-save-v2", tagName: "button", testId: "save-changes", accessibleName: "Save changes" }
      ],
      selectedCandidate: { candidateId: "candidate.current", confidence: 0.91, matchedSignals: ["testId"], failedSignals: ["selector"] }
    }
  });
  assert.equal((target?.element as { selector?: string }).selector, "#settings-save-v2", "the element the page really has, not the one that was recorded");
  assert.equal(target?.selector, "#settings-save-v2");
  // The recorded description is richer but names a control that has moved, so
  // richness must not be the tie-break.
  assert.ok(signalCount(target) < 12);
});

test("Core matched but adapted only the fingerprint: the adaptation is still not discarded", () => {
  // A matched target whose candidate list cannot be resolved — a mapper or
  // operator that rewrote the fingerprint rather than enumerating candidates.
  // The adaptation is newer than the recording, so it wins even though the
  // recording carries four times the signals. Getting this backwards would
  // silently undo drift recovery.
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: {
      kind: "element",
      fingerprint: { selector: "#settings-save-v2", tagName: "button", testId: "save-changes-v2" },
      selectedCandidate: { candidateId: "candidate.current", confidence: 0.88, matchedSignals: ["testId"], failedSignals: [] }
    }
  });
  assert.equal((target?.element as { testId?: string }).testId, "save-changes-v2");
  assert.equal((target?.element as { selector?: string }).selector, "#settings-save-v2");
});

test("an adapted target's own element wins when Core matched, and when it names another control", () => {
  const adaptedElement = { selector: "#settings-save-v2", tagName: "button", testId: "save-changes-v2" };
  const matched = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { element: adaptedElement, selectedCandidate: { candidateId: "candidate.current", confidence: 0.9 } }
  });
  assert.equal((matched?.element as { testId?: string }).testId, "save-changes-v2");
  // No candidate was matched, but the test id is one the recording never held,
  // so this is not a copy of the recording. Until D-1 it lost to the recording,
  // which is how a persisted repair reached the page wearing the stale identity.
  const unmatched = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { element: adaptedElement }
  });
  assert.equal((unmatched?.element as { testId?: string }).testId, "save-changes-v2", "an element the recording never described is an adaptation");
  // A pass-through of the recording's own element is still a re-derivation.
  const passThrough = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { element: { selector: "#save-settings", tagName: "BUTTON", testId: "save-changes", visibleText: " Save changes " } }
  });
  assert.equal(signalCount(passThrough), 12, "the recording's own values, however Core spaced or cased them, keep the richer recording");
});

test("a source with no recognized signal does not shadow one that has them", () => {
  // `elementFingerprint` returns `{}` rather than `undefined` for an object it
  // recognizes nothing in, so without this guard reordering the chain would let
  // an empty recorded element hide a real adapted fingerprint.
  const target = outputTargetFromPayload({
    selector: "#save-settings",
    element: { nothingRecognized: true },
    target: { kind: "element", fingerprint: { selector: "#save-settings", tagName: "button" }, source: "runtime" }
  });
  assert.deepEqual(target?.element, { selector: "#save-settings", tagName: "button" });
});

test("the element ordering does not decide the selector or the emptiness guard", () => {
  // Both are ahead of `element` in their own chains and must be unaffected.
  assert.equal(outputTargetFromPayload({
    selector: "#recorded",
    element: recordedElement,
    target: { kind: "element", fingerprint: { selector: "#adapted" }, source: "runtime" }
  })?.selector, "#adapted");
  assert.equal(outputTargetFromPayload({ element: recordedElement })?.selector, "#save-settings", "an element-only payload still resolves its selector from the element");
  assert.equal(outputTargetFromPayload({ element: { tagName: "button", text: "Save" } }), undefined, "no selector and no visual target is still no target");
});

// --- A persisted repair beats the recorded element (D-1) ---------------------
//
// An applied repair writes the domain's resolution into the node's `target`
// and leaves the recorded `element` beside it. Core then rewrites `target` on
// every dispatch, which drops the `handles` that mark it as a repair. The rows
// below run Core's own normalizer for that step rather than a copy of what it
// returns, because the rule depends on what that step keeps and what it loses.

/** What `validateWebRuntimeTargetOverrideEvidence` resolves the renamed Save to (`renamed-save-override.test.ts`). */
const repairedSave = {
  handles: { element: "target.2" },
  handleResolution: "named",
  tagName: "button",
  accessibleName: "Apply changes",
  selector: "main > form > section:nth-of-type(1) > div > button:nth-of-type(1)",
  metadata: { controlType: "submit", formId: "settings-form" }
};

/** The recorded Save node, as `webAutomationOutputPayload` builds it for a click. */
const recordedNode = (): JsonObject => webAutomationOutputPayload("web.dom.click", {
  element: recordedElement,
  visualTarget: { namespace: "web", statePath: "web.elements.button.save", documentBounds: { x: 10, y: 20, width: 90, height: 30 } }
});

/** `prepareElementTargetAction` with no runtime candidates: `target` normalized, everything else untouched. */
function dispatched(parameters: JsonObject): JsonObject {
  const target = normalizeAutomationStudioElementTarget(parameters.target, { source: "runtime" })
    ?? normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  assert.ok(target, "Core found an element target to prepare");
  return { ...parameters, target: target as unknown as JsonObject };
}

test("an applied repair, as the node stores it, names the element the page is asked for", () => {
  const node = { ...recordedNode(), target: repairedSave };
  assert.equal(adaptedTargetSupersedesRecording(node), true);
  const target = outputTargetFromPayload(node);
  assert.equal(target?.selector, repairedSave.selector);
  assert.deepEqual(target?.element, { selector: repairedSave.selector, tagName: "button", accessibleName: "Apply changes" });
});

test("the same repair after Core's dispatch rewrite still names it, though its handles are gone", () => {
  const node = dispatched({ ...recordedNode(), target: repairedSave });
  assert.equal("handles" in (node.target as JsonObject), false, "Core's rewrite keeps no marker, which is why the rule reads content");
  assert.equal(adaptedTargetSupersedesRecording(node), true);
  const target = outputTargetFromPayload(node);
  assert.equal(target?.selector, repairedSave.selector);
  assert.deepEqual(target?.element, { selector: repairedSave.selector, tagName: "button", accessibleName: "Apply changes" });
  assert.equal((target?.element as { testId?: string }).testId, undefined, "nothing of the stale Save rides along");
});

test("Core's rewrite of an unrepaired node is recognised as the recording, whatever the recording looked like", () => {
  const longText = `Save ${"and keep going ".repeat(120)}`.trim();
  const recordings: Array<[string, string, JsonObject]> = [
    ["the identity-drift Save", "web.dom.click", { element: { ...recordedElement, role: "", context: { formId: "settings-form", heading: "Workspace settings" } } }],
    ["a typed field, whose typed text is not its identity", "web.dom.type", { inputValue: "Aurora Field Team", element: { selector: "#display-name", tagName: "input", inputType: "text", name: "displayName", label: "Workspace name", implicitRole: "textbox" } }],
    ["signals only in the attributes", "web.dom.click", { element: { selector: "button.go", tagName: "button", attributes: { "aria-label": "Go now", "data-testid": "go" } } }],
    ["padded text and an upper-case tag", "web.dom.click", { element: { selector: "#pad", tagName: "BUTTON", visibleText: "  Save changes  ", text: " Save changes " } }],
    ["text and an implied role only", "web.dom.click", { element: { selector: "#plain", tagName: "a", text: "Read more", implicitRole: "link", href: "https://example.test/more" } }],
    ["text past Core's length bound", "web.dom.click", { element: { selector: "#long", tagName: "button", visibleText: longText } }],
    ["a visual target beside the element", "web.dom.click", { element: { selector: "#v", tagName: "button", visibleText: "Next" }, visualTarget: { namespace: "web", statePath: "web.elements.next", entityId: "next", entityKind: "button" } }]
  ];
  assert.ok(longText.length > 1_000, "the fixture reaches Core's bound");
  for (const [name, outputId, recording] of recordings) {
    const node = webAutomationOutputPayload(outputId, recording);
    const prepared = dispatched(node);
    assert.equal(adaptedTargetSupersedesRecording(prepared), false, name);
    assert.deepEqual(outputTargetFromPayload(prepared)?.element, outputTargetFromPayload(node)?.element, `${name}: the recording is dispatched whole`);
  }
});

test("a target that only moves the recorded control keeps the recorded identity, and still moves the selector", () => {
  const node = dispatched({ ...recordedNode(), target: { tagName: "button", accessibleName: "Save changes", visibleText: "Save changes", selector: "footer > button" } });
  assert.equal(adaptedTargetSupersedesRecording(node), false);
  const target = outputTargetFromPayload(node);
  assert.equal(target?.selector, "footer > button");
  assert.equal(signalCount(target), 12, "the page checks the new place against everything the recording knew");
});

test("a repair with no selector still carries its own identity, beside the recorded selector the page will check against it", () => {
  // What the resolution is once the caller no longer holds the binding that issued the handle.
  const fingerprintOnly = { handles: repairedSave.handles, handleResolution: "named", tagName: "button", accessibleName: "Apply changes", metadata: repairedSave.metadata };
  const node = dispatched({ ...recordedNode(), target: fingerprintOnly });
  const target = outputTargetFromPayload(node);
  assert.deepEqual(target?.element, { tagName: "button", accessibleName: "Apply changes" });
  assert.equal(target?.selector, "#save-settings", "the recorded selector is a hint the page vetoes by the repair, not by the recording");
});

test("handles without a resolution are not the domain's mark, and the content rule still decides", () => {
  const sameControl = { ...recordedNode(), target: { handles: { element: "target.1" }, tagName: "button", accessibleName: "Save changes" } };
  assert.equal(adaptedTargetSupersedesRecording(sameControl), false);
  const otherControl = { ...recordedNode(), target: { handles: { element: "target.1" }, handleResolution: "guessed", tagName: "button", accessibleName: "Discard changes" } };
  assert.equal(adaptedTargetSupersedesRecording(otherControl), true);
  assert.equal(adaptedTargetSupersedesRecording(recordedNode()), false, "no target at all is the recording");
});

// --- Where the element sat ---------------------------------------------------
//
// `context` reached the wire on 2026-09-12 and died here: this normalizer had
// no `context` key, so the signal was captured, carried across the boundary
// that had been blocking it, and thrown away one layer later -- looking fixed
// from both ends. The rows below pin that it survives, and that it survives as
// a closed vocabulary rather than as whatever JSON arrived.

const recordedContext = {
  formId: "settings-form",
  formName: "settings",
  formAction: "/workspace/settings",
  fieldsetLegend: "General",
  landmark: "main",
  landmarkName: "Workspace",
  heading: "Workspace settings",
  listPosition: { index: 3, total: 24 },
  tablePosition: { row: 2, column: 4, columnHeader: "Total" }
} as const;

test("where the element sat survives into the fingerprint, field by field", () => {
  const fingerprint = elementFingerprint({ selector: "#save", tagName: "button", context: recordedContext });
  assert.deepEqual(fingerprint?.context, recordedContext);
});

test("and into the dispatched target, which is the layer it used to die at", () => {
  const target = outputTargetFromPayload({
    selector: "#save",
    element: { selector: "#save", tagName: "button", context: { formName: "settings", fieldsetLegend: "General" } }
  });
  assert.deepEqual((target?.element as { context?: unknown }).context, { formName: "settings", fieldsetLegend: "General" });
});

test("a context key the normalizer does not know does not reach the page", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    context: { formName: "settings", formIdentifier: "settings-form", landmark: 7 }
  });
  assert.deepEqual(fingerprint?.context, { formName: "settings" }, "an unknown key and a mistyped one are both dropped");
});

test("a position is only a position when it is complete", () => {
  const partial = elementFingerprint({
    selector: "#cell",
    context: { listPosition: { index: 3 }, tablePosition: { row: 2, column: 4 } }
  });
  assert.deepEqual(partial?.context, { tablePosition: { row: 2, column: 4 } }, "an index with no total says how far along nothing");
});

test("an element inside no form, list or table carries no context at all", () => {
  assert.equal("context" in (elementFingerprint({ selector: "#plain", tagName: "div" }) ?? {}), false);
  assert.equal("context" in (elementFingerprint({ selector: "#plain", context: {} }) ?? {}), false, "an empty context is absent, not an empty object");
  assert.equal("context" in (elementFingerprint({ selector: "#plain", context: "main" }) ?? {}), false, "a context that is not an object is absent");
});

test("the attribute map is narrowed to the strings Core compares", () => {
  const fingerprint = elementFingerprint({
    selector: "#save",
    attributes: { "data-testid": "save", "aria-hidden": true, "data-config": { nested: 1 } }
  });
  assert.deepEqual(fingerprint?.attributes, { "data-testid": "save" });
  assert.deepEqual(elementFingerprint({ selector: "#save", attributes: {} })?.attributes, {}, "an element that carried an empty map still carries one");
});

// --- A checkbox's state and its landmark's name (B5) -------------------------
//
// Both are read as their own type and nothing else, which matters most for the
// state: an unchecked box is `false`, and a normalizer that treated `false` as
// absent would replay every toggle as "leave it alone".

test("a checkbox's checked state survives into the fingerprint and the dispatched target, unchecked included", () => {
  assert.equal(elementFingerprint({ selector: "#agree", inputType: "checkbox", checked: true })?.checked, true);
  const target = outputTargetFromPayload({
    selector: "#agree",
    element: { selector: "#agree", tagName: "input", inputType: "checkbox", checked: false }
  });
  assert.equal((target?.element as { checked?: unknown }).checked, false, "false is a state, not an absence");
});

test("a checked state that is not a boolean does not reach the page", () => {
  for (const checked of ["true", 1, null, { value: true }]) {
    assert.equal("checked" in (elementFingerprint({ selector: "#agree", checked }) ?? {}), false, JSON.stringify(checked));
  }
});

test("a landmark's name reaches the dispatched target beside the role it names", () => {
  const target = outputTargetFromPayload({
    selector: "#agree",
    element: { selector: "#agree", context: { landmark: "region", landmarkName: "Billing details" } }
  });
  assert.deepEqual((target?.element as { context?: unknown }).context, { landmark: "region", landmarkName: "Billing details" });
  assert.equal("context" in (elementFingerprint({ selector: "#agree", context: { landmarkName: 7 } }) ?? {}), false, "a name that is not text is no context at all");
});

// --- Which record the element sat in -----------------------------------------
//
// The one field of `context` the page acts on rather than merely carries. A
// position says where a control was and a fingerprint says what it was; on a
// table of 240 identical row actions neither says *which*, so a replay resolved
// the recorded selector's positional answer, agreed with it on every signal,
// promoted the wrong member and reported success. The extension refuses a match
// in another record now (`content/identity/record.ts`), and it can only do that
// if the record reaches it -- which is exactly what `context` itself failed to
// do for a week, one layer above these rows.

test("the record the element sat in survives into the fingerprint", () => {
  const record = { keyAttribute: "data-member-id", key: "usr_a91", text: "Priya Iqbal" };
  const fingerprint = elementFingerprint({ selector: "#row-action", tagName: "button", context: { record } });
  assert.deepEqual(fingerprint?.context, { record });
});

test("and into the dispatched target, which is where the page reads it", () => {
  const target = outputTargetFromPayload({
    selector: "#row-action",
    element: { selector: "#row-action", context: { record: { keyAttribute: "data-member-id", key: "usr_a91" } } }
  });
  assert.deepEqual(
    (target?.element as { context?: { record?: unknown } }).context?.record,
    { keyAttribute: "data-member-id", key: "usr_a91" }
  );
});

test("a record is read with the same closed vocabulary as the context around it", () => {
  const fingerprint = elementFingerprint({
    selector: "#row-action",
    context: { record: { key: "usr_a91", rowIndex: 92, text: 7 } }
  });
  assert.deepEqual(fingerprint?.context, { record: { key: "usr_a91" } }, "an unknown key and a mistyped one are both dropped");
});

test("a record with nothing in it is absent, not an empty object", () => {
  assert.equal("context" in (elementFingerprint({ selector: "#plain", context: { record: {} } }) ?? {}), false);
  assert.equal("context" in (elementFingerprint({ selector: "#plain", context: { record: "row 92" } }) ?? {}), false, "a record that is not an object is no context at all");
});

// --- A repair may rename a control; it may not move it to another record -----
//
// The record gate the page applies (`content/identity/record.ts`) is only as
// good as the record reaching the page, and the repair path is where it stopped
// reaching it. Two facts, both executed rather than reasoned
// (reports/w2-wrong-row-acted-on.md §8):
//
// - Core's `normalizeFingerprint` has no `context` key at all, so nothing of
//   `context` survives a target Core derives.
// - A repair's target is normalized from `parameters.target` alone and never
//   sees `parameters.element`, so it cannot inherit the recording's context
//   either -- and `adaptedTargetSupersedesRecording` hands it the whole
//   identity.
//
// A renamed control inside a list therefore dispatched with no record, and the
// gate was off for exactly the steps a repair had touched. These rows pin that
// the repair keeps the identity it earned and the record still travels.

/** The member directory's row action, recorded: nothing but its row tells it from the other 239. */
const recordedRowAction = {
  selector: '[data-testid="member-rows"] > tr:nth-of-type(171) > td:nth-of-type(7) > button',
  tagName: "button",
  accessibleName: "Row actions",
  visibleText: "Row actions",
  implicitRole: "button",
  classNames: ["x1f4a"],
  context: { tablePosition: { row: 171, column: 7 }, record: { keyAttribute: "data-member-id", key: "usr_3c95c2" } }
};

/** The same control found again under a new name -- and the list position, which is all a repair knows about the row. */
const renamedRowAction = {
  handles: { element: "target.2" },
  handleResolution: "named",
  tagName: "button",
  accessibleName: "Member actions",
  selector: '[data-testid="member-rows"] > tr:nth-of-type(171) > td:nth-of-type(7) > button',
  metadata: { controlType: "button", listIndex: 171, listTotal: 240 }
};

const rowNode = (): JsonObject => webAutomationOutputPayload("web.dom.click", { element: recordedRowAction });
const recordOf = (target: ReturnType<typeof outputTargetFromPayload>): unknown =>
  (target?.element as { context?: { record?: unknown } } | undefined)?.context?.record;

test("a repair inside a list keeps its own name and still carries the recorded record", () => {
  const node = { ...rowNode(), target: renamedRowAction };
  assert.equal(adaptedTargetSupersedesRecording(node), true, "the repair names a label the recording never held");
  const target = outputTargetFromPayload(node);
  assert.equal((target?.element as { accessibleName?: string }).accessibleName, "Member actions", "the repair's identity is what the page is asked for");
  assert.deepEqual(recordOf(target), { keyAttribute: "data-member-id", key: "usr_3c95c2" });
});

test("and still carries it after Core's dispatch rewrite, which is where it used to be lost", () => {
  const node = dispatched({ ...rowNode(), target: renamedRowAction });
  const fingerprint = (node.target as { fingerprint?: Record<string, unknown> }).fingerprint ?? {};
  assert.equal("context" in fingerprint, false, "Core's normalizer has no context key: this is the loss being compensated for");
  assert.equal(adaptedTargetSupersedesRecording(node), true);
  const target = outputTargetFromPayload(node);
  assert.equal((target?.element as { accessibleName?: string }).accessibleName, "Member actions");
  assert.deepEqual(recordOf(target), { keyAttribute: "data-member-id", key: "usr_3c95c2" });
});

test("the recorded record does not overwrite one an adapted target named for itself", () => {
  const node = {
    ...rowNode(),
    target: { ...renamedRowAction, element: { tagName: "button", accessibleName: "Member actions", context: { record: { keyAttribute: "data-member-id", key: "usr_b430d2" } } } }
  };
  assert.deepEqual(recordOf(outputTargetFromPayload(node)), { keyAttribute: "data-member-id", key: "usr_b430d2" },
    "a source describing a record of its own is describing one, not inheriting one");
});

test("a recording that named no record still dispatches without one", () => {
  const node = { ...recordedNode(), target: repairedSave };
  assert.equal(recordOf(outputTargetFromPayload(node)), undefined, "nothing is invented for a control that sits in no record");
});
