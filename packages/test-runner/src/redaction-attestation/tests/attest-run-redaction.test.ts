import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { attestRunRedaction, runRedactionScopes, runRedactionState } from "../index.js";

const password = "synthetic-redaction-password-0001";
const card = "4000000000000000";

/**
 * A temporary run laid out the way `runScenario` leaves one before cleanup: the
 * bundle's staging directory beside the isolated run's FluxIQ storage, holding
 * one persisted recording.
 */
async function runLayout(t: test.TestContext) {
  const runsDirectory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-redaction-attestation-"));
  t.after(() => rm(runsDirectory, { recursive: true, force: true }));
  const bundleStagingPath = path.join(runsDirectory, ".staging-run-test");
  const workspaceStorageDir = path.join(runsDirectory, ".work", "run-test", "fluxiq-root", ".fluxiq");
  const recordingDirectory = path.join(workspaceStorageDir, "artifacts", "automation-studio", "projects", "project_one", "recordings", "recording_one");
  await mkdir(path.join(bundleStagingPath, "snapshots"), { recursive: true });
  await mkdir(path.join(bundleStagingPath, "logs"), { recursive: true });
  await mkdir(recordingDirectory, { recursive: true });
  await writeFile(path.join(bundleStagingPath, "events.ndjson"), JSON.stringify({ trigger: "final", summary: "Scenario completed" }) + "\n");
  await writeFile(path.join(recordingDirectory, "recording.json"), JSON.stringify({ recordingId: "recording_one", entryCount: 2 }));
  await writeFile(path.join(recordingDirectory, "timeline.jsonl"), JSON.stringify({ type: "web.element.input_changed", valueWithheld: true }) + "\n");
  return { bundleStagingPath, workspaceStorageDir, recordingDirectory, scopes: runRedactionScopes({ bundleStagingPath, workspaceStorageDir }) };
}

test("a declared literal persisted in the workspace's recording is a finding, named by scope and path only", async t => {
  const run = await runLayout(t);
  await writeFile(path.join(run.recordingDirectory, "timeline.jsonl"), JSON.stringify({ type: "web.element.input_changed", value: password }) + "\n");

  const attestation = await attestRunRedaction({ literals: [password, card], scopes: run.scopes });

  assert.equal(attestation.status, "failed");
  assert.equal(attestation.findingCount, 1);
  assert.deepEqual(attestation.findings, [{
    scope: "workspace",
    path: ".fluxiq/artifacts/automation-studio/projects/project_one/recordings/recording_one/timeline.jsonl",
    categories: ["secret-literal"],
  }]);
  assert.equal(runRedactionState(attestation), "failed");
  assert.equal(JSON.stringify(attestation).includes(password), false);
});

test("a clean run scans both trees for every literal and yields no finding", async t => {
  const run = await runLayout(t);

  const attestation = await attestRunRedaction({ literals: [password, card, password], scopes: run.scopes });

  assert.equal(attestation.status, "passed");
  assert.equal(attestation.literalCount, 2);
  assert.equal(attestation.findingCount, 0);
  assert.deepEqual(attestation.findings, []);
  assert.deepEqual(attestation.advisories, []);
  // Files were read, so "no finding" is an observation and not a scan that never ran.
  assert.deepEqual(attestation.scopes.map(scope => [scope.name, scope.scannedFiles]), [["bundle", 1], ["workspace", 2]]);
  assert.equal(runRedactionState(attestation), "verified");
});

test("a literal in the bundle is found too, and a path spelling another literal is redacted against all of them", async t => {
  const run = await runLayout(t);
  await writeFile(path.join(run.bundleStagingPath, "snapshots", `field-${card}.json`), JSON.stringify({ typed: password }));

  const attestation = await attestRunRedaction({ literals: [password, card], scopes: run.scopes });

  assert.equal(attestation.status, "failed");
  assert.deepEqual(attestation.findings, [{ scope: "bundle", path: ".staging-run-test/snapshots/field-[redacted].json", categories: ["secret-literal"] }]);
  const serialized = JSON.stringify(attestation);
  assert.equal(serialized.includes(card), false);
  assert.equal(serialized.includes(password), false);
});

test("credential syntax without a declared literal is an advisory, not a failure", async t => {
  const run = await runLayout(t);
  await writeFile(path.join(run.bundleStagingPath, "logs", "core.log"), "Authorization: Bearer synthetic-header-value\n");

  const attestation = await attestRunRedaction({ literals: [password], scopes: run.scopes });

  assert.equal(attestation.status, "passed");
  assert.deepEqual(attestation.advisories, [{ scope: "bundle", path: ".staging-run-test/logs/core.log", categories: ["authorization-material"] }]);
  assert.equal(runRedactionState(attestation), "verified");
});

test("a scope the scan cannot read fails closed", async t => {
  const run = await runLayout(t);
  await rm(run.workspaceStorageDir, { recursive: true, force: true });

  const attestation = await attestRunRedaction({ literals: [password], scopes: run.scopes });

  assert.equal(attestation.status, "failed");
  assert.deepEqual(attestation.findings, [{ scope: "workspace", path: ".fluxiq", categories: ["unreadable-text"] }]);
});

test("a scenario that declares no literal is not applicable, scans nothing, and verifies nothing", async t => {
  const run = await runLayout(t);

  const attestation = await attestRunRedaction({ literals: [], scopes: run.scopes });

  assert.deepEqual(attestation, { status: "not-applicable", literalCount: 0, scopes: [], findingCount: 0, findings: [], advisories: [] });
  assert.equal(runRedactionState(attestation), "not_applicable");
  assert.equal(runRedactionState(undefined), "pending");
});

test("only the workspace's own storage directory and the staging bundle are scoped", () => {
  const bundleStagingPath = path.resolve("runs", ".staging-run-x");
  const workspaceStorageDir = path.resolve("runs", ".work", "run-x", "fluxiq-root", ".fluxiq");
  assert.deepEqual(runRedactionScopes({ bundleStagingPath, workspaceStorageDir }), [
    { name: "bundle", root: path.resolve("runs"), paths: [".staging-run-x"] },
    { name: "workspace", root: path.resolve("runs", ".work", "run-x", "fluxiq-root"), paths: [".fluxiq"] },
  ]);
  assert.deepEqual(runRedactionScopes({ bundleStagingPath }), [{ name: "bundle", root: path.resolve("runs"), paths: [".staging-run-x"] }]);
});
