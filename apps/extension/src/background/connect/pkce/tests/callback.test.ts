import assert from "node:assert/strict";
import test from "node:test";
import { callback, deferred, fixture, tokenResponse, waiting } from "./fixture";

test("exchange removes verifier/state before one POST, then commits private trust before safe outcome", async () => {
  const t = fixture();
  await t.protocol.start();
  const navigation = callback(t);
  const record = waiting(t);
  t.state.onToken = async () => {
    assert.equal(t.state.attempt?.phase, "exchanging");
    const persisted = JSON.stringify(t.state.attempt);
    assert.equal(persisted.includes(record.state), false);
    assert.equal(persisted.includes(record.verifier), false);
    assert.equal(persisted.includes("c".repeat(43)), false);
    return Response.json(tokenResponse());
  };
  const outcome = await t.protocol.observe(navigation);
  assert.equal(outcome.phase, "adopted");
  const saved = await t.bound.read();
  assert.equal(saved?.revision, outcome.adopted?.revision);
  assert.equal(saved?.credential, tokenResponse().credential);
  const post = t.state.requests.find(item => item.options.method === "POST")!;
  assert.equal(post.url, t.binding.tokenUrl);
  assert.deepEqual(post.options.headers, { "Content-Type": "application/json", "fluxiq-client": "browser-extension" });
  assert.equal(post.options.credentials, "omit");
  assert.equal(post.options.redirect, "error");
  assert.equal(post.options.cache, "no-store");
  assert.equal(post.options.referrerPolicy, "no-referrer");
  assert.equal(JSON.parse(String(post.options.body)).code_verifier, record.verifier);
  for (const secret of [record.verifier, record.state, tokenResponse().credential, "c".repeat(43), "person@example.test"]) assert.equal(JSON.stringify(outcome).includes(secret), false);
  assert.equal(t.authenticationTabs.owns(12, record.attemptId), true);
});

const badReturns: { name: string; url: (state: string) => string; tabId?: number }[] = [
  { name: "other tab", url: state => `https://core.example.test/connect/done#code=${"c".repeat(43)}&state=${state}`, tabId: 13 },
  { name: "other origin", url: state => `https://other.example.test/connect/done#code=${"c".repeat(43)}&state=${state}` },
  { name: "other path", url: state => `https://core.example.test/connect/done/extra#code=${"c".repeat(43)}&state=${state}` },
  { name: "query", url: state => `https://core.example.test/connect/done?x=1#code=${"c".repeat(43)}&state=${state}` },
  { name: "URL credentials", url: state => `https://user:pass@core.example.test/connect/done#code=${"c".repeat(43)}&state=${state}` },
  { name: "wrong state", url: () => `https://core.example.test/connect/done#code=${"c".repeat(43)}&state=${"z".repeat(43)}` },
  { name: "duplicate code", url: state => `https://core.example.test/connect/done#code=${"c".repeat(43)}&code=${"c".repeat(43)}&state=${state}` },
  { name: "mixed code and error", url: state => `https://core.example.test/connect/done#code=${"c".repeat(43)}&error=access_denied&state=${state}` },
  { name: "unknown field", url: state => `https://core.example.test/connect/done#code=${"c".repeat(43)}&state=${state}&extra=1` },
  { name: "malformed code", url: state => `https://core.example.test/connect/done#code=bad&state=${state}` }
];
for (const item of badReturns) test(`callback ignores ${item.name} without exchange or discovery`, async () => {
  const t = fixture();
  await t.protocol.start();
  const result = await t.protocol.observe({ tabId: item.tabId ?? 12, url: item.url(waiting(t).state) });
  assert.equal(result.phase, "waiting");
  assert.equal(t.state.requests.length, 1);
  assert.equal(await t.bound.read(), null);
});

test("valid denial terminates without exchange and retains ownership", async () => {
  const t = fixture();
  await t.protocol.start();
  const record = waiting(t);
  const result = await t.protocol.observe({ tabId: 12, url: `https://core.example.test/connect/done#error=access_denied&state=${record.state}` });
  assert.equal(result.phase, "denied");
  assert.equal(t.state.requests.length, 1);
  assert.equal(t.authenticationTabs.owns(12, record.attemptId), true);
  assert.equal(JSON.stringify(t.state.attempt).includes(record.verifier), false);
});

test("duplicate concurrent callbacks across controllers have exactly one exchange winner", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  const gate = deferred<Response>();
  const entered = deferred();
  t.state.onToken = async () => {
    entered.resolve();
    return await gate.promise;
  };
  const first = t.protocol.observe(input);
  await entered.promise;
  assert.equal((await t.restart().observe(input)).phase, "exchanging");
  gate.resolve(Response.json(tokenResponse()));
  assert.equal((await first).phase, "adopted");
  assert.equal(t.state.requests.filter(item => item.options.method === "POST").length, 1);
});

test("fresh callback discovery cannot change the pinned audience", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  t.state.document = { ...(t.state.document as object), gatewayUrl: "wss://core.example.test/other" };
  assert.equal((await t.protocol.observe(input)).failureCode, "binding_changed");
  assert.equal(t.state.requests.filter(item => item.options.method === "POST").length, 0);
});
