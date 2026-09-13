import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { WEB_LLM_EVIDENCE_BYTE_BUDGETS } from "@fluxiq-web-extension/domain/node";
import { parseRunEvaluationJson } from "@fluxiq-web-extension/test-contracts";
import type { RunLaneObservation } from "../../flow-lane/index.js";
import { evidenceBudgetInvariant } from "../evidence-budget-invariant.js";
import { flowLaneEvidenceSizes, type FlowLaneEvidence, type MeasuredEvidencePacket } from "../flow-lane-evidence-sizes.js";
import { evaluateObservedRun, type ObservedRun } from "../observed-run-evaluation.js";

// The budget is the domain's, imported, so these rows move with it rather than
// restating its figure.
const BUDGET = WEB_LLM_EVIDENCE_BYTE_BUDGETS.exploration;

const packet = (actionPosition: number, point: MeasuredEvidencePacket["point"], bytes: number, truncated = false): MeasuredEvidencePacket => ({ actionPosition, point, bytes, truncated });
const evidenceOf = (packets: MeasuredEvidencePacket[]): FlowLaneEvidence => ({ sanitizedPacketBytes: packets.map((item) => item.bytes), rawSnapshotBytes: [], truncationCount: packets.filter((item) => item.truncated).length, packets });

const identity: ObservedRun["identity"] = { scenarioId: "product-catalog", workflowId: null, variantId: null, repeatIndex: 0, expectedFailure: null };
const passedOutcome: ObservedRun["outcome"] = { runId: "run-a", verdict: "passed", invariants: [{ id: "runner-verdict", passed: true, expected: "passed", actual: "passed", evidenceSequences: [9] }], metrics: {}, durationMs: 1_000 };
const flow: RunLaneObservation = { lane: "flow", flowCreated: true, oracleVerdict: "passed", reportedVerdict: "passed", automationFailureReported: null, automationFailureExpected: null, harnessActivations: 0, actions: [] };

test("a packet exactly at the budget passes", () => {
  const invariant = evidenceBudgetInvariant([packet(1, "beforeAction", 512), packet(2, "afterAction", BUDGET, true)]);
  assert.deepEqual(invariant, { id: "evidence-packet-budget", passed: true, expected: `every sanitized evidence packet at most ${BUDGET} bytes`, actual: `2 packets, the largest ${BUDGET} bytes`, evidenceSequences: [] });
});

test("a packet one byte over the budget fails, and the failure names each packet over it by action position, point and bytes", () => {
  const invariant = evidenceBudgetInvariant([packet(1, "beforeAction", BUDGET), packet(3, "afterAction", BUDGET + 1, true), packet(4, null, BUDGET + 900)]);
  assert.equal(invariant?.passed, false);
  assert.equal(invariant?.actual, `2 of 3 packets over budget: action 3 afterAction: ${BUDGET + 1} bytes; action 4 at an unnamed point: ${BUDGET + 900} bytes`);
  assert.equal(invariant?.actual.includes("action 1 "), false, "a packet at the budget is not named as over it");
});

test("a run with no packets gets no budget invariant, on either lane", () => {
  assert.equal(evidenceBudgetInvariant([]), undefined);
  const noPackets = evaluateObservedRun({ identity, outcome: passedOutcome, observation: flow, evidence: evidenceOf([]) });
  assert.deepEqual(noPackets.invariants.map((item) => item.id), ["runner-verdict"]);
  assert.equal(noPackets.verdict, "passed");
  const recording = evaluateObservedRun({ identity, outcome: passedOutcome, observation: { ...flow, lane: "recording", flowCreated: null } });
  assert.deepEqual(recording.invariants.map((item) => item.id), ["runner-verdict"]);
});

test("within budget, a Flow-lane evaluation carries a passing budget invariant and keeps its verdict", () => {
  const evaluation = evaluateObservedRun({ identity, outcome: passedOutcome, observation: flow, evidence: evidenceOf([packet(1, "beforeAction", BUDGET)]) });
  assert.equal(evaluation.verdict, "passed");
  assert.equal("failureCategory" in evaluation, false);
  assert.deepEqual(evaluation.invariants.map((item) => [item.id, item.passed]), [["runner-verdict", true], ["evidence-packet-budget", true]]);
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(evaluation)), evaluation);
});

test("over budget, a run the runner passed fails as performance.budget, and the evaluation stays contract-valid", () => {
  const evaluation = evaluateObservedRun({ identity, outcome: passedOutcome, observation: flow, evidence: evidenceOf([packet(2, "afterAction", BUDGET + 1)]) });
  assert.deepEqual([evaluation.verdict, evaluation.failureCategory], ["failed", "performance.budget"]);
  assert.deepEqual(evaluation.invariants.map((item) => [item.id, item.passed]), [["runner-verdict", true], ["evidence-packet-budget", false]]);
  assert.deepEqual(parseRunEvaluationJson(JSON.stringify(evaluation)), evaluation);
});

test("over budget, a run the runner already failed keeps its own category and still records the breach", () => {
  const failed: ObservedRun["outcome"] = { ...passedOutcome, verdict: "failed", failureCategory: "runtime.behavior", invariants: [{ id: "runner-verdict", passed: false, expected: "passed", actual: "failed: runtime.behavior", evidenceSequences: [9] }] };
  const evaluation = evaluateObservedRun({ identity, outcome: failed, observation: flow, evidence: evidenceOf([packet(1, "beforeAction", BUDGET + 1)]) });
  assert.deepEqual([evaluation.verdict, evaluation.failureCategory], ["failed", "runtime.behavior"]);
  assert.deepEqual(evaluation.invariants.map((item) => [item.id, item.passed]), [["runner-verdict", false], ["evidence-packet-budget", false]]);
});

/** A bundle directory holding only `snapshots/flow-lane.json`. */
function bundleWith(t: TestContext, snapshot: unknown): string {
  const directory = mkdtempSync(path.join(tmpdir(), "fluxiq-evidence-budget-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "snapshots"));
  writeFileSync(path.join(directory, "snapshots", "flow-lane.json"), `${JSON.stringify(snapshot, null, 2)}\n`);
  return directory;
}

test("read from a bundle, the failure quotes no packet content, even text a malformed entry put where a point belongs", (t) => {
  const content = ["Signed in as private.person", "#account-summary", "web.state.2"];
  const snapshot = {
    actions: [
      { actionType: "web.dom.type", status: "succeeded", evidencePackets: [{ point: "beforeAction", bytes: 1_024, truncated: false }] },
      { actionType: "web.dom.click", status: "succeeded", evidencePackets: [{ point: "afterAction", bytes: BUDGET + 1, truncated: true, summary: { title: content[0], elements: [{ selector: content[1] }] }, stateRef: content[2] }, { point: content[0], bytes: BUDGET + 2, truncated: true }] },
    ],
  };
  const evaluation = evaluateObservedRun({ identity, outcome: passedOutcome, observation: flow, evidence: flowLaneEvidenceSizes(bundleWith(t, snapshot)) });
  const budget = evaluation.invariants.find((item) => item.id === "evidence-packet-budget");
  assert.equal(budget?.actual, `2 of 3 packets over budget: action 2 afterAction: ${BUDGET + 1} bytes; action 2 at an unnamed point: ${BUDGET + 2} bytes`);
  const serialised = JSON.stringify(evaluation);
  for (const text of content) assert.equal(serialised.includes(text), false, `${text} must not reach the evaluation`);
});
