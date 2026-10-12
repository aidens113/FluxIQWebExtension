import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS } from "fluxiq/automation-studio";
import { RunnerFailure } from "../../../failure.js";
import { assertCreatedFlowVerificationReady, createdFlowVerificationReady, labCandidateTrialFixtureReset, labCandidateTrialReadiness, readCreatedFlowCandidateTrialReadiness, type CreatedFlowCandidateTrialReadiness } from "../readiness.js";

const refusedBeforeProvider = (mode: unknown, code = "lab.candidate_verification_unavailable") => (error: unknown) => error instanceof RunnerFailure && error.category === "facility.contract"
  && error.details?.code === code
  && error.details?.stage === "before_provider"
  && error.details?.providerInvocation === "not_attempted_by_this_entry"
  && error.details?.authoringMode === (typeof mode === "string" ? mode : "unrecognized");

const HOOKED: CreatedFlowCandidateTrialReadiness = { trialRunner: true, startReset: true, fixtureResetBetweenTrials: true, source: "core" };

test("a legacy-mode Core admits created-Flow qualification, whatever is said about candidate trials", () => {
  assert.doesNotThrow(() => assertCreatedFlowVerificationReady("legacy"));
  assert.equal(createdFlowVerificationReady("legacy"), true);
  assert.equal(createdFlowVerificationReady("legacy", { trialRunner: false, startReset: false, fixtureResetBetweenTrials: true, source: "core" }), true);
});

test("candidate mode admits only a Core with the trial runner and the start hook (t348)", () => {
  assert.doesNotThrow(() => assertCreatedFlowVerificationReady("candidate", HOOKED));
  assert.equal(createdFlowVerificationReady("candidate", HOOKED), true);
  assert.equal(createdFlowVerificationReady("candidate", { ...HOOKED, source: "lab-plan" }), true);
});

test("candidate mode without the trial runner is refused before any provider call", () => {
  assert.throws(() => assertCreatedFlowVerificationReady("candidate"), refusedBeforeProvider("candidate"));
  assert.throws(() => assertCreatedFlowVerificationReady("candidate", { trialRunner: false, startReset: true, fixtureResetBetweenTrials: true, source: "core" }), refusedBeforeProvider("candidate"));
  assert.equal(createdFlowVerificationReady("candidate"), false);
});

test("candidate mode without the start hook is refused before any provider call, naming the hook (t348)", () => {
  assert.throws(() => assertCreatedFlowVerificationReady("candidate", { trialRunner: true, startReset: false, fixtureResetBetweenTrials: true, source: "core" }), (error: unknown) => refusedBeforeProvider("candidate", "lab.candidate_start_hook_unset")(error)
    && (error as RunnerFailure).details?.candidateTrial !== undefined && /start hook/u.test((error as Error).message));
  assert.equal(createdFlowVerificationReady("candidate", { trialRunner: true, startReset: false, fixtureResetBetweenTrials: true, source: "lab-plan" }), false);
});

test("readiness cannot be changed by a caller or model verdict: only Core's exact modes, with Core's trial answer, admit", () => {
  for (const ignored of [undefined, true, "Legacy", " legacy", "Candidate", { ready: true, verified: true }, { consumed: true }]) {
    assert.throws(() => Reflect.apply(assertCreatedFlowVerificationReady, null, [ignored, HOOKED]), refusedBeforeProvider(ignored));
  }
  for (const verdict of [{ trialRunner: "yes", startReset: true }, { trialRunner: true, startReset: "true" }, { trialRunner: true }, { trialRunner: true, startReset: false, fixtureResetBetweenTrials: "false" }, { ready: true }, null]) {
    assert.equal(Reflect.apply(createdFlowVerificationReady, null, ["candidate", verdict]), false);
  }
});

test("before Core starts, the Lab says the linked Core has the trial runner and only a Core it starts gets the hook", () => {
  assert.deepEqual(labCandidateTrialReadiness({ startsCore: true, fixtureResetBetweenTrials: true }), { trialRunner: true, startReset: true, fixtureResetBetweenTrials: true, source: "lab-plan" });
  assert.deepEqual(labCandidateTrialReadiness({ startsCore: false, fixtureResetBetweenTrials: true }), { trialRunner: true, startReset: false, fixtureResetBetweenTrials: true, source: "lab-plan" });
  assert.throws(() => assertCreatedFlowVerificationReady("candidate", labCandidateTrialReadiness({ startsCore: false, fixtureResetBetweenTrials: true })), refusedBeforeProvider("candidate", "lab.candidate_start_hook_unset"));
});

// t470: since t462 the model resets the site before every trial, and a fixture reset between trials hid whether it
// worked. A live (paid) build runs with no start hook, is admitted only by a Core with none, and its receipt says so.
test("a live build's trials start from the model's own reset: no hook, admitted only by a Core with none, and the receipt says so", () => {
  assert.equal(labCandidateTrialFixtureReset({ live: true }), false);
  assert.equal(labCandidateTrialFixtureReset({ live: false }), true);
  for (const startsCore of [true, false]) {
    const planned = labCandidateTrialReadiness({ startsCore, fixtureResetBetweenTrials: false });
    assert.deepEqual(planned, { trialRunner: true, startReset: false, fixtureResetBetweenTrials: false, source: "lab-plan" });
    assert.doesNotThrow(() => assertCreatedFlowVerificationReady("candidate", planned));
  }
  const unhooked: CreatedFlowCandidateTrialReadiness = { trialRunner: true, startReset: false, fixtureResetBetweenTrials: false, source: "core" };
  assert.equal(createdFlowVerificationReady("candidate", unhooked), true);
  // A Core that would still reset between trials makes the receipt untrue, and is refused naming the hook.
  assert.throws(() => assertCreatedFlowVerificationReady("candidate", { ...unhooked, startReset: true }), (error: unknown) => refusedBeforeProvider("candidate", "lab.candidate_start_hook_set")(error)
    && ((error as RunnerFailure).details?.candidateTrial as { fixtureResetBetweenTrials?: unknown } | undefined)?.fixtureResetBetweenTrials === false);
  // Without the trial runner it is refused as before.
  assert.throws(() => assertCreatedFlowVerificationReady("candidate", { ...unhooked, trialRunner: false }), refusedBeforeProvider("candidate"));
});

test("once Core runs, its own generation readiness says whether it has the trial runner and the hook", async () => {
  const readiness = (startReset: boolean | undefined) => {
    const { candidateTrial, ...older } = AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS.capabilities;
    return { ...AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS, capabilities: startReset === undefined ? older : { ...older, candidateTrial: { ...candidateTrial, startReset } } };
  };
  const reads: Array<{ endpoint: string; payload: Record<string, unknown>; domainId: string | undefined }> = [];
  const control = (answer: unknown) => ({ automationStudioCall: async (endpoint: string, payload: Record<string, unknown>, _bounds?: unknown, domainId?: string) => { reads.push({ endpoint, payload, domainId }); return answer; } });
  assert.deepEqual(await readCreatedFlowCandidateTrialReadiness(control({ readiness: readiness(true) }), "web-automation"), { trialRunner: true, startReset: true, fixtureResetBetweenTrials: true, source: "core" });
  assert.deepEqual(await readCreatedFlowCandidateTrialReadiness(control({ readiness: readiness(false) }), "web-automation"), { trialRunner: true, startReset: false, fixtureResetBetweenTrials: true, source: "core" });
  assert.deepEqual(await readCreatedFlowCandidateTrialReadiness(control({ readiness: readiness(false) }), "web-automation", {}, false), { trialRunner: true, startReset: false, fixtureResetBetweenTrials: false, source: "core" });
  // A Core older than the trial runner, or any answer Core's own reader refuses, has no trial runner.
  for (const answer of [{ readiness: readiness(undefined) }, { readiness: { ...readiness(true), extra: true } }, { readiness: null }, null, "ready"]) {
    assert.deepEqual(await readCreatedFlowCandidateTrialReadiness(control(answer), "web-automation"), { trialRunner: false, startReset: false, fixtureResetBetweenTrials: true, source: "core" });
  }
  assert.deepEqual(reads[0], { endpoint: "get-flow-bootstrap-generation-readiness", payload: {}, domainId: "web-automation" });
});

test("the readiness read is retried like every safe read: first try plus 3 on a timeout, and a refusal is not retried", async () => {
  const path = "/api/programs/automation-studio/get-flow-bootstrap-generation-readiness";
  const timedOut = () => new RunnerFailure("environment.missing", "FluxIQ HTTP operation timed out", { details: { bounded: "timeout", operationStage: "control.request", timeoutMs: 30_000, path } });
  const fake = (answers: unknown[]) => {
    let clock = 0;
    const pauses: number[] = [];
    let calls = 0;
    return {
      pauses, calls: () => calls,
      control: {
        automationStudioCall: async () => { calls += 1; clock += 30_000; const answer = answers.length > 1 ? answers.shift() : answers[0]; if (answer instanceof Error) throw answer; return answer; },
        readClock: { now: () => clock, sleep: async (ms: number) => { pauses.push(ms); clock += ms; } },
      },
    };
  };
  const answered = fake([timedOut(), timedOut(), timedOut(), { readiness: AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS }]);
  assert.equal((await readCreatedFlowCandidateTrialReadiness(answered.control, "web-automation")).trialRunner, true);
  assert.equal(answered.calls(), 4);
  assert.deepEqual(answered.pauses, [500, 1_000, 2_000]);

  const never = fake([timedOut()]);
  await assert.rejects(readCreatedFlowCandidateTrialReadiness(never.control, "web-automation"), (error: unknown) => error instanceof RunnerFailure
    && error.message === "FluxIQ HTTP operation timed out" && error.details?.path === path
    && error.details?.endpoint === "get-flow-bootstrap-generation-readiness" && error.details?.attempts === 4);
  assert.equal(never.calls(), 4);

  const refusal = new RunnerFailure("facility.contract", "Core refused a value the Lab sent", { details: { path, status: 400 } });
  const refused = fake([refusal]);
  await assert.rejects(readCreatedFlowCandidateTrialReadiness(refused.control, "web-automation"), (error: unknown) => error === refusal);
  assert.equal(refused.calls(), 1);
});
