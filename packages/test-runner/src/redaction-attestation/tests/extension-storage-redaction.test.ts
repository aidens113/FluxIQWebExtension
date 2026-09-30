import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { attestRunRedaction, chromiumExtensionStorageDirs, runRedactionScopes, runRedactionState } from "../index.js";

const password = "synthetic-redaction-password-0001";
const card = "4000000000000000";
const extensionId = "abcdefghijklmnopabcdefghijklmnop";

/** One LevelDB log record (FULL), header checksum left zero, preceded by binary bytes the way a WriteBatch frames its key and value. */
function logWith(value: Buffer): Buffer {
  const payload = Buffer.concat([Buffer.from([1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1]), Buffer.from("fluxiq.queuedEvents"), value]);
  const header = Buffer.alloc(7); header.writeUInt16LE(payload.length, 4); header[6] = 1;
  return Buffer.concat([header, payload]);
}

/**
 * A run's bundle and a Chromium profile as a Lab browser leaves them: the
 * extension's `chrome.storage.local` LevelDB directory under
 * `Default/Local Extension Settings/<id>`, with a binary log, a binary table,
 * `CURRENT`, `LOCK` and a manifest, and a web origin's IndexedDB beside it.
 */
async function profileLayout(t: test.TestContext, logValue: Buffer) {
  const runsDirectory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-extension-storage-redaction-"));
  t.after(() => rm(runsDirectory, { recursive: true, force: true }));
  const bundleStagingPath = path.join(runsDirectory, ".staging-run-test");
  const profileDir = path.join(runsDirectory, ".work", "run-test", "browser-profile");
  const settings = path.join(profileDir, "Default", "Local Extension Settings", extensionId);
  const webIndexedDb = path.join(profileDir, "Default", "IndexedDB", "http_127.0.0.1_4100.indexeddb.leveldb");
  await mkdir(bundleStagingPath, { recursive: true });
  await mkdir(settings, { recursive: true });
  await mkdir(webIndexedDb, { recursive: true });
  await writeFile(path.join(bundleStagingPath, "events.ndjson"), JSON.stringify({ trigger: "final" }) + "\n");
  await writeFile(path.join(settings, "000003.log"), logWith(logValue));
  await writeFile(path.join(settings, "000005.ldb"), Buffer.from([0, 0, 0xff, 0x10, 0, 7, 0, 0]));
  await writeFile(path.join(settings, "MANIFEST-000001"), Buffer.from([0, 0, 0, 0, 3, 0, 1, 0x01, 0x1a, 0]));
  await writeFile(path.join(settings, "CURRENT"), "MANIFEST-000001\n");
  await writeFile(path.join(settings, "LOCK"), "");
  await writeFile(path.join(webIndexedDb, "000003.log"), logWith(Buffer.from(password)));
  const dirs = await chromiumExtensionStorageDirs(profileDir);
  return { bundleStagingPath, profileDir, settings, scopes: runRedactionScopes({ bundleStagingPath, extensionStorage: { profileDir, dirs } }) };
}

test("the extension storage directories are the profile's extension settings and extension IndexedDB, never a web origin's", async t => {
  const run = await profileLayout(t, Buffer.from("{}"));
  const extensionIndexedDb = path.join(run.profileDir, "Default", "IndexedDB", `chrome-extension_${extensionId}_0.indexeddb.leveldb`);
  await mkdir(extensionIndexedDb, { recursive: true });
  assert.deepEqual(await chromiumExtensionStorageDirs(run.profileDir), [run.settings, extensionIndexedDb]);
  assert.deepEqual(await chromiumExtensionStorageDirs(path.join(run.profileDir, "never-launched")), []);
});

test("the scopes carry extension storage as a LevelDB scope rooted at the profile, and leave it out when there is none", async t => {
  const run = await profileLayout(t, Buffer.from("{}"));
  assert.deepEqual(run.scopes.map(scope => scope.name), ["bundle", "extension-storage"]);
  assert.deepEqual(run.scopes[1], { name: "extension-storage", root: path.resolve(run.profileDir), paths: [`Default/Local Extension Settings/${extensionId}`], store: "leveldb" });
  const bounded = runRedactionScopes({ bundleStagingPath: run.bundleStagingPath, extensionStorage: { profileDir: run.profileDir, dirs: [run.settings], writtenSince: 1_000 } });
  assert.equal(bounded[1]?.writtenSince, 1_000);
  assert.deepEqual(runRedactionScopes({ bundleStagingPath: run.bundleStagingPath, extensionStorage: { profileDir: run.profileDir, dirs: [] } }).map(scope => scope.name), ["bundle"]);
  assert.deepEqual(runRedactionScopes({ bundleStagingPath: run.bundleStagingPath }).map(scope => scope.name), ["bundle"]);
  assert.throws(() => runRedactionScopes({ bundleStagingPath: run.bundleStagingPath, extensionStorage: { profileDir: run.settings, dirs: [run.profileDir] } }));
});

test("a declared literal in the extension's LevelDB log is a finding, in UTF-8 and in UTF-16LE", async t => {
  for (const encoding of ["utf8", "utf16le"] as const) {
    const run = await profileLayout(t, Buffer.from(JSON.stringify({ value: password }), encoding));
    const attestation = await attestRunRedaction({ literals: [password, card], scopes: run.scopes });
    assert.equal(attestation.status, "failed", encoding);
    assert.deepEqual(attestation.findings, [{ scope: "extension-storage", path: `Default/Local Extension Settings/${extensionId}/000003.log`, categories: ["secret-literal"] }], encoding);
    assert.equal(JSON.stringify(attestation).includes(password), false);
  }
});

test("extension storage without the literal passes: its binary LevelDB files are searched, not failed closed", async t => {
  const run = await profileLayout(t, Buffer.from(JSON.stringify({ value: "withheld" })));
  const attestation = await attestRunRedaction({ literals: [password, card], scopes: run.scopes });
  assert.equal(attestation.status, "passed", JSON.stringify(attestation.findings));
  assert.equal(runRedactionState(attestation), "verified");
  const summary = attestation.scopes.find(scope => scope.name === "extension-storage");
  assert.equal(summary?.scannedFiles, 5);
  assert.equal(summary?.skippedBinaryFiles, 0);
  assert.equal(summary?.undecodedLevelDbFiles, 1, "the eight-byte .ldb has no table footer, so only its raw bytes were searched");
});

test("a non-LevelDB file in extension storage still goes to the text scan, and a bounded scope with nothing written since scans nothing", async t => {
  const run = await profileLayout(t, Buffer.from(JSON.stringify({ value: "withheld" })));
  await writeFile(path.join(run.settings, "notes.txt"), `leaked ${card}`);
  const attestation = await attestRunRedaction({ literals: [password, card], scopes: run.scopes });
  assert.deepEqual(attestation.findings, [{ scope: "extension-storage", path: `Default/Local Extension Settings/${extensionId}/notes.txt`, categories: ["secret-literal"] }]);
  const future = runRedactionScopes({ bundleStagingPath: run.bundleStagingPath, extensionStorage: { profileDir: run.profileDir, dirs: [run.settings], writtenSince: Date.now() + 3_600_000 } });
  const bounded = await attestRunRedaction({ literals: [password, card], scopes: future });
  assert.equal(bounded.status, "passed");
  assert.equal(bounded.scopes.find(scope => scope.name === "extension-storage")?.scannedFiles, 0);
});
