import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { WebPanelAuthSessionCache } from "../auth-session.js";

async function temporaryRoot(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-auth-cache-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

test("stores a minimal origin-and-username-scoped session atomically and clears it", async (t) => {
  const root = await temporaryRoot(t);
  const cache = new WebPanelAuthSessionCache(root, { now: () => new Date("2026-09-04T12:00:00.000Z") });
  const scope = { origin: "https://panel.example.test", username: "runner@example.test" };
  const status = await cache.save(scope, { cookie: "fluxiq_session=opaque-value; HttpOnly", expiresAt: "2026-09-04T13:00:00.000Z" });
  assert.equal(status.state, "valid");
  assert.equal(path.dirname(status.path), path.join(root, ".auth"));
  const storedText = await readFile(status.path, "utf8");
  const stored = JSON.parse(storedText);
  assert.deepEqual(Object.keys(stored).sort(), ["cookie", "createdAt", "expiresAt", "origin", "schemaVersion", "username"].sort());
  assert.equal(stored.cookie, "fluxiq_session=opaque-value");
  assert.equal(/password|pin|totp/i.test(storedText), false);
  let validated = 0;
  const loaded = await cache.load(scope, session => { validated += 1; return session.cookie === "fluxiq_session=opaque-value"; });
  assert.equal(loaded.status.state, "valid");
  assert.equal(loaded.session?.cookie, "fluxiq_session=opaque-value");
  assert.equal(validated, 1);
  if (process.platform !== "win32") assert.equal((await stat(status.path)).mode & 0o777, 0o600);
  assert.equal((await cache.clear(scope)).state, "missing");
  assert.equal((await cache.status(scope)).state, "missing");
});

test("rejects expired, malformed, wrong-scope, and unvalidated cache entries", async (t) => {
  const root = await temporaryRoot(t);
  let now = new Date("2026-09-04T12:00:00.000Z");
  const cache = new WebPanelAuthSessionCache(root, { now: () => now });
  const scope = { origin: "http://127.0.0.1:3000", username: "runner" };
  await cache.save(scope, { cookie: "fluxiq_session=one", expiresAt: "2026-09-04T12:01:00.000Z" });
  now = new Date("2026-09-04T12:02:00.000Z");
  assert.equal((await cache.status(scope)).state, "expired");

  const target = cache.pathFor(scope);
  await writeFile(target, "not json", "utf8");
  assert.equal((await cache.status(scope)).state, "malformed");

  await writeFile(target, JSON.stringify({ schemaVersion: "0.1", origin: "http://127.0.0.1:3001", username: "runner", cookie: "fluxiq_session=two", createdAt: "2026-09-04T12:00:00.000Z", expiresAt: "2026-09-05T12:00:00.000Z" }), "utf8");
  assert.equal((await cache.status(scope)).state, "wrong-scope");

  await cache.save(scope, { cookie: "fluxiq_session=three", expiresAt: "2026-09-05T12:00:00.000Z" });
  const invalid = await cache.load(scope, () => false);
  assert.equal(invalid.status.state, "invalid-cookie");
  assert.equal(invalid.session, undefined);
});
