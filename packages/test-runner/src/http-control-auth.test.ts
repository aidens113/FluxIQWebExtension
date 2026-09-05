import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WebPanelAuthSessionCache } from "./auth-session.js";
import { FluxIQControlClient } from "./http-control.js";

const origin = "https://panel.example.test";
const credentials = { username: "runner", password: "never-persist", totp: "123456", pin: "654321" };

async function temporaryRoot(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-auth-client-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function response(status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify({ ok: status < 400, payload: { sessions: [] } }), { status, headers: { "content-type": "application/json", ...headers } });
}

test("reuses only a hook-validated cached cookie and supports forced fresh login", async (t) => {
  const root = await temporaryRoot(t);
  const cache = new WebPanelAuthSessionCache(root);
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    requests.push({ url: String(input), ...(init ? { init } : {}) });
    if (String(input).endsWith("/api/auth/login")) return response(200, { "set-cookie": "fluxiq_session=fresh; Max-Age=3600; HttpOnly" });
    return response();
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const first = new FluxIQControlClient(origin);
  assert.equal(await first.login(credentials, { sessionCache: cache }), "login");
  const second = new FluxIQControlClient(origin);
  assert.equal(await second.login(credentials, { sessionCache: cache }), "cache");
  const third = new FluxIQControlClient(origin);
  assert.equal(await third.login(credentials, { sessionCache: cache, freshLogin: true }), "login");
  assert.equal(requests.filter(item => item.url.endsWith("/api/auth/login")).length, 2);
  assert.equal(requests.filter(item => item.url.endsWith("/api/client-gateway/snapshot")).length, 1);
  const serializedRequests = JSON.stringify(requests);
  assert.equal(serializedRequests.includes(credentials.pin), false);
  assert.equal((await second.authSessionStatus(credentials.username))?.state, "valid");
  assert.equal((await second.clearAuthSession(credentials.username))?.state, "missing");
});

test("relogs in once after 401 or 403 and never includes secrets in failures", async (t) => {
  const originalFetch = globalThis.fetch;
  let loginCount = 0;
  let requestCount = 0;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/api/auth/login")) { loginCount += 1; return response(200, { "set-cookie": `fluxiq_session=value-${loginCount}; Max-Age=3600` }); }
    requestCount += 1;
    return response(requestCount === 1 ? 401 : 200);
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const client = new FluxIQControlClient(origin);
  await client.login(credentials);
  await client.gatewaySnapshot();
  assert.equal(loginCount, 2);
  assert.equal(requestCount, 2);

  let deniedLogins = 0;
  let deniedRequests = 0;
  globalThis.fetch = async (input) => {
    if (String(input).endsWith("/api/auth/login")) { deniedLogins += 1; return response(200, { "set-cookie": "fluxiq_session=denied; Max-Age=3600" }); }
    deniedRequests += 1;
    return response(403);
  };
  const denied = new FluxIQControlClient(origin);
  await denied.login(credentials);
  await assert.rejects(() => denied.gatewaySnapshot(), error => {
    const message = String(error);
    return !message.includes(credentials.password) && !message.includes(credentials.pin) && !message.includes(credentials.totp);
  });
  assert.equal(deniedLogins, 2);
  assert.equal(deniedRequests, 2);
});

test("destination mutations use only the public Automation Studio HTTP endpoints", async (t) => {
  const originalFetch = globalThis.fetch;
  const requests: Array<{ url: string; body?: unknown }> = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input);
    if (url.endsWith("/api/auth/login")) return response(200, { "set-cookie": "fluxiq_session=destination; Max-Age=3600" });
    const body = typeof init?.body === "string" ? JSON.parse(init.body) as Record<string, unknown> : undefined;
    requests.push({ url, ...(body ? { body } : {}) });
    if (url.includes("/create-project")) return new Response(JSON.stringify({ ok: true, payload: { project: { id: "project.destination" } } }), { status: 200 });
    const flow = url.endsWith("/get-flow") ? { projectId: "project.destination", flowId: "flow.destination" } : (body?.flow ?? { projectId: body?.projectId, flowId: body?.flowId });
    return new Response(JSON.stringify({ ok: true, payload: { flow } }), { status: 200 });
  };
  t.after(() => { globalThis.fetch = originalFetch; });
  const client = new FluxIQControlClient(origin);
  await client.login(credentials);
  assert.equal(await client.createProject({ name: "Destination", domainId: "web-automation", authorizationPin: credentials.pin }), "project.destination");
  await client.createFlow({ projectId: "project.destination", flowId: "flow.destination", name: "Destination", authorizationPin: credentials.pin });
  await client.saveFlow({ projectId: "project.destination", flow: { projectId: "project.destination", flowId: "flow.destination" }, authorizationPin: credentials.pin });
  await client.getFlow("project.destination", "flow.destination");
  assert.deepEqual(requests.map(item => new URL(item.url).pathname), [
    "/api/programs/automation-studio/create-project",
    "/api/programs/automation-studio/create-flow",
    "/api/programs/automation-studio/save-flow",
    "/api/programs/automation-studio/get-flow",
  ]);
  assert.equal(new URL(requests[0]!.url).searchParams.get("domainId"), "web-automation");
});
