import assert from "node:assert/strict";
import test from "node:test";
import { MATRIX_CHECKS, matrixStepArrivals, type MatrixCaseEvidence } from "../index.js";
import type { MatrixRecoveryActivity, MatrixTraceAttempt } from "../../records/index.js";
import { RECOVERY_MATRIX_ROWS } from "../../matrix-rows.js";

// Case 13c's saved Flow, by Core's node keys: s7 reads the posts, s10 is the
// heart and s11 the bookmark, the step whose row is redrawn.
const NODE = "node.bootstrap.0123456789abcdef.main";
const CASE = RECOVERY_MATRIX_ROWS.flatMap(row => row.cases).find(item => item.caseId === "13c")!;
const check = MATRIX_CHECKS["row-reacquired"];
const NOT_FOUND = { category: "target_not_found", code: "web.target.not_found" } as const;
const FOUND = { sourceNodeId: `${NODE}.s7`, kind: "row", outcome: "found", reason: null, returned: false } as const;

function attempt(step: string, status: string, extra: Partial<MatrixTraceAttempt> = {}): MatrixTraceAttempt {
  return { index: 0, nodeId: `${NODE}.${step}`, status, failure: null, retryNumber: null, reacquire: null, ...extra };
}

/** One pass of the loop: the heart, then the bookmark three times not found and a fourth time found again. */
function reacquiredPass(): MatrixTraceAttempt[] {
  return [
    attempt("s10", "succeeded"),
    attempt("s11", "failed", { failure: NOT_FOUND }),
    attempt("s11", "failed", { failure: NOT_FOUND, retryNumber: 2 }),
    attempt("s11", "failed", { failure: NOT_FOUND, retryNumber: 3 }),
    attempt("s11", "succeeded", { retryNumber: 4, reacquire: FOUND }),
  ];
}

function foundRow(sequence: number): MatrixRecoveryActivity {
  return { sequence, subjectKind: "run", subjectId: "run-1", nodeId: `${NODE}.s11`, kind: "reacquire", outcome: "succeeded", subject: "Found the item from “read the posts in the feed” again" };
}

function evidence(overrides: Partial<MatrixCaseEvidence> = {}): MatrixCaseEvidence {
  return {
    run: { status: "succeeded", failure: null, stopCode: null },
    attempts: [],
    steps: ["s7", "s10", "s11"].map(nodeKey => ({ subflowKey: "main", nodeKey, definitionId: "web.output.dom-click", lasting: nodeKey !== "s7" })),
    primarySubflowKey: "main",
    site: { held: true, reasons: [], duplicatedActs: 0, observed: {} },
    goalHeld: null,
    model: { calls: 0, interventions: 0, harnessActivations: 0 },
    faultFired: null,
    trace: [attempt("s7", "succeeded"), ...reacquiredPass(), ...reacquiredPass()],
    recoveries: [foundRow(10), foundRow(20)],
    ...overrides,
  };
}

test("the case names its steps by the saved Flow's node keys", () => {
  assert.deepEqual(CASE.reacquire, { step: "s11", source: "s7", passes: 2, reacquiredPasses: 2 });
});

test("a step's arrivals are opened by a first attempt and hold the retries Core stamped after it", () => {
  const arrivals = matrixStepArrivals(evidence().trace!, item => item.nodeId === `${NODE}.s11`);
  assert.deepEqual(arrivals.map(arrival => arrival.length), [4, 4]);
  assert.deepEqual(matrixStepArrivals([attempt("s11", "succeeded"), attempt("s11", "succeeded")], () => true).map(arrival => arrival.length), [1, 1]);
});

test("13c passes when every pass re-acquired its row on the fourth attempt after three not-found failures, each with its recovery row", () => {
  const checked = check(evidence(), CASE);
  assert.deepEqual(checked.reasons, []);
  assert.equal(checked.verdict, "passed");
  assert.equal(checked.observed.reacquiredPasses, 2);
  assert.deepEqual((checked.observed.passes as string[][])[0], ["failed:target_not_found/web.target.not_found", "failed:target_not_found/web.target.not_found", "failed:target_not_found/web.target.not_found", "succeeded reacquire:found"]);
});

test("a run that wrote no re-acquire record at all is not proven, naming the capability", () => {
  const plain = [attempt("s7", "succeeded"), attempt("s10", "succeeded"), attempt("s11", "succeeded"), attempt("s10", "succeeded"), attempt("s11", "succeeded")];
  const checked = check(evidence({ trace: plain, recoveries: [] }), CASE);
  assert.equal(checked.verdict, "not-proven");
  assert.deepEqual(checked.missingRecords, ["reacquire"]);
});

test("13c fails when a pass re-acquired too early, on a failure that was not target-not-found, or from another source", () => {
  const early = [attempt("s7", "succeeded"), attempt("s10", "succeeded"), attempt("s11", "failed", { failure: NOT_FOUND }), attempt("s11", "succeeded", { retryNumber: 2, reacquire: FOUND }), ...reacquiredPass()];
  assert.match(check(evidence({ trace: early }), CASE).reasons.join(" "), /1 pass\(es\) of s11 re-acquired/u);
  const timeout = reacquiredPass().map(item => item.failure ? { ...item, failure: { category: "timeout", code: "web.action.timeout" } } : item);
  assert.equal(check(evidence({ trace: [attempt("s7", "succeeded"), ...timeout, ...reacquiredPass()] }), CASE).verdict, "failed");
  const elsewhere = reacquiredPass().map(item => item.reacquire ? { ...item, reacquire: { ...FOUND, sourceNodeId: `${NODE}.s3` } } : item);
  assert.equal(check(evidence({ trace: [attempt("s7", "succeeded"), ...elsewhere, ...reacquiredPass()] }), CASE).verdict, "failed");
});

test("13c fails on a fifth attempt, a pass that ended failed, a missing pass, a stray re-acquire, or a re-acquire that was not found", () => {
  const fifth = [...reacquiredPass(), attempt("s11", "succeeded", { retryNumber: 5 })];
  assert.match(check(evidence({ trace: [attempt("s7", "succeeded"), ...fifth, ...reacquiredPass()] }), CASE).reasons.join(" "), /attempted 5 times/u);
  const lost = reacquiredPass().map(item => item.reacquire ? { ...item, status: "failed", failure: NOT_FOUND } : item);
  assert.match(check(evidence({ trace: [attempt("s7", "succeeded"), ...reacquiredPass(), ...lost] }), CASE).reasons.join(" "), /pass 2: step s11 ended failed/u);
  assert.match(check(evidence({ trace: [attempt("s7", "succeeded"), ...reacquiredPass()], recoveries: [foundRow(10)] }), CASE).reasons.join(" "), /reached 1 time\(s\) where its loop has 2/u);
  const stray = [attempt("s7", "succeeded"), attempt("s10", "succeeded", { reacquire: FOUND }), ...reacquiredPass().slice(1), ...reacquiredPass()];
  assert.match(check(evidence({ trace: stray }), CASE).reasons.join(" "), /step s10 carries a re-acquire record/u);
  const gone = reacquiredPass().map(item => item.reacquire ? { ...item, status: "failed", failure: { category: "target_not_found", code: "executor.target.gone" }, reacquire: { ...FOUND, outcome: "gone" as const } } : item);
  assert.match(check(evidence({ trace: [attempt("s7", "succeeded"), ...reacquiredPass(), ...gone], recoveries: [foundRow(10)] }), CASE).reasons.join(" "), /came to gone, not found/u);
});

test("13c fails when Core's activity was not collected, or its recovery rows do not match the trace's re-acquires", () => {
  assert.match(check(evidence({ recoveries: null }), CASE).reasons.join(" "), /live activity was not collected/u);
  assert.match(check(evidence({ recoveries: [foundRow(10)] }), CASE).reasons.join(" "), /said 1 re-acquire\(s\) of s11 succeeded where its trace holds 2/u);
  assert.match(check(evidence({ recoveries: [foundRow(10), foundRow(20), { ...foundRow(30), outcome: "failed" }] }), CASE).reasons.join(" "), /1 re-acquire row\(s\) that are not a found s11/u);
});

test("13c holds the floor: a model call, a site that shows an extra act, or a failed run fails it", () => {
  assert.equal(check(evidence({ model: { calls: 1, interventions: 0, harnessActivations: 0 } }), CASE).verdict, "failed");
  assert.equal(check(evidence({ site: { held: false, reasons: ["the site received 3 save change(s) where 2 were expected"], duplicatedActs: 1, observed: {} } }), CASE).verdict, "failed");
  assert.equal(check(evidence({ run: { status: "failed", failure: { category: "target_not_found", code: "web.target.not_found" }, stopCode: null } }), CASE).verdict, "failed");
});
