import assert from "node:assert/strict";
import test from "node:test";
import { resetScenarioLab, type LabResetFetch } from "../reset-scenario-lab.js";

const epoch = "12345678-1234-4123-8123-123456789abc";
const provenance = { schemaVersion: "fixture.state.v1", ownerEpoch: epoch, resetGeneration: 2, mutationSequence: 1 };
const packet = { status: "reset", seed: 12, provenance };
const health = { status: "ready", seed: 12, scenarios: ["basic-form"], provenance };
const response = (value: unknown) => new Response(JSON.stringify(value), { status: 200 });

test("helper returns immutable copied producer packet after fresh bounded health", async () => {
  const calls: Array<{ path: string; method: string }> = [];
  const fetchLab: LabResetFetch = async (url, init) => { calls.push({ path: new URL(url).pathname, method: init.method }); return response(init.method === "POST" ? packet : health); };
  const result = await resetScenarioLab("http://127.0.0.1:1", "isolated-token", fetchLab);
  assert.deepEqual(result, packet); assert.equal(Object.isFrozen(result.provenance), true);
  assert.deepEqual(calls, [{ path: "/__control/reset", method: "POST" }, { path: "/__control/health", method: "GET" }]);
});
for (const bad of [{ ...packet, status: "ready" }, { ...packet, extra: true }, { ...packet, provenance: { ...provenance, ownerEpoch: "forged" } },
  { ...packet, provenance: { ...provenance, resetGeneration: 0 } }, { ...packet, provenance: { ...provenance, mutationSequence: Number.MAX_SAFE_INTEGER + 1 } }, { ...packet, seed: null }]) {
  test("helper refuses malformed producer packet " + JSON.stringify(bad), async () => {
    await assert.rejects(resetScenarioLab("http://127.0.0.1:1", "isolated", async () => response(bad)), /could not be confirmed/);
  });
}
for (const changed of [{ ...health, seed: 13 }, { ...health, provenance: { ...provenance, ownerEpoch: "12345678-1234-4123-8123-123456789abd" } },
  { ...health, provenance: { ...provenance, resetGeneration: 3 } }, { ...health, provenance: { ...provenance, mutationSequence: 0 } }, { ...health, extra: true }]) {
  test("helper refuses mismatched fresh health " + JSON.stringify(changed), async () => {
    await assert.rejects(resetScenarioLab("http://127.0.0.1:1", "isolated", async (_, init) => response(init.method === "POST" ? packet : changed)), /could not be confirmed/);
  });
}
test("helper bounds streamed bytes before JSON parsing and cancels oversized body", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(16385)); }, cancel() { cancelled = true; } });
  await assert.rejects(resetScenarioLab("http://127.0.0.1:1", "isolated", async () => ({ ok: true, status: 200, body })), /could not be confirmed/);
  assert.equal(cancelled, true);
});
for (const status of [201, 401, 500]) test(`helper refuses HTTP${status}`, async () => {
  await assert.rejects(resetScenarioLab("http://127.0.0.1:1", "isolated", async () => new Response("{}", { status })), /could not be confirmed/);
});
test("helper refuses lost response and invalid JSON", async () => {
  await assert.rejects(resetScenarioLab("http://127.0.0.1:1", "isolated", async () => { throw new Error("lost response"); }), /could not be confirmed/);
  await assert.rejects(resetScenarioLab("http://127.0.0.1:1", "isolated", async () => new Response("{")), /could not be confirmed/);
});
test("actual authenticated reset helper observes the built fixture owner", async () => {
  const moduleUrl = new URL("apps/scenario-lab/dist/server.js", new URL("../../../../../", import.meta.url));
  const { startScenarioLab } = await import(moduleUrl.href) as { startScenarioLab(options: { runToken: string; seed: number }): Promise<{ origin: string; close(): Promise<void> }> };
  const token = "isolated-reset-token-1234", lab = await startScenarioLab({ runToken: token, seed: 9 });
  try {
    const result = await resetScenarioLab(lab.origin, token);
    assert.equal(result.seed, 9); assert.equal(result.provenance.resetGeneration, 2);
    const read = await fetch(`${lab.origin}/__control/health`, { headers: { authorization: `Bearer ${token}` } });
    const observed = await read.json() as typeof health;
    assert.deepEqual(result.provenance, observed.provenance);
    await assert.rejects(resetScenarioLab(lab.origin, "wrong"), /could not be confirmed/);
  } finally { await lab.close(); }
});
