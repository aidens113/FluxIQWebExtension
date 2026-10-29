import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createSiteServer } from "../serve.mjs";
import { makeConfig, startStub, goodBody } from "../signup/tests/support/stub-core.mjs";

let stub, site, base, publicDir, outsideSecret;
const logs = [];

before(async () => {
  stub = await startStub();
  const root = mkdtempSync(join(tmpdir(), "site-serve-"));
  publicDir = join(root, "public");
  mkdirSync(join(publicDir, "signup"), { recursive: true });
  writeFileSync(join(publicDir, "index.html"), "<h1>home</h1>");
  writeFileSync(join(publicDir, "signup", "index.html"), "<h1>signup</h1>");
  writeFileSync(join(publicDir, "site.css"), "body{}");
  writeFileSync(join(publicDir, ".hidden"), "x");
  outsideSecret = join(root, "secret.txt");
  writeFileSync(outsideSecret, "TOP-SECRET");
  const config = makeConfig(stub);
  site = createSiteServer({ config, publicDir, log: (l) => logs.push(l) });
  await new Promise((r) => site.listen(0, "127.0.0.1", r));
  base = `http://127.0.0.1:${site.address().port}`;
  config.siteOrigin = base;
});
after(async () => {
  site.closeAllConnections();
  await new Promise((r) => site.close(r));
  await stub.close();
});

// Raw request so path traversal strings are not normalised by a URL parser.
import { request } from "node:http";
function raw(path, { method = "GET", headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(base);
    const req = request({ host: u.hostname, port: u.port, path, method, headers }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, text: Buffer.concat(chunks).toString("utf8") }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

test("serves the index of a directory, files with content types, no-store", async () => {
  const home = await raw("/");
  assert.equal(home.status, 200);
  assert.equal(home.text, "<h1>home</h1>");
  assert.match(home.headers["content-type"], /text\/html/);
  assert.equal(home.headers["cache-control"], "no-store");
  assert.equal((await raw("/signup/")).text, "<h1>signup</h1>");
  const css = await raw("/site.css");
  assert.match(css.headers["content-type"], /text\/css/);
  const redirect = await raw("/signup");
  assert.equal(redirect.status, 301);
  assert.equal(redirect.headers.location, "/signup/");
});

test("404 for missing files; traversal and hidden files refused", async () => {
  assert.equal((await raw("/nope.html")).status, 404);
  for (const p of ["/../secret.txt", "/%2e%2e/secret.txt", "/..%2fsecret.txt", "/signup/../../secret.txt", "/%2e%2e%5csecret.txt", "/.hidden", "/a%00b"]) {
    const r = await raw(p);
    assert.equal(r.status, 404, p);
    assert.equal(r.text.includes("TOP-SECRET"), false, p);
  }
});

test("GET /api/signup/config", async () => {
  const r = await raw("/api/signup/config");
  assert.equal(r.status, 200);
  assert.deepEqual(JSON.parse(r.text), { humanCheck: "off", siteKey: null, termsVersion: "2026-10", inviteRequired: false, appOrigin: "http://127.0.0.1:4800", signupOn: true });
});

test("POST /api/signup over HTTP: JSON 202, form 303, foreign origin 403, other methods and API paths", async () => {
  stub.requests.length = 0;
  const json = JSON.stringify(goodBody());
  const ok = await raw("/api/signup", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: json });
  assert.equal(ok.status, 202);
  assert.equal(ok.text, '{"ok":true}');
  assert.equal(stub.requests.length, 1);
  const form = new URLSearchParams({ ...goodBody(), termsAccepted: "on" }).toString();
  const f = await raw("/api/signup", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", origin: base }, body: form });
  assert.equal(f.status, 303);
  assert.equal(f.headers.location, "/check-email/");
  const foreign = await raw("/api/signup", { method: "POST", headers: { "content-type": "application/json", origin: "http://evil.test" }, body: json });
  assert.equal(foreign.status, 403);
  assert.equal(stub.requests.length, 2);
  assert.equal((await raw("/api/signup")).status, 404);
  assert.equal((await raw("/api/other")).status, 404);
  assert.equal((await raw("/", { method: "DELETE" })).status, 405);
  const big = await raw("/api/signup", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: "x".repeat(40_000) });
  assert.equal(big.status, 413);
  assert.equal(logs.every((l) => !l.includes("person@example.com") && !l.includes("Pat Person")), true);
});

test("POST /api/signup/resend over HTTP", async () => {
  stub.provisioning = () => ({ status: 200, json: { ok: true, result: { status: "accepted" } } });
  const r = await raw("/api/signup/resend", { method: "POST", headers: { "content-type": "application/json", origin: base }, body: JSON.stringify({ email: "a@b.co" }) });
  assert.equal(r.status, 202);
});
