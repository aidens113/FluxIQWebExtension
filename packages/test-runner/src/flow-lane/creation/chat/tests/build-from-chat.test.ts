import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_MODEL } from "@fluxiq-web-extension/test-contracts";
import { automationStudioConversationCandidateDraftSaid, type AutomationStudioCandidateAuthoringResult } from "fluxiq/automation-studio";
import type { ExistingFlowAdaptation } from "../../../../existing-fluxiq-control.js";
import { RunnerFailure } from "../../../../failure.js";
import { buildCreatedFlowFromChat, type CreatedFlowChat, type CreatedFlowChatControl } from "../build-from-chat.js";

/**
 * The created-Flow build started from the extension's chat, against a fake
 * Core whose chat answers the way the real one does: the person's turn, FluxIQ's
 * answer, the Flow `flow.createHere` makes first, and the result turn carrying
 * the command's id. Every ending the stage can meet is a record, except a
 * message the chat never carried, which throws with what the chat showed.
 */

const PROJECT = "project.lab";
const FLOW = "flow.made";
const ADAPTATION = "adaptation.made";
const INSTRUCTION = "Find every pair of wireless earbuds under $50, with columns name, price and url.";
const SCOPE = { projectId: PROJECT, domainId: "web-automation", instruction: INSTRUCTION, authoringMode: "legacy" as const };

type Turn = { turnId: string; ordinal: number; author: string; text: string; ask: Record<string, unknown> | null; attachment: { kind: string; ref: string } | null };

type FakeChatOptions = {
  /** What FluxIQ makes of the message. */
  answer: "build" | "reply" | "other-capability" | "lost";
  /** How a started build ends. */
  ending?: "created" | "failed" | "awaiting_permission" | "never";
  replyWithoutModel?: boolean;
  /** What Core kept of a failed build (`get-flow-bootstrap-failure`); absent, Core does not answer the read. */
  kept?: unknown;
  /** The words of a failed build's result turn, when not the default. */
  failedSaid?: string;
  /**
   * Candidate mode (t348): `draft` ends the build on Core's draft words for
   * `verdict` and a `candidate-draft` turn, written `draftTurnLate` reads
   * after the result when set; `promoted` ends it created, with the
   * `candidateTrial` audit Core records on a promoted candidate's proposal.
   */
  candidate?: { kind: "draft"; verdict: NonNullable<AutomationStudioCandidateAuthoringResult["trial"]>["verdict"]; draftTurnLate?: number } | { kind: "promoted" };
  /** Core's runtime sessions, as `list-runtime-sessions` returns them. */
  runtimeSessions?: readonly unknown[];
};

const CANDIDATE_ID = "candidate.chat";
const DRAFT_TEMPLATE: AutomationStudioCandidateAuthoringResult = { status: "draft", projectId: PROJECT, flowId: FLOW, candidateId: CANDIDATE_ID, revision: 2, digest: "d".repeat(64), sourceInstructionIds: ["instruction.one"], baseDependencyDigest: "base", baseSettingsRevision: 0, verification: "not_performed", promotionAllowed: false, accounting: { requestId: "request.one", estimatedInputTokens: 10 } };
const CANDIDATE_SCOPE = { ...SCOPE, authoringMode: "candidate" as const, candidateTrial: { trialRunner: true, startReset: true, source: "core" as const } };
const trialSession = (runId: string, queuedAt: number, trial: Record<string, unknown>, flowId = FLOW) => ({ runId, flowId, queuedAt, status: "succeeded", flow: { nodes: [{ text: "page words never kept" }] }, metadata: { candidateTrial: { candidateId: CANDIDATE_ID, digest: "d".repeat(64), start: "reset", ...trial } } });

function fakeChat(options: FakeChatOptions) {
  const turns: Turn[] = [];
  const flows: string[] = [];
  let adaptation: ExistingFlowAdaptation | null = null;
  const pictures: string[] = [];
  let clock = 0;
  let lateDraftReads = -1;
  const turn = (author: string, text: string, attachment: Turn["attachment"] = null): void => {
    turns.push({ turnId: `turn.${turns.length + 1}`, ordinal: turns.length + 1, author, text, ask: null, attachment });
  };
  const control: CreatedFlowChatControl = {
    async automationStudioCall(endpoint, payload, _bounds, domainId) {
      // The proposal read raw for the judged yes Core recorded on it, as `getFlowAdaptation` reads it: no domain. This Core recorded none, unless its candidate was promoted.
      if (endpoint === "get-flow-adaptation") return { adaptation: { adaptationId: ADAPTATION, metadata: { phase9: { auditEvents: [{ eventType: "created", detail: options.candidate?.kind === "promoted" ? { candidateTrial: { candidateId: CANDIDATE_ID, revision: 2, digest: "d".repeat(64), trial: { runId: "trial.two", verdict: "yes", calls: 2, start: "reset" }, trials: 2 } } : {} }] } } } };
      if (endpoint === "list-runtime-sessions") { assert.equal(payload.projectId, PROJECT); return { runtimeSessions: [...(options.runtimeSessions ?? [])] }; }
      assert.equal(domainId, "web-automation", "every read is held to the project's domain");
      assert.equal(payload.projectId, PROJECT);
      // A Subflow is listed as a Flow of its own; it must never count as the Flow the chat made.
      if (endpoint === "list-flows") return { flows: [...flows.map((flowId) => ({ flow: { flowId, metadata: {} } })), ...(flows.length ? [{ flow: { flowId: "flow.made.subflow", metadata: { subflowGraph: true } } }] : [])] };
      if (endpoint === "list-conversations") return { conversations: [{ conversationId: "conversation.chat", subject: { kind: "project", id: PROJECT } }] };
      if (endpoint === "get-conversation") {
        if (lateDraftReads > 0 && --lateDraftReads === 0) turn("automation", "Saved candidate draft. Verification pending; the Flow's steps are unchanged.", { kind: "candidate-draft", ref: CANDIDATE_ID });
        return { conversation: { turns: [...turns], hasMore: false } };
      }
      if (endpoint === "get-flow-bootstrap-failure" && options.kept !== undefined) {
        assert.equal(payload.flowId, FLOW);
        return { failure: options.kept };
      }
      throw new Error(`unexpected ${endpoint}`);
    },
    async listFlowAdaptations(projectId, flowId) {
      return adaptation ? [{ adaptationId: ADAPTATION, projectId, flowId, status: adaptation.status }] : [];
    },
    async getFlowAdaptation() {
      if (!adaptation) throw new Error("no proposal was left");
      return adaptation;
    },
  };
  const proposal = (status: string, extra: Partial<ExistingFlowAdaptation> = {}): ExistingFlowAdaptation => ({
    adaptationId: ADAPTATION, projectId: PROJECT, flowId: FLOW, status, adaptationKind: "flow_bootstrap",
    accounting: { provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 40_000, outputTokens: 3_000, totalTokens: 43_000, estimatedCostUsd: 0.02 },
    evidenceLoop: { providerCallCount: 6, decisionCount: 6, traceStepCount: 7, iterationCount: 7, toolCallCount: 5, evidenceBytes: 30_000, toolIds: ["core.run_node"] },
    ...extra,
  });
  const chat: CreatedFlowChat = {
    panelInput: "view-dom",
    async type(text) {
      if (options.answer === "lost") return;
      turn("person", text);
      if (options.answer === "reply") { turn("automation", `I could not tell what you wanted done from that on my own.${options.replyWithoutModel ? "\n\n(I read your message without the model, because the model did not answer in time.)" : ""}`); return; }
      if (options.answer === "other-capability") { turn("automation", 'Doing "Run a Flow".'); turn("automation", "There is no Flow to run.", { kind: "panel-capability-result", ref: "run.execute" }); return; }
      turn("automation", 'Doing "Create an automation here".');
      flows.push(FLOW);
      if (options.ending === "never") return;
      if (options.ending === "created") adaptation = proposal("applied", { appliedMutationCount: 3 });
      if (options.candidate?.kind === "draft") {
        turn("automation", automationStudioConversationCandidateDraftSaid({ ...DRAFT_TEMPLATE, trial: { verdict: options.candidate.verdict, codes: [] } }), { kind: "panel-capability-result", ref: "flow.createHere" });
        if (options.candidate.draftTurnLate) lateDraftReads = options.candidate.draftTurnLate;
        else turn("automation", "Saved candidate draft. Verification pending; the Flow's steps are unchanged.", { kind: "candidate-draft", ref: CANDIDATE_ID });
        return;
      }
      if (options.ending === "awaiting_permission") {
        adaptation = proposal("proposed", { consequences: { declared: [], instructed: [], permissionRequest: { action: { kind: "click", verb: "press" }, control: { name: "Place order", kind: "button" }, consequences: ["move_money"], missing: ["move_money"] } } as unknown as NonNullable<ExistingFlowAdaptation["consequences"]> });
      }
      const said = options.ending === "created" ? 'Created the Flow "Find every pair", explored the site, and put the steps it worked out into the Flow.' : options.failedSaid ?? '"Create an automation here" stopped because the build failed. What is left: the Flow "Find every pair", empty, with what you asked saved on it, so it can be built again.';
      turn("automation", said, { kind: "panel-capability-result", ref: "flow.createHere" });
    },
    shows: async () => "Couldn't send that. Try again.",
    picture: async (moment) => { pictures.push(moment); },
  };
  const wait = { now: () => clock, sleep: async (ms: number) => { clock += Math.max(ms, 1); }, pollMs: 250 };
  return { control, chat, wait, pictures };
}

test("a job typed into the chat becomes the Flow the chat built and applied, read off its proposal", async () => {
  const { control, chat, wait, pictures } = fakeChat({ answer: "build", ending: "created" });
  const made = await buildCreatedFlowFromChat(control, chat, SCOPE, wait);
  assert.equal(made.flowId, FLOW, "the one Flow that was not there before, not its Subflow");
  assert.deepEqual(made.applied, { adaptationId: ADAPTATION, appliedMutationCount: 3 });
  assert.equal(made.build.outcome, "proposed");
  assert.equal(made.build.adaptationId, ADAPTATION);
  assert.equal(made.build.providerCalls, 6);
  assert.equal(made.build.accounting?.estimatedCostUsd, 0.02, "what the build spent is read from the proposal it left");
  assert.deepEqual({ ...made.build.chat, secondsToEnding: undefined }, { conversationId: "conversation.chat", panelInput: "view-dom", personTurn: 1, answerTurn: 2, resultTurn: 3, readWithoutModel: false, became: "build", ending: "created", asks: { permission: 0, personCheck: 0, other: 0 }, secondsToEnding: undefined, said: 'Created the Flow "Find every pair", explored the site, and put the steps it worked out into the Flow.' });
  assert.deepEqual(pictures, ["sent", "answered", "ended"]);
});

test("an answer in words with nothing built is a failed build of no Flow, carrying what FluxIQ said", async () => {
  const { control, chat, wait } = fakeChat({ answer: "reply", replyWithoutModel: true });
  const made = await buildCreatedFlowFromChat(control, chat, SCOPE, wait);
  assert.equal(made.flowId, null);
  assert.equal(made.build.outcome, "failed");
  assert.deepEqual(made.build.failure, { code: "lab.chat_started_no_build", stage: "chat", httpStatus: null });
  assert.equal(made.build.providerInvocation, "not_attempted", "nothing was built, so nothing was spent on a build");
  assert.equal(made.build.chat?.became, "no_build");
  assert.equal(made.build.chat?.readWithoutModel, true, "FluxIQ's own note that it read the words without the model is kept");
  assert.match(made.said ?? "", /could not tell what you wanted/u);
});

test("a message the chat ran as something else is named as that capability", async () => {
  const { control, chat, wait } = fakeChat({ answer: "other-capability" });
  const made = await buildCreatedFlowFromChat(control, chat, SCOPE, wait);
  assert.equal(made.build.chat?.became, "other_capability");
  assert.equal(made.build.chat?.otherCapability, "run.execute");
  assert.equal(made.build.failure?.code, "lab.chat_ran_other_capability");
  assert.equal(made.said, "There is no Flow to run.");
});

test("a build that ended without a proposal is a failed build of the Flow it made, with FluxIQ's account of how far it got", async () => {
  const { control, chat, wait } = fakeChat({ answer: "build", ending: "failed" });
  const made = await buildCreatedFlowFromChat(control, chat, SCOPE, wait);
  assert.equal(made.flowId, FLOW);
  assert.equal(made.applied, null);
  assert.deepEqual(made.build.failure, { code: "lab.chat_build_failed", stage: "chat", httpStatus: null });
  assert.equal(made.build.providerInvocation, "unknown", "a refused build's spend is not readable from the chat");
  assert.equal(made.build.chat?.ending, "failed");
  assert.match(made.said ?? "", /What is left: the Flow "Find every pair", empty/u);
});

/** FluxIQ's ending in live run `run-murzln6g-11debe1d`, read off its chat (screenshot 15); every record cut it at "...was not...". */
const MURZLN6G_ENDING = `The build stopped at its spending limit of $0.10 before the Flow was finished: it had spent $0.089 ($0.000 of it by earlier builds of this Flow), which left $0.011, too little for another round: its next decision and the judging of its Flow could cost up to $0.019. 5 of the 6 things you asked worked when the Flow was run from its start; still to do: "in the 250 Count size": nothing I tried did it. The Flow (13 steps) ran from its start, but what it did was judged not to be what you asked. I explored live once over 30 decisions, and what held it up was that the Flow it said was ready was not judged to do what you asked. The Flow so far was kept, and building again carries on from it, with $0.011 left of this Flow's $0.10. What is left: the Flow "Switch my pickup store to Millbrook Crossing Supercenter, then add two packs...", empty, with what you asked saved on it, so it can be built again.`;

test("FluxIQ's ending is carried whole, however long, so the record says why in all its words", async () => {
  const { control, chat, wait } = fakeChat({ answer: "build", ending: "failed", failedSaid: MURZLN6G_ENDING });
  const made = await buildCreatedFlowFromChat(control, chat, SCOPE, wait);
  assert.ok(MURZLN6G_ENDING.length > 600, "the run's ending is longer than the cut that lost its end");
  assert.equal(made.said, MURZLN6G_ENDING);
  assert.match(made.said ?? "", /was not judged to do what you asked\. The Flow so far was kept/u);
});

test("a build that finished still waiting on a question is the permission ending, never applied", async () => {
  const { control, chat, wait } = fakeChat({ answer: "build", ending: "awaiting_permission" });
  const made = await buildCreatedFlowFromChat(control, chat, SCOPE, wait);
  assert.equal(made.build.outcome, "permission_required");
  assert.deepEqual(made.build.permissionRequest?.missing, ["move_money"]);
  assert.equal(made.build.chat?.ending, "awaiting_permission");
  assert.equal(made.applied, null);
});

test("a build whose result never arrives is recorded as unfinished once its deadline passes", async () => {
  const { control, chat, wait } = fakeChat({ answer: "build", ending: "never" });
  const made = await buildCreatedFlowFromChat(control, chat, SCOPE, { ...wait, deadlineMs: 5_000 });
  assert.equal(made.flowId, FLOW);
  assert.equal(made.build.failure?.code, "lab.chat_build_unfinished");
  assert.equal(made.build.chat?.ending, "no_result");
  assert.equal(made.build.chat?.resultTurn, null);
});

test("a message the chat never carried to FluxIQ fails the stage with what the chat showed", async () => {
  const { control, chat, wait } = fakeChat({ answer: "lost" });
  await assert.rejects(buildCreatedFlowFromChat(control, chat, SCOPE, { ...wait, sendMs: 2_000 }), (error: unknown) => {
    assert.ok(error instanceof RunnerFailure);
    assert.equal(error.category, "runtime.behavior");
    assert.match(error.message, /did not carry the task's instruction to FluxIQ within 2 s of Send; the chat showed: "Couldn't send that\. Try again\."/u);
    return true;
  });
});

// Live run `run-muq3ubys-4b4dbf5b`: the chat's build spent $0.227, and the spend
// ledger recorded $0, because a build that left no proposal left nothing to count.
test("a failed build's spend is read from what Core kept of it, and the failure stays the chat's", async () => {
  const kept = {
    code: "flow_bootstrap.provider_output_padding_truncated", stage: "provider_output_validation", retryable: false, providerInvocation: "attempted", providerResponse: "received",
    accounting: { requestId: "llm-request:one", estimatedInputTokens: 1996, provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 1_801_798, outputTokens: 5_840, totalTokens: 1_807_638, estimatedCostUsd: 0.2272 }
  };
  const { control, chat, wait } = fakeChat({ answer: "build", ending: "failed", kept });
  const made = await buildCreatedFlowFromChat(control, chat, SCOPE, wait);
  assert.equal(made.flowId, FLOW);
  assert.equal(made.build.outcome, "failed");
  assert.equal(made.build.accounting?.estimatedCostUsd, 0.2272, "what the failed build spent is counted");
  assert.equal(made.build.accounting?.inputTokens, 1_801_798);
  assert.deepEqual(made.build.failure, { code: "lab.chat_build_failed", stage: "chat", httpStatus: null, issueCodes: ["flow_bootstrap.provider_output_padding_truncated"] });
  assert.equal(made.build.chat?.ending, "failed");
});

// Live run run-musp8nz1-dbd3905a (cause R1): FluxIQ's ending words were taken
// whole but used only in the lane's failure messages, so a created ending kept
// no record of what FluxIQ told the person. They are on the chat record now,
// on every ending, and so in flow-lane.json's build.chat.
test("FluxIQ's ending words are on the chat record on every ending, created or not", async () => {
  const endings: Array<[FakeChatOptions, RegExp | null]> = [
    [{ answer: "build", ending: "created" }, /^Created the Flow "Find every pair"/u],
    [{ answer: "build", ending: "failed", failedSaid: MURZLN6G_ENDING }, /was not judged to do what you asked\. The Flow so far was kept/u],
    [{ answer: "build", ending: "awaiting_permission" }, /stopped because the build failed/u],
    [{ answer: "reply" }, /could not tell what you wanted/u],
    [{ answer: "other-capability" }, /^There is no Flow to run\.$/u],
    [{ answer: "build", ending: "never" }, null],
  ];
  for (const [options, words] of endings) {
    const { control, chat, wait } = fakeChat(options);
    const made = await buildCreatedFlowFromChat(control, chat, SCOPE, { ...wait, deadlineMs: 5_000 });
    assert.equal(made.build.chat?.said ?? null, made.said, `${options.answer}/${options.ending ?? "-"}: the record holds what the stage said`);
    if (words === null) assert.equal(made.build.chat?.said, null, "no result arrived, so nothing was said");
    else assert.match(made.build.chat?.said ?? "", words);
  }
});

test("candidate authoring mode refuses before any control, authorizer, chat or provider work", async () => {
  const calls: string[] = [];
  const control = new Proxy({}, { get: (_target, key) => { calls.push(String(key)); return async () => { calls.push("effect"); }; } });
  await assert.rejects(async () => { await buildCreatedFlowFromChat(control as never, control as never, { projectId: "project", domainId: "web", instruction: "job", authoringMode: "candidate" }); }, (error: unknown) => !!error && typeof error === "object" && "details" in error && (error.details as Record<string, unknown>)?.code === "lab.candidate_verification_unavailable");
  assert.deepEqual(calls, []);
});

test("a candidate the chat kept as a draft is recorded with its id, the verdict in Core's own words and every trial Core ran (t348)", async () => {
  const sessions = [
    trialSession("trial.two", 20, { revision: 2, execution: "succeeded" }),
    trialSession("trial.one", 10, { revision: 1, execution: "failed", code: "web.action.timeout" }),
    trialSession("trial.elsewhere", 5, { revision: 1, execution: "succeeded" }, "flow.other"),
    { runId: "run.normal", flowId: FLOW, queuedAt: 1, status: "succeeded", metadata: {} },
  ];
  for (const verdict of ["no", "unsure", "execution_failed"] as const) {
    const { control, chat, wait } = fakeChat({ answer: "build", candidate: { kind: "draft", verdict }, runtimeSessions: sessions });
    const made = await buildCreatedFlowFromChat(control, chat, CANDIDATE_SCOPE, wait);
    assert.equal(made.build.outcome, "draft");
    assert.equal(made.applied, null, "a draft is never applied");
    assert.equal(made.build.candidateReference?.candidateId, CANDIDATE_ID);
    const outcome = made.build.candidateOutcome;
    assert.equal(outcome?.outcome, "draft");
    assert.equal(outcome?.candidateId, CANDIDATE_ID);
    assert.equal(outcome?.verdict, verdict, "read from Core's own words for that verdict");
    assert.deepEqual(outcome?.trials?.map((trial) => [trial.runId, trial.revision, trial.execution, trial.code, trial.start]), [["trial.one", 1, "failed", "web.action.timeout", "reset"], ["trial.two", 2, "succeeded", null, "reset"]], "this Flow's trials of this candidate, in the order Core queued them");
    assert.equal(outcome?.trialRunId, "trial.two", "the last trial is the one that decided");
    assert.equal(outcome?.revision, 2);
    assert.doesNotMatch(JSON.stringify(outcome), /page words/u, "nothing of a trial's Flow document is kept");
  }
});

test("a draft turn Core writes just after the result is waited for, not read as a failed build (t348)", async () => {
  const { control, chat, wait } = fakeChat({ answer: "build", candidate: { kind: "draft", verdict: "no", draftTurnLate: 6 } });
  const made = await buildCreatedFlowFromChat(control, chat, CANDIDATE_SCOPE, wait);
  assert.equal(made.build.outcome, "draft");
  assert.equal(made.build.candidateOutcome?.verdict, "no");
  assert.deepEqual(made.build.candidateOutcome?.trials, []);
});

test("a candidate the chat promoted and applied carries the candidate and trial behind its proposal (t348)", async () => {
  const { control, chat, wait } = fakeChat({ answer: "build", ending: "created", candidate: { kind: "promoted" }, runtimeSessions: [trialSession("trial.two", 20, { revision: 2, execution: "succeeded" })] });
  const made = await buildCreatedFlowFromChat(control, chat, CANDIDATE_SCOPE, wait);
  assert.equal(made.build.outcome, "proposed");
  assert.deepEqual(made.applied, { adaptationId: ADAPTATION, appliedMutationCount: 3 });
  assert.deepEqual({ ...made.build.candidateOutcome, trials: made.build.candidateOutcome?.trials?.map((trial) => trial.runId) }, { authoringMode: "candidate", outcome: "promoted", draft: null, candidateId: CANDIDATE_ID, revision: 2, digest: "d".repeat(64), verdict: "yes", trialRunId: "trial.two", codes: [], judgeCalls: 2, trialCount: 2, trials: ["trial.two"], promotedAdaptationId: ADAPTATION });
  // The same chat in legacy mode reads no candidate.
  const legacy = fakeChat({ answer: "build", ending: "created" });
  assert.equal((await buildCreatedFlowFromChat(legacy.control, legacy.chat, SCOPE, legacy.wait)).build.candidateOutcome, undefined);
});

test("candidate mode refuses a Core without the trial runner, or without the start hook, before anything is typed (t348)", async () => {
  for (const [candidateTrial, code] of [[{ trialRunner: false, startReset: false, source: "core" as const }, "lab.candidate_verification_unavailable"], [{ trialRunner: true, startReset: false, source: "core" as const }, "lab.candidate_start_hook_unset"]] as const) {
    const { control, chat, wait } = fakeChat({ answer: "build", ending: "created" });
    let typed = 0;
    await assert.rejects(buildCreatedFlowFromChat(control, { ...chat, type: async (text) => { typed += 1; await chat.type(text); } }, { ...SCOPE, authoringMode: "candidate", candidateTrial }, wait), (error: unknown) => error instanceof RunnerFailure && error.category === "facility.contract" && error.details?.code === code && error.details?.stage === "before_provider");
    assert.equal(typed, 0);
  }
});

// Lane A round 4 (run-muyrpbnk-fef374e7, C6): a candidate build the chat
// started stopped for no progress after two trials, and the Lab recorded
// `candidate: null`. Core's failure now names the candidate, its kept draft and
// each trial's verdict, and the Lab records them beside the trial sessions (t362).
test("a candidate build that failed in the chat is recorded with its candidate, kept draft, trials and verdicts (t362)", async () => {
  const kept = {
    code: "flow_bootstrap.evidence_repeat_without_progress", stage: "provider_output_validation", retryable: false, providerInvocation: "attempted", providerResponse: "received",
    accounting: { requestId: "candidate.request", estimatedInputTokens: 10, provider: "deepseek", model: DEFAULT_LLM_MODEL, inputTokens: 718_858, outputTokens: 7_971, totalTokens: 726_829, estimatedCostUsd: 0.0392 },
    issueCodes: ["flow_bootstrap.evidence_completion_parameters_unresolved"],
    candidate: { candidateId: CANDIDATE_ID, draft: "saved", revision: 7, digest: "d".repeat(64), trialCount: 2,
      trials: [{ revision: 2, verdict: "execution_failed", trialRunId: "trial.one", code: "web.target.not_found" }, { revision: 4, verdict: "execution_failed", trialRunId: "trial.two", code: "web.action.rate_limited" }] },
  };
  const sessions = [
    trialSession("trial.two", 20, { revision: 4, execution: "failed", code: "web.action.rate_limited" }),
    trialSession("trial.one", 10, { revision: 2, execution: "failed", code: "web.target.not_found" }),
  ];
  const { control, chat, wait } = fakeChat({ answer: "build", ending: "failed", kept, runtimeSessions: sessions });
  const made = await buildCreatedFlowFromChat(control, chat, CANDIDATE_SCOPE, wait);
  assert.equal(made.build.outcome, "failed");
  assert.equal(made.build.failure?.code, "lab.chat_build_failed");
  assert.equal(made.build.accounting?.estimatedCostUsd, 0.0392, "the spend is still read");
  const outcome = made.build.candidateOutcome;
  assert.deepEqual({ ...outcome, trials: outcome?.trials?.map((trial) => [trial.runId, trial.revision, trial.execution, trial.code, trial.verdict]) }, {
    authoringMode: "candidate", outcome: "failed", draft: "saved", candidateId: CANDIDATE_ID, revision: 7, digest: "d".repeat(64),
    verdict: "execution_failed", trialRunId: "trial.two", codes: ["web.action.rate_limited"], judgeCalls: null, trialCount: 2,
    trials: [["trial.one", 2, "failed", "web.target.not_found", "execution_failed"], ["trial.two", 4, "failed", "web.action.rate_limited", "execution_failed"]],
    promotedAdaptationId: null,
  });
  assert.doesNotMatch(JSON.stringify(outcome), /page words/u, "nothing of a trial's Flow document is kept");

  // A candidate that never had a version accepted is still named, with no trials and nothing kept.
  const none = fakeChat({ answer: "build", ending: "failed", kept: { ...kept, code: "flow_bootstrap.evidence_unusable_decision", issueCodes: ["llm_output.invalid_evidence_decision"], candidate: { candidateId: CANDIDATE_ID, draft: "none", trialCount: 0, trials: [] } }, runtimeSessions: [] });
  const noneMade = await buildCreatedFlowFromChat(none.control, none.chat, CANDIDATE_SCOPE, none.wait);
  assert.deepEqual([noneMade.build.candidateOutcome?.outcome, noneMade.build.candidateOutcome?.draft, noneMade.build.candidateOutcome?.verdict, noneMade.build.candidateOutcome?.trialCount, noneMade.build.candidateOutcome?.trials], ["failed", "none", "not_tested", 0, []]);

  // In legacy mode the same failure records no candidate.
  const legacy = fakeChat({ answer: "build", ending: "failed", kept });
  assert.equal((await buildCreatedFlowFromChat(legacy.control, legacy.chat, SCOPE, legacy.wait)).build.candidateOutcome, undefined);
});
