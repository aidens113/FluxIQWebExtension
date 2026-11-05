import assert from "node:assert/strict";
import test from "node:test";

import { FluxIQConnection } from "../connection";

// Forget tells Core over a live socket, so this browser's trust ends there and
// then. Offline it sends nothing: `send` would queue it for a later connection,
// whose credential is about to be gone.
function connectionIn(state: string, sent: string[], send: (type: string) => Promise<void> = async (type) => { sent.push(type); }): FluxIQConnection {
  const connection = Object.create(FluxIQConnection.prototype) as FluxIQConnection;
  Object.assign(connection as unknown as Record<string, unknown>, { gateway: { state: () => state, send } });
  return connection;
}

test("forgetting over a live socket tells Core", async () => {
  const sent: string[] = [];
  await connectionIn("connected", sent).forgetPairing();
  assert.deepEqual(sent, ["client.forget_pairing"]);
});

test("forgetting while not connected queues nothing", async () => {
  for (const state of ["disconnected", "connecting", "pairing", "reconnecting", "error"]) {
    const sent: string[] = [];
    await connectionIn(state, sent).forgetPairing();
    assert.deepEqual(sent, []);
  }
});

test("a send that fails does not stop the person forgetting", async () => {
  await connectionIn("connected", [], async () => {
    throw new Error("socket closed");
  }).forgetPairing();
});
