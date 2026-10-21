import assert from "node:assert/strict";
import test from "node:test";
import type { AutomationStudioFlowCandidate } from "fluxiq/automation-studio";
import { offlineTrialRequest } from "../offline-trial-request.js";
import type { CandidateRebuild, TracedRevision } from "../types.js";

const source: TracedRevision = {
  traceId: "trace.src", trialRunId: "trial.src", candidateId: "candidate.c", whole: { revision: 5, digest: "w5" },
  test: { step: 111, verdict: "no", code: "candidate.trial_judged_no", storedRows: 15 }, subflow: { briefId: "brief-1", revision: 10, digest: "s10", submitStep: 109 }, events: 89, artifacts: 4,
};
const candidate = { revision: 1, digest: "w5" } as unknown as AutomationStudioFlowCandidate;
const rebuilt = (matches: boolean): CandidateRebuild => ({
  briefId: "brief-1", submitStep: 109,
  subflow: { recorded: { revision: 10, digest: "s10" }, rebuiltDigest: matches ? "s10" : "s-other", matches },
  whole: { recorded: { revision: 5, digest: "w5" }, rebuiltDigest: matches ? "w5" : "w-other", matches },
  candidate, refusal: null,
});
const store = { automationDataDir: "a", projectId: "p", flowId: "f" };

test("a recorded revision runs only when Core's digests of the rebuild equal the recorded ones", () => {
  const request = offlineTrialRequest({ store, source, kind: "recorded_revision", rebuild: rebuilt(true), liveTwin: source });
  assert.deepEqual([request.candidate.kind, request.candidate.candidateId, request.candidate.subflowDigest, request.candidate.wholeDigest], ["recorded_revision", "candidate.c", "s10", "w5"]);
  assert.deepEqual(request.candidate.recorded, { subflow: { revision: 10, digest: "s10" }, whole: { revision: 5, digest: "w5" } });
  assert.deepEqual(request.liveTwin, { traceId: "trace.src", trialRunId: "trial.src", verdict: "no", code: "candidate.trial_judged_no", storedRows: 15 });
  assert.throws(() => offlineTrialRequest({ store, source, kind: "recorded_revision", rebuild: rebuilt(false), liveTwin: source }), /not the revision that ran live/);
});

test("a correction carries no recorded receipt, and a refused rebuild makes no request", () => {
  const correction = offlineTrialRequest({ store, source, kind: "tier1_correction", rebuild: { ...rebuilt(false), subflow: { recorded: null, rebuiltDigest: "s-new", matches: null }, whole: { recorded: null, rebuiltDigest: "w-new", matches: null } }, liveTwin: null });
  assert.equal(correction.candidate.recorded, null);
  assert.equal(correction.liveTwin, null);
  assert.throws(() => offlineTrialRequest({ store, source, kind: "recorded_revision", rebuild: { ...rebuilt(true), candidate: null, refusal: { stage: "subflow", codes: ["web.handle.unknown"], unresolved: [] } }, liveTwin: null }), /refused rebuild/);
});
