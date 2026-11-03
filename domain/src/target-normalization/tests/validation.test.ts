import assert from "node:assert/strict";
import test from "node:test";
import { isWebElementTarget, normalizeWebElementTarget, validateWebElementTarget } from "../index";

test("the actual web guard and validator retain durable-signal and selected-confidence refusals", () => {
  assert.equal(isWebElementTarget({ kind: "element", fingerprint: {} }), true);
  assert.equal(isWebElementTarget({ kind: "element", fingerprint: [] }), false);
  assert.deepEqual(validateWebElementTarget({ kind: "element", fingerprint: {} }).issues.map(issue => issue.code), ["element_target.empty_fingerprint"]);
  const result = validateWebElementTarget({ kind: "element", fingerprint: { selector: "#saved", bounds: { x: 0, y: 0, width: -1, height: 10 } }, selectedCandidate: { candidateId: "saved", confidence: 1.2, matchedSignals: [], failedSignals: [] } });
  assert.deepEqual(result.issues.map(issue => issue.code), ["element_target.invalid_bounds", "element_target.selection_invalid_confidence"]);
});

test("normalization and validation share the original privacy and identity interpretation", () => {
  const target = normalizeWebElementTarget({ selector: "#saved", metadata: { token: "synthetic-token", kept: true }, drawing: "d1.saved" })!;
  assert.equal(validateWebElementTarget(target).ok, true);
  assert.equal(JSON.stringify(target).includes("synthetic-token"), false);
  assert.deepEqual(validateWebElementTarget({ kind: "element", fingerprint: { selector: "#saved", attributes: { authorization: "synthetic" } } }).issues.map(issue => issue.code), ["element_target.sensitive_attribute"]);
});
