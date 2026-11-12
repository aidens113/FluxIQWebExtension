// Coverage of humanness-relay.ts: a Flow's read, a Flow's set or clear and a
// task's set or clear are each one Core call carrying exactly the fields
// written here, `null` clears, the session's project stands in only when none
// is named, a level that cannot travel is refused before Core, and Core's
// refusal comes back as Core gave it.

import assert from "node:assert/strict";
import test from "node:test";

import { RUNTIME_MESSAGES } from "../../../shared/constants";
import type { PanelRelayResponse } from "../../../shared/protocol";
import { relayHumanness } from "../humanness-relay";
import type { PanelRelayContext } from "../relay-context";

function context(answers: Record<string, PanelRelayResponse> = {}, projectId: string | null = "project-session") {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const value: PanelRelayContext = {
    call: async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      return answers[endpoint] ?? { ok: true, payload: {} };
    },
    projectId: () => projectId,
    pageLocation: async () => undefined
  };
  return { value, calls };
}

const flowRead = RUNTIME_MESSAGES.panelFlowHumannessRead;
const flowSet = RUNTIME_MESSAGES.panelFlowHumannessSet;
const taskSet = RUNTIME_MESSAGES.panelTaskHumannessSet;

test("the three message names are the panel's own", () => {
  assert.equal(flowRead, "fluxiq.panel.flowHumannessRead");
  assert.equal(flowSet, "fluxiq.panel.flowHumannessSet");
  assert.equal(taskSet, "fluxiq.panel.taskHumannessSet");
});

test("a Flow's read is one get-flow-metadata-detail with the project and the Flow, answering only the level Core holds", async () => {
  const c = context({ "get-flow-metadata-detail": { ok: true, payload: { flow: { flowId: "flow-1", name: "Orders", inputs: [], metadata: { humanness: 40 } } } } });
  const answer = await relayHumanness({ type: flowRead, projectId: " project-2 ", flowId: " flow-1 ", humanness: 90, name: "x" }, c.value);
  assert.deepEqual(answer, { ok: true, payload: { humanness: 40 } });
  assert.deepEqual(c.calls, [{ endpoint: "get-flow-metadata-detail", payload: { projectId: "project-2", flowId: "flow-1" } }]);
});

test("a Flow with no level of its own reads as none", async () => {
  for (const flow of [{ flowId: "flow-1" }, { flowId: "flow-1", metadata: {} }, { flowId: "flow-1", metadata: { humanness: null } }, null]) {
    const c = context({ "get-flow-metadata-detail": { ok: true, payload: { flow } } });
    assert.deepEqual(await relayHumanness({ type: flowRead, flowId: "flow-1" }, c.value), { ok: true, payload: {} });
  }
});

test("a Flow's set is one update-flow-settings whose patch carries the humanness and nothing else", async () => {
  const c = context({ "update-flow-settings": { ok: true, payload: { flow: { flowId: "flow-1", metadata: { humanness: 65 } } } } });
  const answer = await relayHumanness({ type: flowSet, projectId: "project-2", flowId: "flow-1", humanness: 65, name: "Renamed", metadata: { costLimit: 9 }, flow: { visibility: "public" } }, c.value);
  assert.deepEqual(answer, { ok: true, payload: { humanness: 65 } });
  assert.deepEqual(c.calls, [{ endpoint: "update-flow-settings", payload: { projectId: "project-2", flowId: "flow-1", flow: { flowId: "flow-1", metadata: { humanness: 65 } } } }]);
});

test("a Flow's clear sends null, and the level Core no longer holds reads as none", async () => {
  const c = context({ "update-flow-settings": { ok: true, payload: { flow: { flowId: "flow-1" } } } });
  assert.deepEqual(await relayHumanness({ type: flowSet, flowId: "flow-1", humanness: null }, c.value), { ok: true, payload: {} });
  assert.deepEqual(c.calls, [{ endpoint: "update-flow-settings", payload: { projectId: "project-session", flowId: "flow-1", flow: { flowId: "flow-1", metadata: { humanness: null } } } }]);
});

test("a task's set and clear are each one update-task-settings with the project, the task and the level", async () => {
  const set = context({ "update-task-settings": { ok: true, payload: { taskId: "task-1", humanness: 55 } } });
  assert.deepEqual(await relayHumanness({ type: taskSet, projectId: "project-2", taskId: "task-1", humanness: 55, title: "x", flowId: "flow-9" }, set.value), { ok: true, payload: { humanness: 55 } });
  assert.deepEqual(set.calls, [{ endpoint: "update-task-settings", payload: { projectId: "project-2", taskId: "task-1", humanness: 55 } }]);
  const clear = context({ "update-task-settings": { ok: true, payload: { taskId: "task-1", humanness: null } } });
  assert.deepEqual(await relayHumanness({ type: taskSet, projectId: "project-2", taskId: "task-1", humanness: null }, clear.value), { ok: true, payload: {} });
  assert.deepEqual(clear.calls, [{ endpoint: "update-task-settings", payload: { projectId: "project-2", taskId: "task-1", humanness: null } }]);
});

test("a level Core judges out of range is sent as given, and Core's refusal comes back as Core gave it", async () => {
  const refusal: PanelRelayResponse = { ok: false, code: "failed", httpStatus: 400, coreCode: "task.humanness_invalid", error: "A task's humanness is a whole number from 0 to 100, or null to remove it." };
  const c = context({ "update-task-settings": refusal });
  assert.deepEqual(await relayHumanness({ type: taskSet, projectId: "project-2", taskId: "task-1", humanness: 101 }, c.value), refusal);
  assert.deepEqual(c.calls, [{ endpoint: "update-task-settings", payload: { projectId: "project-2", taskId: "task-1", humanness: 101 } }]);
  const flow = context({ "get-flow-metadata-detail": { ok: false, code: "refused", httpStatus: 403, error: "FluxIQ refused this browser's pairing." } });
  assert.deepEqual(await relayHumanness({ type: flowRead, flowId: "flow-1" }, flow.value), { ok: false, code: "refused", httpStatus: 403, error: "FluxIQ refused this browser's pairing." });
});

test("a request naming no Flow or task, or no level that can travel, is refused before Core is called", async () => {
  const c = context();
  assert.deepEqual(await relayHumanness({ type: flowRead }, c.value), { ok: false, code: "invalid_request", error: "Say which Flow this is for." });
  assert.deepEqual(await relayHumanness({ type: flowSet, flowId: "  ", humanness: 10 }, c.value), { ok: false, code: "invalid_request", error: "Say which Flow this is for." });
  assert.deepEqual(await relayHumanness({ type: taskSet, flowId: "flow-1", humanness: 10 }, c.value), { ok: false, code: "invalid_request", error: "Say which task to change." });
  for (const humanness of [undefined, "40", Number.NaN, Number.POSITIVE_INFINITY, { level: 40 }]) {
    assert.deepEqual(await relayHumanness({ type: flowSet, flowId: "flow-1", humanness }, c.value), { ok: false, code: "invalid_request", error: "Say what humanness to use, from 0 to 100, or clear it." });
    assert.deepEqual(await relayHumanness({ type: taskSet, taskId: "task-1", humanness }, c.value), { ok: false, code: "invalid_request", error: "Say what humanness to use, from 0 to 100, or clear it." });
  }
  assert.deepEqual(c.calls, []);
});

test("with no project named the session's is used, and with none known nothing is sent", async () => {
  const known = context();
  await relayHumanness({ type: flowRead, flowId: "flow-1" }, known.value);
  assert.deepEqual(known.calls, [{ endpoint: "get-flow-metadata-detail", payload: { projectId: "project-session", flowId: "flow-1" } }]);
  const none = context({}, null);
  assert.deepEqual(await relayHumanness({ type: taskSet, taskId: "task-1", humanness: 5 }, none.value), { ok: false, code: "no_project", error: "FluxIQ has not said which project this browser belongs to yet. Connect, then try again." });
  assert.deepEqual(none.calls, []);
});

test("any other message is not this relay's", async () => {
  const c = context();
  assert.equal(await relayHumanness({ type: RUNTIME_MESSAGES.panelConversationRename, flowId: "flow-1", humanness: 5 }, c.value), undefined);
  assert.deepEqual(c.calls, []);
});
