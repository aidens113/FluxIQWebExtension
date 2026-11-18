// The key's pushed state: a background broadcast becomes a card state at once, an unreadable one says "read
// again", and any other message does nothing. The port hands the card the same subscription.

import assert from "node:assert/strict";
import test from "node:test";
import type { ModelAccessState } from "@fluxiq/ui-components";
import { sendRecorder } from "../../../tests/send-recorder";
import type { RuntimeListen } from "../../activity";
import { modelKeysPort } from "../model-keys-port";
import { MODEL_ACCESS_CHANGED_MESSAGE, subscribeModelAccess } from "../subscribe-model-access";

const access = (status: string, lastCall: unknown = null) => ({ status, message: "Core's sentence.", key: { name: "Work key", provider: "anthropic", model: "claude-haiku-5-5" }, lastCall });

function runtime() {
  let heard: ((message: unknown) => void) | undefined;
  let removed = 0;
  const listen: RuntimeListen = (listener) => {
    heard = listener;
    return () => { removed += 1; };
  };
  return { listen, send: (message: unknown) => heard?.(message), removed: () => removed };
}

test("the broadcast's type is the background's", () => {
  assert.equal(MODEL_ACCESS_CHANGED_MESSAGE, "fluxiq.panel.modelAccessChanged");
});

test("a broadcast gives the card state at once; an unrelated message does nothing", () => {
  const bus = runtime();
  const states: Array<ModelAccessState | null> = [];
  const stop = subscribeModelAccess(bus.listen, (state) => states.push(state));
  bus.send({ type: MODEL_ACCESS_CHANGED_MESSAGE, modelAccess: access("ready"), at: 1 });
  bus.send({ type: "fluxiq.panel.changes", modelAccess: access("no_key") });
  bus.send("not a record");
  bus.send(undefined);
  assert.deepEqual(states, [{ kind: "ready", provider: "Anthropic", keyName: "Work key" }]);
  stop();
  assert.equal(bus.removed(), 1);
});

test("a broadcast whose state cannot be read says the key changed and to read again", () => {
  const bus = runtime();
  const states: Array<ModelAccessState | null> = [];
  subscribeModelAccess(bus.listen, (state) => states.push(state));
  bus.send({ type: MODEL_ACCESS_CHANGED_MESSAGE, modelAccess: { status: "mystery" }, at: 1 });
  bus.send({ type: MODEL_ACCESS_CHANGED_MESSAGE, at: 2 });
  assert.deepEqual(states, [null, null]);
});

test("the port subscribes only when given a subscription, and a push needs no read", () => {
  const recorder = sendRecorder({ ok: true, value: { ok: true, payload: {} } });
  assert.equal(modelKeysPort(recorder.request).subscribe, undefined);
  const bus = runtime();
  const port = modelKeysPort(recorder.request, undefined, (listener) => subscribeModelAccess(bus.listen, listener));
  const states: Array<ModelAccessState | null> = [];
  port.subscribe!((state) => states.push(state));
  bus.send({ type: MODEL_ACCESS_CHANGED_MESSAGE, modelAccess: access("provider_refused", { outcome: "provider_refused", atMs: 1 }), at: 3 });
  assert.equal(states.length, 1);
  assert.equal(states[0]?.kind, "not-accepted");
  assert.deepEqual(recorder.sent, [], "nothing was sent to read the key");
});
