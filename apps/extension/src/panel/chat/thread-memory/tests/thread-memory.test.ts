// This window's remembered thread: kept in session storage under the window's
// own key, read back whole or not at all, and reopened by the thread list's
// first read only while the chat still shows its latest chat and the list holds
// the thread.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { ChatConversationPort, ChatResult, ChatTarget } from "@fluxiq/ui-components";
import { restoringThreadList, sessionThreadMemory, type RememberedThread, type ThreadMemory } from "../index";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function fakeBrowser(t: TestContext, windowId: number | undefined, stored: Record<string, unknown> = {}) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const session = {
    get: async (key: string) => (key in stored ? { [key]: stored[key] } : {}),
    set: async (items: Record<string, unknown>) => { Object.assign(stored, items); }
  };
  const windows = { getCurrent: async () => (windowId === undefined ? {} : { id: windowId }) };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage: { session }, windows } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome"); });
  return stored;
}

test("a kept thread is stored under this window's key and recalled whole", async (t) => {
  const stored = fakeBrowser(t, 7, { "fluxiq.chatThread.8": { conversationId: "other-window", projectId: "p1" } });
  const memory = sessionThreadMemory();
  assert.equal(await memory.recall(), undefined);
  memory.keep({ conversationId: "c1", projectId: "p1" });
  await settle();
  assert.deepEqual(stored["fluxiq.chatThread.7"], { conversationId: "c1", projectId: "p1" });
  assert.deepEqual(await memory.recall(), { conversationId: "c1", projectId: "p1" });
});

test("a stored entry that is not a whole thread is not recalled", async (t) => {
  fakeBrowser(t, 7, { "fluxiq.chatThread.7": { conversationId: "c1" } });
  assert.equal(await sessionThreadMemory().recall(), undefined);
});

test("a window the browser cannot name makes the recall fail, never answer a thread", async (t) => {
  fakeBrowser(t, undefined);
  await assert.rejects(sessionThreadMemory().recall(), /did not say which window/);
});

test("a browser without session storage keeps nothing", async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime: {} } });
  t.after(() => { if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome"); });
  const memory = sessionThreadMemory();
  memory.keep({ conversationId: "c1", projectId: "p1" });
  assert.equal(await memory.recall(), undefined);
});

function harness(remembered: RememberedThread | undefined | Error, listed: unknown[], target: ChatTarget = { kind: "latest", projectId: "p1" }) {
  const opened: ChatTarget[] = [];
  let reads = 0;
  const memory: ThreadMemory = {
    recall: async () => {
      if (remembered instanceof Error) throw remembered;
      return remembered;
    },
    keep: () => undefined
  };
  const port = {
    listAllThreads: async (): Promise<ChatResult<{ conversations?: unknown }>> => {
      reads += 1;
      return { ok: true, value: { conversations: listed } };
    }
  } as unknown as ChatConversationPort;
  const chat = { target: () => target, open: (next: ChatTarget) => { opened.push(next); } };
  return { restoring: restoringThreadList(port, memory, () => chat), opened, reads: () => reads };
}

test("the first list holding the remembered thread opens it while the chat shows its latest chat, and only once", async () => {
  const h = harness({ conversationId: "c2", projectId: "p2" }, [{ conversationId: "c1" }, { conversationId: "c2" }]);
  const result = await h.restoring.listAllThreads!({ limit: 25 });
  await h.restoring.listAllThreads!({ limit: 25 });
  assert.deepEqual(result, { ok: true, value: { conversations: [{ conversationId: "c1" }, { conversationId: "c2" }] } });
  assert.deepEqual(h.opened, [{ kind: "thread", conversationId: "c2", projectId: "p2" }]);
  assert.equal(h.reads(), 2);
});

test("a thread no longer listed, a chat already on another thread, or no memory opens nothing", async () => {
  const gone = harness({ conversationId: "c9", projectId: "p1" }, [{ conversationId: "c1" }]);
  await gone.restoring.listAllThreads!({ limit: 25 });
  assert.deepEqual(gone.opened, []);
  const chosen = harness({ conversationId: "c1", projectId: "p1" }, [{ conversationId: "c1" }], { kind: "thread", conversationId: "c3", projectId: "p1" });
  await chosen.restoring.listAllThreads!({ limit: 25 });
  assert.deepEqual(chosen.opened, []);
  const none = harness(undefined, [{ conversationId: "c1" }]);
  await none.restoring.listAllThreads!({ limit: 25 });
  assert.deepEqual(none.opened, []);
});

test("a memory the browser could not read still lets the list through", async () => {
  const h = harness(new Error("no window"), [{ conversationId: "c1" }]);
  assert.deepEqual(await h.restoring.listAllThreads!({ limit: 25 }), { ok: true, value: { conversations: [{ conversationId: "c1" }] } });
  assert.deepEqual(h.opened, []);
});

test("a port with no thread list is left as it is", () => {
  const port = { listThreads: async () => ({ ok: true, value: {} }) } as unknown as ChatConversationPort;
  assert.equal(restoringThreadList(port, { recall: async () => undefined, keep: () => undefined }, () => undefined), port);
});
