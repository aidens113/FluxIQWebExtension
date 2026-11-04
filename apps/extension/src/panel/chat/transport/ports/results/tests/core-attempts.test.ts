// The chat's answer turn over Core's attempt records: `readThread` and `readAttempt` read Core's
// routes through the panel's request, through the contract, beside the runs the panel saw finish.
// Pure unit: the background is a scripted `request`.

import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioTaskAttemptNoLoopsCaught, parseAutomationStudioTaskResult } from "@fluxiq/contracts/automation";
import { ACTIVITY_MESSAGES } from "../../../../../../shared/activity/index";
import { AUTOMATION_PANEL_MESSAGES } from "../../../../../../shared/protocol";
import type { PanelMessage, PanelResult, PanelStore } from "../../../../../state";
import { createExtensionChatTransport } from "../../../create-extension-chat-transport";

const attempt = (over: Record<string, unknown> = {}) => ({
  taskId: "task.1", attemptId: "attempt.1", ordinal: 1, projectId: "p1", flowId: "flow-1", runId: "explore.1", path: "explore", status: "achieved",
  spend: { calls: 3, inputTokens: 10, outputTokens: 5, usd: 0.42, ms: 900 }, budget: { usd: 5 }, liveSteps: 2, loopsCaught: automationStudioTaskAttemptNoLoopsCaught(), startedAtMs: 2000, endedAtMs: 2900,
  ...over
});
const confirmed = (attemptId = "attempt.1") => ({ attemptId, kind: "plain_answer", label: "confirmed", timesChecked: 1, source: "exploration", acts: [], answerText: { text: "Three loans.", author: "model" }, checkedWhat: "The list of loans." });
const SAVED = { state: "partly_works", trust: "unproven", flowId: "flow-1", savedAtMs: 2900 };
const outcomes = (...values: unknown[]): PanelResult<unknown> => ({ ok: true, value: { ok: true, payload: { outcomes: values } } });

function setup(script: { thread?: PanelResult<unknown>; attempt?: PanelResult<unknown>; detail?: PanelResult<unknown>; export?: PanelResult<unknown> }) {
  const sent: PanelMessage[] = [];
  let push: (message: unknown) => void = () => undefined;
  const request = (async (message: PanelMessage) => {
    sent.push(message);
    if (message.type === AUTOMATION_PANEL_MESSAGES.taskOutcomes) return (message.attemptId === undefined ? script.thread : script.attempt) ?? { ok: false, sentence: "no answer" };
    if (message.type === AUTOMATION_PANEL_MESSAGES.runDetail) return script.detail ?? { ok: false, sentence: "no detail" };
    if (message.type === AUTOMATION_PANEL_MESSAGES.exportDataset) return script.export ?? { ok: false, sentence: "no export" };
    return { ok: false, sentence: "unexpected" };
  }) as PanelStore["request"];
  const transport = createExtensionChatTransport(request, (listener) => {
    push = listener;
    return () => undefined;
  });
  assert.ok(transport.results);
  return { results: transport.results, sent, push: (message: unknown) => push(message) };
}

const FINISHED_RUN = (runId: string) => ({ type: ACTIVITY_MESSAGES.changed, state: { current: { activityId: runId, sequence: 9, subject: { kind: "run", id: runId, projectId: "p1", flowId: "flow-1" }, phase: "done", label: "Done", final: true, conversationId: "c1", at: "2026-11-03T10:00:00Z" } } });
const RUN_DETAIL = (runId: string, startedAt: number): PanelResult<unknown> => ({ ok: true, value: { ok: true, payload: { runDetail: { summary: { runId, flowId: "flow-1", status: "succeeded", startedAt, finishedAt: startedAt + 100 }, datasets: [{ datasetId: "deals", recordCount: 1 }] }, adaptations: [] } } });
const RUN_EXPORT: PanelResult<unknown> = { ok: true, value: { ok: true, payload: { export: { tooLarge: false, fileName: "rows.json", contentType: "application/json", body: JSON.stringify([{ name: "Kettle" }]) } } } };

test("readThread reads the thread's attempts from Core, and says how it asked", async () => {
  const t = setup({ thread: outcomes({ attempt: attempt(), result: confirmed(), saved: SAVED }) });
  const read = await t.results.readThread({ projectId: "p1", conversationId: "c1" });
  assert.deepEqual(t.sent, [{ type: AUTOMATION_PANEL_MESSAGES.taskOutcomes, projectId: "p1", conversationId: "c1" }]);
  assert.ok(read.ok);
  const [outcome] = read.value.outcomes;
  assert.equal(outcome?.attempt.status, "achieved");
  assert.equal(outcome?.attempt.spend.usd, 0.42);
  assert.deepEqual(outcome?.saved, SAVED);
  assert.equal(parseAutomationStudioTaskResult(outcome?.result).ok, true);
  assert.equal(outcome?.spendUnknown, undefined, "an attempt's spend is real");
});

test("a thread with no attempts is an empty list, and a working row is a row", async () => {
  const none = setup({ thread: outcomes() });
  assert.deepEqual(await none.results.readThread({ projectId: "p1", conversationId: "c1" }), { ok: true, value: { outcomes: [] } });
  const working = setup({ thread: outcomes({ attempt: attempt({ status: "working", endedAtMs: undefined }) }) });
  const read = await working.results.readThread({ projectId: "p1", conversationId: "c1" });
  assert.ok(read.ok);
  assert.equal(read.value.outcomes[0]?.attempt.status, "working");
});

test("a record the contract refuses is a failed read, never a guess", async () => {
  const bad: unknown[] = [
    { attempt: attempt({ status: "failed" }) },
    { attempt: attempt(), result: { ...confirmed(), label: "probably" } },
    // Each parses alone, and they disagree: a tick on an answer nobody confirmed.
    { attempt: attempt(), result: { ...confirmed(), label: "unverified" } },
    { attempt: attempt(), result: confirmed("attempt.other") },
    { attempt: attempt(), result: confirmed(), saved: { state: "ready", trust: "unproven", flowId: "flow-1", savedAtMs: 1, lastWorkedAtMs: 1 } },
    { attempt: attempt(), result: confirmed(), comparedTo: { attemptId: "attempt.0" } },
    { attempt: attempt(), result: confirmed(), spentForReal: true },
    { attempt: attempt() },
    { attempt: attempt({ projectId: "another-project" }), result: confirmed() },
    "not an outcome"
  ];
  for (const value of bad) {
    const t = setup({ thread: outcomes({ attempt: attempt({ attemptId: "attempt.good", runId: "explore.good" }), result: confirmed("attempt.good") }, value), attempt: { ok: true, value: { ok: true, payload: { outcome: value } } } });
    const read = await t.results.readThread({ projectId: "p1", conversationId: "c1" });
    assert.equal(read.ok, false, JSON.stringify(value));
    if (!read.ok) assert.equal(read.sentence, "FluxIQ's account of this task could not be read.");
    assert.equal((await t.results.readAttempt({ projectId: "p1", attemptId: "attempt.1" })).ok, false, JSON.stringify(value));
  }
  const notAList = setup({ thread: { ok: true, value: { ok: true, payload: { outcomes: "nope" } } } });
  assert.equal((await notAList.results.readThread({ projectId: "p1", conversationId: "c1" })).ok, false);
});

test("a refusal from Core is a failed read in Core's own words", async () => {
  const t = setup({ thread: { ok: false, sentence: "What was kept of this task could not be read, so I cannot say how it went." } });
  assert.deepEqual(await t.results.readThread({ projectId: "p1", conversationId: "c1" }), { ok: false, sentence: "What was kept of this task could not be read, so I cannot say how it went." });
});

test("readAttempt reads one attempt from Core, and says Core's words when it cannot find it", async () => {
  const t = setup({ attempt: { ok: true, value: { ok: true, payload: { outcome: { attempt: attempt(), result: confirmed() } } } } });
  const read = await t.results.readAttempt({ projectId: "p1", attemptId: "attempt.1" });
  assert.deepEqual(t.sent, [{ type: AUTOMATION_PANEL_MESSAGES.taskOutcomes, projectId: "p1", attemptId: "attempt.1" }]);
  assert.ok(read.ok);
  assert.equal(read.value.attempt.attemptId, "attempt.1");
  const missing = setup({ attempt: { ok: false, sentence: "I could not find that attempt." } });
  assert.deepEqual(await missing.results.readAttempt({ projectId: "p1", attemptId: "attempt.none" }), { ok: false, sentence: "I could not find that attempt." });
});

test("a run this panel saw finish is told beside the attempts, oldest first, marked as having no known spend", async () => {
  const t = setup({ thread: outcomes({ attempt: attempt(), result: confirmed() }), detail: RUN_DETAIL("run-before", 1000), export: RUN_EXPORT });
  t.push(FINISHED_RUN("run-before"));
  const read = await t.results.readThread({ projectId: "p1", conversationId: "c1" });
  assert.ok(read.ok);
  assert.deepEqual(read.value.outcomes.map((outcome) => [outcome.attempt.attemptId, outcome.spendUnknown]), [["attempt-run-before", true], ["attempt.1", undefined]]);
  const one = await t.results.readAttempt({ projectId: "p1", attemptId: "attempt-run-before" });
  assert.ok(one.ok);
  assert.equal(one.value.attempt.runId, "run-before");
  assert.equal(t.sent.some((message) => message.type === AUTOMATION_PANEL_MESSAGES.taskOutcomes && message.attemptId !== undefined), false, "a run the panel holds needs no call");
});

test("an attempt's own session finishing in the feed is not told a second time", async () => {
  const t = setup({ thread: outcomes({ attempt: attempt(), result: confirmed() }), detail: RUN_DETAIL("explore.1", 2000), export: RUN_EXPORT });
  t.push(FINISHED_RUN("explore.1"));
  const read = await t.results.readThread({ projectId: "p1", conversationId: "c1" });
  assert.ok(read.ok);
  assert.deepEqual(read.value.outcomes.map((outcome) => outcome.attempt.attemptId), ["attempt.1"]);
});

test("the port says nothing against real spend: the marker is a run's alone", () => {
  assert.equal(setup({}).results.reportsSpend, undefined);
});
