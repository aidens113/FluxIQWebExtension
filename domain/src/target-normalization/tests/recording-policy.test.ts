import assert from "node:assert/strict";
import test from "node:test";
import { decodeRecordingEntry } from "fluxiq/client-gateway/recording/decoding";
import { isWebRecordingTarget, webRecordingTargetPolicy } from "../index";

test("the complete recording outer guard preserves scalar locators, geometry, visual targets and metadata", () => {
  const target = {
    type: "ui_element",
    id: "saved",
    label: "Save",
    selector: "#saved",
    bounds: { x: 1, y: 2, width: 0, height: -1 },
    relativePosition: { x: 0.5, y: 0.25 },
    visualTarget: { entityId: "saved", entityKind: "control", statePath: { namespace: "actual", path: "saved" }, confidence: 2, metadata: { complete: true } },
    elementTarget: { kind: "element", fingerprint: { selector: "#saved" } },
    metadata: { nested: [null, false, 2, "retained"] },
    unknownFutureField: { retained: true }
  };
  assert.equal(isWebRecordingTarget(target), true);
  assert.equal(webRecordingTargetPolicy.accepts(target), true);
  assert.equal(isWebRecordingTarget({ type: "legacy", selector: "" }), true);
  assert.equal(isWebRecordingTarget({ type: "legacy" }), true);
  for (const value of [null, undefined, [], 3, "target", {}, { type: "legacy", selector: null }, { type: "legacy", selector: [] }, { type: "legacy", selector: {} }, { type: "legacy", selector: 3 }, { type: "legacy", bounds: { x: 0, y: 0, width: Number.NaN, height: 1 } }, { type: "legacy", relativePosition: { x: 0 } }, { type: "legacy", visualTarget: { entityId: 3 } }, { type: "legacy", metadata: { value: Number.POSITIVE_INFINITY } }]) {
    assert.equal(isWebRecordingTarget(value), false, JSON.stringify(value));
  }
});

test("recording ingress retains inner validation, warning acceptance and null refusal", () => {
  const warning = { kind: "element", fingerprint: { id: "saved", selector: "" } };
  const accepted = { type: "ui_element", elementTarget: warning };
  assert.equal(isWebRecordingTarget(accepted), true);
  assert.deepEqual(webRecordingTargetPolicy.targetIssues(accepted, "timeline.0.target"), [{ severity: "warning", code: "element_target.empty_signal", message: "Element target selector is empty and should be omitted.", path: "timeline.0.target.elementTarget.fingerprint.selector" }]);
  const base = { type: "action", actionType: "actual", origin: "operator", startedAt: 1, parameters: {} };
  const evidence = (_value: unknown): _value is never => false;
  const guards = { target: webRecordingTargetPolicy.accepts, evidence };
  const decoded = { ...base, target: accepted };
  assert.equal(decodeRecordingEntry(decoded, guards), decoded);
  assert.throws(() => decodeRecordingEntry({ ...base, target: null }, guards), { message: "recording.invalid_entry" });
  for (const elementTarget of [null, { kind: "element", fingerprint: {} }, { kind: "element", fingerprint: [] }, { kind: "element", fingerprint: { selector: "#saved", attributes: { authorization: "synthetic" } } }, { kind: "element", fingerprint: { selector: "#saved" }, selectedCandidate: { candidateId: "saved", confidence: 1.2 } }]) {
    assert.equal(isWebRecordingTarget({ type: "ui_element", elementTarget }), false);
    assert.throws(() => decodeRecordingEntry({ ...base, target: { type: "ui_element", elementTarget } }, guards), { message: "recording.invalid_entry" });
  }
  assert.deepEqual(webRecordingTargetPolicy.targetIssues(null, "target"), []);
  assert.deepEqual(webRecordingTargetPolicy.targetIssues(undefined, "target"), []);
});

test("the policy preserves complete target/parameter issue codes, messages, paths and raw confidence", () => {
  const elementTarget = { kind: "element", fingerprint: { selector: "#saved", attributes: { authorization: "synthetic" } }, selectedCandidate: { candidateId: "saved", confidence: 1.2, matchedSignals: [], failedSignals: [] } };
  const before = JSON.stringify(elementTarget);
  const expected = [
    { severity: "error", code: "element_target.sensitive_attribute", message: "Element target attributes cannot include sensitive keys.", path: "timeline.3.target.elementTarget.fingerprint.attributes" },
    { severity: "error", code: "element_target.selection_invalid_confidence", message: "Selected element confidence must be between 0 and 1.", path: "timeline.3.target.elementTarget.selectedCandidate.confidence" }
  ];
  assert.deepEqual(webRecordingTargetPolicy.targetIssues({ elementTarget }, "timeline.3.target"), expected);
  assert.deepEqual(webRecordingTargetPolicy.parameterIssues({ target: elementTarget }, "timeline.3.parameters"), expected.map(issue => ({ ...issue, path: issue.path.replace("timeline.3.target.elementTarget", "timeline.3.parameters.target") })));
  assert.deepEqual(webRecordingTargetPolicy.parameterIssues({ target: { kind: "other" } }, "parameters"), []);
  assert.equal(JSON.stringify(elementTarget), before);
});

test("command encoding keeps original type coercion and the exact original metadata object", () => {
  for (const type of [undefined, null, "", "saved", 3, false]) {
    const value = type === undefined ? { extra: [null, "kept"] } : { type, extra: [null, "kept"] };
    const encoded = webRecordingTargetPolicy.commandTarget(value);
    assert.deepEqual(encoded, { type: String(type ?? "client-target"), metadata: value });
    assert.equal((encoded as { metadata: unknown }).metadata, value);
  }
});

test("the selected policy retains every original action result status without reducing the decoder", () => {
  const evidence = (_value: unknown): _value is never => false;
  const guards = { target: webRecordingTargetPolicy.accepts, evidence };
  for (const status of ["succeeded", "failed", "timed_out", "cancelled", "unknown"]) {
    const value = { type: "action", actionType: "actual", origin: "runtime", startedAt: 1, completedAt: 2, parameters: { empty: [] }, target: { type: "legacy", selector: "#saved" }, result: { status, message: "retained", evidence: [], metadata: { retained: true } }, metadata: { retained: [] } };
    assert.equal(decodeRecordingEntry(value, guards), value);
  }
});
