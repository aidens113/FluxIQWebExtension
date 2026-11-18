import assert from "node:assert/strict";
import test from "node:test";
import { callback, deferred, envelope, fixture, tokenResponse, waiting } from "./fixture";

test("same-session waiting restore refreshes discovery and requires committed ownership", async () => {
  const t = fixture();
  await t.protocol.start();
  const record = waiting(t);
  assert.equal((await t.restart().restore()).phase, "waiting");
  assert.equal(t.state.requests.length, 2);
  assert.equal(t.state.navigations.length, 1);
  await t.authenticationTabs.release(12, record.attemptId);
  assert.equal((await t.restart().restore()).failureCode, "ownership_lost");
  assert.equal(t.authenticationTabs.owns(12, record.attemptId), false);
});

test("preparing restore never claims or navigates a guessed tab", async () => {
  const t = fixture();
  await t.protocol.start();
  const record = waiting(t);
  t.state.attempt = { ...record, phase: "preparing", tabId: null };
  assert.equal((await t.restart().restore()).failureCode, "interrupted");
  assert.equal(t.state.navigations.length, 1);
  assert.equal(t.state.requests.filter(item => item.options.method === "POST").length, 0);
});

for (const status of ["network", "invalid-json", "503"] as const) test(`ambiguous ${status} exchange is never repeated after restart`, async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  t.state.onToken = async () => {
    if (status === "network") throw new Error("synthetic-private-network");
    return status === "503" ? Response.json({ error: "temporarily_unavailable" }, { status: 503 }) : new Response("synthetic-private-malformed", { status: 200 });
  };
  assert.equal((await t.protocol.observe(input)).phase, "uncertain");
  await t.restart().restore();
  await t.restart().observe(input);
  assert.equal(t.state.requests.filter(item => item.options.method === "POST").length, 1);
});

test("worker interruption after exchange marker preserves no verifier and never reposts", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  const gate = deferred<Response>();
  const entered = deferred();
  t.state.onToken = async () => {
    entered.resolve();
    return await gate.promise;
  };
  const oldWorker = t.protocol.observe(input);
  await entered.promise;
  assert.equal((await t.restart().restore()).phase, "uncertain");
  assert.equal(JSON.stringify(envelope(t)).includes('"verifier"'), false);
  gate.resolve(Response.json(tokenResponse()));
  assert.equal((await oldWorker).adopted, undefined);
  assert.equal(await t.bound.read(), null);
  assert.equal((await t.bound.pendingRevocations()).length, 1);
  assert.equal(t.state.requests.filter(item => item.options.method === "POST").length, 1);
});

test("new session, corrupt session union and unavailable storage fail closed", async () => {
  const t = fixture();
  await t.protocol.start();
  const stored = envelope(t);
  t.state.browserSessionId = "browser-session.2";
  assert.equal((await t.restart().restore()).failureCode, "session_changed");
  t.state.browserSessionId = "browser-session.1";
  t.state.attempt = { ...stored.attempt!, code: "synthetic-private-code" } as unknown as typeof t.state.attempt;
  assert.equal((await t.restart().restore()).failureCode, "attempt_invalid");
  t.state.loadsFail = true;
  assert.equal((await t.restart().restore()).failureCode, "attempt_store_unavailable");
  assert.equal(t.state.requests.filter(item => item.options.method === "POST").length, 0);
});

test("CAS failure cannot navigate or submit, and known error descriptions never escape", async () => {
  const t = fixture();
  t.state.savesFail = true;
  assert.equal((await t.protocol.start()).failureCode, "attempt_store_unavailable");
  assert.equal(t.state.navigations.length, 0);
  t.state.savesFail = false;
  await t.restart().start();
  const input = callback(t);
  t.state.onToken = async () => Response.json({ error: "invalid_grant", error_description: "synthetic-private-server-detail" }, { status: 400 });
  const outcome = await t.restart().observe(input);
  assert.equal(outcome.failureCode, "invalid_grant");
  assert.equal(JSON.stringify(outcome).includes("synthetic-private"), false);
});
