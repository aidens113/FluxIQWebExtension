// The activity port hears only the background's `changed` broadcasts, and gives
// the listener the state they carry; every other runtime message is ignored.

import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_MESSAGES } from "../../../../shared/activity/index";
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
    broadcast: (message: unknown) => {
      for (const listener of [...listeners]) {
        listener(message);
      }
    }
  };
}

test("subscribe passes the state of each changed push and ignores other messages", () => {
  const bus = runtime();
  const transport = createExtensionChatTransport(sendRecorder({ ok: true, value: {} }).request, bus.listen);
  const heard: unknown[] = [];
  const unsubscribe = transport.activity.subscribe((state) => heard.push(state));
  const state = { overlay: "expanded", live: true };
  bus.broadcast({ type: "fluxiq.statusChanged", state: { ignored: true } });
  bus.broadcast("not an object");
  bus.broadcast(null);
  bus.broadcast({ type: ACTIVITY_MESSAGES.changed, state });
  assert.deepEqual(heard, [state]);
  unsubscribe();
  assert.equal(bus.listeners.size, 0);
  bus.broadcast({ type: ACTIVITY_MESSAGES.changed, state });
  assert.equal(heard.length, 1);
});
