import assert from "node:assert/strict";
import test from "node:test";
import { ExecutionCallbackPolicies } from "fluxiq/runtime/execution-observation/policies";
import { createWebElementMatcher } from "../../../element-fingerprint";
import { createWebAutomationOutputNodeImplementationBundle } from "../../native-runtime";

const input = { action: { actionType: "web.dom.click", outputId: "web.dom.click", parameters: { target: { kind: "element", fingerprint: { selector: "#saved" }, candidates: [{ candidateId: "saved", selector: "#saved" }] } } }, domainId: "web", output: { id: "web.dom.click", title: "Click", metadata: { elementTarget: true } } };

test("the default bundle supplies original pure web hooks only on its actual receiver", () => {
  const bundle = createWebAutomationOutputNodeImplementationBundle();
  assert.ok(bundle.outputTargetPreparer);
  assert.ok(bundle.recordingEntryTargetPreparer);
  assert.equal(ExecutionCallbackPolicies.isPure(bundle, bundle.outputTargetPreparer), true);
  assert.equal(ExecutionCallbackPolicies.isPure(bundle, bundle.recordingEntryTargetPreparer), true);
  assert.equal(ExecutionCallbackPolicies.isPure({ ...bundle }, bundle.outputTargetPreparer), false);
  assert.equal(ExecutionCallbackPolicies.isPure({ ...bundle }, bundle.recordingEntryTargetPreparer), false);
});

test("custom hooks and an arbitrary matcher receive no automatic read-only declaration", () => {
  const outputTargetPreparer = () => ({ ok: true as const });
  const recordingEntryTargetPreparer = () => null;
  const custom = createWebAutomationOutputNodeImplementationBundle({ outputTargetPreparer, recordingEntryTargetPreparer });
  assert.equal(custom.outputTargetPreparer, outputTargetPreparer);
  assert.equal(custom.recordingEntryTargetPreparer, recordingEntryTargetPreparer);
  assert.equal(ExecutionCallbackPolicies.isPure(custom, outputTargetPreparer), false);
  assert.equal(ExecutionCallbackPolicies.isPure(custom, recordingEntryTargetPreparer), false);
  const matcher = createWebElementMatcher();
  const customMatcher = createWebAutomationOutputNodeImplementationBundle({ elementMatcher: matcher });
  assert.equal(customMatcher.elementMatcher, matcher);
  assert.equal(ExecutionCallbackPolicies.isPure(customMatcher, customMatcher.outputTargetPreparer!), false);
  const result = customMatcher.outputTargetPreparer!(input);
  assert.ok(result.resolution?.status === "matched");
  assert.equal(result.resolution.candidateId, "saved");
});

test("the default hook retains its pinned original matcher method after the exposed member changes", () => {
  const bundle = createWebAutomationOutputNodeImplementationBundle();
  const matcher = bundle.elementMatcher!;
  const original = matcher.bestCandidate;
  let replacementCalls = 0;
  matcher.bestCandidate = () => {
    replacementCalls++;
    throw new Error("must not invoke substituted default matcher");
  };
  try {
    const result = bundle.outputTargetPreparer!(input);
    assert.ok(result.ok);
    assert.ok(result.resolution?.status === "matched");
    assert.equal(result.resolution.candidateId, "saved");
    const second = createWebAutomationOutputNodeImplementationBundle();
    const next = second.outputTargetPreparer!(input);
    assert.ok(next.ok);
    assert.ok(next.resolution?.status === "matched");
    assert.equal(next.resolution.candidateId, "saved");
    assert.equal(replacementCalls, 0);
  } finally { matcher.bestCandidate = original; }
});

test("an explicit missing hook remains missing rather than silently restoring a default", () => {
  const hookOverride = {};
  Object.defineProperty(hookOverride, "outputTargetPreparer", { value: undefined, enumerable: true });
  const bundle = createWebAutomationOutputNodeImplementationBundle(hookOverride);
  assert.equal(bundle.outputTargetPreparer, undefined);
  const matcherOverride = {};
  Object.defineProperty(matcherOverride, "elementMatcher", { value: undefined, enumerable: true });
  const withoutMatcher = createWebAutomationOutputNodeImplementationBundle(matcherOverride);
  const result = withoutMatcher.outputTargetPreparer!(input);
  assert.ok(result.ok);
  assert.equal(result.resolution?.status, "unresolved_no_matcher");
});
