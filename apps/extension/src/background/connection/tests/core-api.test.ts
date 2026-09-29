// Coverage of callCoreProgram in core-api.ts: the one request the panel's
// relays make. It must carry the pairing token as the bearer credential and no
// cookie, return Core's payload untouched, and never put the token in anything
// it answers with.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { callCoreProgram } from "../core-api";

const TOKEN = "secret-pairing-token";
const credentials = { coreApiUrl: "http://127.0.0.1:3000", token: TOKEN };

function stubFetch(t: TestContext, respond: () => Response | Promise<Response>) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });
    return respond();
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = original; });
  return requests;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("posts to the program endpoint with the token as bearer and no cookie, and returns Core's payload unchanged", async (t) => {
  const payload = { conversation: { conversationId: "c-1", turns: [{ text: "Hi" }] } };
  const requests = stubFetch(t, () => json(200, { ok: true, payload }));

  const reply = await callCoreProgram(credentials, "get-conversation", { projectId: "p-1", conversationId: "c-1" });

  assert.deepEqual(reply, { ok: true, payload });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "http://127.0.0.1:3000/api/programs/automation-studio/get-conversation");
  assert.equal(requests[0]?.init.method, "POST");
  assert.equal(requests[0]?.init.credentials, "omit");
  assert.deepEqual(requests[0]?.init.headers, { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${TOKEN}` });
  assert.equal(requests[0]?.init.body, JSON.stringify({ projectId: "p-1", conversationId: "c-1" }));
});

test("without a token nothing is sent", async (t) => {
  const requests = stubFetch(t, () => json(200, { ok: true }));
  assert.deepEqual(await callCoreProgram({ coreApiUrl: credentials.coreApiUrl, token: undefined }, "list-conversations", {}), {
    ok: false, code: "not_paired", error: "This browser is not paired with FluxIQ yet."
  });
  assert.equal(requests.length, 0);
});

test("a 401 or 403 is refused, with Core's sentence; any other failure is failed, with Core's sentence or the status", async (t) => {
  let next: Response = json(403, { ok: false, error: "This endpoint is not available to a paired client." });
  stubFetch(t, () => next);
  assert.deepEqual(await callCoreProgram(credentials, "get-conversation", {}), {
    ok: false, code: "refused", httpStatus: 403, error: "This endpoint is not available to a paired client."
  });
  next = new Response("", { status: 401 });
  assert.deepEqual(await callCoreProgram(credentials, "get-conversation", {}), {
    ok: false, code: "refused", httpStatus: 401, error: "FluxIQ refused this browser's pairing."
  });
  next = json(400, { ok: false, error: "Automation Studio project is unavailable in this domain scope." });
  assert.deepEqual(await callCoreProgram(credentials, "get-conversation", {}), {
    ok: false, code: "failed", httpStatus: 400, error: "Automation Studio project is unavailable in this domain scope."
  });
  next = new Response("<html>oops</html>", { status: 502 });
  assert.deepEqual(await callCoreProgram(credentials, "get-conversation", {}), { ok: false, code: "failed", httpStatus: 502, error: "FluxIQ answered 502." });
});

test("an unreachable FluxIQ is unreachable, and no failure ever carries the token", async (t) => {
  stubFetch(t, () => { throw new TypeError(`fetch failed for Bearer ${TOKEN}`); });
  const reply = await callCoreProgram(credentials, "append-turn", { text: "hello" });
  assert.deepEqual(reply, { ok: false, code: "unreachable", error: "FluxIQ could not be reached." });
  assert.ok(!JSON.stringify(reply).includes(TOKEN));
});

test("an address that is not a URL is unreachable rather than a throw", async (t) => {
  const requests = stubFetch(t, () => json(200, { ok: true }));
  assert.deepEqual(await callCoreProgram({ coreApiUrl: "not a url", token: TOKEN }, "list-conversations", {}), {
    ok: false, code: "unreachable", error: "FluxIQ could not be reached."
  });
  assert.equal(requests.length, 0);
});
