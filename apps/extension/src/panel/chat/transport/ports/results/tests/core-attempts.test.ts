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

// A person closes the popup while a task goes on, and opens it again after it finished. The result is Core's,
// so the new panel's first read tells it, though this port never saw a push for it.
test("a task that finished while no panel was open is told by the first read of a panel opened afterwards", async () => {
  let kept: unknown[] = [];
  const request = (async (message: PanelMessage) => {
    if (message.type === AUTOMATION_PANEL_MESSAGES.taskOutcomes) return outcomes(...kept);
    return { ok: false, sentence: "unexpected" };
  }) as PanelStore["request"];
  const open = () => createExtensionChatTransport(request, () => () => undefined).results!;
  const before = open();
  assert.deepEqual(await before.readThread({ projectId: "p1", conversationId: "c1" }), { ok: true, value: { outcomes: [] } });
  // The popup is closed here: nothing is listening, and the task finishes.
  kept = [{ attempt: attempt(), result: confirmed(), saved: SAVED }];
  const after = open();
  const read = await after.readThread({ projectId: "p1", conversationId: "c1" });
  assert.ok(read.ok);
  assert.deepEqual(read.value.outcomes.map((outcome) => [outcome.attempt.attemptId, outcome.attempt.status, outcome.result?.label]), [["attempt.1", "achieved", "confirmed"]]);
  const one = await open().readAttempt({ projectId: "p1", attemptId: "attempt.1" });
  assert.equal(one.ok, false, "this scripted Core answers a thread, and the attempt read asks for its own");
});

const PROVENANCE = { route: "ran the Flow it had saved", startedFrom: "a saved Flow of 2 steps", steps: [{ position: 1, label: "Open loans", from: "saved", ran: true }, { position: 2, label: "Renew", from: "worked_out", ran: false }] };

test("an attempt's provenance reaches the chat through the contract's parse, and an attempt with none has none", async () => {
  const t = setup({ thread: outcomes({ attempt: attempt(), result: confirmed(), provenance: PROVENANCE }, { attempt: attempt({ attemptId: "attempt.2", runId: "explore.2", startedAtMs: 3000, endedAtMs: 3900 }), result: confirmed("attempt.2") }), attempt: { ok: true, value: { ok: true, payload: { outcome: { attempt: attempt(), result: confirmed(), provenance: PROVENANCE } } } } });
  const read = await t.results.readThread({ projectId: "p1", conversationId: "c1" });
  assert.ok(read.ok);
  assert.deepEqual(read.value.outcomes[0]?.provenance, PROVENANCE);
  assert.equal("provenance" in read.value.outcomes[1]!, false);
  const one = await t.results.readAttempt({ projectId: "p1", attemptId: "attempt.1" });
  assert.ok(one.ok);
  assert.deepEqual(one.value.provenance, PROVENANCE);
});

test("a provenance that is not exactly the shape fails the read, and nothing is dropped silently", async () => {
  const bad: unknown[] = [
    "steps",
    { ...PROVENANCE, extra: 1 },
    { route: "x", startedFrom: "y" },
    { ...PROVENANCE, steps: [{ position: 1, label: "Open", from: "saved" }] },
    { ...PROVENANCE, steps: [{ position: 1, label: "Open", from: "invented", ran: true }] },
    { ...PROVENANCE, steps: [{ position: 1.5, label: "Open", from: "saved", ran: true }] },
    { ...PROVENANCE, steps: [{ position: 1, label: "Open", from: "saved", ran: "yes" }] },
    { ...PROVENANCE, steps: [{ position: 1, label: "Open", from: "saved", ran: true, hidden: true }] }
  ];
  for (const provenance of bad) {
    const t = setup({ thread: outcomes({ attempt: attempt(), result: confirmed(), provenance }) });
    assert.equal((await t.results.readThread({ projectId: "p1", conversationId: "c1" })).ok, false, JSON.stringify(provenance));
  }
});

test("carrying an attempt on asks Core for exactly the attempt and the amount, and answers what Core said", async () => {
  const sent: PanelMessage[] = [];
  const reply = (async (message: PanelMessage) => {
    sent.push(message);
    return { ok: true, value: { ok: true, payload: { attemptId: "attempt.1", budgetUsd: 5 } } };
  }) as PanelStore["request"];
  const results = createExtensionChatTransport(reply, () => () => undefined).results!;
  assert.deepEqual(await results.addBudgetAndCarryOn!({ projectId: "p1", attemptId: "attempt.1", addUsd: 0 }), { ok: true, value: { attemptId: "attempt.1", budgetUsd: 5 } });
  assert.deepEqual(sent, [{ type: AUTOMATION_PANEL_MESSAGES.carryOnTaskAttempt, projectId: "p1", attemptId: "attempt.1", addUsd: 0 }]);
});

test("a carry-on Core refuses is Core's sentence, and an answer that is not the contract's is a failed request", async () => {
  const refusing = createExtensionChatTransport((async () => ({ ok: false, sentence: "That attempt is still going." })) as PanelStore["request"], () => () => undefined).results!;
  assert.deepEqual(await refusing.addBudgetAndCarryOn!({ projectId: "p1", attemptId: "attempt.1", addUsd: 0 }), { ok: false, sentence: "That attempt is still going." });
  for (const payload of [{}, { attemptId: "attempt.1" }, { attemptId: "attempt.1", budgetUsd: "5" }, { attemptId: "", budgetUsd: 5 }]) {
    const odd = createExtensionChatTransport((async () => ({ ok: true, value: { ok: true, payload } })) as PanelStore["request"], () => () => undefined).results!;
    assert.equal((await odd.addBudgetAndCarryOn!({ projectId: "p1", attemptId: "attempt.1", addUsd: 1 })).ok, false, JSON.stringify(payload));
  }
});
