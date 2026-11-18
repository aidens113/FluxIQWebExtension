import assert from "node:assert/strict";
import test from "node:test";
import { sendHostProofEvent } from "../events.js";

test("an intentional observer disconnect ends proof observations without sending", () => {
  let sent = false;
  sendHostProofEvent({ type: "proof.network", violations: 0 }, { connected: false, send: () => {
    sent = true;
    return true;
  } });
  assert.equal(sent, false);
});

test("a disconnect between the connected check and IPC callback is expected", () => {
  const error = Object.assign(new Error("Channel closed"), { code: "ERR_IPC_CHANNEL_CLOSED" });
  assert.doesNotThrow(() => sendHostProofEvent({ type: "proof.network", violations: 0 }, {
    connected: true,
    send: (_event: unknown, ...args: unknown[]) => {
      const callback = args.find((arg): arg is (error: Error | null) => void => typeof arg === "function");
      assert.ok(callback);
      callback(error);
      return true;
    }
  }));
});

test("unexpected IPC callback failures remain visible", () => {
  const error = Object.assign(new Error("IPC transport failed"), { code: "EIO" });
  assert.throws(() => sendHostProofEvent({ type: "proof.network", violations: 0 }, {
    connected: true,
    send: (_event: unknown, ...args: unknown[]) => {
      const callback = args.find((arg): arg is (error: Error | null) => void => typeof arg === "function");
      assert.ok(callback);
      callback(error);
      return true;
    }
  }), (actual) => actual === error);
});
