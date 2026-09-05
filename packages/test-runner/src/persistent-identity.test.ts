import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadOrCreatePersistentIdentity } from "./persistent-identity.js";

async function temporaryWorkspace(t: test.TestContext): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "fluxiq-persistent-identity-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

const credentials = { username: "lab-runner", password: "Long-Random-Password!9", pin: "654321" };

test("creates a protected identity once and reuses the same credentials", async (t) => {
  const workspace = await temporaryWorkspace(t);
  let generated = 0;
  const first = await loadOrCreatePersistentIdentity(workspace, () => { generated += 1; return credentials; });
  const second = await loadOrCreatePersistentIdentity(workspace, () => { generated += 1; return { username: "other", password: "Another-Long-Password!9", pin: "123456" }; });

  assert.deepEqual(first, { credentials, created: true });
  assert.deepEqual(second, { credentials, created: false });
  assert.equal(generated, 1);
  const target = path.join(workspace, ".identity", "credentials.json");
  const stored = JSON.parse(await readFile(target, "utf8"));
  assert.deepEqual(Object.keys(stored).sort(), ["credentials", "schemaVersion"]);
  assert.deepEqual(Object.keys(stored.credentials).sort(), ["password", "pin", "username"]);
  if (process.platform !== "win32") {
    assert.equal((await stat(path.dirname(target))).mode & 0o777, 0o700);
    assert.equal((await stat(target)).mode & 0o777, 0o600);
  }
});

test("malformed existing identity fails closed without invoking the generator", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const directory = path.join(workspace, ".identity");
  await mkdir(directory);
  await writeFile(path.join(directory, "credentials.json"), JSON.stringify({ schemaVersion: "0.1", credentials: { ...credentials, extra: "not-allowed" } }), "utf8");
  let generated = false;
  await assert.rejects(() => loadOrCreatePersistentIdentity(workspace, () => { generated = true; return credentials; }), /malformed/);
  assert.equal(generated, false);
});

test("oversize existing identity is rejected before parsing or generation", async (t) => {
  const workspace = await temporaryWorkspace(t);
  const directory = path.join(workspace, ".identity");
  await mkdir(directory);
  await writeFile(path.join(directory, "credentials.json"), "x".repeat(4 * 1024 + 1), "utf8");
  let generated = false;
  await assert.rejects(() => loadOrCreatePersistentIdentity(workspace, () => { generated = true; return credentials; }), /size limit/);
  assert.equal(generated, false);
});

test("generated credentials must satisfy the strict persisted schema", async (t) => {
  const workspace = await temporaryWorkspace(t);
  await assert.rejects(() => loadOrCreatePersistentIdentity(workspace, () => ({ ...credentials, pin: "12ab" })), /PIN must contain only digits/);
  await assert.rejects(() => loadOrCreatePersistentIdentity(workspace, () => ({ ...credentials, password: "short" })), /password/);
});
