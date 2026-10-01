// The automations controller: when it reads, what each failure turns into,
// Run and its summary, the opened automation's detail, and export.

import assert from "node:assert/strict";
import test from "node:test";
import { SIMPLE_PANEL_MESSAGES as M } from "../../../shared/protocol";
import type { PanelMessage, PanelResult } from "../../state";
import { statusWith } from "../../tests/status-fixture";
import { createAutomationsController, type SaveFile } from "../controller";

const connected = statusWith({ connectionState: "connected", paired: true });
const UNSUPPORTED: PanelResult<unknown> = { ok: false, sentence: "This extension doesn't support that yet.", unsupported: true };
const ok = (payload: unknown): PanelResult<unknown> => ({ ok: true, value: { ok: true, payload } });

const exportDetail = ok({ runDetail: { datasets: [{ datasetId: "d1" }] } });
const oldRun = { runId: "r0", flowId: "f1", status: "succeeded", startedAt: 0, finishedAt: 2_000, updatedAt: 2_000, interventionCount: 0, adaptationCount: 0 };
const newRun = { runId: "r1", flowId: "f1", status: "succeeded", startedAt: 10_000, finishedAt: 24_200, updatedAt: 24_200, interventionCount: 1, adaptationCount: 1 };
const list = (runs: unknown[]) => ok({ flows: [{ flowId: "f1", name: "Weekly orders", updatedAt: 1, nodeCount: 4 }], runs });

test("failed browser export delivery gives local recovery and releases the lock", async () => {
  let fail = true, deliveries = 0, changes = 0;
  const request = (async (message: PanelMessage) => message.type === M.exportDataset
    ? ok({ export: { tooLarge: false, fileName: "synthetic.csv", contentType: "text/csv", body: "synthetic" } }) : message.type === M.runDetail ? exportDetail : list([oldRun])) as import("../../state").PanelStore["request"];
  const controller = createAutomationsController(request, { onChange: () => changes++, download: () => { deliveries++; if (fail) throw new Error("synthetic-private-error"); } });
  controller.observe(connected); await controller.refresh(); await controller.focus("f1"); const before = changes;
  await controller.exportDataset("f1", "r0", "d1", "csv");
  assert.equal(controller.state().rows[0]?.exporting, false); assert.equal(controller.state().rows[0]?.notice?.openFluxIQ, true);
  assert.match(controller.state().rows[0]?.notice?.sentence ?? "", /couldn't save/i); assert.equal(JSON.stringify(controller.state()).includes("synthetic-private-error"), false);
  assert.ok(changes > before); fail = false; await controller.exportDataset("f1", "r0", "d1", "csv"); assert.equal(deliveries, 2); assert.equal(controller.state().rows[0]?.notice, undefined);
});

test("export lock remains held during reentrant synchronous delivery", async () => {
  let exports = 0, reentered = false; const request = (async (message: PanelMessage) => {
    if (message.type === M.exportDataset) { exports++; return ok({ export: { tooLarge: false, fileName: "synthetic.csv", contentType: "text/csv", body: "synthetic" } }); }
    return message.type === M.runDetail ? exportDetail : list([oldRun]);
  }) as import("../../state").PanelStore["request"];
  const controller = createAutomationsController(request, { onChange() {}, download() { if (!reentered) { reentered = true; void controller.exportDataset("f1", "r0", "d1", "csv"); } } });
  controller.observe(connected); await controller.refresh(); await controller.focus("f1"); await controller.exportDataset("f1", "r0", "d1", "csv"); assert.equal(exports, 1);
});

function setup(answer: (message: PanelMessage) => PanelResult<unknown>) {
  const sent: PanelMessage[] = [];
  const saved: Parameters<SaveFile>[] = [];
  let changes = 0;
  const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
    sent.push(message);
    return answer(message) as PanelResult<T>;
  };
  const controller = createAutomationsController(request, { onChange: () => changes++, download: (...args) => saved.push(args) });
  return { sent, saved, controller, changes: () => changes, types: () => sent.map((message) => message.type) };
}

test("offline reads nothing and says so; connecting is reported once", async () => {
  const { controller, sent } = setup(() => list([]));
  await controller.refresh();
  assert.equal(sent.length, 0);
  assert.equal(controller.state().mode, "offline");
  assert.equal(controller.observe(connected), true);
  assert.equal(controller.observe(connected), false);
  assert.equal(controller.state().mode, "loading");
});

test("a list read gives rows with plain summary lines; the last run's detail is read only once the automation is opened", async () => {
  const { controller, types } = setup((message) => message.type === M.listAutomations ? list([oldRun]) : ok({ runDetail: { datasets: [] }, adaptations: [] }));
  controller.observe(connected);
  await controller.refresh();
  const state = controller.state();
  assert.equal(state.mode, "list");
  assert.deepEqual(state.rows[0]?.lines, ["Completed in 2.0s", "No AI needed"]);
  assert.deepEqual(types(), [M.listAutomations], "no detail for a row nobody opened");
  await controller.focus("f1");
  assert.deepEqual(types(), [M.listAutomations, M.runDetail]);
  await controller.refresh();
  assert.deepEqual(types(), [M.listAutomations, M.runDetail, M.listAutomations], "a detail already read is not read again");
  await controller.focus(undefined);
});

test("empty list", async () => {
  const { controller } = setup(() => ok({ flows: [], runs: [] }));
  controller.observe(connected);
  await controller.refresh();
  assert.equal(controller.state().mode, "empty");
});

test("unsupported list: the fallback, and never another read", async () => {
  const { controller, sent } = setup(() => UNSUPPORTED);
  controller.observe(connected);
  await controller.refresh();
  assert.equal(controller.state().mode, "fallback");
  assert.equal(controller.state().readError, undefined);
  await controller.refresh();
  assert.equal(sent.length, 1);
});

test("a failed read keeps the rows and its sentence until the next good read; junk is a failure too", async () => {
  let answer: PanelResult<unknown> = list([oldRun]);
  const { controller } = setup((message) => message.type === M.listAutomations ? answer : UNSUPPORTED);
  controller.observe(connected);
  await controller.refresh();
  answer = { ok: false, sentence: "FluxIQ isn't answering.", detail: "timeout" };
  await controller.refresh();
  assert.equal(controller.state().mode, "list", "the rows stay");
  assert.deepEqual(controller.state().readError, { sentence: "FluxIQ isn't answering.", detail: "timeout" });
  answer = ok({ nope: true });
  await controller.refresh();
  assert.equal(controller.state().readError?.sentence, "Couldn't read your automations from FluxIQ.");
  answer = list([oldRun]);
  await controller.refresh();
  assert.equal(controller.state().readError, undefined);
});

test("Run sends runAutomation, shows Running..., then the reply's summary, re-reads, and loads the detail's datasets", async () => {
  let release: (() => void) | undefined;
  let listed: unknown[] = [oldRun];
  const answers = (message: PanelMessage): PanelResult<unknown> => {
    if (message.type === M.listAutomations) return list(listed);
    if (message.type === M.runDetail) {
      return message.runId === "r1"
        ? ok({ runDetail: { adaptationIds: ["a1"], datasets: [{ datasetId: "d1", label: "Orders", recordCount: 12 }] }, adaptations: [{ adaptationId: "a1", status: "applied" }] })
        : ok({ runDetail: {}, adaptations: [] });
    }
    listed = [oldRun, newRun];
    return ok({ runSummary: newRun, interventionCount: 1, createdAdaptationIds: ["a1"] });
  };
  const sent: PanelMessage[] = [];
  const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
    sent.push(message);
    if (message.type === M.runAutomation) await new Promise<void>((resolve) => (release = resolve));
    return answers(message) as PanelResult<T>;
  };
  const controller = createAutomationsController(request, { onChange: () => undefined, download: () => undefined });
  controller.observe(connected);
  await controller.refresh();
  await controller.focus("f1");

  const running = controller.run("f1");
  await Promise.resolve();
  assert.deepEqual(controller.state().rows[0]?.lines, ["Running..."]);
  assert.equal(controller.state().rows[0]?.running, true);
  assert.equal(controller.state().runInFlight, true);
  release?.();
  await running;

  assert.deepEqual(sent.find((message) => message.type === M.runAutomation), { type: M.runAutomation, flowId: "f1" });
  const row = controller.state().rows[0];
  assert.deepEqual(row?.lines, ["Completed in 14.2s", "AI activated once", "Learned 1 new page variation", "Future runs updated"]);
  assert.equal(row?.runId, "r1");
  assert.deepEqual(row?.datasets.map((dataset) => dataset.label), ["Orders"]);
  assert.equal(sent.filter((message) => message.type === M.listAutomations).length, 2, "re-read after the run");
});

test("Run waits while FluxIQ runs something, and while offline", async () => {
  const { controller, types } = setup(() => list([oldRun]));
  controller.observe(connected);
  controller.setWorking(true);
  assert.equal(controller.state().working, true);
  await controller.run("f1");
  controller.setWorking(false);
  controller.observe(statusWith({ connectionState: "disconnected", paired: true }));
  await controller.run("f1");
  assert.equal(types().includes(M.runAutomation), false);
});

test("the runtime flipping to running is not \"working\": only the shell's held signal is, and each change redraws once", () => {
  const { controller, changes } = setup(() => list([]));
  controller.observe(connected);
  const before = changes();
  for (let flip = 0; flip < 20; flip++) {
    controller.observe(statusWith({ connectionState: "connected", paired: true, runtime: flip % 2 === 0 ? { state: "running" } : { state: "idle" } }));
  }
  assert.equal(controller.state().working, false);
  assert.equal(changes(), before, "page reads never redraw the tab");
  controller.setWorking(true);
  controller.setWorking(true);
  controller.setWorking(false);
  assert.equal(changes(), before + 2);
});

test("a failed Run says why in its row; an unsupported Run points to FluxIQ and is not sent again", async () => {
  let runAnswer: PanelResult<unknown> = { ok: false, sentence: "FluxIQ couldn't start it.", detail: "boom" };
  const { controller, types } = setup((message) => message.type === M.runAutomation ? runAnswer : message.type === M.listAutomations ? list([oldRun]) : UNSUPPORTED);
  controller.observe(connected);
  await controller.refresh();
  await controller.run("f1");
  assert.deepEqual(controller.state().rows[0]?.notice, { sentence: "FluxIQ couldn't start it.", detail: "boom", openFluxIQ: false });
  runAnswer = UNSUPPORTED;
  await controller.run("f1");
  assert.deepEqual(controller.state().rows[0]?.notice, { sentence: "Run it in FluxIQ.", openFluxIQ: true });
  const before = types().filter((type) => type === M.runAutomation).length;
  await controller.run("f1");
  assert.equal(types().filter((type) => type === M.runAutomation).length, before);
});

test("export: inline saves the file, too large points to FluxIQ, a failure says why", async () => {
  let exportAnswer = ok({ export: { tooLarge: false, fileName: "orders.csv", contentType: "text/csv", body: "a,b\n", rowCount: 1 } });
  const { controller, sent, saved } = setup((message) => message.type === M.exportDataset ? exportAnswer : message.type === M.runDetail ? exportDetail : list([oldRun]));
  controller.observe(connected);
  await controller.refresh();
  await controller.focus("f1");
  await controller.exportDataset("f1", "r0", "d1", "csv");
  assert.deepEqual(sent.at(-1), { type: M.exportDataset, runId: "r0", datasetId: "d1", format: "csv" });
  assert.deepEqual(saved, [["orders.csv", "text/csv", "a,b\n"]]);
  assert.equal(controller.state().rows[0]?.notice, undefined);

  exportAnswer = ok({ export: { tooLarge: true, rowCount: 90_000, downloadPath: "/x" } });
  await controller.exportDataset("f1", "r0", "d1", "json");
  assert.deepEqual(controller.state().rows[0]?.notice, { sentence: "Too large to export here — open it in FluxIQ.", openFluxIQ: true });

  exportAnswer = { ok: false, sentence: "FluxIQ isn't answering." };
  await controller.exportDataset("f1", "r0", "d1", "json");
  assert.equal(controller.state().rows[0]?.notice?.sentence, "FluxIQ isn't answering.");
  assert.equal(saved.length, 1);
});
