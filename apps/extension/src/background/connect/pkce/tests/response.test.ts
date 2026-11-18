import assert from "node:assert/strict";
import test from "node:test";
import { callback, fixture, tokenResponse } from "./fixture";

for (const [name, patch, failure] of [
  ["expired", { credentialExpiresAt: 999 }, "credential_expired"],
  ["unsafe expiry", { credentialExpiresAt: Number.MAX_SAFE_INTEGER + 1 }, "response_invalid"],
  ["foreign gateway", { gatewayUrl: "wss://other.example.test/client" }, "response_invalid"]
] as const) test(`${name} proof is never adopted and known original proof is journalled`, async () => {
  const t = fixture();
  await t.protocol.start();
  t.state.onToken = async () => Response.json(tokenResponse(patch));
  const result = await t.protocol.observe(callback(t));
  assert.equal(result.failureCode, failure);
  assert.equal(result.adopted, undefined);
  assert.equal(await t.bound.read(), null);
  assert.equal((await t.bound.pendingRevocations()).length, 1);
});

test("malformed success with missing owner summary is uncertain and never accepted", async () => {
  const t = fixture();
  await t.protocol.start();
  t.state.onToken = async () => Response.json({ ...tokenResponse(), user: { userId: "user-one" } });
  const result = await t.protocol.observe(callback(t));
  assert.equal(result.failureCode, "response_invalid");
  assert.equal(result.adopted, undefined);
  assert.equal(await t.bound.read(), null);
});

test("credential commit failure journals delivered proof without exposing memory-only trust", async () => {
  const t = fixture();
  await t.protocol.start();
  t.state.wrapBound = bound => ({ ...bound, commit: async () => { throw new Error("synthetic-private-idb-abort"); } });
  const result = await t.protocol.observe(callback(t));
  assert.equal(result.failureCode, "credential_store_unavailable");
  assert.equal(result.adopted, undefined);
  assert.equal(await t.bound.read(), null);
  assert.equal((await t.bound.pendingRevocations()).length, 1);
});

test("changed credential revision before callback refuses POST", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  await t.bound.commit({ kind: "new-trust", operationId: "synthetic-other-trust", expectedRevision: 0, response: tokenResponse() });
  assert.equal((await t.protocol.observe(input)).failureCode, "credential_conflict");
  assert.equal(t.state.requests.filter(item => item.options.method === "POST").length, 0);
});
