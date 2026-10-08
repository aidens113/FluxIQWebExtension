import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { createdFlowLaneSnapshot } from "../snapshot.js";
import { ADAPTATION_ID, FLOW_ID, PROJECT_ID, fakeCreationCore, type FakeCreationCoreOptions } from "./fake-creation-core.js";
import { chatCore } from "./chat-core.js";
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

// Lane A round 6 (`run-muz2cj6p-80eb2179`, t367): the chat's build tested its
// candidate four times from the Lab's reset, the fourth was judged yes, Core
// promoted it and the chat applied it. The proposal carried the promotion's
// `candidateTrial` audit and no legacy evidence-loop audit, and the Lab refused
// it as `lab.proposal_without_evidence_audit` before it read the candidate, so
// `flow-lane.json` said `candidate: null` and nothing was reset, played or
// checked against the oracle.
const ROUND_6_SESSIONS = [1, 2, 3, 4].map((trial) => ({
  runId: `trial.${trial}`, flowId: FLOW_ID, queuedAt: trial * 10, status: trial === 4 ? "succeeded" : "failed",
  metadata: { candidateTrial: { candidateId: "candidate.round6", revision: Math.max(2, trial), digest: DIGEST, start: "reset", execution: trial === 4 ? "succeeded" : "failed", ...(trial === 4 ? {} : { code: "web.action.timeout" }) } },
}));
const ROUND_6_PROMOTION = { candidateId: "candidate.round6", revision: 4, digest: DIGEST, trial: { runId: "trial.4", verdict: "yes", calls: 2, start: "reset" }, trials: 4 };
const round6Core = (options: FakeCreationCoreOptions = {}) => chatCore({ candidateReadiness: { startReset: true }, evidenceLoop: null, candidateTrial: ROUND_6_PROMOTION, runtimeSessions: ROUND_6_SESSIONS, ...options });

test("round 6: a promoted candidate the chat applied, with its trial audit and no evidence-loop audit, reaches the reset, playback and oracle in order with the candidate recorded (t367)", async () => {
  const { core, entry } = round6Core();
  const { run, evidence, incomplete } = await runLane(core, { authoringMode: "candidate", entry });
  const outcome = await run;
  assert.equal(incomplete.length, 0, "the run was never stopped at the build");
  assert.equal(outcome.build.outcome, "proposed");
  assert.equal(outcome.build.failure, null);
  assert.equal(outcome.build.evidenceLoop, null, "Core published no evidence-loop audit, and none is invented");
  assert.equal(outcome.build.providerCalls, null);
  assert.equal(outcome.build.chat?.ending, "created");
  // The Lab's own checks, in order, after the chat applied the Flow: the fixture reset, the page presented for playback, the run, the oracle, the evidence.
  const order = ["reset:/__control/reset", "prepare", "run", "oracle", "publish"].map((step) => core.calls.lastIndexOf(step));
  assert.ok(order.every((index) => index >= 0), `every step happened: ${JSON.stringify(core.calls)}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, `in order: ${JSON.stringify(core.calls)}`);
  assert.ok(!core.calls.includes("approve") && !core.calls.includes("apply"), "the chat applied its own proposal; the Lab does not apply it again");
  assert.deepEqual(outcome.build.candidateOutcome, {
    authoringMode: "candidate", outcome: "promoted", draft: null, candidateId: "candidate.round6", revision: 4, digest: DIGEST, verdict: "yes", trialRunId: "trial.4", codes: [], judgeCalls: 2, trialCount: 4,
    trials: [
      { runId: "trial.1", revision: 2, digest: DIGEST, start: "reset", execution: "failed", code: "web.action.timeout", verdict: null },
      { runId: "trial.2", revision: 2, digest: DIGEST, start: "reset", execution: "failed", code: "web.action.timeout", verdict: null },
      { runId: "trial.3", revision: 3, digest: DIGEST, start: "reset", execution: "failed", code: "web.action.timeout", verdict: null },
      { runId: "trial.4", revision: 4, digest: DIGEST, start: "reset", execution: "succeeded", code: null, verdict: "yes" },
    ],
    promotedAdaptationId: ADAPTATION_ID,
  });
  const snapshot = createdFlowLaneSnapshot(evidence[0]!);
  assert.equal(snapshot.candidate?.candidateId, "candidate.round6", "flow-lane.json names the candidate");
  assert.equal(snapshot.candidate?.promotedAdaptationId, ADAPTATION_ID);
});

test("a promoted candidate the Lab built directly, with its trial audit and no evidence-loop audit, is applied, reset, played and checked (t367)", async () => {
  const core = candidateCore({ evidenceLoop: null, candidateTrial: { ...ROUND_6_PROMOTION, candidateId: "candidate.lab", trial: { ...ROUND_6_PROMOTION.trial, runId: "trial.two" } } });
  const { run } = await runLane(core, { authoringMode: "candidate" });
  const outcome = await run;
  for (const step of ["approve", "apply", "reset:/__control/reset", "run", "oracle", "publish"]) assert.ok(core.calls.includes(step), `${step} happens`);
  assert.equal(outcome.build.candidateOutcome?.outcome, "promoted");
  assert.deepEqual(outcome.build.candidateOutcome?.trials?.map((trial) => trial.verdict), [null, "yes"]);
});

test("without the evidence-loop audit, a proposal is refused unless candidate mode reads a whole promotion on it (t367)", async () => {
  const refusedAt = async (options: FakeCreationCoreOptions, authoringMode: "legacy" | "candidate", why: string) => {
    for (const viaChat of [false, true]) {
      const { core, entry } = viaChat ? round6Core(options) : { core: candidateCore({ evidenceLoop: null, candidateTrial: ROUND_6_PROMOTION, runtimeSessions: ROUND_6_SESSIONS, ...options }), entry: undefined };
      const { run } = await runLane(core, { authoringMode, ...(entry ? { entry } : {}) });
      await assert.rejects(run, (error: unknown) => error instanceof RunnerFailure && error.category === "runtime.behavior" && /lab\.proposal_without_evidence_audit/u.test(error.message), `${why}${viaChat ? " (chat)" : " (direct)"}`);
      for (const never of ["reset:/__control/reset", "run", "oracle"]) assert.ok(!core.calls.includes(never), `${never} never happens: ${why}`);
    }
  };
  await refusedAt({}, "legacy", "legacy mode still needs its evidence audit, whatever the proposal says of a candidate");
  await refusedAt({ candidateTrial: undefined }, "candidate", "a candidate-mode proposal with no promotion on it");
  await refusedAt({ candidateTrial: { ...ROUND_6_PROMOTION, trial: { ...ROUND_6_PROMOTION.trial, verdict: "no" } } }, "candidate", "a promotion whose trial was not judged yes");
  await refusedAt({ candidateTrial: { ...ROUND_6_PROMOTION, trial: { ...ROUND_6_PROMOTION.trial, calls: 0 } } }, "candidate", "a promotion no judge was called for");
  await refusedAt({ candidateTrial: { ...ROUND_6_PROMOTION, trial: { verdict: "yes", calls: 2 } } }, "candidate", "a promotion that names no trial run");
});
