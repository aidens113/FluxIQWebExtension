// T1 coverage of the identity signals a target carries.
//
// `testId`, `accessibleName` and `label` are Core's element-fingerprint
// signals by name (`fingerprinting/element-fingerprint.ts`), and among its
// highest weighted: `testId` 28, `accessibleName` 24, `label` 20, against 14
// for a selector. A target that omits them can only be matched on its selector
// and text, which is what makes a superficial DOM change break a workflow.

import assert from "node:assert/strict";
import test from "node:test";
import { elementFingerprint, outputTargetFromPayload } from "../targets";

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

test("an adapted target's own element wins when Core matched, and loses when it did not", () => {
  const adaptedElement = { selector: "#settings-save-v2", tagName: "button", testId: "save-changes-v2" };
  const matched = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { element: adaptedElement, selectedCandidate: { candidateId: "candidate.current", confidence: 0.9 } }
  });
  assert.equal((matched?.element as { testId?: string }).testId, "save-changes-v2");
  const unmatched = outputTargetFromPayload({
    selector: "#save-settings",
    element: recordedElement,
    target: { element: adaptedElement }
  });
  assert.equal((unmatched?.element as { testId?: string }).testId, "save-changes", "an unmatched pass-through is a re-derivation, not an adaptation");
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
