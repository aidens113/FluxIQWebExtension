// Coverage of auto-connect.ts and session-disconnect-memory.ts: a paired
// browser reconnects by itself on browser start and panel open, and never after
// the person chose Disconnect -- not even once the worker has been stopped and
// started again, which a Manifest V3 worker is after half a minute idle.

import assert from "node:assert/strict";
import test from "node:test";

import type { ConnectionState } from "../../../shared/protocol";
import { AutoConnect, shouldAutoConnect, workerDisconnectMemory } from "../auto-connect";
import { sessionDisconnectMemory } from "../session-disconnect-memory";

const down = { paired: true, autoReconnect: true, connectionState: "disconnected" as ConnectionState };

test("connects only when paired, reconnection is on, and the connection is down", () => {
  assert.equal(shouldAutoConnect(down, false), true);
  assert.equal(shouldAutoConnect({ ...down, connectionState: "error" }, false), true);
  assert.equal(shouldAutoConnect({ ...down, paired: false }, false), false);
  assert.equal(shouldAutoConnect({ ...down, autoReconnect: false }, false), false);
  assert.equal(shouldAutoConnect(down, true), false);
  for (const connectionState of ["connecting", "pairing", "connected", "reconnecting"] as ConnectionState[]) {
    assert.equal(shouldAutoConnect({ ...down, connectionState }, false), false, connectionState);
  }
});

test("Disconnect holds it off until the person presses Connect again", async () => {
  let connects = 0;
  const auto = new AutoConnect(async () => { connects += 1; });

  assert.equal(await auto.maybeConnect(down), true);
  await auto.noteDisconnectedByPerson();
  assert.equal(await auto.maybeConnect(down), false);
  await auto.noteConnectedByPerson();
  assert.equal(await auto.maybeConnect(down), true);
  assert.equal(connects, 2);
});

test("the Disconnect survives the worker being stopped and started again", async () => {
  installSessionStorage();
  let connects = 0;
  await new AutoConnect(async () => { connects += 1; }, sessionDisconnectMemory()).noteDisconnectedByPerson();

  const restarted = new AutoConnect(async () => { connects += 1; }, sessionDisconnectMemory());
  assert.equal(await restarted.maybeConnect(down), false);
  await restarted.noteConnectedByPerson();
  assert.equal(await new AutoConnect(async () => { connects += 1; }, sessionDisconnectMemory()).maybeConnect(down), true);
  assert.equal(connects, 1);
});

test("without session storage the memory lasts as long as the worker", async () => {
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage: {} } });
  const memory = sessionDisconnectMemory();
  assert.equal(await memory.read(), false);
  await memory.write(true);
  assert.equal(await memory.read(), true);
  assert.equal(await workerDisconnectMemory().read(), false);
});

test("a failed connection attempt is not rethrown: the connection reports its own failure", async () => {
  const auto = new AutoConnect(async () => { throw new Error("WebSocket connection failed."); });
  assert.equal(await auto.maybeConnect(down), true);
});

function installSessionStorage(): void {
  const stored: Record<string, unknown> = {};
  const session = {
    get: async (key: string) => (key in stored ? { [key]: stored[key] } : {}),
    set: async (items: Record<string, unknown>) => { Object.assign(stored, items); }
  };
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage: { session } } });
}
