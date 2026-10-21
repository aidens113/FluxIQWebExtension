import assert from "node:assert/strict";
import test from "node:test";
import { installSandboxRuntimeStub, type SandboxDelivery } from "../sandbox-runtime-stub.js";

type Stubbed = { chrome?: { runtime?: { sendMessage(message: unknown): Promise<unknown>; onMessage: { addListener(listener: unknown): void } } } } & Record<string, unknown>;
const harness = (scope: Stubbed) => scope["__sandbox"] as { sent: unknown[]; deliver(message: unknown): Promise<SandboxDelivery> };

test("what the content code sends is kept as a copy taken when it was sent", async () => {
  const scope: Stubbed = {};
  installSandboxRuntimeStub("__sandbox", scope);
  const message = { type: "fluxiq.contentReady", nested: { n: 1 } };
  await scope.chrome?.runtime?.sendMessage(message);
  message.nested.n = 2;
  assert.deepEqual(harness(scope).sent, [{ type: "fluxiq.contentReady", nested: { n: 1 } }]);
});

test("a delivery is answered by the first sendResponse, synchronously or after a listener keeps the channel open", async () => {
  const scope: Stubbed = {};
  installSandboxRuntimeStub("__sandbox", scope);
  scope.chrome?.runtime?.onMessage.addListener((message: { type: string }, _sender: unknown, sendResponse: (response: unknown) => void) => {
    if (message.type !== "executeAction") return false;
    setTimeout(() => sendResponse({ status: "succeeded" }), 1);
    return true;
  });
  scope.chrome?.runtime?.onMessage.addListener((message: { type: string }, _sender: unknown, sendResponse: (response: unknown) => void) => {
    if (message.type === "ping") sendResponse("pong");
    return false;
  });
  assert.deepEqual(await harness(scope).deliver({ type: "executeAction" }), { responded: true, response: { status: "succeeded" } });
  assert.deepEqual(await harness(scope).deliver({ type: "ping" }), { responded: true, response: "pong" });
  assert.deepEqual(await harness(scope).deliver({ type: "nobody" }), { responded: false });
});

test("an existing chrome object keeps its other members", () => {
  const scope: Stubbed & { chrome: Record<string, unknown> } = { chrome: { other: 1 } };
  installSandboxRuntimeStub("__sandbox", scope);
  assert.equal(scope.chrome["other"], 1);
  assert.equal(typeof (scope.chrome["runtime"] as { sendMessage: unknown }).sendMessage, "function");
});
