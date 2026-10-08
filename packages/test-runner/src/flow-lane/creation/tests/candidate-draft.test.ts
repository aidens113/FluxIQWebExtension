import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { createdFlowCandidateDraft } from "../candidate-draft.js";
import { createdFlowCandidateDraftFailure, createdFlowCandidateDraftOutcome, readCreatedFlowCandidatePromotion } from "../candidate-outcome.js";
const candidate = { status: "draft", projectId: "project", flowId: "flow", candidateId: "candidate", revision: 1, digest: "a".repeat(64), sourceInstructionIds: ["instruction"], baseDependencyDigest: "base", baseSettingsRevision: 0, verification: "not_performed", promotionAllowed: false, accounting: { requestId: "request", estimatedInputTokens: 10 } };
test("actual draft wire is retained as unverified authoring for its original Lab subject", () => {
  const read = createdFlowCandidateDraft({ candidate }, { projectId: "project", flowId: "flow" });
  assert.equal(read?.candidateId, "candidate"); assert.equal(read?.verification, "not_performed"); assert.equal(read?.promotionAllowed, false);
  assert.equal(createdFlowCandidateDraft({ candidate }, { projectId: "foreign", flowId: "flow" }), null);
  assert.equal(createdFlowCandidateDraft({ adaptation: { status: "proposed" } }, { projectId: "project", flowId: "flow" }), null);
});

/** A Core answering the two reads a candidate outcome makes (t348). */
function candidateCore(answers: { adaptation?: unknown; sessions?: unknown }) {
  const reads: string[] = [];
  return { reads, control: { automationStudioCall: async (endpoint: string) => {
    reads.push(endpoint);
    if (endpoint === "get-flow-adaptation") return answers.adaptation;
    if (endpoint === "list-runtime-sessions") { if (answers.sessions instanceof Error) throw answers.sessions; return answers.sessions; }
    throw new Error(`unexpected ${endpoint}`);
  } } };
}
const session = (runId: string, queuedAt: number, trial: Record<string, unknown>) => ({ runId, flowId: "flow", queuedAt, metadata: { candidateTrial: { candidateId: "candidate", ...trial } } });

test("a direct build's draft carries its own verdict, run and codes, and the trials Core ran (t348)", async () => {
  const draft = createdFlowCandidateDraft({ candidate: { ...candidate, trial: { verdict: "unsure", runId: "trial.two", codes: ["candidate.trial_unsure", "not a code"] } } }, { projectId: "project", flowId: "flow" })!;
  const { control } = candidateCore({ sessions: { runtimeSessions: [session("trial.two", 2, { revision: 1, execution: "succeeded", start: "reset" }), session("trial.one", 1, { revision: 1, execution: "succeeded", start: "reset" })] } });
  const outcome = await createdFlowCandidateDraftOutcome(control, draft);
  assert.equal(outcome.outcome, "draft"); assert.equal(outcome.verdict, "unsure"); assert.equal(outcome.trialRunId, "trial.two");
  assert.deepEqual(outcome.codes, ["candidate.trial_unsure"], "only closed codes are kept");
  assert.deepEqual(outcome.trials?.map((trial) => trial.runId), ["trial.one", "trial.two"]);
  // A Core that answers no list leaves the trials unknown rather than empty; a read that fails is not read as no trials.
  assert.equal((await createdFlowCandidateDraftOutcome(candidateCore({ sessions: { runtimeSessions: "none" } }).control, draft)).trials, null);
  await assert.rejects(createdFlowCandidateDraftOutcome(candidateCore({ sessions: new Error("down") }).control, draft), /down/u);
});

test("a draft fails the lane as the product's outcome, with the candidate id and its verdicts (t348)", () => {
  const failure = createdFlowCandidateDraftFailure({ authoringMode: "candidate", outcome: "draft", draft: null, candidateId: "candidate", revision: 2, digest: null, verdict: "no", trialRunId: "trial.two", codes: ["candidate.trial_no"], judgeCalls: null, trialCount: 2, trials: [{ runId: "trial.one", revision: 1, digest: null, start: "reset", execution: "failed", code: "web.action.timeout", verdict: null }, { runId: "trial.two", revision: 2, digest: null, start: "reset", execution: "succeeded", code: null, verdict: null }], promotedAdaptationId: null }, "Its test run from the start was judged not to do what you asked.");
  assert.ok(failure instanceof RunnerFailure);
  assert.equal(failure.category, "runtime.behavior");
  assert.match(failure.message, /judged no \(candidate candidate; candidate\.trial_no\)/u);
  assert.deepEqual(failure.details, { code: "lab.candidate_not_promoted", stage: "verification", authoringMode: "candidate", candidateId: "candidate", revision: 2, verdict: "no", codes: ["candidate.trial_no"], trialRunId: "trial.two",
    trials: [{ runId: "trial.one", revision: 1, start: "reset", execution: "failed", code: "web.action.timeout" }, { runId: "trial.two", revision: 2, start: "reset", execution: "succeeded", code: null }] });
});

test("a proposal without Core's candidateTrial audit is not a candidate's (t348)", async () => {
  const { control, reads } = candidateCore({ adaptation: { adaptation: { metadata: { phase9: { auditEvents: [{ eventType: "created", detail: { buildJudged: { verdict: "yes" } } }] } } } } });
  assert.equal(await readCreatedFlowCandidatePromotion(control, { projectId: "project", flowId: "flow" }, "adaptation.one"), null);
  assert.deepEqual(reads, ["get-flow-adaptation"]);
});
