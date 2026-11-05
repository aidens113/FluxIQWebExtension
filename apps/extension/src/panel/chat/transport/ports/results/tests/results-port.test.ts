// The answer turn's adapter: a finished run in the activity feed becomes an outcome
// of the real rows its dataset exports. Pure unit: the background is a scripted `request`.

import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_MESSAGES } from "../../../../../../shared/activity/index";
import { AUTOMATION_PANEL_MESSAGES } from "../../../../../../shared/protocol";
import type { PanelMessage, PanelResult, PanelStore } from "../../../../../state";
import { createExtensionChatTransport } from "../../../create-extension-chat-transport";
// Core's shared records and their cross-record check. `@fluxiq/ui-components` restates the types and
// does not import them, so the adapter's output is run through the contract's own readers here.
import { checkAutomationStudioTaskAttemptResult, parseAutomationStudioTaskResult } from "@fluxiq/contracts/automation";

type Download = { fileName: string; contentType: string; body: string };

const ROWS = [{ product_name: "Blue kettle", unitPrice: 18.5 }, { product_name: "Glass jug", unitPrice: 9 }];

function detailReply(summary: Record<string, unknown>, datasets: unknown[]): PanelResult<unknown> {
  return { ok: true, value: { ok: true, payload: { runDetail: { summary: { runId: "run-1", flowId: "flow-1", status: "succeeded", startedAt: 1000, finishedAt: 4500, ...summary }, datasets }, adaptations: [] } } };
}

function exportReply(body: string, format: "json" | "csv" = "json"): PanelResult<unknown> {
  return { ok: true, value: { ok: true, payload: { export: { tooLarge: false, fileName: `rows.${format}`, contentType: format === "json" ? "application/json" : "text/csv", body } } } };
}

function setup(script: { detail?: PanelResult<unknown>; export?: PanelResult<unknown>; run?: PanelResult<unknown> }) {
  const sent: PanelMessage[] = [];
  const downloads: Download[] = [];
  let push: (message: unknown) => void = () => undefined;
  const request = (async (message: PanelMessage) => {
    sent.push(message);
    if (message.type === AUTOMATION_PANEL_MESSAGES.runDetail) return script.detail ?? { ok: false, sentence: "no detail" };
    if (message.type === AUTOMATION_PANEL_MESSAGES.exportDataset) return script.export ?? { ok: false, sentence: "no export" };
    if (message.type === AUTOMATION_PANEL_MESSAGES.runAutomation) return script.run ?? { ok: false, sentence: "no run" };
    // Core has no attempts for these runs: what its attempts add is `./core-attempts.test.ts`.
    if (message.type === AUTOMATION_PANEL_MESSAGES.taskOutcomes) return message.attemptId === undefined ? { ok: true, value: { ok: true, payload: { outcomes: [] } } } : { ok: false, sentence: "I could not find that attempt." };
    return { ok: false, sentence: "unexpected" };
  }) as PanelStore["request"];
  const transport = createExtensionChatTransport(request, (listener) => {
    push = listener;
    return () => undefined;
  }, (fileName, contentType, body) => {
    downloads.push({ fileName, contentType, body });
  });
  assert.ok(transport.results);
  return { results: transport.results, sent, downloads, push: (message: unknown) => push(message) };
}

function finished(over: Record<string, unknown> = {}, subject: Record<string, unknown> = {}) {
  return {
    type: ACTIVITY_MESSAGES.changed,
    state: { current: { activityId: "a1", sequence: 9, subject: { kind: "run", id: "run-1", projectId: "p1", flowId: "flow-1", ...subject }, phase: "done", label: "Done", final: true, conversationId: "c1", at: "2026-11-03T10:00:00Z", ...over } }
  };
}

async function outcomesOf(t: ReturnType<typeof setup>, projectId: string, conversationId: string): Promise<unknown[]> {
  const read = await t.results.readThread({ projectId, conversationId });
  assert.ok(read.ok);
  return [...read.value.outcomes];
}

const DATASETS = [{ datasetId: "deals", label: "Deals", recordCount: 2 }];

test("a finished run becomes an outcome with the real rows of its export, unverified", async () => {
  const t = setup({ detail: detailReply({}, DATASETS), export: exportReply(JSON.stringify(ROWS)) });
  t.push(finished());
  const read = await t.results.readThread({ projectId: "p1", conversationId: "c1" });
  assert.ok(read.ok);
  assert.equal(read.value.outcomes.length, 1);
  const [outcome] = read.value.outcomes;
  // An attempt's spend is real, so the port says nothing against it; this outcome has none to tell, and says so itself.
  assert.equal(t.results.reportsSpend, undefined);
  assert.equal(outcome?.spendUnknown, true);
  // Nothing confirmed these rows, so the run is never `achieved` (the contract refuses it), and it is not a
  // status the contract has either: the chat tells it as found and not confirmed.
  assert.equal(outcome?.attempt.status, "finished_unchecked");
  assert.equal(outcome?.attempt.runId, "run-1");
  assert.equal(outcome?.attempt.flowId, "flow-1");
  assert.equal(outcome?.attempt.spend.usd, 0);
  assert.equal(outcome?.attempt.spend.ms, 3500);
  assert.equal(outcome?.result?.kind, "rows");
  assert.equal(outcome?.result?.label, "unverified");
  assert.equal(outcome?.result?.timesChecked, 0);
  assert.deepEqual(outcome?.result?.rows, {
    runId: "run-1", datasetId: "deals", totalRows: 2, truncated: false,
    columns: [{ id: "product_name", label: "Product name" }, { id: "unitPrice", label: "Unit price" }],
    previewRows: ROWS
  });
  assert.deepEqual(outcome?.result?.acts, []);
  assert.equal(outcome?.result?.answerText, undefined);
  assert.equal(outcome?.saved, undefined);
  assert.deepEqual(t.sent.map((message) => message.type), [AUTOMATION_PANEL_MESSAGES.runDetail, AUTOMATION_PANEL_MESSAGES.exportDataset, AUTOMATION_PANEL_MESSAGES.taskOutcomes]);
  assert.deepEqual(t.sent[1], { type: AUTOMATION_PANEL_MESSAGES.exportDataset, runId: "run-1", datasetId: "deals", format: "json" });
  const one = await t.results.readAttempt({ projectId: "p1", attemptId: "attempt-run-1" });
  assert.deepEqual(one, { ok: true, value: outcome });
  const missing = await t.results.readAttempt({ projectId: "p1", attemptId: "nope" });
  assert.equal(missing.ok, false);
});

test("a result check the run's own summary reports as confirmed is labelled confirmed, checked once", async () => {
  const t = setup({ detail: detailReply({ resultCheck: { status: "confirmed" } }, DATASETS), export: exportReply(JSON.stringify(ROWS)) });
  t.push(finished());
  const read = await t.results.readThread({ projectId: "p1", conversationId: "c1" });
  assert.ok(read.ok);
  assert.equal(read.value.outcomes[0]?.result?.label, "confirmed");
  assert.equal(read.value.outcomes[0]?.result?.timesChecked, 1);
  assert.equal(read.value.outcomes[0]?.attempt.status, "achieved", "achieved only for a run whose check was confirmed");
});

test("what the adapter reports passes Core's shared check: an unchecked run is no achieved attempt, a confirmed one is achieved with a confirmed result", async () => {
  for (const [summary, status, label] of [[{}, "finished_unchecked", "unverified"], [{ resultCheck: { status: "confirmed" } }, "achieved", "confirmed"]] as const) {
    const t = setup({ detail: detailReply(summary, DATASETS), export: exportReply(JSON.stringify(ROWS)) });
    t.push(finished());
    const read = await t.results.readThread({ projectId: "p1", conversationId: "c1" });
    assert.ok(read.ok);
    const outcome = read.value.outcomes[0]!;
    assert.equal(outcome.attempt.status, status);
    const parsed = parseAutomationStudioTaskResult(outcome.result);
    assert.equal(parsed.ok, true, JSON.stringify(parsed));
    assert.equal(outcome.result?.label, label);
    // The check applies to the contract's own statuses; `finished_unchecked` is not one, so it can never be
    // told as `achieved`: asked as if it were, the contract refuses it, which is why it is not.
    assert.deepEqual(checkAutomationStudioTaskAttemptResult({ attemptId: outcome.attempt.attemptId, status: "achieved" }, outcome.result).ok, label === "confirmed");
    if (outcome.attempt.status === "achieved") assert.deepEqual(checkAutomationStudioTaskAttemptResult(outcome.attempt, outcome.result), { ok: true });
  }
});

test("a run with no dataset, a run that did not succeed, and runs that are not final and done give no outcome", async () => {
  const none = setup({ detail: detailReply({}, []) });
  none.push(finished());
  assert.deepEqual(await outcomesOf(none, "p1", "c1"), []);
  assert.equal(none.sent.some((message) => message.type === AUTOMATION_PANEL_MESSAGES.exportDataset), false);

  const failed = setup({ detail: detailReply({ status: "failed" }, DATASETS), export: exportReply("[]") });
  failed.push(finished());
  assert.deepEqual(await outcomesOf(failed, "p1", "c1"), []);

  const ignored = setup({ detail: detailReply({}, DATASETS), export: exportReply(JSON.stringify(ROWS)) });
  ignored.push(finished({ final: false }));
  ignored.push(finished({ phase: "failed" }));
  ignored.push(finished({ stopped: true }));
  ignored.push(finished({}, { kind: "build" }));
  ignored.push({ type: "something.else" });
  assert.deepEqual(await outcomesOf(ignored, "p1", "c1"), []);
  // Core was asked for its attempts, and no run was read: none of these is a finished run.
  assert.deepEqual(ignored.sent.map((message) => message.type), [AUTOMATION_PANEL_MESSAGES.taskOutcomes]);
});

test("an export that fails is a failed result with no outcome, and nothing throws", async () => {
  const t = setup({ detail: detailReply({}, DATASETS), export: { ok: false, sentence: "FluxIQ is busy." } });
  t.push(finished());
  assert.deepEqual(await outcomesOf(t, "p1", "c1"), []);
  const saved = await t.results.exportRows({ projectId: "p1", runId: "run-1", datasetId: "deals", format: "csv" });
  assert.deepEqual(saved, { ok: false, sentence: "FluxIQ is busy." });
  assert.deepEqual(t.downloads, []);
  const garbled = setup({ detail: detailReply({}, DATASETS), export: exportReply("not json at all") });
  garbled.push(finished());
  assert.deepEqual(await outcomesOf(garbled, "p1", "c1"), []);
});

test("a dataset too large to send is a truncated result with no rows of its own, and its count from the run", async () => {
  const tooLarge: PanelResult<unknown> = { ok: true, value: { ok: true, payload: { export: { tooLarge: true } } } };
  const t = setup({ detail: detailReply({}, [{ datasetId: "deals", recordCount: 90_000 }]), export: tooLarge });
  t.push(finished());
  const read = await t.results.readThread({ projectId: "p1", conversationId: "c1" });
  assert.ok(read.ok);
  assert.deepEqual(read.value.outcomes[0]?.result?.rows, { runId: "run-1", datasetId: "deals", totalRows: 90_000, truncated: true, columns: [], previewRows: [] });
  const saved = await t.results.exportRows({ projectId: "p1", runId: "run-1", datasetId: "deals", format: "json" });
  assert.equal(saved.ok, false);
  assert.deepEqual(t.downloads, []);
});

test("only the leading rows are kept, with the whole count", async () => {
  const many = Array.from({ length: 120 }, (_, index) => ({ n: index }));
  const t = setup({ detail: detailReply({}, [{ datasetId: "deals", recordCount: 120 }]), export: exportReply(JSON.stringify(many)) });
  t.push(finished());
  const read = await t.results.readThread({ projectId: "p1", conversationId: "c1" });
  assert.ok(read.ok);
  const rows = read.value.outcomes[0]?.result?.rows;
  assert.equal(rows?.totalRows, 120);
  assert.equal(rows?.previewRows.length, 50);
  assert.deepEqual(rows?.previewRows[49], { n: 49 });
});

test("exporting saves the whole file as the background sent it", async () => {
  const csv = "Name,Price\r\nKettle,18.5\r\n";
  const t = setup({ export: exportReply(csv, "csv") });
  const saved = await t.results.exportRows({ projectId: "p1", runId: "run-1", datasetId: "deals", format: "csv" });
  assert.deepEqual(saved, { ok: true, value: { fileName: "rows.csv" } });
  assert.deepEqual(t.downloads, [{ fileName: "rows.csv", contentType: "text/csv", body: csv }]);
  assert.deepEqual(t.sent, [{ type: AUTOMATION_PANEL_MESSAGES.exportDataset, runId: "run-1", datasetId: "deals", format: "csv" }]);
  const json = setup({ export: exportReply(JSON.stringify(ROWS)) });
  await json.results.exportRows({ projectId: "p1", runId: "run-1", datasetId: "deals", format: "json" });
  assert.deepEqual(json.downloads, [{ fileName: "rows.json", contentType: "application/json", body: JSON.stringify(ROWS) }]);
});

test("a download that throws is a failed result, not a throw", async () => {
  const request = (async () => exportReply("[]")) as PanelStore["request"];
  const results = createExtensionChatTransport(request, () => () => undefined, () => { throw new Error("blocked"); }).results;
  const saved = await results?.exportRows({ projectId: "p1", runId: "run-1", datasetId: "deals", format: "json" });
  assert.equal(saved?.ok, false);
});

test("a run with no conversation belongs to the latest thread its project spoke in", async () => {
  const t = setup({ detail: detailReply({}, DATASETS), export: exportReply(JSON.stringify(ROWS)) });
  t.push(finished({ conversationId: "c-old", final: false, phase: "running" }));
  t.push(finished({ conversationId: "c-new", final: false, phase: "running" }));
  t.push(finished({ conversationId: undefined }));
  assert.equal((await outcomesOf(t, "p1", "c-old")).length, 0);
  assert.equal((await outcomesOf(t, "p1", "c-new")).length, 1);
  assert.equal((await outcomesOf(t, "other", "c-new")).length, 0);
});

test("run again starts the outcome's own flow through the existing run message, and is unsupported without a flow", async () => {
  const started: PanelResult<unknown> = { ok: true, value: { ok: true, payload: { runSummary: { runId: "run-2", flowId: "flow-1", status: "queued" } } } };
  const t = setup({ detail: detailReply({}, DATASETS), export: exportReply(JSON.stringify(ROWS)), run: started });
  t.push(finished());
  const again = await t.results.runAgain({ projectId: "p1", taskId: "task-run-1" });
  assert.deepEqual(again, { ok: true, value: { attemptId: "attempt-run-2" } });
  assert.deepEqual(t.sent.at(-1), { type: AUTOMATION_PANEL_MESSAGES.runAutomation, flowId: "flow-1" });
  const unknown = await t.results.runAgain({ projectId: "p1", taskId: "task-nope" });
  assert.deepEqual(unknown, { ok: false, sentence: "I can't run this one again from here.", unsupported: true });
  // Carrying on is Core's since t869 (`core-attempts.test.ts`), so the port has it.
  assert.equal(typeof t.results.addBudgetAndCarryOn, "function");
});
