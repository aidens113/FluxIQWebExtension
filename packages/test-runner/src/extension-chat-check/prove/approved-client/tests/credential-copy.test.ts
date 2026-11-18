import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { connectWithCredentialCopy } from "../credential-copy.js";

function fixture(t: test.TestContext, response: string) {
  const previousChrome = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  const previousSocket = globalThis.WebSocket;
  const sent: Array<{ type: string; payload: Record<string, unknown> }> = [];
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { storage: { local: { get: async () => ({ state: { clientId: "fixture-client", token: "fixture-private-credential", recordedPage: "must-stay-in-the-browser" } }) } } } });
  class Socket {
    listeners = new Map<string, (event: { data: string }) => void>();
    constructor() { queueMicrotask(() => this.listeners.get("open")?.({ data: "" })); }
    addEventListener(name: string, listener: (event: { data: string }) => void) { this.listeners.set(name, listener); }
    send(value: string) {
      const message = JSON.parse(value) as { type: string; payload: Record<string, unknown> };
      sent.push(message);
      if (message.type === "client.hello") queueMicrotask(() => this.listeners.get("message")?.({ data: response }));
    }
    close() {}
  }
  globalThis.WebSocket = Socket as unknown as typeof WebSocket;
  t.after(() => {
    globalThis.WebSocket = previousSocket;
    if (previousChrome) Object.defineProperty(globalThis, "chrome", previousChrome);
    else Reflect.deleteProperty(globalThis, "chrome");
  });
  const control = { evaluate: async (fn: () => Promise<unknown>) => {
    const selected = await fn();
    assert.deepEqual(selected, { clientId: "fixture-client", token: "fixture-private-credential" });
    return selected;
  } } as unknown as Page;
  return { control, sent };
}

test("the copy proof extracts only its credential binding and acknowledges rotation", async (t) => {
  const h = fixture(t, JSON.stringify({ type: "server.session_ready" }));
  const copy = await connectWithCredentialCopy(h.control, "ws://127.0.0.1:9998");
  assert.deepEqual(h.sent.map((message) => message.type), ["client.hello", "client.credential_received"]);
  assert.equal(h.sent[0]!.payload.clientType, "extension");
  assert.doesNotMatch(JSON.stringify(h.sent), /recordedPage|must-stay-in-the-browser/u);
  copy.close();
});

test("malformed gateway data fails with sanitized feedback", async (t) => {
  const h = fixture(t, "null");
  await assert.rejects(() => connectWithCredentialCopy(h.control, "ws://127.0.0.1:9998"), (error) => {
    assert.doesNotMatch(String(error), /fixture-private|must-stay/u);
    return /could not connect/u.test(String(error));
  });
});
