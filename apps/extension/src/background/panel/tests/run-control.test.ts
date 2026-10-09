// Coverage of run-control.ts: Stop with a run named, and Stop with none, which
// asks Core which of the project's runs have not ended and stops each; and
// Take over / Hand back, which forward only the named fields and need a run.

import assert from "node:assert/strict";
import test from "node:test";

import type { PanelHandBackRunRequest, PanelRelayResponse, PanelTakeOverRunRequest } from "../../../shared/protocol";
import type { PanelRelayContext } from "../relay-context";
import { handBackRun, stopRun, takeOverRun } from "../run-control";

function context(answer: (endpoint: string, payload: Record<string, unknown>) => PanelRelayResponse, projectId: string | null = "project-1") {
  const calls: Array<{ endpoint: string; payload: Record<string, unknown> }> = [];
  const value: PanelRelayContext = {
    call: async (endpoint, payload) => {
      calls.push({ endpoint, payload });
      return answer(endpoint, payload);
    },
    projectId: () => projectId,
    pageLocation: async () => undefined
  };
  return { value, calls };
}

const reason = "Stopped from the browser extension.";

test("a build is cancelled by Flow without scanning or stopping runs", async () => {
  const c = context(() => ({ ok: true, payload: { cancellationRequested: true } }));
  await stopRun({ projectId: "p", flowId: "f" }, c.value);
  assert.deepEqual(c.calls, [{ endpoint: "cancel-flow-bootstrap", payload: { projectId: "p", flowId: "f" } }]);
  const reply = await stopRun({ flowId: "f", runId: "r" }, c.value);
  assert.equal(reply.ok, false); assert.equal(c.calls.length, 1);
});

test("a named run is stopped directly, and Core's answer comes back unchanged", async () => {
  const c = context(() => ({ ok: true, payload: { runtimeSession: { runId: "run-1", status: "cancelled" } } }));
  const reply = await stopRun({ runId: "run-1" }, c.value);
  assert.deepEqual(c.calls, [{ endpoint: "cancel-runtime-session", payload: { projectId: "project-1", runId: "run-1", reason } }]);
  assert.deepEqual(reply, { ok: true, payload: { runtimeSession: { runId: "run-1", status: "cancelled" } } });
});

test("with no run named, every run of the project that has not ended is stopped, and ended ones are left alone", async () => {
  const c = context((endpoint, payload) => endpoint === "list-runtime-sessions"
    ? { ok: true, payload: { runtimeSessions: [
      { runId: "run-a", status: "running" },
      { runId: "run-b", status: "succeeded" },
      { runId: "run-c", status: "queued" },
      { runId: "run-d", status: "cancelled" },
      { runId: "run-e", status: "waiting" },
      { status: "running" }
    ] } }
    : { ok: true, payload: { runtimeSession: { runId: payload.runId, status: "cancelled" } } });

  const reply = await stopRun({}, c.value);

  assert.deepEqual(c.calls, [
    { endpoint: "list-runtime-sessions", payload: { projectId: "project-1", summaries: true, limit: 25 } },
    { endpoint: "cancel-runtime-session", payload: { projectId: "project-1", runId: "run-a", reason } },
    { endpoint: "cancel-runtime-session", payload: { projectId: "project-1", runId: "run-c", reason } },
    { endpoint: "cancel-runtime-session", payload: { projectId: "project-1", runId: "run-e", reason } }
  ]);
  assert.deepEqual(reply, { ok: true, payload: { runtimeSessions: [
    { runId: "run-a", status: "cancelled" },
    { runId: "run-c", status: "cancelled" },
    { runId: "run-e", status: "cancelled" }
  ] } });
});

test("with nothing running, Stop answers an empty list rather than an error", async () => {
  const c = context(() => ({ ok: true, payload: { runtimeSessions: [{ runId: "run-b", status: "failed" }] } }));
  assert.deepEqual(await stopRun({ projectId: "project-2" }, c.value), { ok: true, payload: { runtimeSessions: [] } });
  assert.deepEqual(c.calls.map((entry) => entry.payload.projectId), ["project-2"]);
});

test("a refused listing or stop comes back as Core said it", async () => {
  const refused: PanelRelayResponse = { ok: false, code: "failed", httpStatus: 404, error: "Global program API handler not found: automation-studio/cancel-runtime-session" };
  const c = context((endpoint) => endpoint === "list-runtime-sessions" ? { ok: true, payload: { runtimeSessions: [{ runId: "run-a", status: "running" }] } } : refused);
  assert.deepEqual(await stopRun({}, c.value), refused);
});

test("with no project known, Stop is refused before Core is called", async () => {
  const c = context(() => ({ ok: true, payload: null }), null);
  assert.deepEqual(await stopRun({ runId: "run-1" }, c.value), {
    ok: false, code: "no_project", error: "FluxIQ has not said which project this browser belongs to yet. Connect, then try again."
  });
  assert.deepEqual(c.calls, []);
});

test("Take over pauses the named run with the page handed to the person, sending only the named fields", async () => {
  const answer = { runId: "run-1", sessionStatus: "running", live: true, runControl: { state: "paused" }, progress: null };
  const c = context(() => ({ ok: true, payload: answer }));
  const reply = await takeOverRun({ runId: " run-1 ", reason: "x", takeControl: false, extra: 1 } as Partial<PanelTakeOverRunRequest>, c.value);
  assert.deepEqual(c.calls, [{ endpoint: "pause-runtime-session", payload: { projectId: "project-1", runId: "run-1", takeControl: true } }]);
  assert.deepEqual(reply, { ok: true, payload: answer });
  await takeOverRun({ projectId: "project-9", runId: "run-2" }, c.value);
  assert.deepEqual(c.calls[1], { endpoint: "pause-runtime-session", payload: { projectId: "project-9", runId: "run-2", takeControl: true } });
});

test("Hand back resumes the named run after the person's own actions, sending only the named fields", async () => {
  const c = context(() => ({ ok: true, payload: { runId: "run-1", live: true } }));
  const reply = await handBackRun({ runId: "run-1", note: "done", afterManualAction: false } as Partial<PanelHandBackRunRequest>, c.value);
  assert.deepEqual(c.calls, [{ endpoint: "resume-runtime-session", payload: { projectId: "project-1", runId: "run-1", afterManualAction: true } }]);
  assert.deepEqual(reply, { ok: true, payload: { runId: "run-1", live: true } });
});

test("Take over and Hand back with no run named are refused before Core is called", async () => {
  // What a panel page could send: the relay must not trust the declared type.
  for (const runId of [undefined, "", "   ", 7] as Array<string | number | undefined>) {
    const c = context(() => ({ ok: true, payload: null }));
    const taken = await takeOverRun({ runId } as Partial<PanelTakeOverRunRequest>, c.value);
    const handed = await handBackRun({ runId } as Partial<PanelHandBackRunRequest>, c.value);
    assert.deepEqual(taken, { ok: false, code: "invalid_request", error: "Take over needs the run it is for." });
    assert.deepEqual(handed, { ok: false, code: "invalid_request", error: "Hand back needs the run it is for." });
    assert.deepEqual(c.calls, []);
  }
});

test("Take over and Hand back with no project known are refused before Core is called", async () => {
  const c = context(() => ({ ok: true, payload: null }), null);
  assert.equal((await takeOverRun({ runId: "run-1" }, c.value)).ok, false);
  assert.deepEqual(await handBackRun({ runId: "run-1" }, c.value), {
    ok: false, code: "no_project", error: "FluxIQ has not said which project this browser belongs to yet. Connect, then try again."
  });
  assert.deepEqual(c.calls, []);
});
