// A granted Flow run is finished only when Core has finished with it. A
// recovery runs after the failed status is saved, so a run read at that moment
// is not the finished run, and tearing Core down then ends the recovery before
// it has recorded anything: every `--flow` repair run on 2026-09-21 reported no
// provider call and no recovery that way (`run-mubosmk0-57653b21`).

import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { FLUXIQ_HTTP_MAX_TIMEOUT_MS, type FluxIQHttpOptions } from "../../http-control/index.js";
import { executeRecordedFlowRun, type PersistedFlowLlmExecution, type PersistedFlowRunControl } from "../persisted-flow-run.js";

const failedAttempt = { attemptId: "attempt.one", nodeId: "node.one", definitionId: "builtin.policy.action", order: 0, status: "failed", startedAt: 1_000, finishedAt: 1_030 };
/** The recovery ladder's placeholder, written with the run's first save: present before the recovery has done anything. */
const ladderPlaceholder = { interventionId: "recovery.diagnosis", kind: "diagnosis", validation: { ok: false } };
const recovering = { summary: { status: "failed" }, actionAttempts: [failedAttempt], interventions: [ladderPlaceholder] };
const recovered = { ...recovering, metadata: { llmGate: { invoked: true, patchSkippedCode: "llm.runtime_patch_permission_required" }, recoveryTrace: { stages: [] } } };

type Script = {
  purpose: PersistedFlowLlmExecution["purpose"];
  /** What the one request that runs the Flow does: answer, or time out. */
  request: "answers" | "times out";
  /** The details Core serves, one per read; the last is served from then on. */
  details: Array<Record<string, unknown>>;
};

function granted(script: Script) {
  const requestBounds: FluxIQHttpOptions[] = [];
  let reads = 0;
  let named = "";
  const clock = { value: 0 };
  const client = {
    selectExistingContext: async () => {},
    getRunDetail: async () => ({ interventions: [{ kind: "diagnosis", validationOk: false, validationCodes: [] }], runtimePatchAttempts: [], adaptationIds: [], changeProposalIds: [] }),
    automationStudioCall: async (endpoint: string, payload: Record<string, unknown>, bounds: FluxIQHttpOptions = {}) => {
      if (endpoint === "run-runtime-session") {
        requestBounds.push(bounds);
        named = String(payload.newRunId);
        if (script.request === "times out") throw new RunnerFailure("environment.missing", "FluxIQ HTTP operation timed out", { details: { bounded: "timeout", timeoutMs: bounds.timeoutMs } });
        return { runtimeSession: { runId: named, status: "failed", flowId: "flow.new" } };
      }
      const next = script.details[Math.min(reads, script.details.length - 1)]!;
      reads += 1;
      return { runDetail: { ...next, summary: { runId: named, ...(next.summary as Record<string, unknown>) } } };
    },
  } as unknown as PersistedFlowRunControl;
  const run = () => executeRecordedFlowRun(
    client,
    { projectId: "project.web", flowId: "flow.new", facilityRunId: "run-lab", llmExecution: { grantId: "llm-grant:test", purpose: script.purpose } },
    {},
    { now: () => clock.value, sleep: async (ms) => { clock.value += ms; } },
  );
  return { run, requestBounds, reads: () => reads, clock };
}

test("the request that runs a granted Flow is held as long as one request may be, never the client's 30-second default", async () => {
  const lab = granted({ purpose: "explore_and_adapt", request: "answers", details: [recovered] });
  await lab.run();

  assert.equal(lab.requestBounds.length, 1);
  assert.equal(lab.requestBounds[0]!.timeoutMs, FLUXIQ_HTTP_MAX_TIMEOUT_MS);
});

test("a failed repair run whose request timed out is read until Core's recovery has recorded how it ended", async () => {
  const running = { summary: { status: "running" }, actionAttempts: [], interventions: [] };
  const lab = granted({ purpose: "explore_and_adapt", request: "times out", details: [running, recovering, recovering, recovering, recovered] });
  const outcome = await lab.run();

  // A failed status with the ladder's placeholder beside it is not the
  // finished run; the reads go on until the gate and the trace are in.
  assert.equal(lab.reads(), 5);
  assert.equal(outcome.status, "failed");
  assert.equal(outcome.harnessRecovery.attempted, true);
});

test("an answered request is still read until the recovery is in, should Core ever answer early", async () => {
  const lab = granted({ purpose: "diagnose_and_adapt", request: "answers", details: [recovering, recovered] });
  const outcome = await lab.run();

  assert.equal(lab.reads(), 2);
  assert.equal(outcome.status, "failed");
});

test("a run left with a failed attempt waits the full recovery record wait, and is still the run that happened", async () => {
  // Core's recovery record is evidence *about* a run whose outcome is already
  // written, and nothing that judges a created Flow reads it. Failing the run
  // for its absence threw away a complete product result and reported
  // `performance.budget` instead -- a verdict about the harness
  // (`run-mudslg9p-c59266aa`). The run is reported, and the absence with it.
  const lab = granted({ purpose: "explore_and_adapt", request: "times out", details: [recovering] });
  const outcome = await lab.run();

  assert.equal(outcome.status, "failed");
  assert.equal(outcome.unsettled, "recovery");
  assert.equal(outcome.actions.length, 1);
  // Bounded by the recovery record's own wait, measured from the first
  // terminal read, rather than by the grant's whole run lease.
  assert.ok(lab.clock.value >= 300_000 && lab.clock.value <= 301_000, `waited ${lab.clock.value} ms`);
});

/**
 * `run-mudwci8d-de88aa32` and `run-mudw1ktb-0557816b`, 2026-09-23. Neither run
 * left a failed attempt: the first recovered both faults it met on retry, and
 * the second's five attempts all succeeded and Core simply refuted the answer.
 * Core's recovery plans from a failed attempt's diagnosis, so for both the
 * whole plan was one `stop` -- and both spent 5 min 11 s of a run of 7 to 8
 * minutes waiting for the record of it.
 */
test("a failed run that left no failed attempt has no recovery to wait for, so it settles instead of spending five minutes", async () => {
  const succeeded = { ...failedAttempt, status: "succeeded" };
  const cleanRun = { summary: { status: "failed" }, actionAttempts: [succeeded], interventions: [ladderPlaceholder] };
  const lab = granted({ purpose: "explore_and_adapt", request: "times out", details: [cleanRun] });
  const outcome = await lab.run();

  assert.equal(outcome.status, "failed");
  // Reported exactly as it was, and as honestly: Core never said, and that is
  // still the difference between "Core recovered nothing" and "Core never said".
  assert.equal(outcome.unsettled, "recovery");
  assert.ok(lab.clock.value <= 6_000, `waited ${lab.clock.value} ms`);

  // The same run, with the ladder having recovered the one fault it met, is
  // still a run with nothing left to diagnose.
  const recoveredRun = { ...cleanRun, actionAttempts: [failedAttempt, { ...failedAttempt, attemptId: "attempt.two", order: 1, status: "succeeded" }] };
  const absorbed = granted({ purpose: "explore_and_adapt", request: "times out", details: [recoveredRun] });
  assert.equal((await absorbed.run()).unsettled, "recovery");
  assert.ok(absorbed.clock.value <= 6_000, `waited ${absorbed.clock.value} ms`);

  // And the record is still read when it does arrive inside the grace, because
  // the rule is about what Core can plan from, not about what it has written.
  const late = granted({ purpose: "explore_and_adapt", request: "times out", details: [cleanRun, cleanRun, { ...recovered, actionAttempts: [succeeded] }] });
  const settled = await late.run();
  assert.equal(settled.unsettled, undefined);
  assert.equal(late.reads(), 3);
});

test("a run still missing its verdict when the wait runs out fails, because reading it would report a pass the verdict may take away", async () => {
  const unjudged = { summary: { status: "succeeded" }, actionAttempts: [{ ...failedAttempt, status: "succeeded" }], interventions: [] };
  const lab = granted({ purpose: "verify_result", request: "times out", details: [unjudged] });

  await assert.rejects(lab.run(), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "performance.budget");
    assert.equal(error.details?.code, "flow_lane.granted_run_unsettled");
    assert.equal(error.details?.pending, "verdict");
    return true;
  });
  // The verdict keeps the grant's own run lease: it decides the run's outcome.
  assert.ok(lab.clock.value >= 600_000 && lab.clock.value <= 601_000, `waited ${lab.clock.value} ms`);
});

test("a verify_result run buys no recovery, so its failure is final as soon as it is written", async () => {
  const lab = granted({ purpose: "verify_result", request: "times out", details: [recovering] });
  const outcome = await lab.run();

  assert.equal(lab.reads(), 1);
  assert.equal(outcome.status, "failed");
});
