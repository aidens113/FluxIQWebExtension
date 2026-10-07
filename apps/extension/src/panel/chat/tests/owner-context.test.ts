import assert from "node:assert/strict";
import test from "node:test";
import { createChatOwnerContext } from "../owner-context";
import { statusWith } from "../../tests/status-fixture";
import type { ExtensionStatus } from "../../../shared/protocol";
const status = () => statusWith({ paired: true, projectId: "project-a", settings: { coreApiUrl: "http://core.invalid", gatewayUrl: "ws://gateway.invalid", autoReconnect: true, captureMutations: false, captureInputValues: false, captureSnapshots: false, requestsEnabled: false } });
for (const field of ["gateway", "core", "client", "project", "paired"] as const) test(`owner lease changes for confirmed ${field}`, () => {
  const context = createChatOwnerContext(async <T>() => ({ ok: true, value: {} as T })); const original = status(); context.observe(original); const lease = context.capture();
  const next: ExtensionStatus = { ...original, ...(field === "gateway" ? { gatewayUrl: "ws://different.invalid" } : field === "core" ? { settings: { ...original.settings!, coreApiUrl: "http://different.invalid" } } : field === "client" ? { clientId: "different" } : field === "project" ? { projectId: "different" } : { paired: false }) };
  assert.equal(context.observe(next).changed, true); assert.equal(lease.current(), false);
});
test("missing settings and volatile reconnect/session/tab values retain current owner", () => {
  const context = createChatOwnerContext(async <T>() => ({ ok: true, value: {} as T })); const original = status(); context.observe(original); const lease = context.capture();
  assert.equal(context.observe({ ...original, settings: undefined, connectionState: "connected", sessionId: "reconnected", activeTabId: 9, queueSize: 4, recordingState: "paused" }).changed, false); assert.equal(lease.current(), true);
});
test("A/B/A never revives a retained request lease and does not cancel dispatched acknowledgement", async () => {
  let calls = 0; let finish!: (value: any) => void; const context = createChatOwnerContext(<T>() => { calls++; return new Promise((resolve) => { finish = resolve; }) as Promise<any>; });
  const original = status(); context.observe(original); const lease = context.capture(); const dispatched = lease.request({ type: "synthetic" } as any);
  context.observe({ ...original, projectId: "other" }); context.observe(original);
  assert.equal(lease.current(), false); assert.equal(context.capture().identity, lease.identity); assert.equal((await lease.request({ type: "synthetic" } as any)).ok, false); assert.equal(calls, 1);
  finish({ ok: true, value: "accepted" }); assert.equal((await dispatched).ok, true);
});
test("first richer identity retires unknown context while absent fields retain confirmed identity", () => {
  const context = createChatOwnerContext(async <T>() => ({ ok: true, value: {} as T })); context.observe({ connectionState: "connected" } as ExtensionStatus); const unknown = context.capture();
  assert.equal(context.observe(status()).changed, true); assert.equal(unknown.current(), false);
  const bound = context.capture(); context.observe({ connectionState: "disconnected", projectId: "project-a" } as ExtensionStatus); assert.equal(bound.current(), true);
});
