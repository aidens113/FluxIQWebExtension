// Coverage of core-recording-proxy.ts: the extension's program calls are
// forwarded unchanged and recorded without their credential.

import assert from "node:assert/strict";
import { createServer, type IncomingHttpHeaders } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { startCoreRecordingProxy } from "../core-recording-proxy.js";

async function upstream(): Promise<{ origin: string; seen: Array<{ url: string; headers: IncomingHttpHeaders; body: string }>; close: () => Promise<void> }> {
  const seen: Array<{ url: string; headers: IncomingHttpHeaders; body: string }> = [];
  const server = createServer((request, response) => {
    let body = "";
    request.on("data", chunk => { body += chunk; });
    request.on("end", () => {
      seen.push({ url: request.url ?? "", headers: request.headers, body });
      response.writeHead(200, { "content-type": "application/json", "x-core": "yes" });
      response.end(JSON.stringify({ ok: true, payload: { echoed: body.length } }));
    });
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", () => resolve()));
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen, close: () => new Promise(resolve => server.close(() => resolve())) };
}

test("a program call is forwarded unchanged, answered as Core answered, and recorded without its credential", async () => {
  const core = await upstream();
  const proxy = await startCoreRecordingProxy(core.origin);
  try {
    const body = JSON.stringify({ projectId: "p", conversationId: "c", text: "What can you do?", capabilities: [{ id: "flow.describe" }] });
    const response = await fetch(`${proxy.origin}/api/programs/automation-studio/append-turn?x=1`, { method: "POST", headers: { authorization: "Bearer secret-token-value", "content-type": "application/json" }, body });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("x-core"), "yes");
    assert.deepEqual(await response.json(), { ok: true, payload: { echoed: body.length } });
    assert.equal(core.seen.length, 1);
    assert.equal(core.seen[0]!.url, "/api/programs/automation-studio/append-turn?x=1");
    assert.equal(core.seen[0]!.headers.authorization, "Bearer secret-token-value");
    assert.equal(core.seen[0]!.headers.host, new URL(core.origin).host);
    assert.equal(core.seen[0]!.body, body);
    const [call] = proxy.calls();
    assert.equal(call!.endpoint, "append-turn");
    assert.equal(call!.path, "/api/programs/automation-studio/append-turn");
    assert.equal(call!.bearer, true);
    assert.deepEqual(call!.request, JSON.parse(body));
    assert.equal(call!.status, 200);
    assert.doesNotMatch(JSON.stringify(proxy.calls()), /secret-token-value/u);
  } finally {
    await proxy.close();
    await core.close();
  }
});

test("any other route is forwarded but not recorded, and a call without a credential says so", async () => {
  const core = await upstream();
  const proxy = await startCoreRecordingProxy(core.origin);
  try {
    await fetch(`${proxy.origin}/api/client-gateway/snapshot`);
    await fetch(`${proxy.origin}/api/programs/automation-studio/answer-ask`, { method: "POST", body: "not json" });
    assert.equal(core.seen.length, 2);
    const calls = proxy.calls();
    assert.equal(calls.length, 1);
    assert.equal(calls[0]!.endpoint, "answer-ask");
    assert.equal(calls[0]!.bearer, false);
    assert.deepEqual(calls[0]!.request, { unparsed: true, bytes: 8 });
  } finally {
    await proxy.close();
    await core.close();
  }
});
