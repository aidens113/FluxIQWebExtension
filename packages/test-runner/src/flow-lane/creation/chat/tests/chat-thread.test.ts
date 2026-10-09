import assert from "node:assert/strict";
import test from "node:test";
import { projectFacilityFailure } from "../../../../facility-failure/index.js";
import { RunnerFailure } from "../../../../failure.js";
import { chatConversationIds, chatThreadTurns, projectFlowIds, type CreatedFlowChatReadControl } from "../chat-thread.js";

/**
 * The chat stage's reads of Core are safe to repeat, so each gets its first
 * try plus three more when Core did not answer in time, the connection failed
 * or Core failed on its side (lane A run `run-mv0fu9uq-107ab0de` died on one
 * unretried 10 s `list-flows` before the instruction was typed). A refusal is
 * not retried, and the failure given up on still projects to the run's
 * facility diagnostic with its endpoint.
 */

const SCOPE = { projectId: "project.lab", domainId: "web-automation" };
const LIST_FLOWS_PATH = "/api/programs/automation-studio/list-flows";

const timedOut = (path = LIST_FLOWS_PATH) => new RunnerFailure("environment.missing", "FluxIQ HTTP operation timed out", { details: { bounded: "timeout", operationStage: "control.request", timeoutMs: 10_000, path } });
const transportFailed = () => new RunnerFailure("environment.missing", "FluxIQ HTTP transport failed", { details: { operationStage: "control.request", transportCategory: "network", path: LIST_FLOWS_PATH } });
const serverFailed = () => new RunnerFailure("environment.missing", `FluxIQ control request failed: ${LIST_FLOWS_PATH} (503)`, { details: { path: LIST_FLOWS_PATH, status: 503 } });
const refused = () => new RunnerFailure("facility.contract", "Core refused a value the Lab sent", { details: { path: LIST_FLOWS_PATH, status: 400 } });
const interrupted = () => new RunnerFailure("environment.missing", "FluxIQ HTTP operation was interrupted", { details: { bounded: "abort", operationStage: "control.request", path: LIST_FLOWS_PATH } });

/** A Core whose answers to each endpoint are given in order: an error is thrown, anything else is returned. */
function fakeCore(answers: Record<string, unknown[]>) {
  let clock = 0;
  const calls: string[] = [];
  const pauses: number[] = [];
  const control: CreatedFlowChatReadControl = {
    async automationStudioCall(endpoint, _payload, bounds, domainId) {
      calls.push(endpoint);
      assert.equal(domainId, SCOPE.domainId);
      assert.equal(bounds?.timeoutMs, 10_000, "each try keeps its own 10 s bound");
      clock += 10_000;
      const queue = answers[endpoint] ?? [];
      const answer = queue.length > 1 ? queue.shift() : queue[0];
      if (answer instanceof Error) throw answer;
      return answer;
    },
    readClock: { now: () => clock, sleep: async (ms) => { pauses.push(ms); clock += ms; } },
  };
  return { control, calls, pauses };
}

test("a list-flows that times out three times is answered on the fourth try", async () => {
  const core = fakeCore({ "list-flows": [timedOut(), timedOut(), timedOut(), { flows: [{ flow: { flowId: "flow.one", metadata: {} } }] }] });
  assert.deepEqual(await projectFlowIds(core.control, SCOPE), ["flow.one"]);
  assert.equal(core.calls.length, 4);
  assert.deepEqual(core.pauses, [500, 1_000, 2_000]);
});

test("a read that never answers gives up after the first try and 3 retries, naming the endpoint, the tries and the time", async () => {
  const core = fakeCore({ "list-flows": [timedOut()] });
  const failure = await projectFlowIds(core.control, SCOPE).then(() => assert.fail("expected the read to give up"), (error: unknown) => error);
  assert.ok(failure instanceof RunnerFailure);
  assert.equal(core.calls.length, 4);
  // The message and bounded details the facility projection keys on are kept.
  assert.equal(failure.message, "FluxIQ HTTP operation timed out");
  assert.equal(failure.category, "environment.missing");
  assert.equal(failure.details?.bounded, "timeout");
  assert.equal(failure.details?.timeoutMs, 10_000);
  assert.equal(failure.details?.path, LIST_FLOWS_PATH);
  assert.equal(failure.details?.endpoint, "list-flows");
  assert.equal(failure.details?.attempts, 4);
  assert.equal(failure.details?.elapsedMs, 4 * 10_000 + 500 + 1_000 + 2_000);
  assert.deepEqual({ ...projectFacilityFailure(failure, "finalized-bundle", "scenario.execute") }, { boundary: "finalized-bundle", stage: "scenario.execute", reason: "http.timeout", operationStage: "control.request", timeoutMs: 10_000, endpoint: LIST_FLOWS_PATH });
});

test("a transport failure and a Core server error are retried too", async () => {
  const core = fakeCore({ "list-flows": [transportFailed(), serverFailed(), { flows: [] }] });
  assert.deepEqual(await projectFlowIds(core.control, SCOPE), []);
  assert.equal(core.calls.length, 3);
});

test("a refusal and a caller's abort are not retried", async () => {
  for (const error of [refused(), interrupted(), new Error("malformed")]) {
    const core = fakeCore({ "list-flows": [error] });
    await assert.rejects(projectFlowIds(core.control, SCOPE), (thrown: unknown) => thrown === error);
    assert.equal(core.calls.length, 1);
    assert.deepEqual(core.pauses, []);
  }
});

test("the thread reads before the send retry the same way", async () => {
  const core = fakeCore({
    "list-conversations": [timedOut("/api/programs/automation-studio/list-conversations"), { conversations: [{ conversationId: "conversation.chat" }] }],
    "get-conversation": [timedOut("/api/programs/automation-studio/get-conversation"), { conversation: { turns: [{ turnId: "turn.1", ordinal: 1, author: "person", text: "hi", ask: null, attachment: null }], hasMore: false } }],
  });
  assert.deepEqual(await chatConversationIds(core.control, SCOPE), ["conversation.chat"]);
  const turns = await chatThreadTurns(core.control, SCOPE, "conversation.chat");
  assert.deepEqual(turns.map((turn) => turn.turnId), ["turn.1"]);
  assert.deepEqual(core.calls, ["list-conversations", "list-conversations", "get-conversation", "get-conversation"]);
});
