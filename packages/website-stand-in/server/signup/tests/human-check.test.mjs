import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { verifyHuman } from "../human-check.mjs";
import { makeConfig, startStub } from "./support/stub-core.mjs";

let stub;
before(async () => { stub = await startStub(); });
after(() => stub.close());

test("off: succeeds without calling siteverify", async () => {
  stub.requests.length = 0;
  const r = await verifyHuman({ config: makeConfig(stub, { SITE_HUMAN_CHECK: "off" }), token: undefined });
  assert.deepEqual(r, { ok: true });
  assert.equal(stub.requests.length, 0);
});

test("on: success posts secret, token and ip to siteverify", async () => {
  stub.requests.length = 0;
  stub.siteverify = () => ({ status: 200, json: { success: true } });
  const r = await verifyHuman({ config: makeConfig(stub, { SITE_HUMAN_CHECK: "turnstile" }), token: "tok", ip: "9.9.9.9" });
  assert.deepEqual(r, { ok: true });
  const form = new URLSearchParams(stub.requests[0].text);
  assert.equal(form.get("secret"), "turnstile-secret-value");
  assert.equal(form.get("response"), "tok");
  assert.equal(form.get("remoteip"), "9.9.9.9");
});

test("on: failure, missing token and unreachable siteverify are distinct refusals", async () => {
  const config = makeConfig(stub, { SITE_HUMAN_CHECK: "turnstile" });
  stub.siteverify = () => ({ status: 200, json: { success: false } });
  assert.deepEqual(await verifyHuman({ config, token: "tok" }), { ok: false, reason: "failed" });
  stub.requests.length = 0;
  assert.deepEqual(await verifyHuman({ config, token: "" }), { ok: false, reason: "missing" });
  assert.equal(stub.requests.length, 0);
  stub.siteverify = () => ({ destroy: true });
  assert.deepEqual(await verifyHuman({ config, token: "tok" }), { ok: false, reason: "unreachable" });
  stub.siteverify = () => ({ status: 500, json: {} });
  assert.deepEqual(await verifyHuman({ config, token: "tok" }), { ok: false, reason: "unreachable" });
  const down = makeConfig(stub, { SITE_HUMAN_CHECK: "turnstile", SITE_TURNSTILE_VERIFY_URL: "http://127.0.0.1:1/x" });
  assert.deepEqual(await verifyHuman({ config: down, token: "tok" }), { ok: false, reason: "unreachable" });
});
