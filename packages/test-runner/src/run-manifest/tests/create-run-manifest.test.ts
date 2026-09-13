import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertRunManifest, SCENARIO_SCHEMA_VERSION, type WebScenario } from "@fluxiq-web-extension/test-contracts";
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

async function manifestFor(t: test.TestContext, verdict: "passed" | "failed", redaction: RunRedactionAttestation | undefined) {
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
    workflowId: undefined, variantId: undefined, automationFailure: null, steps: [], actions: [], redaction,
  });
  assertRunManifest(manifest);
  return manifest;
}

test("a run no attestation vouched for records pending, and one with nothing to scan not_applicable, never verified", async t => {
  assert.equal((await manifestFor(t, "passed", undefined)).redactionState, "pending");
  assert.equal((await manifestFor(t, "passed", attestation("not-applicable"))).redactionState, "not_applicable");
});

test("a passed attestation records verified, and a failed one records failed on a failed run", async t => {
  assert.equal((await manifestFor(t, "passed", attestation("passed"))).redactionState, "verified");
  assert.equal((await manifestFor(t, "failed", attestation("failed"))).redactionState, "failed");
});
