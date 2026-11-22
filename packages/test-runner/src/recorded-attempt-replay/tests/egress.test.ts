import assert from "node:assert/strict";
import test from "node:test";
import { routedFetch } from "../../attempt-lane/scripted-model/index.js";

test("missing/broken recorded server never falls back to the original provider endpoint", async () => {
  const seen: string[] = [];
  const real = (async (input: RequestInfo | URL, init?: RequestInit) => {
    seen.push(String(input));
    assert.equal(init?.redirect, "error");
    assert.equal(init?.method, "POST");
    assert.equal(Buffer.from(init?.body as ArrayBuffer).toString(), '{"model":"fixture"}');
    throw new TypeError("synthetic_local_server_failure");
  }) as typeof fetch;
  const request = new Request("https://model-fixture.example.test/v1/messages", { method: "POST", headers: { "anthropic-version": "fixture" }, body: '{"model":"fixture"}' });
  await assert.rejects(() => routedFetch(real, "http://127.0.0.1:9")(request, { signal: new AbortController().signal }), /synthetic_local_server_failure/u);
  assert.deepEqual(seen, ["http://127.0.0.1:9/v1/messages"]);
  assert.throws(() => routedFetch(real, "https://model-fixture.example.test"), /loopback/u);
  await assert.rejects(() => routedFetch(real, "http://127.0.0.1:9")("https://model-fixture.example.test/other", { method: "POST" }), /refuses/u);
  assert.equal(seen.length, 1);
});
