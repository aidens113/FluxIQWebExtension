import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  ContractValidationError,
  EVIDENCE_SCHEMA_VERSION,
  validateEvidenceEvent,
  validateEvidencePolicy,
} from "@fluxiq-web-extension/test-contracts";
import {
  DEFAULT_EVIDENCE_POLICY,
  EvidenceBundle,
  EvidenceCaptureController,
  RedactionFailure,
  assertNoSensitiveText,
  redactStructured,
  sha256,
  toContractEvidencePolicy,
} from "../dist/index.js";

const correlation = (stepId = "step-1") => ({
  runId: "run-1",
  scenarioId: "sensitive-input",
  stepId,
  correlationId: `correlation-${stepId}`,
});

async function temporaryRoot(t) {
  const root = await mkdtemp(path.join(tmpdir(), "fluxiq-evidence-"));
  t.after(async () => { await import("node:fs/promises").then(({ rm }) => rm(root, { recursive: true, force: true })); });
  return root;
}

test("redacts nested denylisted fields and configured secrets without mutating input", () => {
  const input = { headers: { Authorization: "Bearer abc.def", cookie: "sid=secret" }, password: "hunter2", message: "token is private-value", nested: [{ access_token: "abc" }] };
  const redacted = redactStructured(input, { secrets: ["private-value"] });
  assert.equal(redacted.headers.Authorization, "[REDACTED]");
  assert.equal(redacted.headers.cookie, "[REDACTED]");
  assert.equal(redacted.password, "[REDACTED]");
  assert.equal(redacted.message, "token is [REDACTED]");
  assert.equal(redacted.nested[0].access_token, "[REDACTED]");
  assert.equal(input.password, "hunter2");
  assert.throws(() => assertNoSensitiveText("Authorization: Bearer abc.def"), RedactionFailure);
});

test("fails closed for circular structured data and unverified visual captures", async (t) => {
  const circular = {};
  circular.self = circular;
  assert.throws(() => redactStructured(circular), RedactionFailure);
  const root = await temporaryRoot(t);
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-1", scenarioId: "sensitive-input", redaction: { secrets: ["unsafe-secret"] } });
  await bundle.initialize();
  const controller = new EvidenceCaptureController(bundle, { screenshots: "events", minimumScreenshotIntervalMs: 0, maxScreenshots: 5, maxBytes: 100 }, {
    async capture() { return { bytes: Buffer.from("unsafe"), mediaType: "image/png", redactionVerified: false }; },
  });
  await assert.rejects(() => controller.trigger({ trigger: "checkpoint", summary: "capture", correlation: correlation() }), RedactionFailure);
  assert.deepEqual(await readdir(path.join(root, ".staging-run-1")), []);
  await assert.rejects(() => bundle.writeVerifiedArtifact("playwright/trace.zip", { bytes: Buffer.from("contains unsafe-secret"), mediaType: "application/zip", redactionVerified: true, redaction: "verified" }), RedactionFailure);
});

test("publishes atomically and builds a hash-consistent artifact index", async (t) => {
  const root = await temporaryRoot(t);
  let tick = 0;
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-1", scenarioId: "basic-form", now: () => new Date(1_700_000_000_000 + tick++ * 1000), redaction: { secrets: ["do-not-store"] } });
  await bundle.initialize();
  await assert.rejects(() => stat(path.join(root, "run-1")), { code: "ENOENT" });
  await bundle.appendEvent({ trigger: "step.start", summary: "entered do-not-store", correlation: correlation() });
  await bundle.appendEvent({ trigger: "error", summary: "assertion failed", correlation: correlation("submit") });
  const result = await bundle.finalize({ verdict: "failed", metrics: { retries: 1 } });
  await assert.rejects(() => stat(path.join(root, ".staging-run-1")), { code: "ENOENT" });
  assert.equal((await stat(result.path)).isDirectory(), true);
  for (const entry of result.index.artifacts) {
    const bytes = await readFile(path.join(result.path, ...entry.path.split("/")));
    assert.equal(bytes.byteLength, entry.bytes);
    assert.equal(sha256(bytes), entry.sha256);
  }
  const indexBytes = await readFile(path.join(result.path, "artifact-index.json"));
  const completion = JSON.parse(await readFile(path.join(result.path, "bundle.complete.json"), "utf8"));
  assert.equal(completion.artifactIndexSha256, sha256(indexBytes));
  const stored = await readFile(path.join(result.path, "events.ndjson"), "utf8");
  assert.equal(stored.includes("do-not-store"), false);
  assert.equal(result.summary.firstFailure.stepId, "submit");
});

test("deduplicates identical screenshots while retaining correlated events", async (t) => {
  const root = await temporaryRoot(t);
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-1", scenarioId: "dynamic-list" });
  await bundle.initialize();
  const bytes = Buffer.from("verified synthetic png bytes");
  const controller = new EvidenceCaptureController(bundle, { screenshots: "events", minimumScreenshotIntervalMs: 0, maxScreenshots: 10, maxBytes: 1_000 }, {
    async capture() { return { bytes, mediaType: "image/png", redactionVerified: true }; },
  }, () => 10_000);
  const first = await controller.trigger({ trigger: "step.start", summary: "before", correlation: correlation() });
  const second = await controller.trigger({ trigger: "step.complete", summary: "after", correlation: correlation() });
  assert.ok(first.screenshot.path);
  assert.equal(second.screenshot.duplicateOfSha256, first.screenshot.sha256);
  assert.equal((await readdir(path.join(root, ".staging-run-1", "screenshots"))).length, 1);
});

test("rate limits ordinary frames but always attempts error evidence", async (t) => {
  const root = await temporaryRoot(t);
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-1", scenarioId: "delayed-ui" });
  await bundle.initialize();
  let captures = 0;
  const controller = new EvidenceCaptureController(bundle, { screenshots: "events", minimumScreenshotIntervalMs: 1_000, maxScreenshots: 10, maxBytes: 1_000 }, {
    async capture() { captures += 1; return { bytes: Buffer.from(`frame-${captures}`), mediaType: "image/png", redactionVerified: true }; },
  }, () => 5_000);
  await controller.trigger({ trigger: "step.start", summary: "one", correlation: correlation() });
  const limited = await controller.trigger({ trigger: "state.change", summary: "two", correlation: correlation() });
  const failure = await controller.trigger({ trigger: "error", summary: "three", correlation: correlation() });
  assert.equal(limited.screenshot.suppressed, "rate-limit");
  assert.ok(failure.screenshot.path);
  assert.equal(captures, 2);
});

test("report and timeline identify failing step, preserve correlations, and escape content", async (t) => {
  const root = await temporaryRoot(t);
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-1", scenarioId: "failure-surfaces" });
  await bundle.initialize();
  await bundle.appendEvent({ trigger: "error", summary: "Expected <button> & failed", correlation: { ...correlation("detached-button"), gatewayMessageId: "gateway-7", recordingEntryId: "recording-8", commandAttemptId: "attempt-9" }, details: { before: "enabled", after: "detached" } });
  const { path: finalPath } = await bundle.finalize({ verdict: "failed" });
  const report = await readFile(path.join(finalPath, "report.html"), "utf8");
  const timeline = JSON.parse(await readFile(path.join(finalPath, "review", "timeline.json"), "utf8"));
  assert.match(report, /First failure:<\/strong> step detached-button/);
  assert.match(report, /Expected &lt;button&gt; &amp; failed/);
  assert.equal(report.includes("Expected <button>"), false);
  assert.equal(timeline[0].correlationId, "correlation-detached-button");
  assert.equal(timeline[0].correlation.gatewayMessageId, "gateway-7");
  const rawEvent = JSON.parse((await readFile(path.join(finalPath, "events.ndjson"), "utf8")).trim());
  assert.equal(validateEvidenceEvent(rawEvent).valid, true);
  assert.equal(rawEvent.schemaVersion, EVIDENCE_SCHEMA_VERSION);
  assert.equal(rawEvent.scenarioStepId, "detached-button");
  assert.equal(rawEvent.correlationId, "correlation-detached-button");
  assert.equal(rawEvent.details.capture.gatewayMessageId, "gateway-7");
  assert.equal(rawEvent.details.capture.recordingEntryId, "recording-8");
  assert.equal(rawEvent.details.capture.commandAttemptId, "attempt-9");
  assert.equal("correlation" in rawEvent, false);
  assert.equal("screenshot" in rawEvent, false);
});

test("publishes only canonical evidence events and a canonical final policy", async (t) => {
  const root = await temporaryRoot(t);
  const policy = {
    screenshots: "events",
    trace: "failure",
    video: "off",
    sampleFps: 0.25,
    minimumScreenshotIntervalMs: 50,
    maxScreenshots: 4,
    maxBytes: 2_048,
    reviewRequired: true,
  };
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-1", scenarioId: "basic-form", evidencePolicy: policy });
  await bundle.initialize();
  const captured = await bundle.appendEvent({ trigger: "checkpoint", summary: "canonical boundary", correlation: correlation("publish") });
  assert.equal(captured.published.scenarioStepId, "publish");
  const { path: finalPath } = await bundle.finalize({ verdict: "passed" });

  const lines = (await readFile(path.join(finalPath, "events.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(lines.length, 1);
  for (const event of lines) assert.equal(validateEvidenceEvent(event).valid, true);
  assert.deepEqual(Object.keys(lines[0]).sort(), ["correlationId", "details", "scenarioStepId", "schemaVersion", "sequence", "summary", "timestamp", "trigger"].sort());

  const publishedPolicy = JSON.parse(await readFile(path.join(finalPath, "evidence-policy.json"), "utf8"));
  assert.equal(validateEvidencePolicy(publishedPolicy).valid, true);
  assert.deepEqual(publishedPolicy, toContractEvidencePolicy(policy));
  assert.equal("minimumScreenshotIntervalMs" in publishedPolicy, false);
});

test("contract validation fails closed before invalid events or policies are durable", async (t) => {
  const root = await temporaryRoot(t);
  assert.throws(
    () => new EvidenceBundle({ rootDirectory: root, runId: "bad-policy", scenarioId: "basic-form", evidencePolicy: { ...DEFAULT_EVIDENCE_POLICY, screenshots: "sometimes" } }),
    ContractValidationError,
  );
  assert.deepEqual(await readdir(root), []);

  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "bad-event", scenarioId: "basic-form" });
  await bundle.initialize();
  await assert.rejects(
    () => bundle.appendEvent({ trigger: "checkpoint", summary: "", correlation: correlation("invalid") }),
    ContractValidationError,
  );
  assert.deepEqual(await readdir(path.join(root, ".staging-bad-event")), []);
});
