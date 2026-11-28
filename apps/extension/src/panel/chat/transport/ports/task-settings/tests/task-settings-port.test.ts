// The chat's task settings port: a task's humanness is read from its
// `list-project-tasks` row with the starting value from the status of the
// moment, a set or clear is one background message with its fields written by
// name, and Core's refusal reaches the card in Core's own words through the
// panel's real request path.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { RUNTIME_MESSAGES } from "../../../../../../shared/constants";
import { panelRequest, type PanelMessage, type PanelResult, type PanelStore } from "../../../../../state";
import { createExtensionChatTransport } from "../../../create-extension-chat-transport";
import { startingHumanness } from "../starting-humanness";
import { taskSettingsPort } from "../task-settings-port";

const NO_PUSHES = () => () => undefined;
const TASK = { projectId: "p1", taskId: "t2" };
const OUT_OF_RANGE = "A task's humanness is a whole number from 0 to 100, or null to remove it.";

/** Answers each message with the next reply in `replies`, keeping the messages. */
function scripted(replies: Array<PanelResult<unknown>>) {
  const sent: PanelMessage[] = [];
  const request = (async (message: PanelMessage) => {
    sent.push(message);
    return replies.shift() ?? { ok: false, sentence: "No reply scripted." };
  }) as PanelStore["request"];
  return { sent, request };
}

const page = (tasks: unknown[], nextCursor: string | null = null): PanelResult<unknown> => ({ ok: true, value: { ok: true, payload: { tasks, nextCursor } } });

const starting = (value: unknown): PanelResult<unknown> => ({ ok: true, value: { ok: true, payload: { startingHumanness: value } } });

test("the starting value is Core's whole number from 0 to 100, and 0 when it says none or the read fails", async () => {
  const read = async (reply: PanelResult<unknown>) => startingHumanness(scripted([reply]).request);
  assert.equal(await read(starting(null)), 0);
  assert.equal(await read(starting("40")), 0);
  assert.equal(await read(starting(42.6)), 43);
  assert.equal(await read(starting(140)), 100);
  assert.equal(await read(starting(-5)), 0);
  assert.equal(await read(starting(35)), 35);
  assert.equal(await read({ ok: false, sentence: "FluxIQ could not be reached." }), 0);
  assert.equal(await read({ ok: true, value: { ok: true, payload: {} } }), 0);
  assert.equal(await startingHumanness((async () => { throw new Error("gone"); }) as PanelStore["request"]), 0, "a read that throws is still 0");
});

test("a read finds the task's row through listTasks and pairs its level with the starting value read again each time", async () => {
  const s = scripted([page([{ taskId: "t1", humanness: 90 }, { taskId: "t2", humanness: 60 }]), starting(25), page([{ taskId: "t2" }]), starting(70)]);
  const port = taskSettingsPort(s.request);
  assert.deepEqual(await port.read(TASK), { ok: true, value: { humanness: 60, starting: 25 } });
  assert.deepEqual(await port.read(TASK), { ok: true, value: { starting: 70 } }, "a row with no level inherits, and the starting value is read again");
  assert.deepEqual(s.sent, [
    { type: RUNTIME_MESSAGES.panelListTasks, projectId: "p1", limit: 100, cursor: undefined },
    { type: RUNTIME_MESSAGES.panelStartingHumanness },
    { type: RUNTIME_MESSAGES.panelListTasks, projectId: "p1", limit: 100, cursor: undefined },
    { type: RUNTIME_MESSAGES.panelStartingHumanness }
  ]);
});

test("a task further down is found by following the list's cursor, and a task not listed is a failed read", async () => {
  const s = scripted([page([{ taskId: "t9" }], "c1"), page([{ taskId: "t2", humanness: 15 }]), starting(null)]);
  assert.deepEqual(await taskSettingsPort(s.request).read(TASK), { ok: true, value: { humanness: 15, starting: 0 } });
  assert.deepEqual(s.sent.map((message) => message.cursor), [undefined, "c1", undefined]);
  const gone = scripted([page([{ taskId: "t9" }], "c1"), page([{ taskId: "t8" }])]);
  assert.deepEqual(await taskSettingsPort(gone.request).read(TASK), { ok: false, sentence: "That task is no longer here." });
  const looping = scripted([page([], "c1"), page([], "c1")]);
  assert.deepEqual(await taskSettingsPort(looping.request).read(TASK), { ok: false, sentence: "That task is no longer here." });
  assert.equal(looping.sent.length, 2, "a cursor already followed is not followed again");
});

test("a read the background cannot carry says unsupported, and other failures keep their sentence", async () => {
  const old = scripted([{ ok: false, sentence: "This extension doesn't support that yet.", detail: "Unknown FluxIQ extension message.", unsupported: true }]);
  assert.deepEqual(await taskSettingsPort(old.request).read(TASK), { ok: false, sentence: "This extension doesn't support that yet.", detail: "Unknown FluxIQ extension message.", unsupported: true });
  const odd = scripted([{ ok: true, value: { ok: true, payload: { tasks: "nope" } } }]);
  assert.deepEqual(await taskSettingsPort(odd.request).read(TASK), { ok: false, sentence: "FluxIQ's list of your tasks could not be read." });
});

test("a set and a clear are each one taskHumannessSet with the project, the task and the level, answering the level Core holds", async () => {
  const s = scripted([{ ok: true, value: { ok: true, payload: { humanness: 55 } } }, { ok: true, value: { ok: true, payload: {} } }]);
  const port = taskSettingsPort(s.request);
  assert.deepEqual(await port.setHumanness({ projectId: "p1", taskId: "t2", humanness: 55 }), { ok: true, value: { humanness: 55 } });
  assert.deepEqual(await port.setHumanness({ projectId: "p1", taskId: "t2", humanness: null }), { ok: true, value: {} });
  assert.deepEqual(s.sent, [
    { type: RUNTIME_MESSAGES.panelTaskHumannessSet, projectId: "p1", taskId: "t2", humanness: 55 },
    { type: RUNTIME_MESSAGES.panelTaskHumannessSet, projectId: "p1", taskId: "t2", humanness: null }
  ]);
});

function replyWith(t: TestContext, reply: unknown): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const runtime = { lastError: undefined, sendMessage: (_message: unknown, respond: (answer: unknown) => void) => respond(reply) };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome"); });
}

test("Core's refusal of a level out of range reaches the card in Core's own sentence, with its code", async (t) => {
  replyWith(t, { ok: false, code: "failed", httpStatus: 400, coreCode: "task.humanness_invalid", error: OUT_OF_RANGE });
  const port = createExtensionChatTransport(panelRequest, NO_PUSHES, undefined, () => undefined).taskSettings!;
  assert.deepEqual(await port.setHumanness({ projectId: "p1", taskId: "t2", humanness: 101 }), { ok: false, sentence: OUT_OF_RANGE, detail: OUT_OF_RANGE, code: "failed", coreCode: "task.humanness_invalid" });
});

test("the transport offers task settings only when it is given the status to read the starting value from", () => {
  const request = scripted([]).request;
  assert.equal(createExtensionChatTransport(request, NO_PUSHES).taskSettings, undefined);
  assert.notEqual(createExtensionChatTransport(request, NO_PUSHES, undefined, () => undefined).taskSettings, undefined);
});
