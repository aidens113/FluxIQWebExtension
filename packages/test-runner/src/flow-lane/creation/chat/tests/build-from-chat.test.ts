import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LLM_MODEL } from "@fluxiq-web-extension/test-contracts";
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
const SCOPE = { projectId: PROJECT, domainId: "web-automation", instruction: INSTRUCTION };

type Turn = { turnId: string; ordinal: number; author: string; text: string; ask: Record<string, unknown> | null; attachment: { kind: string; ref: string } | null };

type FakeChatOptions = {
  /** What FluxIQ makes of the message. */
  answer: "build" | "reply" | "other-capability" | "lost";
  /** How a started build ends. */
  ending?: "created" | "failed" | "awaiting_permission" | "never";
  replyWithoutModel?: boolean;
  /** What Core kept of a failed build (`get-flow-bootstrap-failure`); absent, Core does not answer the read. */
  kept?: unknown;
};

function fakeChat(options: FakeChatOptions) {
  const turns: Turn[] = [];
  const flows: string[] = [];
  let adaptation: ExistingFlowAdaptation | null = null;
  const pictures: string[] = [];
  let clock = 0;
  const turn = (author: string, text: string, attachment: Turn["attachment"] = null): void => {
    turns.push({ turnId: `turn.${turns.length + 1}`, ordinal: turns.length + 1, author, text, ask: null, attachment });
  };
  const control: CreatedFlowChatControl = {
    async automationStudioCall(endpoint, payload, _bounds, domainId) {
      assert.equal(domainId, "web-automation", "every read is held to the project's domain");
      assert.equal(payload.projectId, PROJECT);
      // A Subflow is listed as a Flow of its own; it must never count as the Flow the chat made.
      if (endpoint === "list-flows") return { flows: [...flows.map((flowId) => ({ flow: { flowId, metadata: {} } })), ...(flows.length ? [{ flow: { flowId: "flow.made.subflow", metadata: { subflowGraph: true } } }] : [])] };
      if (endpoint === "list-conversations") return { conversations: [{ conversationId: "conversation.chat", subject: { kind: "project", id: PROJECT } }] };
      if (endpoint === "get-conversation") return { conversation: { turns, hasMore: false } };
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
      if (options.ending === "awaiting_permission") {
        adaptation = proposal("proposed", { consequences: { declared: [], instructed: [], permissionRequest: { action: { kind: "click", verb: "press" }, control: { name: "Place order", kind: "button" }, consequences: ["move_money"], missing: ["move_money"] } } as unknown as NonNullable<ExistingFlowAdaptation["consequences"]> });
      }
      const said = options.ending === "created" ? 'Created the Flow "Find every pair", explored the site, and put the steps it worked out into the Flow.' : '"Create an automation here" stopped because the build failed. What is left: the Flow "Find every pair", empty, with what you asked saved on it, so it can be built again.';
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
  assert.deepEqual({ ...made.build.chat, secondsToEnding: undefined }, { conversationId: "conversation.chat", panelInput: "view-dom", personTurn: 1, answerTurn: 2, resultTurn: 3, readWithoutModel: false, became: "build", ending: "created", asks: { permission: 0, personCheck: 0, other: 0 }, secondsToEnding: undefined });
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
