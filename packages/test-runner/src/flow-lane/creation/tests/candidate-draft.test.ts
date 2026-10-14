import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../failure.js";
import { createdFlowCandidateDraft } from "../candidate-draft.js";
import { createdFlowCandidateDraftFailure, createdFlowCandidateDraftOutcome, createdFlowChatCandidateDraftOutcome, createdFlowFailedCandidateOutcome, readCreatedFlowCandidatePromotion } from "../candidate-outcome.js";
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
const session = (runId: string, queuedAt: number, trial: Record<string, unknown>) => ({ runId, flowId: "flow", queuedAt, candidateTrial: { candidateId: "candidate", ...trial } });

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
  const failure = createdFlowCandidateDraftFailure({ authoringMode: "candidate", outcome: "draft", draft: null, candidateId: "candidate", revision: 2, digest: null, verdict: "no", trialRunId: "trial.two", codes: ["candidate.trial_no"], judgeCalls: null, trialCount: 2, trials: [{ runId: "trial.one", revision: 1, digest: null, start: "reset", execution: "failed", code: "web.action.timeout", verdict: null, reason: null }, { runId: "trial.two", revision: 2, digest: null, start: "reset", execution: "succeeded", code: null, verdict: null, reason: null }], promotedAdaptationId: null }, "Its test run from the start was judged not to do what you asked.");
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

// W4 (automation-project-agents-plan): a project build's outcome is read as a candidate's. Its supervisor assembles the
// builders' subflows into one candidate that Core submits, test-runs and promotes through the same trial runner and
// promotion owner, and keeps as the same draft. Only the recorded mode differs.
const projectSubject = { projectId: "project", flowId: "flow" };

/** A Core answering the two reads an outcome makes: the proposal and the runtime sessions. */
function projectCore(answers: { adaptation?: unknown; sessions?: unknown }) {
  const reads: string[] = [];
  return { reads, control: { automationStudioCall: async (endpoint: string) => {
    reads.push(endpoint);
    if (endpoint === "get-flow-adaptation") return answers.adaptation;
    if (endpoint === "list-runtime-sessions") return answers.sessions;
    throw new Error(`unexpected ${endpoint}`);
  } } };
}

// The assembled candidate's whole trials, and one builder's partial subflow trial of another candidate, which is not this one's.
const sessions = { runtimeSessions: [
  { runId: "trial.whole.2", flowId: "flow", queuedAt: 30, candidateTrial: { candidateId: "project.candidate", revision: 2, digest: "d2", start: "reset", execution: "succeeded" } },
  { runId: "trial.whole.1", flowId: "flow", queuedAt: 20, candidateTrial: { candidateId: "project.candidate", revision: 1, digest: "d1", start: "reset", execution: "failed", code: "web.action.timeout" } },
  { runId: "trial.subflow.brief-1", flowId: "flow", queuedAt: 10, candidateTrial: { candidateId: "builder.brief-1", revision: 1, start: "reset", execution: "succeeded" } },
  { runId: "playback", flowId: "flow", queuedAt: 40, metadata: {} },
] };

const promotedProposal = { adaptation: { metadata: { phase9: { auditEvents: [
  { eventType: "created", detail: { candidateTrial: { candidateId: "project.candidate", revision: 2, digest: "d2", trials: 2, trial: { verdict: "yes", runId: "trial.whole.2", calls: 2 } } } },
] } } } };

test("a promoted project build is read from the proposal's candidateTrial audit, its trials from the sessions, and says it was a project build", async () => {
  const { control, reads } = projectCore({ adaptation: promotedProposal, sessions });
  const outcome = await readCreatedFlowCandidatePromotion(control, projectSubject, "adaptation.project", "project");
  assert.deepEqual(outcome, {
    authoringMode: "project", outcome: "promoted", draft: null, candidateId: "project.candidate",
    revision: 2, digest: "d2", verdict: "yes", trialRunId: "trial.whole.2", codes: [], judgeCalls: 2, trialCount: 2,
    trials: [
      { runId: "trial.whole.1", revision: 1, digest: "d1", start: "reset", execution: "failed", code: "web.action.timeout", verdict: "execution_failed", reason: "web.action.timeout" },
      { runId: "trial.whole.2", revision: 2, digest: "d2", start: "reset", execution: "succeeded", code: null, verdict: "yes", reason: null },
    ],
    promotedAdaptationId: "adaptation.project",
  });
  assert.deepEqual(reads, ["get-flow-adaptation", "list-runtime-sessions"]);
  // A candidate run reads the same proposal as before, and names its own mode when none is passed.
  assert.equal((await readCreatedFlowCandidatePromotion(projectCore({ adaptation: promotedProposal, sessions }).control, projectSubject, "adaptation.project"))?.authoringMode, "candidate");
});

test("a project draft, from the direct build, the chat or a failed build, is read as a candidate draft and recorded as the project's", async () => {
  const candidate = { status: "draft", projectId: "project", flowId: "flow", candidateId: "project.candidate", revision: 2, digest: "d".repeat(64), sourceInstructionIds: ["instruction"], baseDependencyDigest: "base", baseSettingsRevision: 0, verification: "not_performed", promotionAllowed: false, accounting: { requestId: "request", estimatedInputTokens: 10 }, trial: { verdict: "no", runId: "trial.whole.2", codes: ["candidate.trial_no"] } };
  const direct = await createdFlowCandidateDraftOutcome(projectCore({ sessions }).control, createdFlowCandidateDraft({ candidate }, projectSubject)!, "project");
  assert.equal(direct.authoringMode, "project");
  assert.equal(direct.outcome, "draft");
  assert.equal(direct.verdict, "no");
  assert.deepEqual(direct.trials?.map((trial) => trial.runId), ["trial.whole.1", "trial.whole.2"], "a builder's subflow trial of its own candidate is not the assembled candidate's");

  const chat = await createdFlowChatCandidateDraftOutcome(projectCore({ sessions }).control, projectSubject, "project.candidate", null, "project");
  assert.equal(chat.authoringMode, "project");
  assert.equal(chat.trialRunId, "trial.whole.2");
  assert.equal(chat.trialCount, 2);

  const failed = await createdFlowFailedCandidateOutcome(projectCore({ sessions }).control, projectSubject, { candidateId: "project.candidate", draft: "saved", revision: 2, digest: "d2", trialCount: 2, trials: [{ revision: 1, verdict: "execution_failed", trialRunId: "trial.whole.1", code: "web.action.timeout" }, { revision: 2, verdict: "unsure", trialRunId: "trial.whole.2", code: "candidate.trial_unsure" }] }, "project");
  assert.equal(failed.authoringMode, "project");
  assert.equal(failed.outcome, "failed");
  assert.equal(failed.draft, "saved");
  assert.equal(failed.verdict, "unsure");
  assert.deepEqual(failed.trials?.map((trial) => [trial.runId, trial.verdict]), [["trial.whole.1", "execution_failed"], ["trial.whole.2", "unsure"]]);

  const failure = createdFlowCandidateDraftFailure(direct, "It was judged not to do what you asked.");
  assert.ok(failure instanceof RunnerFailure);
  assert.equal(failure.category, "runtime.behavior");
  assert.match(failure.message, /kept its assembled project candidate as a draft/u);
  assert.equal(failure.details?.code, "lab.candidate_not_promoted");
  assert.equal(failure.details?.authoringMode, "project");
});

// t604: listing a whole project's sessions once outgrew what Core could send (A8 `run-mv8mf0x5-95071c06`). The Lab asks
// only for its own build's trials -- this Flow, this candidate -- follows Core's cursor, and still drops a summary that is
// not its candidate's, in case a Core ignored a filter.
test("a build's trials are read from a listing asked for its Flow and candidate, page by page", async () => {
  const asked: Array<Record<string, unknown>> = [];
  const pages: Record<string, unknown> = {
    first: { runtimeSessions: [session("trial.three", 3, { revision: 3, execution: "failed" }), { runId: "other.flow", flowId: "flow.other", queuedAt: 2, candidateTrial: { candidateId: "candidate" } }], page: { nextCursor: "cursor.two" } },
    "cursor.two": { runtimeSessions: [session("trial.two", 2, { revision: 2 }), { runId: "other.candidate", flowId: "flow", queuedAt: 1, candidateTrial: { candidateId: "candidate.other" } }], page: { nextCursor: "cursor.three" } },
    "cursor.three": { runtimeSessions: [session("trial.one", 1, { revision: 1 })], page: { nextCursor: null } },
  };
  const control = { automationStudioCall: async (endpoint: string, payload: Record<string, unknown>) => {
    assert.equal(endpoint, "list-runtime-sessions");
    asked.push(payload);
    return pages[typeof payload.cursor === "string" ? payload.cursor : "first"];
  } };
  const outcome = await createdFlowChatCandidateDraftOutcome(control, { projectId: "project", flowId: "flow" }, "candidate", null);
  assert.deepEqual(asked, [
    { projectId: "project", flowId: "flow", candidateId: "candidate", limit: 100 },
    { projectId: "project", flowId: "flow", candidateId: "candidate", limit: 100, cursor: "cursor.two" },
    { projectId: "project", flowId: "flow", candidateId: "candidate", limit: 100, cursor: "cursor.three" },
  ]);
  assert.deepEqual(outcome.trials?.map((trial) => [trial.runId, trial.revision]), [["trial.one", 1], ["trial.two", 2], ["trial.three", 3]]);
  assert.equal(outcome.trialRunId, "trial.three");
});
