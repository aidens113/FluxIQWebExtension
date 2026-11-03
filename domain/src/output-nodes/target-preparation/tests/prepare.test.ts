import assert from "node:assert/strict";
import test from "node:test";
import type { OutputTargetPreparer } from "fluxiq/runtime/output-dispatch/preparation";
import type { AutomationStudioElementTarget } from "fluxiq/automation-studio";
import { createWebElementMatcher } from "../../../element-fingerprint";
import { createWebOutputTargetPreparer } from "../index";

type Input = Parameters<OutputTargetPreparer>[0];
const input = (parameters: Record<string, unknown>, metadata: Input["output"]["metadata"] = { elementTarget: true }): Input => ({ action: { actionType: "web.dom.click", outputId: "web.dom.click", parameters }, domainId: "web", output: { id: "web.dom.click", title: "Click", metadata, safety: { level: "review" } } });

test("the web preparer preserves the exact missing-fingerprint refusal", () => {
  assert.deepEqual(createWebOutputTargetPreparer()(input({})), {
    ok: false,
    error: "Output web.dom.click declares element targeting but parameters.target does not contain an element fingerprint.",
    failure: { category: "graph_validation_or_unknown_node", code: "element_target.missing_fingerprint", retryable: false, stage: "target_resolution" }
  });
  assert.deepEqual(createWebOutputTargetPreparer()(input({}, {})), { ok: true });
});

test("a web target without candidates claims no confidence or floor", () => {
  const result = createWebOutputTargetPreparer(createWebElementMatcher())(input({ target: { kind: "element", fingerprint: { selector: "#saved" } } }, { elementTarget: true, elementTargetMinConfidence: 0.99 }));
  assert.ok(result.ok);
  assert.deepEqual(result.resolution, { status: "unresolved_no_candidates", candidateCount: 0 });
  assert.equal(Object.hasOwn(result.resolution!, "minimumConfidence"), false);
  assert.equal(Object.hasOwn(result.resolution!, "confidence"), false);
});

test("the actual calibrated default matcher selects the saved candidate and preserves drawing diagnostics", () => {
  const result = createWebOutputTargetPreparer(createWebElementMatcher())(input({ target: { kind: "element", fingerprint: { selector: "#saved", drawing: "d1.original" }, candidates: [{ candidateId: "wrong", selector: "#other" }, { candidateId: "saved", selector: "#saved", drawing: "d1.original" }] } }));
  assert.ok(result.ok);
  assert.ok(result.resolution?.status === "matched");
  assert.equal(result.resolution.candidateId, "saved");
  assert.equal(result.resolution.minimumConfidence, 0.68);
  const target = result.parameters?.target as AutomationStudioElementTarget;
  assert.equal(target.fingerprint.drawing, "d1.original");
  assert.equal(target.selectedCandidate?.candidateId, "saved");
  assert.equal(target.candidates?.[1]?.drawing, "d1.original");
});

test("an explicitly supplied custom matcher retains its original receiver and exact two-argument call", () => {
  const matcher = createWebElementMatcher();
  let calls = 0;
  matcher.bestCandidate = function(this: unknown, fingerprint, candidates) {
    assert.equal(this, matcher);
    assert.equal(arguments.length, 2);
    assert.deepEqual(fingerprint, { selector: "#saved" });
    assert.equal(candidates[0]?.candidateId, "saved");
    calls++;
    return null;
  };
  const result = createWebOutputTargetPreparer(matcher)(input({ target: { kind: "element", fingerprint: { selector: "#saved" }, candidates: [{ candidateId: "saved", selector: "#saved" }] } }));
  assert.equal(calls, 1);
  assert.deepEqual(result, { ok: false, error: "Element target could not be matched to any runtime candidate.", failure: { category: "target_not_found", code: "element_target.no_match", retryable: true, stage: "target_resolution" }, resolution: { status: "no_match", candidateCount: 1, minimumConfidence: 0.68 } });
});

test("a supplied matcher failure remains its identical original error", () => {
  const matcher = createWebElementMatcher();
  const primary = new Error("original matcher failure");
  matcher.bestCandidate = () => { throw primary; };
  assert.throws(() => createWebOutputTargetPreparer(matcher)(input({ target: { kind: "element", fingerprint: { selector: "#saved" }, candidates: [{ candidateId: "saved", selector: "#saved" }] } })), error => error === primary);
});
