import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertRunManifest, SCENARIO_SCHEMA_VERSION, type RunManifest, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import type { RunRedactionAttestation } from "../../redaction-attestation/index.js";
import { createRunManifest } from "../create-run-manifest.js";

const here = path.dirname(fileURLToPath(import.meta.url));

const scenario: WebScenario = {
  schemaVersion: SCENARIO_SCHEMA_VERSION, id: "redaction-state", title: "Redaction state", tags: [], seed: 1,
  startPath: "/", capabilities: [], networkPolicy: "loopback-only", recordingScript: [], expected: {},
};

/** The facility checkout this compiled test sits in: the manifest records real git revisions, so it needs one. */
function repositoryRoot(): string {
  let directory = here;
  while (!existsSync(path.join(directory, "pnpm-workspace.yaml"))) {
    const parent = path.dirname(directory);
    if (parent === directory) throw new Error("The manifest test must run inside the facility checkout");
    directory = parent;
  }
  return directory;
}

function attestation(status: RunRedactionAttestation["status"]): RunRedactionAttestation {
  return {
    status, literalCount: status === "not-applicable" ? 0 : 1, scopes: [], advisories: [],
    findingCount: status === "failed" ? 1 : 0,
    findings: status === "failed" ? [{ scope: "workspace", path: ".fluxiq/recording.json", categories: ["secret-literal"] }] : [],
  };
}

async function manifestFor(t: test.TestContext, verdict: "passed" | "failed", redaction: RunRedactionAttestation | undefined, invocation?: RunManifest["invocation"]) {
  const root = repositoryRoot();
  // Inside the checkout, because the manifest records the build as a repository-relative path; the compiled tests sit in an ignored build directory.
  const extensionPath = await mkdtemp(path.join(here, "extension-"));
  t.after(() => rm(extensionPath, { recursive: true, force: true }));
  await writeFile(path.join(extensionPath, "manifest.json"), JSON.stringify({ version: "0.0.0" }));
  const manifest = await createRunManifest({
    repositoryRoot: root,
    // A git directory with no lockfile of its own, so the manifest's lockfile paths stay distinct without reading Core.
    fluxiqRepositoryRoot: path.join(root, "packages", "test-runner"),
    target: undefined, scenario, runId: "run-redaction-state", seed: 1, startedAt: new Date().toISOString(), verdict,
    browserVersion: "test", extensionPath, topology: undefined, existingPreflight: undefined, existingExecution: undefined,
    panelVerification: undefined, cloneState: { sourceSessionIdentityVerified: false, sourceHashVerifiedAfterRun: false, cleanupOutcome: "pending" },
    workflowId: undefined, variantId: undefined, automationFailure: null, steps: [], actions: [], redaction, ...(invocation ? { invocation } : {}),
  });
  assertRunManifest(manifest);
  return manifest;
}

test("a manifest records each repository's changes and how the run was invoked", async t => {
  const manifest = await manifestFor(t, "passed", undefined, { via: "test-runner", args: ["--x"], fluxiqEnvironment: ["FLUXIQ_A"] });
  assert.deepEqual(manifest.invocation, { via: "test-runner", args: ["--x"], fluxiqEnvironment: ["FLUXIQ_A"] });
  for (const repo of [manifest.repositories.facility, manifest.repositories.core]) {
    assert.ok(Array.isArray(repo.changes));
    assert.equal(repo.dirty, repo.changes!.length > 0 || (repo.changesOmitted ?? 0) > 0);
  }
});

test("a run no attestation vouched for records pending, and one with nothing to scan not_applicable, never verified", async t => {
  assert.equal((await manifestFor(t, "passed", undefined)).redactionState, "pending");
  assert.equal((await manifestFor(t, "passed", attestation("not-applicable"))).redactionState, "not_applicable");
});

test("a passed attestation records verified, and a failed one records failed on a failed run", async t => {
  assert.equal((await manifestFor(t, "passed", attestation("passed"))).redactionState, "verified");
  assert.equal((await manifestFor(t, "failed", attestation("failed"))).redactionState, "failed");
});
