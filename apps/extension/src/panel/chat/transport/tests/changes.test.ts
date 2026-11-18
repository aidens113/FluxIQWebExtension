// The changes port hears only the background's `panelChanges` pushes: once per conversation named, or once with none.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import { conversationChangedFor, resyncChange } from "../../../../background/projects/index";
import { createExtensionChatTransport } from "../create-extension-chat-transport";
import { sendRecorder } from "./send-recorder";

function runtime() {
  const listeners = new Set<(message: unknown) => void>();
  return {
    listeners,
    listen: (listener: (message: unknown) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    broadcast: (message: unknown) => { for (const listener of [...listeners]) listener(message); }
  };
}

test("each named conversation is a change; a push naming none is one change with no conversation", () => {
  const bus = runtime();
  const transport = createExtensionChatTransport(sendRecorder({ ok: true, value: {} }).request, bus.listen);
  const kept = bus.listeners.size;
  const heard: Array<{ conversationId?: string }> = [];
  const unsubscribe = transport.changes!.subscribe((change) => heard.push(change));
  bus.broadcast({ type: RUNTIME_MESSAGES.panelChanges, projectId: "p", conversationIds: ["c1", "c2", 3, ""], at: 1 });
  bus.broadcast({ type: RUNTIME_MESSAGES.panelChanges, projectId: null, at: 2 });
  bus.broadcast({ type: "fluxiq.statusChanged" });
  bus.broadcast(null);
  assert.deepEqual(heard, [{ conversationId: "c1" }, { conversationId: "c2" }, {}]);
  unsubscribe();
  assert.equal(bus.listeners.size, kept);
  bus.broadcast({ type: RUNTIME_MESSAGES.panelChanges, at: 3 });
  assert.equal(heard.length, 3);
});

test("the port is complete, and subscribing and hearing pushes starts no interval", () => {
  const bus = runtime();
  const transport = createExtensionChatTransport(sendRecorder({ ok: true, value: {} }).request, bus.listen);
  assert.equal(transport.changes!.complete, true);
  const original = globalThis.setInterval;
  let started = 0;
  globalThis.setInterval = ((...args: Parameters<typeof setInterval>) => {
    started += 1;
    return original(...args);
  }) as typeof setInterval;
  try {
    const unsubscribe = transport.changes!.subscribe(() => undefined);
    bus.broadcast(conversationChangedFor({ conversationId: "c1", projectId: null }, 1));
    unsubscribe();
  } finally {
    globalThis.setInterval = original;
  }
  assert.equal(started, 0);
});

test("a conversation_changed push names its thread; a ready session is one full re-read", () => {
  const bus = runtime();
  const transport = createExtensionChatTransport(sendRecorder({ ok: true, value: {} }).request, bus.listen);
  const heard: Array<{ conversationId?: string }> = [];
  transport.changes!.subscribe((change) => heard.push(change));
  bus.broadcast(conversationChangedFor({ conversationId: "c9", projectId: "p1" }, 1));
  bus.broadcast(conversationChangedFor({ conversationId: "panel-thread", projectId: null }, 2));
  assert.deepEqual(heard, [{ conversationId: "c9" }, { conversationId: "panel-thread" }]);
  bus.broadcast(resyncChange(3));
  assert.deepEqual(heard.slice(2), [{}]);
});
