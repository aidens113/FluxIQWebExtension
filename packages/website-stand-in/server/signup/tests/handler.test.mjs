import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { createSignupHandler } from "../handler.mjs";
import { APP_ORIGIN, SITE_ORIGIN, TOKEN, formRequest, goodBody, jsonRequest, makeConfig, startStub } from "./support/stub-core.mjs";

let stub;
before(async () => { stub = await startStub(); });
after(() => stub.close());
beforeEach(() => {
  stub.requests.length = 0;
  stub.provisioning = () => ({ status: 200, json: { ok: true, result: { status: "created", userId: "u", workspaceId: "w" } } });
  stub.siteverify = () => ({ status: 200, json: { success: true } });
});

function make(overrides = {}, deps = {}) {
  const logs = [];
  const config = makeConfig(stub, overrides);
  const handler = createSignupHandler({ config, log: (l) => logs.push(l), ...deps });
  return { handler, logs, config };
}
const core = () => stub.requests.filter((r) => r.url.startsWith("/provisioning/"));

test("createAccount payload is exactly the contract shape, bearer from file, no Origin", async () => {
  const { handler } = make();
  const res = await handler.signup(jsonRequest({ ...goodBody(), continue: `${APP_ORIGIN}/connect/authorize?client=c&state=s` }));
  assert.equal(res.status, 202);
  const req = core()[0];
  assert.equal(req.url, "/provisioning/createAccount");
  assert.equal(req.headers.authorization, `Bearer ${TOKEN}`);
  assert.equal("origin" in req.headers, false);
  const { requestId, ...rest } = req.json;
  assert.match(requestId, /^[A-Za-z0-9._:-]{1,128}$/);
  assert.deepEqual(rest, {
    email: "person@example.com", displayName: "Pat Person", policies: ["FluxIQUserAccess"], workspace: "new",
    termsVersion: "2026-10", continueUrl: "/connect/authorize?client=c&state=s", sendWelcome: true
  });
});

test("continue is omitted from the payload when it fails validation", async () => {
  const { handler } = make();
  await handler.signup(jsonRequest({ ...goodBody(), continue: "//evil.test/connect/authorize" }));
  assert.equal("continueUrl" in core()[0].json, false);
});

test("each call sends a fresh requestId", async () => {
  const { handler } = make();
  await handler.signup(jsonRequest(goodBody()));
  await handler.signup(jsonRequest(goodBody()));
  assert.notEqual(core()[0].json.requestId, core()[1].json.requestId);
});

test("exists and created give byte-identical responses", async () => {
  const { handler } = make();
  const a = await handler.signup(jsonRequest(goodBody()));
  stub.provisioning = () => ({ status: 200, json: { ok: true, result: { status: "exists" } } });
  const b = await handler.signup(jsonRequest(goodBody()));
  assert.deepEqual(b, a);
  assert.equal(a.body, '{"ok":true}');
  const f1 = await handler.signup(formRequest({ ...goodBody(), termsAccepted: "on" }));
  stub.provisioning = () => ({ status: 200, json: { ok: true, result: { status: "created" } } });
  const f2 = await handler.signup(formRequest({ ...goodBody(), termsAccepted: "on" }));
  assert.deepEqual(f1, f2);
});

test("validation errors: 400 JSON with per-field messages, and Core is not called", async () => {
  const { handler } = make();
  const res = await handler.signup(jsonRequest({ email: "x", displayName: "", termsAccepted: false, termsVersion: "old" }));
  assert.equal(res.status, 400);
  const body = JSON.parse(res.body);
  assert.deepEqual(Object.keys(body.errors).sort(), ["displayName", "email", "termsAccepted", "termsVersion"]);
  assert.equal(core().length, 0);
  const bad = await handler.signup({ ...jsonRequest({}), rawBody: "{not json" });
  assert.equal(bad.status, 400);
});

test("form post: success 303 to /check-email/, failure 303 with error and fields", async () => {
  const { handler } = make();
  const ok = await handler.signup(formRequest({ ...goodBody(), termsAccepted: "on" }));
  assert.equal(ok.status, 303);
  assert.equal(ok.headers.location, "/check-email/");
  const bad = await handler.signup(formRequest({ email: "x", displayName: "Pat", termsAccepted: "on", termsVersion: "2026-10" }));
  assert.equal(bad.status, 303);
  assert.equal(bad.headers.location, "/signup/?error=invalid&fields=email");
  stub.provisioning = () => ({ destroy: true });
  const down = await handler.signup(formRequest({ ...goodBody(), termsAccepted: "on" }));
  assert.equal(down.headers.location, "/signup/?error=unavailable&fields=");
  const foreign = await handler.signup(formRequest(goodBody(), { origin: "http://evil.test" }));
  assert.equal(foreign.headers.location, "/signup/?error=origin&fields=");
});

test("form post with a JSON Accept answers in JSON", async () => {
  const { handler } = make();
  const res = await handler.signup(formRequest({ ...goodBody(), termsAccepted: "on" }, { accept: "application/json" }));
  assert.equal(res.status, 202);
});

test("same origin: foreign Origin refused; missing Origin needs Sec-Fetch-Site same-origin", async () => {
  const { handler } = make();
  const foreign = await handler.signup(jsonRequest(goodBody(), { origin: "http://evil.test" }));
  assert.equal(foreign.status, 403);
  const nullOrigin = await handler.signup(jsonRequest(goodBody(), { origin: "null" }));
  assert.equal(nullOrigin.status, 403);
  const none = jsonRequest(goodBody());
  delete none.headers.origin;
  assert.equal((await handler.signup(none)).status, 403);
  const crossSite = jsonRequest(goodBody(), { "sec-fetch-site": "cross-site" });
  assert.equal((await handler.signup(crossSite)).status, 403);
  const same = jsonRequest(goodBody());
  delete same.headers.origin;
  same.headers["sec-fetch-site"] = "same-origin";
  assert.equal((await handler.signup(same)).status, 202);
  assert.equal((await handler.signup(jsonRequest(goodBody(), { "sec-fetch-site": "same-origin" }))).status, 202);
  assert.equal(core().length, 2, "refused requests never reach Core");
});

test("rate limit per IP and total; X-Forwarded-For counts only when trusted", async () => {
  const { handler } = make({ SITE_RATE_PER_IP: "2", SITE_RATE_TOTAL: "100" });
  const from = (ip, headers = {}) => ({ ...jsonRequest(goodBody(), headers), remoteAddress: ip });
  assert.equal((await handler.signup(from("1.1.1.1"))).status, 202);
  assert.equal((await handler.signup(from("1.1.1.1"))).status, 202);
  const limited = await handler.signup(from("1.1.1.1"));
  assert.equal(limited.status, 429);
  assert.ok(Number(limited.headers["retry-after"]) >= 1);
  assert.equal((await handler.signup(from("2.2.2.2"))).status, 202);
  // Not trusted: the header is ignored, so rotating it does not help.
  assert.equal((await handler.signup(from("1.1.1.1", { "x-forwarded-for": "7.7.7.7" }))).status, 429);

  const trusted = make({ SITE_RATE_PER_IP: "1", SITE_RATE_TOTAL: "100", SITE_TRUST_FORWARDED_FOR: "1" }).handler;
  assert.equal((await trusted.signup(from("9.9.9.9", { "x-forwarded-for": "7.7.7.1" }))).status, 202);
  assert.equal((await trusted.signup(from("9.9.9.9", { "x-forwarded-for": "7.7.7.2" }))).status, 202);
  assert.equal((await trusted.signup(from("9.9.9.9", { "x-forwarded-for": "7.7.7.2" }))).status, 429);

  const total = make({ SITE_RATE_PER_IP: "50", SITE_RATE_TOTAL: "2" }).handler;
  assert.equal((await total.signup(from("3.3.3.1"))).status, 202);
  assert.equal((await total.signup(from("3.3.3.2"))).status, 202);
  assert.equal((await total.signup(from("3.3.3.3"))).status, 429);
});

test("rate-limited form post redirects with error=rate", async () => {
  const { handler } = make({ SITE_RATE_PER_IP: "0" });
  const res = await handler.signup(formRequest(goodBody()));
  assert.equal(res.headers.location, "/signup/?error=rate&fields=");
});

test("human check off: siteverify is never called", async () => {
  const { handler } = make({ SITE_HUMAN_CHECK: "off" });
  assert.equal((await handler.signup(jsonRequest(goodBody()))).status, 202);
  assert.equal(stub.requests.filter((r) => r.url.startsWith("/siteverify")).length, 0);
});

test("human check on: success, failure, missing token, unreachable siteverify", async () => {
  const { handler } = make({ SITE_HUMAN_CHECK: "turnstile" });
  const ok = await handler.signup(jsonRequest({ ...goodBody(), humanToken: "tok" }));
  assert.equal(ok.status, 202);
  const viaWidget = await handler.signup(formRequest({ ...goodBody(), termsAccepted: "on", "cf-turnstile-response": "tok2" }));
  assert.equal(viaWidget.status, 303);
  assert.equal(viaWidget.headers.location, "/check-email/");
  const verified = stub.requests.filter((r) => r.url.startsWith("/siteverify")).map((r) => new URLSearchParams(r.text).get("response"));
  assert.deepEqual(verified, ["tok", "tok2"]);

  const before = core().length;
  const missing = await handler.signup(jsonRequest(goodBody()));
  assert.equal(missing.status, 400);
  assert.ok(JSON.parse(missing.body).errors.humanToken);
  stub.siteverify = () => ({ status: 200, json: { success: false } });
  assert.equal((await handler.signup(jsonRequest({ ...goodBody(), humanToken: "bad" }))).status, 400);
  stub.siteverify = () => ({ destroy: true });
  assert.equal((await handler.signup(jsonRequest({ ...goodBody(), humanToken: "x" }))).status, 503);
  assert.equal(core().length, before, "Core is not called without a passed check");
});

test("503 when Core answers any error, times out, or is unreachable; body is the fixed message", async () => {
  const unavailable = JSON.stringify({ ok: false, message: "Sign-up is unavailable, try again shortly." });
  for (const code of ["invalid_input", "rate_limited", "unauthorized", "internal_error", "request_conflict"]) {
    const { handler } = make();
    stub.provisioning = () => ({ status: 400, json: { ok: false, error: { code, message: "secret detail person@example.com" } } });
    const res = await handler.signup(jsonRequest(goodBody()));
    assert.equal(res.status, 503, code);
    assert.equal(res.body, unavailable);
  }
  const { handler } = make({ SITE_PROVISIONING_TIMEOUT_MS: "50" });
  stub.provisioning = () => ({ status: 200, json: { ok: true, result: { status: "created" } }, delayMs: 400 });
  assert.equal((await handler.signup(jsonRequest(goodBody()))).status, 503);
  stub.provisioning = () => ({ destroy: true });
  assert.equal((await handler.signup(jsonRequest(goodBody()))).status, 503);
  stub.provisioning = () => ({ status: 200, json: { ok: true, result: { status: "weird" } } });
  assert.equal((await handler.signup(jsonRequest(goodBody()))).status, 503);
  const down = make({ FLUXIQ_PROVISIONING_URL: "http://127.0.0.1:1" }).handler;
  assert.equal((await down.signup(jsonRequest(goodBody()))).status, 503);
  const noToken = make({ FLUXIQ_PROVISIONING_TOKEN_FILE: join(make().config.dir, "absent") }).handler;
  assert.equal((await noToken.signup(jsonRequest(goodBody()))).status, 503);
});

test("signup off answers 503 and config reports it", async () => {
  const { handler } = make({ SITE_SIGNUP: "off" });
  assert.equal((await handler.signup(jsonRequest(goodBody()))).status, 503);
  assert.equal(JSON.parse(handler.config().body).signupOn, false);
});

test("logs hold only requestId, outcome, status and ms; never the body, on any path", async () => {
  const secrets = ["person@example.com", "Pat Person", "invite-xyz-123", TOKEN, "tok-secret-value", "turnstile-secret-value"];
  const dir = make().config.dir;
  const invites = join(dir, "invites");
  writeFileSync(invites, "invite-xyz-123\n");
  const { handler, logs } = make({ SITE_HUMAN_CHECK: "turnstile", SITE_INVITE_CODES_FILE: invites });
  const body = { ...goodBody(), inviteCode: "invite-xyz-123", humanToken: "tok-secret-value" };
  const attempts = [
    () => handler.signup(jsonRequest(body)),
    () => handler.signup(jsonRequest({ ...body, inviteCode: "wrong" })),
    () => handler.signup(jsonRequest(body, { origin: "http://evil.test" })),
    () => handler.resend(jsonRequest({ email: "person@example.com", humanToken: "tok-secret-value" })),
    () => {
      stub.provisioning = () => ({ status: 500, json: { ok: false, error: { code: "internal_error", message: "person@example.com Pat Person" } } });
      return handler.signup(jsonRequest(body));
    },
    () => {
      stub.provisioning = () => ({ destroy: true });
      return handler.signup(jsonRequest(body));
    },
    () => {
      stub.siteverify = () => ({ destroy: true });
      return handler.signup(jsonRequest(body));
    },
    () => handler.signup({ ...jsonRequest(body), rawBody: "{person@example.com" })
  ];
  for (const go of attempts) await go();
  assert.ok(logs.length >= attempts.length);
  for (const line of logs) {
    assert.match(line, /^signup (requestId=\S+ )?outcome=\w+ status=\d+( ms=\d+)?$/);
    for (const s of secrets) assert.equal(line.includes(s), false, line);
  }
});

test("a thrown dependency is a 503 and is logged without detail", async () => {
  const logs = [];
  const config = makeConfig(stub);
  const client = { createAccount: async () => { throw new Error("boom person@example.com"); }, sendWelcome: async () => ({}) };
  const handler = createSignupHandler({ config, log: (l) => logs.push(l), client });
  assert.equal((await handler.signup(jsonRequest(goodBody()))).status, 503);
  assert.equal(logs.some((l) => l.includes("person@example.com") || l.includes("boom")), false);
});

test("resend: sendWelcome by email, same 202 whatever the account state, 503 on Core errors", async () => {
  const { handler } = make();
  stub.provisioning = () => ({ status: 200, json: { ok: true, result: { status: "accepted" } } });
  const a = await handler.resend(jsonRequest({ email: " Person@Example.com ", continue: `${APP_ORIGIN}/connect/authorize?x=1` }));
  const b = await handler.resend(jsonRequest({ email: "unknown@example.com" }));
  assert.equal(a.status, 202);
  assert.deepEqual(b, a);
  assert.equal(core()[0].url, "/provisioning/sendWelcome");
  const { requestId, ...rest } = core()[0].json;
  assert.ok(requestId);
  assert.deepEqual(rest, { email: "person@example.com", continueUrl: "/connect/authorize?x=1" });
  assert.deepEqual(Object.keys(core()[1].json).sort(), ["email", "requestId"]);
  assert.equal((await handler.resend(jsonRequest({ email: "bad" }))).status, 400);
  assert.equal((await handler.resend(jsonRequest({ email: "a@b.co" }, { origin: "http://evil.test" }))).status, 403);
  stub.provisioning = () => ({ status: 500, json: { ok: false, error: { code: "internal_error" } } });
  assert.equal((await handler.resend(jsonRequest({ email: "a@b.co" }))).status, 503);
  const form = await make().handler.resend(formRequest({ email: "a@b.co" }));
  assert.equal(form.status, 303);
});

test("config endpoint reports the public settings only", () => {
  const { handler } = make({ SITE_HUMAN_CHECK: "turnstile" });
  const body = JSON.parse(handler.config().body);
  assert.deepEqual(body, { humanCheck: "turnstile", siteKey: "site-key-1", termsVersion: "2026-10", inviteRequired: false, appOrigin: "http://127.0.0.1:4800", signupOn: true });
  const off = JSON.parse(make({ SITE_HUMAN_CHECK: "off" }).handler.config().body);
  assert.equal(off.humanCheck, "off");
  assert.equal(off.siteKey, null);
  assert.equal(SITE_ORIGIN.length > 0, true);
});
