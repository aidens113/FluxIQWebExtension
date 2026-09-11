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
  openEvidenceJournalWithRetry,
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
  assert.deepEqual(await readdir(path.join(root, ".staging-run-1")), ["events.ndjson"]);
  assert.equal(await readFile(path.join(root, ".staging-run-1", "events.ndjson"), "utf8"), "");
  await assert.rejects(() => bundle.writeVerifiedArtifact("playwright/trace.zip", { bytes: Buffer.from("contains unsafe-secret"), mediaType: "application/zip", redactionVerified: true, redaction: "verified" }), RedactionFailure);
  await bundle.abort();
});

test("retries only recognized transient evidence-journal acquisition failures", async () => {
  const expected = { close() {}, sync() {}, writeFile() {} };
  const delays = [];
  let attempts = 0;
  const opened = await openEvidenceJournalWithRetry("events.ndjson", async (_target, flags) => {
    assert.equal(flags, "ax");
    attempts += 1;
    if (attempts < 3) throw Object.assign(new Error("busy"), { code: attempts === 1 ? "EBUSY" : "EACCES" });
    return expected;
  }, async milliseconds => { delays.push(milliseconds); });
  assert.equal(opened, expected);
  assert.equal(attempts, 3);
  assert.deepEqual(delays, [10, 25]);

  const exhaustedDelays = [];
  let exhaustedAttempts = 0;
  await assert.rejects(() => openEvidenceJournalWithRetry("events.ndjson", async () => {
    exhaustedAttempts += 1;
    throw Object.assign(new Error("still busy"), { code: "EPERM" });
  }, async milliseconds => { exhaustedDelays.push(milliseconds); }), { code: "EPERM" });
  assert.equal(exhaustedAttempts, 4);
  assert.deepEqual(exhaustedDelays, [10, 25, 50]);

  for (const failure of [Object.assign(new Error("missing"), { code: "ENOENT" }), new RedactionFailure("do not retry")]) {
    let rejectedAttempts = 0;
    await assert.rejects(() => openEvidenceJournalWithRetry("events.ndjson", async () => {
      rejectedAttempts += 1;
      throw failure;
    }, async () => undefined), failure);
    assert.equal(rejectedAttempts, 1);
  }
});

test("serializes rapid concurrent events through one owned journal", async (t) => {
  const root = await temporaryRoot(t);
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-1", scenarioId: "rapid-journal" });
  await bundle.initialize();
  await Promise.all(Array.from({ length: 64 }, (_, index) => bundle.appendEvent({
    trigger: "checkpoint",
    summary: "rapid append",
    correlation: correlation(`rapid-${index}`),
  })));
  const result = await bundle.finalize({ verdict: "passed" });
  const events = (await readFile(path.join(result.path, "events.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(events.length, 64);
  assert.deepEqual(events.map(event => event.sequence), Array.from({ length: 64 }, (_, index) => index + 1));
});

test("retains sequential diagnostics immediately after twenty screenshots", async (t) => {
  const root = await temporaryRoot(t);
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-1", scenarioId: "diagnostic-burst" });
  await bundle.initialize();
  const controller = new EvidenceCaptureController(bundle, { screenshots: "events", deduplicateScreenshots: false, maxScreenshots: 20, maxBytes: 10_000 }, {
    async capture(input) { return { bytes: Buffer.from(input.correlation.stepId), mediaType: "image/png", redactionVerified: true }; },
  });
  for (let index = 0; index < 20; index += 1) await controller.trigger({
    trigger: "step.complete",
    summary: "visual boundary",
    correlation: correlation(`visual-${index}`),
  });
  for (const stepId of ["diagnostic-flow-open-complete", "diagnostic-connect-call"]) await controller.trigger({
    trigger: "checkpoint",
    summary: "Sanitized diagnostic checkpoint",
    correlation: correlation(stepId),
    details: { diagnostic: { stage: stepId, errorCode: "diagnostic.test", facts: { ready: true } } },
    screenshotSuppression: "sensitive-action",
  });
  const result = await bundle.finalize({ verdict: "failed" });
  const events = (await readFile(path.join(result.path, "events.ndjson"), "utf8")).trim().split("\n").map(JSON.parse);
  assert.equal(events.length, 22);
  assert.equal(events[20].scenarioStepId, "diagnostic-flow-open-complete");
  assert.equal(events[21].scenarioStepId, "diagnostic-connect-call");
  assert.equal(events[21].details.capture.screenshotSuppressed, "sensitive-action");
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
  await bundle.abort();
});

test("preserves identical physical frames when continuous review capture disables deduplication", async (t) => {
  const root = await temporaryRoot(t);
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-1", scenarioId: "continuous-review" });
  await bundle.initialize();
  const bytes = Buffer.from("same verified frame");
  const controller = new EvidenceCaptureController(bundle, { screenshots: "events", deduplicateScreenshots: false, sampleFps: 2, maxScreenshots: 10, maxBytes: 1_000 }, {
    async capture() { return { bytes, mediaType: "image/png", redactionVerified: true }; },
  });
  const first = await controller.trigger({ trigger: "checkpoint", summary: "frame one", correlation: correlation("one") });
  const second = await controller.trigger({ trigger: "checkpoint", summary: "frame two", correlation: correlation("two") });
  assert.ok(first.screenshot.path);
  assert.ok(second.screenshot.path);
  assert.notEqual(first.screenshot.path, second.screenshot.path);
  assert.equal((await readdir(path.join(root, ".staging-run-1", "screenshots"))).length, 2);
  assert.equal(validateEvidencePolicy(toContractEvidencePolicy({ screenshots: "events", sampleFps: 2, maxScreenshots: 10, maxBytes: 1_000 })).valid, true);
  await bundle.abort();
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
  await bundle.abort();
});

test("retains a truthful event when the screenshot adapter is transiently unavailable", async (t) => {
  const root = await temporaryRoot(t);
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "run-1", scenarioId: "capture-failure" });
  await bundle.initialize();
  const controller = new EvidenceCaptureController(bundle, { screenshots: "events", maxScreenshots: 10, maxBytes: 1_000 }, {
    async capture() { throw new Error("arbitrary adapter failure that must not be stored"); },
  });
  const event = await controller.trigger({ trigger: "step.start", summary: "before action", correlation: correlation("durable-boundary") });
  assert.equal(event.screenshot.suppressed, "capture-unavailable");
  assert.equal(event.published.details.capture.screenshotSuppressed, "capture-unavailable");
  const result = await bundle.finalize({ verdict: "failed" });
  const stored = await readFile(path.join(result.path, "events.ndjson"), "utf8");
  assert.match(stored, /"scenarioStepId":"durable-boundary"/u);
  assert.match(stored, /"screenshotSuppressed":"capture-unavailable"/u);
  assert.doesNotMatch(stored, /arbitrary adapter failure/u);
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
  assert.deepEqual(await readdir(path.join(root, ".staging-bad-event")), ["events.ndjson"]);
  assert.equal(await readFile(path.join(root, ".staging-bad-event", "events.ndjson"), "utf8"), "");
  await bundle.abort();
});

test("suppresses sensitive-action pixels while retaining redacted before and after events", async (t) => {
  const root = await temporaryRoot(t);
  const secrets = ["deepseek-key-fixture", "password-fixture", "654321"];
  const bundle = new EvidenceBundle({ rootDirectory: root, runId: "sensitive-run", scenarioId: "sensitive-input", redaction: { secrets } });
  await bundle.initialize();
  let captureAttempts = 0;
  const controller = new EvidenceCaptureController(bundle, { screenshots: "events", maxScreenshots: 10, maxBytes: 10_000 }, {
    async capture() { captureAttempts += 1; return { bytes: Buffer.from(secrets.join("|")), mediaType: "image/png", redactionVerified: true }; },
  });
  for (const [trigger, label] of [["step.start", "Before"], ["step.complete", "After"]]) {
    const event = await controller.trigger({
      trigger,
      summary: `${label}: enter deepseek-key-fixture`,
      correlation: correlation("provider-secret-entry"),
      details: { apiKey: secrets[0], password: secrets[1], pin: secrets[2] },
      screenshotSuppression: "sensitive-action",
    });
    assert.equal(event.screenshot.suppressed, "sensitive-action");
    assert.equal(event.published.details.capture.screenshotSuppressed, "sensitive-action");
  }
  const result = await bundle.finalize({ verdict: "passed" });
  assert.equal(captureAttempts, 0);
  assert.equal(result.summary.eventCount, 2);
  assert.equal(result.summary.screenshotCount, 0);
  assert.equal(result.index.artifacts.some(artifact => artifact.mediaType.startsWith("image/")), false);
  for (const artifact of result.index.artifacts) {
    const bytes = await readFile(path.join(result.path, ...artifact.path.split("/")));
    const rendered = bytes.toString("utf8");
    for (const secret of secrets) assert.equal(rendered.includes(secret), false, `${artifact.path} contained sensitive text`);
  }
});
