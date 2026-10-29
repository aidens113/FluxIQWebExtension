import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createProvisioningClient } from "../provisioning-client.mjs";
import { makeConfig, startStub, TOKEN } from "./support/stub-core.mjs";

let stub;
before(async () => { stub = await startStub(); });
after(() => stub.close());

const clientFor = (config, extra = {}) => createProvisioningClient({
  url: config.provisioningUrl, tokenFile: config.provisioningTokenFile, timeoutMs: 1000, ...extra
});

test("posts JSON to /provisioning/<op> with the first token line and no Origin", async () => {
  stub.requests.length = 0;
  stub.provisioning = () => ({ status: 200, json: { ok: true, result: { status: "created" } } });
  const config = makeConfig(stub);
  const r = await clientFor(config).createAccount({ requestId: "r1", email: "a@b.co" });
  assert.deepEqual(r, { ok: true, result: { status: "created" } });
  const req = stub.requests[0];
  assert.equal(req.url, "/provisioning/createAccount");
  assert.equal(req.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(req.headers["content-type"], "application/json");
  assert.equal("origin" in req.headers, false);
  assert.deepEqual(req.json, { requestId: "r1", email: "a@b.co" });
});

test("re-reads the token file on every call", async () => {
  stub.requests.length = 0;
  const config = makeConfig(stub);
  const client = clientFor(config);
  await client.getAccount({ email: "a@b.co" });
  writeFileSync(config.provisioningTokenFile, `${"n".repeat(40)}\n`);
  await client.getAccount({ email: "a@b.co" });
  assert.equal(stub.requests[0].headers.authorization, `Bearer ${TOKEN}`);
  assert.equal(stub.requests[1].headers.authorization, `Bearer ${"n".repeat(40)}`);
});

test("passes Core's error envelope through", async () => {
  stub.provisioning = () => ({ status: 409, json: { ok: false, error: { code: "request_conflict", message: "m" } } });
  const r = await clientFor(makeConfig(stub)).sendWelcome({ requestId: "r", email: "a@b.co" });
  assert.equal(r.ok, false);
  assert.equal(r.error.code, "request_conflict");
});

test("never throws: closed connection, timeout, bad body, missing token all become failures", async () => {
  const config = makeConfig(stub);
  stub.provisioning = () => ({ destroy: true });
  assert.deepEqual(await clientFor(config).createAccount({}), { ok: false, error: { code: "unreachable" } });
  stub.provisioning = () => ({ status: 200, json: { ok: true }, delayMs: 400 });
  assert.deepEqual(await clientFor(config, { timeoutMs: 50 }).createAccount({}), { ok: false, error: { code: "unreachable" } });
  stub.provisioning = () => ({ status: 200, raw: "<html>" });
  assert.equal((await clientFor(config).createAccount({})).ok, false);
  stub.provisioning = () => ({ status: 200, json: { nope: 1 } });
  assert.equal((await clientFor(config).createAccount({})).error.code, "bad_response");
  writeFileSync(join(config.dir, "empty"), "");
  assert.equal((await clientFor(config, { tokenFile: join(config.dir, "empty") }).createAccount({})).error.code, "unreachable");
  assert.equal((await clientFor(config, { tokenFile: join(config.dir, "missing") }).createAccount({})).error.code, "unreachable");
  assert.equal((await clientFor(config, { url: "http://127.0.0.1:1" }).createAccount({})).error.code, "unreachable");
});
