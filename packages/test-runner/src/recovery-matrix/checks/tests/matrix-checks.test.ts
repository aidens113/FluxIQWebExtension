import assert from "node:assert/strict";
import test from "node:test";
import { MATRIX_CHECKS, type MatrixCaseEvidence } from "../index.js";
import type { MatrixAttemptRecord } from "../../records/index.js";
import { RECOVERY_MATRIX_ROWS } from "../../matrix-rows.js";

const NODE = "node.bootstrap.0123456789abcdef.main";
const caseOf = (caseId: string) => RECOVERY_MATRIX_ROWS.flatMap(row => row.cases).find(item => item.caseId === caseId)!;

function attempt(step: string, status: string, extra: Partial<MatrixAttemptRecord> = {}): MatrixAttemptRecord {
  return { order: 0, nodeId: `${NODE}.${step}`, definitionId: null, status, retry: false, failure: null, framePath: null, lifecycle: null, entry: null, stateRouting: null, skipped: null, startedAt: null, finishedAt: null, ...extra };
}

/** A handler record with only what a check reads set. */
function handler(disposition: string, extra: Partial<NonNullable<MatrixAttemptRecord["lifecycle"]>> = {}): NonNullable<MatrixAttemptRecord["lifecycle"]> {
  return { event: "retry", handlerId: `${NODE}.h1-s1`, handlerRef: null, disposition, completionCheck: "true", unhandledReason: null, unhandledGuard: null, ...extra };
}

function evidence(overrides: Partial<MatrixCaseEvidence> = {}): MatrixCaseEvidence {
  return {
    run: { status: "succeeded", failure: null, stopCode: null },
    attempts: [attempt("s1", "succeeded"), attempt("s2", "succeeded")],
    steps: [{ subflowKey: "main", nodeKey: "s1", definitionId: "web.output.dom-click", lasting: false }, { subflowKey: "main", nodeKey: "s2", definitionId: "web.output.dom-click", lasting: true }, { subflowKey: "main", nodeKey: "s3", definitionId: "builtin.control.end", lasting: false, endStatus: "failed" }],
    primarySubflowKey: "main",
    site: { held: true, reasons: [], duplicatedActs: 0, observed: {} },
    goalHeld: true,
    model: { calls: 0, interventions: 0, harnessActivations: 0 },
    faultFired: null,
    ...overrides,
  };
}

test("cold start passes from the first step with no route, and records that dev wrote no entry", () => {
  const checked = MATRIX_CHECKS["cold-start"](evidence(), caseOf("1"));
  assert.equal(checked.verdict, "passed");
  assert.equal(checked.observed.entryRecord, "absent");
});

test("cold start fails when the run began elsewhere, was routed, or a model was called or not counted", () => {
  assert.equal(MATRIX_CHECKS["cold-start"](evidence({ attempts: [attempt("s2", "succeeded")] }), caseOf("1")).verdict, "failed");
  assert.equal(MATRIX_CHECKS["cold-start"](evidence({ attempts: [attempt("s1", "succeeded", { stateRouting: { outcome: "routed", toNodeId: null, refused: [] } })] }), caseOf("1")).verdict, "failed");
  assert.match(MATRIX_CHECKS["cold-start"](evidence({ model: { calls: 1, interventions: 0, harnessActivations: 0 } }), caseOf("1")).reasons.join(" "), /1 model provider call/);
  assert.match(MATRIX_CHECKS["cold-start"](evidence({ model: { calls: null, interventions: 0, harnessActivations: 0 } }), caseOf("1")).reasons.join(" "), /no provider-call accounting/);
});

test("a row whose mechanism wrote no record is not proven, naming what is missing", () => {
  const checked = MATRIX_CHECKS["popup-handled"](evidence(), caseOf("4a"));
  assert.equal(checked.verdict, "not-proven");
  assert.deepEqual(checked.missingRecords, ["handlers"]);
  assert.equal(MATRIX_CHECKS["shortcut-refused"](evidence(), caseOf("3")).verdict, "not-proven");
});

test("a handler that resumed with its completion check true proves row 4", () => {
  const handled = attempt("s2", "succeeded", { lifecycle: handler("resume", { event: "before" }) });
  assert.equal(MATRIX_CHECKS["popup-handled"](evidence({ attempts: [attempt("s1", "succeeded"), handled] }), caseOf("4a")).verdict, "passed");
});

test("retries absorbed needs a retry and a successful run", () => {
  assert.equal(MATRIX_CHECKS["retries-absorbed"](evidence(), caseOf("13a")).verdict, "failed");
  const retried = [attempt("s1", "succeeded"), attempt("s2", "failed"), attempt("s2", "succeeded", { retry: true })];
  assert.equal(MATRIX_CHECKS["retries-absorbed"](evidence({ attempts: retried }), caseOf("13a")).verdict, "passed");
});

test("a deliberate stop ends failed on the End the Flow marked failed, after a step failed", () => {
  const stopped = [attempt("s1", "succeeded"), attempt("s2", "failed"), attempt("s3", "failed")];
  assert.equal(MATRIX_CHECKS["deliberate-stop"](evidence({ run: { status: "failed", failure: null, stopCode: null }, attempts: stopped }), caseOf("13b")).verdict, "passed");
  assert.equal(MATRIX_CHECKS["deliberate-stop"](evidence({ run: { status: "failed", failure: null, stopCode: null }, attempts: stopped.slice(0, 2) }), caseOf("13b")).verdict, "failed");
});

test("row 7 fails when a handler of the inactive part ran, and when a handler ran whose id cannot be read", () => {
  const run = (handlerId: string | null) => attempt("s2", "succeeded", { lifecycle: handler("resume", { event: "before", handlerId }) });
  assert.equal(MATRIX_CHECKS["inactive-handler"](evidence({ attempts: [attempt("s1", "succeeded"), run(`${NODE}.h1-s1`)] }), caseOf("7")).verdict, "passed");
  assert.equal(MATRIX_CHECKS["inactive-handler"](evidence({ attempts: [attempt("s1", "succeeded"), run("node.bootstrap.0123456789abcdef.store.h1-s1")] }), caseOf("7")).verdict, "failed");
  // Before t404 every handler id read as null, and this passed whatever ran.
  assert.equal(MATRIX_CHECKS["inactive-handler"](evidence({ attempts: [attempt("s1", "succeeded"), run(null)] }), caseOf("7")).verdict, "failed");
});

test("row 10 passes when the confirms done before the route are passed over as already done after it", () => {
  const steps = [
    { subflowKey: "main", nodeKey: "requests", definitionId: "web.dom.wait_for_selector", lasting: false },
    { subflowKey: "main", nodeKey: "amara", definitionId: "web.dom.click", lasting: true },
    { subflowKey: "main", nodeKey: "freya", definitionId: "web.dom.click", lasting: true },
  ];
  const alreadyDone = { reason: "already_done" as const, code: "executor.act.already_done" };
  const routedBack = [
    attempt("requests", "succeeded"), attempt("amara", "succeeded"),
    attempt("freya", "failed", { lifecycle: handler("route") }),
    attempt("requests", "succeeded"), attempt("amara", "succeeded", { skipped: alreadyDone }), attempt("freya", "succeeded"),
  ];
  const passed = MATRIX_CHECKS["checkpoint-route"](evidence({ steps, attempts: routedBack }), caseOf("10"));
  assert.equal(passed.verdict, "passed", passed.reasons.join("; "));
  assert.equal(passed.observed.alreadyDone, 1);
  // Amara confirmed again rather than passed over: the ledger did not hold her act.
  const repeated = routedBack.map((item, index) => (index === 4 ? attempt("amara", "succeeded") : item));
  const failed = MATRIX_CHECKS["checkpoint-route"](evidence({ steps, attempts: repeated }), caseOf("10"));
  assert.equal(failed.verdict, "failed");
  assert.match(failed.reasons.join(" "), /amara, done before the route, was not passed over/);
  assert.match(failed.reasons.join(" "), /amara succeeded more than once/);
});

test("row 10 fails when the handler's route was unhandled, and names why", () => {
  const unrouted = [attempt("s1", "succeeded"), attempt("s2", "failed", { lifecycle: handler("unhandled", { unhandledReason: "route_refused", unhandledGuard: "passes_uncertain_act" }) })];
  const checked = MATRIX_CHECKS["checkpoint-route"](evidence({ attempts: unrouted }), caseOf("10"));
  assert.equal(checked.verdict, "failed");
  assert.deepEqual(checked.observed.unhandled, ["route_refused/passes_uncertain_act"]);
});

test("row 8 needs an attempt on a called part's own step, not only a handler body's nested frame", () => {
  const PART = "node.bootstrap.0123456789abcdef.quick-add";
  const steps = [{ subflowKey: "main", nodeKey: "s6", definitionId: "builtin.control.call-subflow", lasting: false }, { subflowKey: "main", nodeKey: "h1-s2", definitionId: "builtin.control.call-subflow", lasting: false }, { subflowKey: "quick-add", nodeKey: "s2", definitionId: "web.dom.click", lasting: true }];
  const failed = attempt("s6", "failed", { lifecycle: handler("resolve", { event: "fail" }) });
  const body = attempt("h1-s2", "succeeded", { framePath: ["a", "b"] });
  const inPart = { ...attempt("s2", "succeeded", { framePath: ["a", "b", "c"] }), nodeId: `${PART}.s2` };
  assert.equal(MATRIX_CHECKS["known-alternative"](evidence({ steps, attempts: [failed, body, inPart] }), caseOf("8")).verdict, "passed");
  const bodyOnly = MATRIX_CHECKS["known-alternative"](evidence({ steps, attempts: [failed, body] }), caseOf("8"));
  assert.equal(bodyOnly.verdict, "failed");
  assert.match(bodyOnly.reasons.join(" "), /no attempt ran in a called part's frame/);
});
