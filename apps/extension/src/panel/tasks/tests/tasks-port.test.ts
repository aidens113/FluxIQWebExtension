// The tasks port over Core's task routes: the list, rename and remove of what each task remembers, the one subflow a
// task's "Save this" would keep, and Run again over a listed task. Pure unit: the background is a scripted `request`.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioTaskAttemptNoLoopsCaught } from "@fluxiq/contracts/automation";
import { AUTOMATION_PANEL_MESSAGES } from "../../../shared/protocol";
import type { PanelMessage, PanelResult, PanelStore } from "../../state";
import { extensionTasksPort } from "../tasks-port";

const attempt = (over: Record<string, unknown> = {}) => ({
  taskId: "task.1", attemptId: "attempt.1", ordinal: 1, projectId: "p1", flowId: "flow-1", path: "explore", status: "working",
  spend: { calls: 3, inputTokens: 10, outputTokens: 5, usd: 0.42, ms: 900 }, budget: { usd: 5 }, liveSteps: 2, loopsCaught: automationStudioTaskAttemptNoLoopsCaught(), startedAtMs: 2000,
  ...over
});
const task = (taskId: string, title: string | undefined, startedAtMs: number, extra: Record<string, unknown> = {}) => ({
  taskId, flowId: `flow-${taskId}`, ...(title === undefined ? {} : { title }), attemptCount: 2, latest: { attempt: attempt({ taskId, attemptId: `${taskId}.a2`, flowId: `flow-${taskId}`, startedAtMs }) }, ...extra
});
const ok = (payload: unknown): PanelResult<unknown> => ({ ok: true, value: { ok: true, payload } });

function setup(replies: Record<string, PanelResult<unknown>>) {
  const sent: PanelMessage[] = [];
  const request = (async (message: PanelMessage) => {
    sent.push(message);
    return replies[message.type] ?? { ok: false, sentence: `unexpected ${message.type}` };
  }) as PanelStore["request"];
  return { tasks: extensionTasksPort(request, () => () => undefined, () => undefined), sent };
}

test("a page of tasks is read from Core's list, titled and ready to open in its chat", async () => {
  const t = setup({ [AUTOMATION_PANEL_MESSAGES.listTasks]: ok({ tasks: [task("task.1", "Cheapest kettle", 5000, { conversationId: "c1" }), task("task.2", undefined, 4000)], nextCursor: "2" }) });
  const listed = await t.tasks.port.list({ projectId: "p1", limit: 2, cursor: "0" });
  assert.ok(listed.ok);
  assert.deepEqual(listed.value.tasks.map((item) => [item.taskId, item.title, item.conversationId, item.flowId]), [["task.1", "Cheapest kettle", "c1", "flow-task.1"], ["task.2", "", undefined, "flow-task.2"]]);
  assert.equal(listed.value.nextCursor, "2");
  assert.deepEqual(t.sent, [{ type: AUTOMATION_PANEL_MESSAGES.listTasks, projectId: "p1", limit: 2, cursor: "0" }]);
});

test("a search reads the list and filters it here, by the task's name", async () => {
  const t = setup({ [AUTOMATION_PANEL_MESSAGES.listTasks]: ok({ tasks: [task("task.1", "Kettle", 5000), task("task.2", "Jobs", 4000)], nextCursor: null }) });
  const found = await t.tasks.port.list({ projectId: "p1", limit: 5, text: " kett " });
  assert.ok(found.ok);
  assert.deepEqual(found.value.tasks.map((item) => item.title), ["Kettle"]);
});

test("a task that does not read, or is another project's, fails the list rather than showing part of it", async () => {
  const wrong = setup({ [AUTOMATION_PANEL_MESSAGES.listTasks]: ok({ tasks: [{ ...task("task.1", "x", 1), latest: { attempt: attempt({ projectId: "other" }) } }], nextCursor: null }) });
  assert.equal((await wrong.tasks.port.list({ projectId: "p1", limit: 5 })).ok, false);
  const broken = setup({ [AUTOMATION_PANEL_MESSAGES.listTasks]: ok({ tasks: [{ taskId: "task.1", latest: { attempt: { nonsense: true } } }], nextCursor: null }) });
  assert.equal((await broken.tasks.port.list({ projectId: "p1", limit: 5 })).ok, false);
});

test("a task is read with its attempts newest first from its chat, and one that is gone says so", async () => {
  const t = setup({
    [AUTOMATION_PANEL_MESSAGES.listTasks]: ok({ tasks: [task("task.1", "Kettle", 5000, { conversationId: "c1" })], nextCursor: null }),
    [AUTOMATION_PANEL_MESSAGES.taskOutcomes]: ok({ outcomes: [{ attempt: attempt({ attemptId: "a1", startedAtMs: 1000 }) }, { attempt: attempt({ attemptId: "a2", ordinal: 2, startedAtMs: 4000 }) }] })
  });
  const read = await t.tasks.port.read({ projectId: "p1", taskId: "task.1" });
  assert.ok(read.ok);
  assert.deepEqual(read.value.attempts.map((item) => item.attempt.attemptId), ["a2", "a1"]);
  assert.deepEqual(await t.tasks.port.read({ projectId: "p1", taskId: "task.9" }), { ok: false, sentence: "That task is no longer here." });
});

test("rename and remove send Core the project, the task and the name, and a refusal comes back in Core's words", async () => {
  const t = setup({
    [AUTOMATION_PANEL_MESSAGES.renameTask]: ok({ taskId: "task.1", title: "Loans" }),
    [AUTOMATION_PANEL_MESSAGES.removeTask]: { ok: true, value: { ok: false, sentence: "I could not find that task.", code: "task.not_found" } }
  });
  assert.deepEqual(await t.tasks.port.rename!({ projectId: "p1", taskId: "task.1", title: "Loans" }), { ok: true, value: undefined });
  assert.deepEqual(await t.tasks.port.remove!({ projectId: "p1", taskId: "task.1" }), { ok: false, sentence: "I could not find that task.", code: "task.not_found" });
  assert.deepEqual(t.sent, [
    { type: AUTOMATION_PANEL_MESSAGES.renameTask, projectId: "p1", taskId: "task.1", title: "Loans" },
    { type: AUTOMATION_PANEL_MESSAGES.removeTask, projectId: "p1", taskId: "task.1" }
  ]);
});

test("Save this names a Flow's one active primary subflow, and none where there is none or several", async () => {
  const subflow = (subflowId: string, role = "primary", status = "active") => ({ subflowId, name: ` Name of ${subflowId} `, role, status });
  const one = setup({ [AUTOMATION_PANEL_MESSAGES.listFlowSubflows]: ok({ subflows: [subflow("s1"), subflow("s2", "utility"), subflow("s3", "primary", "archived")] }) });
  assert.deepEqual(await one.tasks.port.subflowToKeep!({ projectId: "p1", flowId: "f1" }), { ok: true, value: { subflowId: "s1", name: "Name of s1" } });
  assert.deepEqual(one.sent, [{ type: AUTOMATION_PANEL_MESSAGES.listFlowSubflows, projectId: "p1", flowId: "f1" }]);
  const several = setup({ [AUTOMATION_PANEL_MESSAGES.listFlowSubflows]: ok({ subflows: [subflow("s1"), subflow("s2")] }) });
  assert.deepEqual(await several.tasks.port.subflowToKeep!({ projectId: "p1", flowId: "f1" }), { ok: true, value: undefined });
  const none = setup({ [AUTOMATION_PANEL_MESSAGES.listFlowSubflows]: ok({ subflows: [] }) });
  assert.deepEqual(await none.tasks.port.subflowToKeep!({ projectId: "p1", flowId: "f1" }), { ok: true, value: undefined });
});

test("keeping it sends Core the Flow and its subflow, and answers Core's sentence for a refusal", async () => {
  const t = setup({ [AUTOMATION_PANEL_MESSAGES.savePart]: ok({ saved: false, code: "part.not_found", message: "That piece is not in this automation." }) });
  const kept = await t.tasks.port.keepSubflow!({ projectId: "p1", flowId: "f1", subflowId: "s1" });
  assert.deepEqual(kept, { ok: true, value: { saved: false, code: "part.not_found", message: "That piece is not in this automation." } });
  assert.deepEqual(t.sent, [{ type: AUTOMATION_PANEL_MESSAGES.savePart, projectId: "p1", flowId: "f1", subflowId: "s1" }]);
});

test("Run again starts the Flow a listed task names", async () => {
  const t = setup({
    [AUTOMATION_PANEL_MESSAGES.listTasks]: ok({ tasks: [task("task.1", "Kettle", 5000)], nextCursor: null }),
    [AUTOMATION_PANEL_MESSAGES.runAutomation]: ok({ runSummary: { runId: "run-7" } })
  });
  await t.tasks.port.list({ projectId: "p1", limit: 5 });
  await t.tasks.results.runAgain({ projectId: "p1", taskId: "task.1" });
  assert.ok(t.sent.some((message) => message.type === AUTOMATION_PANEL_MESSAGES.runAutomation && message.flowId === "flow-task.1"));
});
