import assert from "node:assert/strict";
import test from "node:test";
import { AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS } from "fluxiq/automation-studio";
import { RunnerFailure } from "../../../failure.js";
import { assertCreatedFlowVerificationReady, createdFlowVerificationReady, labCandidateTrialReadiness, readCreatedFlowCandidateTrialReadiness, type CreatedFlowCandidateTrialReadiness } from "../readiness.js";

const refusedBeforeProvider = (mode: unknown, code = "lab.candidate_verification_unavailable") => (error: unknown) => error instanceof RunnerFailure && error.category === "facility.contract"
  && error.details?.code === code
  && error.details?.stage === "before_provider"
  && error.details?.providerInvocation === "not_attempted_by_this_entry"
  && error.details?.authoringMode === (typeof mode === "string" ? mode : "unrecognized");

const HOOKED: CreatedFlowCandidateTrialReadiness = { trialRunner: true, startReset: true, source: "core" };

test("a legacy-mode Core admits created-Flow qualification, whatever is said about candidate trials", () => {
  assert.doesNotThrow(() => assertCreatedFlowVerificationReady("legacy"));
  assert.equal(createdFlowVerificationReady("legacy"), true);
  assert.equal(createdFlowVerificationReady("legacy", { trialRunner: false, startReset: false, source: "core" }), true);
});

test("candidate mode admits only a Core with the trial runner and the start hook (t348)", () => {
  assert.doesNotThrow(() => assertCreatedFlowVerificationReady("candidate", HOOKED));
  assert.equal(createdFlowVerificationReady("candidate", HOOKED), true);
  assert.equal(createdFlowVerificationReady("candidate", { ...HOOKED, source: "lab-plan" }), true);
});

test("candidate mode without the trial runner is refused before any provider call", () => {
  assert.throws(() => assertCreatedFlowVerificationReady("candidate"), refusedBeforeProvider("candidate"));
  assert.throws(() => assertCreatedFlowVerificationReady("candidate", { trialRunner: false, startReset: true, source: "core" }), refusedBeforeProvider("candidate"));
  assert.equal(createdFlowVerificationReady("candidate"), false);
});

test("candidate mode without the start hook is refused before any provider call, naming the hook (t348)", () => {
  assert.throws(() => assertCreatedFlowVerificationReady("candidate", { trialRunner: true, startReset: false, source: "core" }), (error: unknown) => refusedBeforeProvider("candidate", "lab.candidate_start_hook_unset")(error)
    && (error as RunnerFailure).details?.candidateTrial !== undefined && /start hook/u.test((error as Error).message));
  assert.equal(createdFlowVerificationReady("candidate", { trialRunner: true, startReset: false, source: "lab-plan" }), false);
});

test("readiness cannot be changed by a caller or model verdict: only Core's exact modes, with Core's trial answer, admit", () => {
  for (const ignored of [undefined, true, "Legacy", " legacy", "Candidate", { ready: true, verified: true }, { consumed: true }]) {
    assert.throws(() => Reflect.apply(assertCreatedFlowVerificationReady, null, [ignored, HOOKED]), refusedBeforeProvider(ignored));
  }
  for (const verdict of [{ trialRunner: "yes", startReset: true }, { trialRunner: true, startReset: "true" }, { ready: true }, null]) {
    assert.equal(Reflect.apply(createdFlowVerificationReady, null, ["candidate", verdict]), false);
  }
});

test("before Core starts, the Lab says the linked Core has the trial runner and only a Core it starts gets the hook", () => {
  assert.deepEqual(labCandidateTrialReadiness({ startsCore: true }), { trialRunner: true, startReset: true, source: "lab-plan" });
  assert.deepEqual(labCandidateTrialReadiness({ startsCore: false }), { trialRunner: true, startReset: false, source: "lab-plan" });
  assert.throws(() => assertCreatedFlowVerificationReady("candidate", labCandidateTrialReadiness({ startsCore: false })), refusedBeforeProvider("candidate", "lab.candidate_start_hook_unset"));
});

test("once Core runs, its own generation readiness says whether it has the trial runner and the hook", async () => {
  const readiness = (startReset: boolean | undefined) => {
    const { candidateTrial, ...older } = AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS.capabilities;
    return { ...AUTOMATION_STUDIO_FLOW_BOOTSTRAP_GENERATION_READINESS, capabilities: startReset === undefined ? older : { ...older, candidateTrial: { ...candidateTrial, startReset } } };
  };
  const reads: Array<{ endpoint: string; payload: Record<string, unknown>; domainId: string | undefined }> = [];
  const control = (answer: unknown) => ({ automationStudioCall: async (endpoint: string, payload: Record<string, unknown>, _bounds?: unknown, domainId?: string) => { reads.push({ endpoint, payload, domainId }); return answer; } });
  assert.deepEqual(await readCreatedFlowCandidateTrialReadiness(control({ readiness: readiness(true) }), "web-automation"), { trialRunner: true, startReset: true, source: "core" });
  assert.deepEqual(await readCreatedFlowCandidateTrialReadiness(control({ readiness: readiness(false) }), "web-automation"), { trialRunner: true, startReset: false, source: "core" });
  // A Core older than the trial runner, or any answer Core's own reader refuses, has no trial runner.
  for (const answer of [{ readiness: readiness(undefined) }, { readiness: { ...readiness(true), extra: true } }, { readiness: null }, null, "ready"]) {
    assert.deepEqual(await readCreatedFlowCandidateTrialReadiness(control(answer), "web-automation"), { trialRunner: false, startReset: false, source: "core" });
  }
  assert.deepEqual(reads[0], { endpoint: "get-flow-bootstrap-generation-readiness", payload: {}, domainId: "web-automation" });
});
