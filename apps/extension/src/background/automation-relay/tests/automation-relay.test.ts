import assert from "node:assert/strict";
import test from "node:test";

import { AUTOMATION_PANEL_MESSAGES, type PanelRelayResponse } from "../../../shared/protocol";
import { AUTOMATION_RUN_LIST_LIMIT, handleAutomationRelay, type AutomationRelayDeps } from "../automation-relay";

type Call = { endpoint: string; payload: Record<string, unknown>; programId: string | undefined };

function harness(answers: Record<string, PanelRelayResponse> = {}, overrides: Partial<AutomationRelayDeps> = {}) {
  const calls: Call[] = [];
  const removed: string[] = [];
  const deps: AutomationRelayDeps = {
    isControlPage: () => true,
    call: async (endpoint, payload, programId) => {
      calls.push({ endpoint, payload, programId });
      return answers[endpoint] ?? { ok: true, payload: {} };
    },
    projectId: () => "project-1",
    lastStoppedRecordingId: () => "recording-9",
    removeRecordedStep: async (activityId) => {
      removed.push(activityId);
      return { ok: true, payload: { removedFrom: "queue", removedCount: 1 } };
    },
    ...overrides
  };
  const send = async (message: Record<string, unknown>) => {
    const result = await handleAutomationRelay(message as never, {} as chrome.runtime.MessageSender, deps);
    assert.equal(result.handled, true);
    return (result as { response: PanelRelayResponse }).response;
  };
  return { calls, removed, send, deps };
}

test("messages that are not Automation panel's are left for the next handler", async () => {
  const h = harness();
  assert.deepEqual(await handleAutomationRelay({ type: "fluxiq.getStatus" }, {} as chrome.runtime.MessageSender, h.deps), { handled: false });
});

test("only the side panel or the popup may ask, and nothing reaches Core otherwise", async () => {
  const h = harness({}, { isControlPage: () => false });
  const reply = await h.send({ type: AUTOMATION_PANEL_MESSAGES.runAutomation, flowId: "flow-1" });
  assert.deepEqual(reply, { ok: false, code: "forbidden", error: "Only the FluxIQ panel can do that." });
  assert.equal(h.calls.length, 0);
});

test("the automations list reads Flows, then their newest runs, and joins nothing itself", async () => {
  const h = harness({
    "list-flow-summaries": { ok: true, payload: { flows: [{ flowId: "flow-1" }] } },
    "list-flow-runs": { ok: true, payload: { runs: [{ runId: "run-1", flowId: "flow-1" }], page: {} } }
  });
  const reply = await h.send({ type: AUTOMATION_PANEL_MESSAGES.listAutomations });
  assert.deepEqual(reply, { ok: true, payload: { flows: [{ flowId: "flow-1" }], runs: [{ runId: "run-1", flowId: "flow-1" }] } });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["list-flow-summaries", { projectId: "project-1" }],
    ["list-flow-runs", { projectId: "project-1", sort: "updated", direction: "desc", limit: AUTOMATION_RUN_LIST_LIMIT }]
  ]);
});

test("a run sends only the project, the Flow and the repair intent; a test of a generated Flow sends no intent", async () => {
  const h = harness();
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.runAutomation, flowId: "flow-1", flow: { nodes: [] }, runIntent: "build_and_adapt", permittedConsequences: ["move_money"], inputs: { password: "x" } });
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.testGeneratedAutomation, flowId: "flow-2", proposalId: "p" });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["run-runtime-session", { projectId: "project-1", flowId: "flow-1", runIntent: "explore_and_adapt" }]
  ]);
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.runAutomation }), { ok: false, code: "invalid_request", error: "That request is missing its flowId." });
});

test("a run's detail reads compact, then the adaptations of the run's Flow", async () => {
  const h = harness({
    "get-flow-run-detail": { ok: true, payload: { runDetail: { runId: "run-1", summary: { flowId: "flow-7" } } } },
    "list-flow-adaptations": { ok: true, payload: { adaptations: [{ adaptationId: "a1" }] } }
  });
  const reply = await h.send({ type: AUTOMATION_PANEL_MESSAGES.runDetail, runId: "run-1" });
  assert.deepEqual(reply, { ok: true, payload: { runDetail: { runId: "run-1", summary: { flowId: "flow-7" } }, adaptations: [{ adaptationId: "a1" }] } });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["get-flow-run-detail", { projectId: "project-1", runId: "run-1", compact: true }],
    ["list-flow-adaptations", { projectId: "project-1", flowId: "flow-7" }]
  ]);
});

test("an export names its run, dataset and format", async () => {
  const h = harness();
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.exportDataset, runId: "run-1", datasetId: "d1", format: "csv" });
  assert.deepEqual(h.calls[0]?.payload, { projectId: "project-1", runId: "run-1", datasetId: "d1", format: "csv" });
  assert.equal((await h.send({ type: AUTOMATION_PANEL_MESSAGES.exportDataset, runId: "run-1", datasetId: "d1" })).ok, false);
});

test("model readiness carries whether a key opens here, and nothing else about it", async () => {
  const h = harness({
    snapshot: { ok: true, payload: { keys: [{ id: "secret:1", name: "Mine", kind: "llm", provider: "anthropic", enabled: true, unlocked: false, lockedBecause: "signed_out" }, { kind: "llm", enabled: true, unlocked: true }, { kind: "llm", enabled: true, unlocked: "no" }] } }
  });
  const reply = await h.send({ type: AUTOMATION_PANEL_MESSAGES.modelReadiness });
  assert.deepEqual(reply, { ok: true, payload: { keys: [{ kind: "llm", provider: "anthropic", enabled: true, unlocked: false, lockedBecause: "signed_out" }, { kind: "llm", enabled: true, unlocked: true }, { kind: "llm", enabled: true }] } });
});

test("a task's attempts are read by conversation or by attempt, naming exactly one, and nothing else reaches Core", async () => {
  const listed = { ok: true, payload: { outcomes: [{ attempt: { attemptId: "a1" } }] } } as const;
  const h = harness({ "list-conversation-task-attempts": listed, "get-task-attempt": { ok: true, payload: { outcome: { attempt: { attemptId: "a1" } } } } });
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.taskOutcomes, projectId: "project-7", conversationId: "c1", flow: { nodes: [] } }), listed);
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.taskOutcomes, attemptId: "a1", inputs: { password: "x" } });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["list-conversation-task-attempts", { projectId: "project-7", conversationId: "c1" }],
    ["get-task-attempt", { projectId: "project-1", attemptId: "a1" }]
  ]);
  for (const asked of [{}, { conversationId: "c1", attemptId: "a1" }]) {
    assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.taskOutcomes, ...asked }), { ok: false, code: "invalid_request", error: "That request must name one conversation or one attempt." });
  }
  assert.equal(h.calls.length, 2);
});

test("tasks are listed, renamed and forgotten with exactly the fields each needs, and a stray field never reaches Core", async () => {
  const h = harness({ "list-project-tasks": { ok: true, payload: { tasks: [], nextCursor: null } }, "rename-task": { ok: true, payload: { taskId: "t1", title: "Loans" } }, "remove-task": { ok: true, payload: { taskId: "t1", removed: true } }, "list-flow-subflows": { ok: true, payload: { subflows: [] } } });
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.listTasks, projectId: "project-7", limit: 20, cursor: "20", flow: { nodes: [] } });
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.renameTask, taskId: "t1", title: " Loans ", flowId: "f1" });
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.removeTask, taskId: "t1", title: "x", flowId: "f1" });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["list-project-tasks", { projectId: "project-7", limit: 20, cursor: "20" }],
    ["rename-task", { projectId: "project-1", taskId: "t1", title: "Loans" }],
    ["remove-task", { projectId: "project-1", taskId: "t1" }]
  ]);
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.listFlowSubflows, flowId: "f1", role: "utility", status: "archived" });
  assert.deepEqual([h.calls.at(-1)?.endpoint, h.calls.at(-1)?.payload], ["list-flow-subflows", { projectId: "project-1", flowId: "f1", role: "primary", status: "active", limit: 3, offset: 0 }]);
  h.calls.pop();
  for (const asked of [{ type: AUTOMATION_PANEL_MESSAGES.renameTask, title: "x" }, { type: AUTOMATION_PANEL_MESSAGES.renameTask, taskId: "t1" }, { type: AUTOMATION_PANEL_MESSAGES.removeTask }]) {
    assert.equal((await h.send(asked)).ok, false);
  }
  assert.equal(h.calls.length, 3);
});

test("a carry-on sends Core exactly the attempt and the amount, and no stray field reaches it", async () => {
  const h = harness({ "carry-on-task-attempt": { ok: true, payload: { attemptId: "a1", budgetUsd: 1 } } });
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.carryOnTaskAttempt, projectId: "project-7", attemptId: "a1", addUsd: 0, flowId: "flow-x", authoringMode: "candidate", authSessionId: "s" }), { ok: true, payload: { attemptId: "a1", budgetUsd: 1 } });
  await h.send({ type: AUTOMATION_PANEL_MESSAGES.carryOnTaskAttempt, attemptId: "a1", addUsd: 0.5 });
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [
    ["carry-on-task-attempt", { projectId: "project-7", attemptId: "a1", addUsd: 0 }],
    ["carry-on-task-attempt", { projectId: "project-1", attemptId: "a1", addUsd: 0.5 }]
  ]);
});

test("a run again sends Core exactly the project and the task, and no stray field reaches it", async () => {
  const h = harness({ "run-task-again": { ok: true, payload: { attemptId: "a2" } } });
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.runTaskAgain, projectId: "project-7", taskId: "task.1", flowId: "flow-x", askedAgain: true, authoringMode: "candidate", startLocation: "https://elsewhere.example/" }), { ok: true, payload: { attemptId: "a2" } });
  assert.equal((await h.send({ type: AUTOMATION_PANEL_MESSAGES.runTaskAgain })).ok, false);
  assert.deepEqual(h.calls.map((call) => [call.endpoint, call.payload]), [["run-task-again", { projectId: "project-7", taskId: "task.1" }]]);
});

test("a carry-on without an attempt, or with an amount that is not zero or more, never reaches Core", async () => {
  const h = harness();
  assert.equal((await h.send({ type: AUTOMATION_PANEL_MESSAGES.carryOnTaskAttempt, addUsd: 1 })).ok, false);
  for (const addUsd of [undefined, "1", -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.carryOnTaskAttempt, attemptId: "a1", addUsd }), { ok: false, code: "invalid_request", error: "That request must say how much budget to add, zero or more." }, String(addUsd));
  }
  assert.equal(h.calls.length, 0);
});

test("model readiness asks the secret-keys program and keeps only kind, provider and enabled", async () => {
  const h = harness({
    snapshot: { ok: true, payload: { keys: [{ id: "secret:1", name: "My OpenAI key", kind: "llm-api-key", provider: "openai", enabled: true, metadata: { hint: "sk-...1234" } }, { kind: "llm-api-key", enabled: "yes" }] } }
  });
  const reply = await h.send({ type: AUTOMATION_PANEL_MESSAGES.modelReadiness });
  assert.deepEqual(reply, { ok: true, payload: { keys: [{ kind: "llm-api-key", provider: "openai", enabled: true }, { kind: "llm-api-key", enabled: false }] } });
  assert.deepEqual(h.calls, [{ endpoint: "snapshot", payload: {}, programId: "secret-keys" }]);
});

// A snapshot with no key list cannot say whether a key exists: passing it on
// as an empty list made the chat claim "FluxIQ needs a model key" on evidence
// that could not tell. It goes on with no list, which the chat reads as unknown.
test("model readiness passes no key list on when Core's snapshot named none", async () => {
  for (const payload of [{}, { keys: "unreadable" }, null]) {
    const h = harness({ snapshot: { ok: true, payload } });
    assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.modelReadiness }), { ok: true, payload: {} }, JSON.stringify(payload));
  }
});

test("recording-only generation, test and approval are retired without a Core call", async () => {
  const h = harness();
  for (const type of [AUTOMATION_PANEL_MESSAGES.generateFromRecording, AUTOMATION_PANEL_MESSAGES.testGeneratedAutomation, AUTOMATION_PANEL_MESSAGES.saveGeneratedAutomation]) {
    const result = await h.send({ type, flowId: "flow.one", proposalId: "proposal.one" });
    assert.equal(result.ok, false);
    if (!result.ok) assert.match(result.error, /Author task instructions/);
  }
  assert.equal(h.calls.length, 0);
});

test("a step is removed by the activity id the log showed, and without a project nothing else runs", async () => {
  const h = harness({}, { projectId: () => undefined });
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.removeRecordingStep, entryId: "dom.click.1.x" }), { ok: true, payload: { removedFrom: "queue", removedCount: 1 } });
  assert.deepEqual(h.removed, ["dom.click.1.x"]);
  assert.equal((await h.send({ type: AUTOMATION_PANEL_MESSAGES.listAutomations })).ok, false);
  assert.equal(h.calls.length, 0);
});

test("a Core failure is passed through unchanged", async () => {
  const refused: PanelRelayResponse = { ok: false, code: "refused", httpStatus: 403, error: "Not on the allowlist." };
  const h = harness({ "list-flow-summaries": refused });
  assert.deepEqual(await h.send({ type: AUTOMATION_PANEL_MESSAGES.listAutomations }), refused);
});
