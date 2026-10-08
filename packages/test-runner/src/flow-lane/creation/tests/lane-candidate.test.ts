import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { createdFlowLaneSnapshot } from "../snapshot.js";
import { ADAPTATION_ID, FLOW_ID, PROJECT_ID, fakeCreationCore, type FakeCreationCoreOptions } from "./fake-creation-core.js";
import { runLane } from "./lane-harness.js";

/**
 * The created-Flow lane in candidate authoring mode (t348, design unit U4),
 * against a fake Core: it admits only a Core that test-runs candidates and was
 * started with the start hook on the Lab's fixture reset, asked before any
 * build; a candidate that stayed a draft fails as the product's outcome with
 * its id and verdicts and is never applied or run; a promoted candidate goes on
 * to the same reset, playback and oracle as a legacy build, and the evidence
 * says which candidate and trials it came from.
 */

const DIGEST = "c".repeat(64);
const SESSIONS = [
  { runId: "trial.one", flowId: FLOW_ID, queuedAt: 10, status: "failed", metadata: { candidateTrial: { candidateId: "candidate.lab", revision: 1, digest: DIGEST, start: "reset", execution: "failed", code: "web.action.timeout" } } },
  { runId: "trial.two", flowId: FLOW_ID, queuedAt: 20, status: "succeeded", metadata: { candidateTrial: { candidateId: "candidate.lab", revision: 2, digest: DIGEST, start: "reset", execution: "succeeded" } } },
];
const draft = (trial: Record<string, unknown>) => ({ status: "draft", projectId: PROJECT_ID, flowId: FLOW_ID, candidateId: "candidate.lab", revision: 2, digest: DIGEST, sourceInstructionIds: ["instruction.one"], baseDependencyDigest: "base", baseSettingsRevision: 0, verification: "not_performed", promotionAllowed: false, accounting: { requestId: "request.one", estimatedInputTokens: 10, provider: "deepseek", estimatedCostUsd: 0.03 }, trial });
const candidateCore = (options: FakeCreationCoreOptions = {}) => fakeCreationCore({ candidateReadiness: { startReset: true }, runtimeSessions: SESSIONS, ...options });

test("candidate mode against a Core started without the start hook reads its readiness and refuses before any build (t348)", async () => {
  const core = fakeCreationCore({ candidateReadiness: { startReset: false } });
  const { run, incomplete } = await runLane(core, { authoringMode: "candidate" });
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "facility.contract" && error.details?.code === "lab.candidate_start_hook_unset" && error.details?.stage === "before_provider");
  assert.deepEqual(core.calls, ["get-flow-bootstrap-generation-readiness"], "no Flow, no authorizer, no build");
  assert.equal(incomplete.length, 0);
});

test("a candidate that stayed a draft fails as runtime.behavior with its id and verdicts, and is never applied or run (t348)", async () => {
  const core = candidateCore({ generation: { kind: "candidate-draft", candidate: draft({ verdict: "no", runId: "trial.two", codes: ["candidate.trial_no"] }) } });
  const { run, incomplete } = await runLane(core, { authoringMode: "candidate" });
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior"
    && error.details?.code === "lab.candidate_not_promoted" && error.details?.candidateId === "candidate.lab" && error.details?.verdict === "no"
    && JSON.stringify(error.details?.codes) === JSON.stringify(["candidate.trial_no"])
    && JSON.stringify(error.details?.trials) === JSON.stringify([{ runId: "trial.one", revision: 1, start: "reset", execution: "failed", code: "web.action.timeout" }, { runId: "trial.two", revision: 2, start: "reset", execution: "succeeded", code: null }]));
  assert.equal(core.generationRequests[0]?.authoringMode, "candidate", "the build asks Core for a tested candidate");
  for (const never of ["approve", "apply", "reset:/__control/reset", "run", "oracle"]) assert.ok(!core.calls.includes(never), `${never} never happens for a draft`);
  assert.equal(core.calls[0], "get-flow-bootstrap-generation-readiness");
  // The incomplete flow-lane.json says which mode, which candidate, and what each trial came to.
  const stopped = incomplete[0]!;
  assert.equal(stopped.authoringMode, "candidate");
  assert.equal(stopped.candidate?.candidateId, "candidate.lab");
  assert.equal(stopped.candidate?.verdict, "no");
  assert.equal(stopped.candidate?.outcome, "draft");
  assert.deepEqual(stopped.candidate?.trials?.map((trial) => trial.runId), ["trial.one", "trial.two"]);
  assert.equal(stopped.build?.accounting?.estimatedCostUsd, 0.03, "what the build spent is kept for the settlement");
});

test("a promoted candidate reaches the reset, playback and oracle unchanged, and the evidence names it (t348)", async () => {
  const core = candidateCore({ candidateTrial: { candidateId: "candidate.lab", revision: 2, digest: DIGEST, trial: { runId: "trial.two", verdict: "yes", calls: 2, start: "reset" }, trials: 2 } });
  const legacy = fakeCreationCore();
  const [{ run, evidence }, legacyLane] = [await runLane(core, { authoringMode: "candidate" }), await runLane(legacy)];
  const outcome = await run;
  await legacyLane.run;
  // After the readiness read and the candidate reads, the very calls a legacy lane makes, in the same order.
  const candidateOnly = new Set(["get-flow-bootstrap-generation-readiness", "list-runtime-sessions"]);
  assert.deepEqual(core.calls.filter((call) => !candidateOnly.has(call)), legacy.calls.map((call) => call === "get-flow-adaptation" ? [call, "get-flow-adaptation"] : [call]).flat());
  assert.equal(core.calls[0], "get-flow-bootstrap-generation-readiness");
  for (const step of ["approve", "apply", "reset:/__control/reset", "run", "oracle", "publish"]) assert.ok(core.calls.includes(step), `${step} happens for a promoted candidate`);
  assert.equal(outcome.authoringMode, "candidate");
  assert.deepEqual({ ...outcome.build.candidateOutcome, trials: outcome.build.candidateOutcome?.trials?.map((trial) => trial.runId) }, { authoringMode: "candidate", outcome: "promoted", draft: null, candidateId: "candidate.lab", revision: 2, digest: DIGEST, verdict: "yes", trialRunId: "trial.two", codes: [], judgeCalls: 2, trialCount: 2, trials: ["trial.one", "trial.two"], promotedAdaptationId: ADAPTATION_ID });
  const snapshot = createdFlowLaneSnapshot(evidence[0]!);
  assert.equal(snapshot.authoringMode, "candidate");
  assert.equal(snapshot.candidate?.promotedAdaptationId, ADAPTATION_ID);
  assert.equal(createdFlowLaneSnapshot((await legacyLane.run)).candidate, null);
});

test("a candidate-mode proposal that names no tested candidate is never applied (t348)", async () => {
  const core = candidateCore();
  const { run } = await runLane(core, { authoringMode: "candidate" });
  await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && error.details?.code === "lab.candidate_proposal_unattributed" && error.details?.adaptationId === ADAPTATION_ID);
  assert.ok(!core.calls.includes("approve") && !core.calls.includes("apply"));
});
