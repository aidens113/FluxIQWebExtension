// The controller's Stop: offered only while the automation's run is in
// progress, aimed at that run's id when known, and the project-wide stop as
// the fallback while a Run from this panel has not been named yet.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../shared/constants";
import { AUTOMATION_PANEL_MESSAGES as M } from "../../../shared/protocol";
import type { PanelMessage, PanelResult } from "../../state";
import { statusWith } from "../../tests/status-fixture";
import { createAutomationsController } from "../controller";

const connected = statusWith({ connectionState: "connected", paired: true });
const ok = (payload: unknown): PanelResult<unknown> => ({ ok: true, value: { ok: true, payload } });
const done = { runId: "r0", flowId: "f1", status: "succeeded", startedAt: 0, finishedAt: 2_000, updatedAt: 2_000 };
const live = { runId: "r1", flowId: "f1", status: "running", startedAt: 10_000, updatedAt: 11_000 };
const cancelled = { ...live, status: "cancelled", finishedAt: 12_000, updatedAt: 12_000 };
const list = (runs: unknown[]) => ok({ flows: [{ flowId: "f1", name: "Weekly orders", updatedAt: 1 }], runs });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function setup(answer: (message: PanelMessage) => PanelResult<unknown> | Promise<PanelResult<unknown>>) {
  const sent: PanelMessage[] = [];
  const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
    sent.push(message);
    return await answer(message) as PanelResult<T>;
  };
  const controller = createAutomationsController(request, { onChange() {}, download() {} });
  const stops = () => sent.filter((message) => message.type === RUNTIME_MESSAGES.panelStopRun);
  return { sent, stops, controller, row: () => controller.state().rows[0]! };
}

test("Stop is offered only while a run is in progress and does nothing otherwise", async () => {
  const view = setup(() => list([done]));
  view.controller.observe(connected); await view.controller.refresh();
  assert.equal(view.row().stoppable, false);
  assert.equal(view.row().stop, undefined);
  await view.controller.stop("f1");
  assert.equal(view.stops().length, 0);
});

test("a run FluxIQ lists as in progress stops by its own id, without another read", async () => {
  const view = setup((message) => message.type === RUNTIME_MESSAGES.panelStopRun ? ok({ runtimeSession: {} }) : list([live]));
  view.controller.observe(connected); await view.controller.refresh();
  assert.equal(view.row().stoppable, true);
  const reads = view.sent.length;
  await view.controller.stop("f1");
  assert.deepEqual(view.stops(), [{ type: RUNTIME_MESSAGES.panelStopRun, runId: "r1" }]);
  assert.equal(view.sent.length, reads + 1);
  assert.equal(view.row().stop, "requested");
});

test("a Run from the strip is named by a fresh read, stops once, and ends as Stopped", async () => {
  const runReply = deferred<PanelResult<unknown>>();
  const stopReply = deferred<PanelResult<unknown>>();
  let runs: unknown[] = [done];
  const view = setup((message) => {
    if (message.type === M.runAutomation) return runReply.promise;
    if (message.type === RUNTIME_MESSAGES.panelStopRun) return stopReply.promise;
    return message.type === M.runDetail ? ok({ runDetail: { datasets: [] } }) : list(runs);
  });
  view.controller.observe(connected); await view.controller.refresh();
  const running = view.controller.run("f1");
  assert.equal(view.row().stoppable, true);
  runs = [live, done];
  const stopping = view.controller.stop("f1");
  assert.equal(view.row().stop, "stopping");
  await view.controller.stop("f1");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(view.stops(), [{ type: RUNTIME_MESSAGES.panelStopRun, runId: "r1" }], "a second press sends nothing");
  stopReply.resolve(ok({ runtimeSession: {} }));
  await stopping;
  assert.equal(view.row().stop, "requested");
  runs = [cancelled, done];
  runReply.resolve(ok({ runtimeSession: cancelled }));
  await running;
  assert.equal(view.row().stoppable, false);
  assert.equal(view.row().stop, undefined);
  assert.equal(view.row().lines[0], "Stopped");
});

test("with no run id to name, Stop falls back to the project's active runs", async () => {
  const runReply = deferred<PanelResult<unknown>>();
  const view = setup((message) => message.type === M.runAutomation ? runReply.promise
    : message.type === RUNTIME_MESSAGES.panelStopRun ? ok({ runtimeSessions: [] }) : list([done]));
  view.controller.observe(connected); await view.controller.refresh();
  const running = view.controller.run("f1");
  await view.controller.stop("f1");
  assert.deepEqual(view.stops(), [{ type: RUNTIME_MESSAGES.panelStopRun }]);
  runReply.resolve(ok({ runtimeSession: cancelled })); await running;
});

test("a failed stop says so and can be pressed again", async () => {
  let fail = true;
  const view = setup((message) => message.type === RUNTIME_MESSAGES.panelStopRun
    ? (fail ? { ok: false, sentence: "synthetic" } : ok({})) : list([live]));
  view.controller.observe(connected); await view.controller.refresh();
  await view.controller.stop("f1");
  assert.equal(view.row().stop, "failed");
  fail = false;
  await view.controller.stop("f1");
  assert.equal(view.stops().length, 2);
  assert.equal(view.row().stop, "requested");
});

test("a relay that answers but refuses the stop is a failure too", async () => {
  const view = setup((message) => message.type === RUNTIME_MESSAGES.panelStopRun
    ? { ok: true, value: { ok: false, code: "failed", error: "synthetic" } } : list([live]));
  view.controller.observe(connected); await view.controller.refresh();
  await view.controller.stop("f1");
  assert.equal(view.row().stop, "failed");
});

test("a stale owner's stop does nothing, and an owner change drops the answer", async () => {
  const stopReply = deferred<PanelResult<unknown>>();
  const view = setup((message) => message.type === RUNTIME_MESSAGES.panelStopRun ? stopReply.promise : list([live]));
  view.controller.observe(connected); await view.controller.refresh();
  const owner = view.controller.state().ownerRevision;
  await view.controller.stop("f1", owner - 1);
  assert.equal(view.stops().length, 0);
  const stopping = view.controller.stop("f1", owner);
  view.controller.observe(statusWith({ connectionState: "connected", paired: true, projectId: "other" }));
  await view.controller.refresh();
  stopReply.resolve({ ok: false, sentence: "synthetic" }); await stopping;
  assert.equal(view.row().stop, undefined);
});

// t384: a run started elsewhere (the chat's "run it", a playback through the
// API) never answers this panel. FluxIQ starting work is when the list is read
// again, so the row shows the run with Stop and its id, and finishing work reads
// how it went.
test("a run started elsewhere shows Stop once FluxIQ is working, and stops by the id the list names", async () => {
  let runs: unknown[] = [done];
  const view = setup((message) => message.type === RUNTIME_MESSAGES.panelStopRun ? ok({ runtimeSession: {} }) : list(runs));
  view.controller.observe(connected); await view.controller.refresh();
  assert.equal(view.row().stoppable, false);
  runs = [live, done];
  view.controller.setWorking(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(view.row().stoppable, true);
  assert.equal(view.row().runId, "r1");
  await view.controller.stop("f1");
  assert.deepEqual(view.stops(), [{ type: RUNTIME_MESSAGES.panelStopRun, runId: "r1" }]);
  assert.equal(view.row().stop, "requested");
  runs = [cancelled, done];
  view.controller.setWorking(false);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(view.row().stoppable, false);
  assert.equal(view.row().lines[0], "Stopped");
});

test("FluxIQ's working signal reads nothing while offline", async () => {
  const view = setup(() => list([live]));
  view.controller.setWorking(true);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(view.sent.length, 0);
});
