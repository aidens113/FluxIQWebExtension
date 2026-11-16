// The changes port hears only the background's `panelChanges` pushes: once per conversation named, or once with none.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
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
