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

// Row 14 (t968): a press the page never answered is not a success.
test("act-effect-honest passes a run whose every success the next step could build on, and says which defence answered", () => {
  const attempts = [
    attempt("s1", "succeeded"),
    attempt("s2", "failed", { failure: { category: "page_changed", code: "web.page.changed" } }),
    attempt("s2", "succeeded", { retry: true }),
    attempt("s3", "succeeded")
  ];
  const checked = MATRIX_CHECKS["act-effect-honest"](evidence({ attempts }), caseOf("14"));
  assert.equal(checked.verdict, "passed");
  assert.equal(checked.observed.pageWentBeforePress, 1);
});

test("act-effect-honest fails a success the next step never found its target after, as run-mwohvt8n-a57cad8a's click", () => {
  const notFound = { category: "target_not_found", code: "web.target.not_found" };
  const attempts = [attempt("s1", "succeeded"), attempt("s2", "failed", { failure: notFound }), attempt("s2", "failed", { failure: notFound, retry: true })];
  const checked = MATRIX_CHECKS["act-effect-honest"](evidence({ attempts, run: { status: "failed", failure: null, stopCode: null } }), caseOf("14"));
  assert.equal(checked.verdict, "failed");
  assert.ok(checked.reasons.some(reason => /answered success, and the step after it never found its target/u.test(reason)));
  // A slow page the next step found its target on at a retry is no false success.
  const slow = [attempt("s1", "succeeded"), attempt("s2", "failed", { failure: notFound }), attempt("s2", "succeeded", { retry: true })];
  assert.equal(MATRIX_CHECKS["act-effect-honest"](evidence({ attempts: slow }), caseOf("14")).verdict, "passed");
});

// Row 15 (t972): a check a person cleared is gone on from at its step, the Flow's last step included.
// The steps as case 15's Flow saves them: an optional step, then the merge its plan adds, twice, then the search and the presses.
const CASE_15_STEPS = ["s1", "s2", "s3", "s4", "s5", "s6", "s7", "s8", "s9", "s10"].map(nodeKey => ({ subflowKey: "main", nodeKey, definitionId: nodeKey === "s2" || nodeKey === "s4" ? "builtin.control.merge" : "web.output.dom-click", lasting: false }));
const PERSON_CHECK = { category: "user_intervention_required", code: "web.intervention.required" };

test("person-cleared-resume passes a run that went on from each cleared step to its end, as matrix run rmx-2026-11-20T10-04-51-026Z-2f5801 did", () => {
  const attempts = [
    ...["s1", "s2", "s3", "s4", "s5", "s6"].map(step => attempt(step, "succeeded")),
    attempt("s7", "failed", { failure: PERSON_CHECK, clearedByPerson: true }),
    ...["s8", "s9"].map(step => attempt(step, "succeeded")),
    attempt("s10", "failed", { failure: PERSON_CHECK, clearedByPerson: true }),
  ];
  const checked = MATRIX_CHECKS["person-cleared-resume"](evidence({ steps: CASE_15_STEPS, attempts }), caseOf("15"));
  assert.equal(checked.verdict, "passed", checked.reasons.join("; "));
  assert.deepEqual(checked.observed.clearedSteps, ["s7", "s10"]);
  assert.equal(checked.observed.lastStep, "s10");
});

test("person-cleared-resume fails the run that ended at the last step the person cleared, as run-mwoq9g4l-dbd69bd6 did", () => {
  const ended = MATRIX_CHECKS["person-cleared-resume"](evidence({ steps: CASE_15_STEPS, run: { status: "failed", failure: PERSON_CHECK, stopCode: null }, attempts: [attempt("s7", "failed", { failure: PERSON_CHECK, clearedByPerson: true }), attempt("s10", "failed", { failure: PERSON_CHECK, clearedByPerson: true })] }), caseOf("15"));
  assert.equal(ended.verdict, "failed");
  assert.ok(ended.reasons.some(reason => /Core reported the run failed/u.test(reason)));
  // A check nobody cleared at a step the case names is no proof, and neither is one cleared elsewhere.
  const missed = MATRIX_CHECKS["person-cleared-resume"](evidence({ steps: CASE_15_STEPS, attempts: [attempt("s6", "failed", { failure: PERSON_CHECK, clearedByPerson: true }), attempt("s10", "failed", { failure: PERSON_CHECK, clearedByPerson: true })] }), caseOf("15"));
  assert.deepEqual(missed.reasons, ["step s7 did not meet a check the person cleared", "the person cleared a check at step(s) s6, which the case does not expect"]);
});
