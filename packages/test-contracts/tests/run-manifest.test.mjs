import assert from "node:assert/strict";
import test from "node:test";
import { ContractValidationError, assertRunManifest, parseRunManifestJson, validateRunManifest } from "../dist/index.js";

const digest = "a".repeat(64);
const commit = "b".repeat(40);

function manifest(overrides = {}) {
  return {
    schemaVersion: "0.1",
    runId: "run-1",
    scenarioId: "basic-form",
    scenarioRevision: digest,
    seed: 101,
    status: "passed",
    startedAt: "2026-09-11T10:00:00.000Z",
    finishedAt: "2026-09-11T10:01:00.000Z",
    repositories: { facility: { path: "/repo", commit, dirty: false }, core: { path: "/core", commit, dirty: true } },
    compatibility: [],
    lockfiles: [],
    extension: { version: "0.1.0", sha256: digest, path: "apps/extension/dist/e2e-chromium" },
    environment: { os: "win32", architecture: "x64", browserName: "chromium", browserVersion: "134", locale: "en-US", timezone: "UTC", viewport: { width: 1280, height: 720 } },
    ports: { scenario: 4100 },
    processExits: {},
    artifacts: [],
    redactionState: "verified",
    verdict: "passed",
    ...overrides,
  };
}

const issuePaths = (input) => {
  const result = validateRunManifest(input);
  return result.valid ? [] : result.issues.map((issue) => issue.path);
};

test("a manifest without the run-detail fields stays valid, so older bundles still inspect", () => {
  assert.doesNotThrow(() => assertRunManifest(manifest()));
});

test("accepts workflow and variant ids, the reported automation failure, and step and action timings", () => {
  const value = manifest({
    workflowId: "paginated-extraction",
    variantId: "short-catalog",
    automationFailure: { category: "target_not_found", code: "web.dom.target_missing" },
    steps: [
      { stepId: "enter-name", operation: "type", startedAt: "2026-09-11T10:00:01.000Z", durationMs: 42, outcome: "succeeded" },
      { stepId: "read-page", operation: "extract", startedAt: "2026-09-11T10:00:02.000Z", durationMs: 0, outcome: "failed" },
    ],
    actions: [
      { actionType: "web.dom.type", startedAt: "2026-09-11T10:00:03.000Z", durationMs: 120, status: "succeeded" },
      { actionType: "web.dom.click", startedAt: "2026-09-11T10:00:04.000Z", status: "running" },
    ],
  });
  assert.deepEqual(issuePaths(value), []);
  assert.equal(parseRunManifestJson(JSON.stringify(value)).variantId, "short-catalog");
});

test("null records that FluxIQ reported no automation failure", () => {
  assert.deepEqual(issuePaths(manifest({ automationFailure: null })), []);
});

test("rejects malformed run-detail fields with their exact paths", () => {
  const paths = issuePaths(manifest({
    workflowId: "Paginated Extraction",
    variantId: "",
    automationFailure: { category: "runtime.behavior", code: " padded ", extra: true },
    steps: [{ stepId: "", operation: "hover", startedAt: "yesterday", durationMs: -1, outcome: "skipped" }],
    actions: [{ actionType: "web.dom.click", startedAt: "2026-09-11T10:00:04.000Z", durationMs: 1.5, status: "exploded" }],
  }));
  for (const expected of [
    "$.workflowId", "$.variantId",
    "$.automationFailure.category", "$.automationFailure.code", "$.automationFailure.extra",
    "$.steps[0].stepId", "$.steps[0].operation", "$.steps[0].startedAt", "$.steps[0].durationMs", "$.steps[0].outcome",
    "$.actions[0].durationMs", "$.actions[0].status",
  ]) assert.ok(paths.includes(expected), `${expected} in ${paths.join(", ")}`);
});

test("the automation failure uses the scenario taxonomy, not the test-rig categories", () => {
  assert.throws(() => assertRunManifest(manifest({ automationFailure: { category: "action.dispatch" } })), ContractValidationError);
  assert.doesNotThrow(() => assertRunManifest(manifest({ automationFailure: { category: "ambiguous_or_unknown" } })));
});

test("step and action timings must be arrays of objects", () => {
  const paths = issuePaths(manifest({ steps: {}, actions: ["x"] }));
  assert.ok(paths.includes("$.steps"));
  assert.ok(paths.includes("$.actions[0]"));
});
