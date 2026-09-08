import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { RunnerFailure } from "./failure.js";
import {
  DemoLlmPreparationPhaseTracker,
  parseDemoLlmPreparationStatus,
  readDemoLlmPreparationStatus,
  sanitizeDemoLlmPreparationFailure,
  writeDemoLlmPreparationStatus,
} from "./demo-operation-status.js";

test("records only allowlisted phase, failure, and source-location codes", () => {
  const secret = "SENTINEL_CREDENTIAL_MUST_NOT_APPEAR";
  const failure = new RunnerFailure("runtime.behavior", secret);
  failure.stack = `RunnerFailure: ${secret}\n    at operation (F:\\workspace\\packages\\test-runner\\dist\\demo-workspace.js:219:13)`;
  const status = sanitizeDemoLlmPreparationFailure("connect-diagnostic-call", failure);
  assert.deepEqual(status, {
    schemaVersion: "0.1",
    operation: "demo-llm-prepare",
    outcome: "failed",
    phase: "connect-diagnostic-call",
    phaseIndex: 13,
    failureClass: "runner",
    failureCode: "runtime.behavior",
    sourceLocation: "demo-workspace:219:13",
  });
  assert.equal(JSON.stringify(status).includes(secret), false);
  assert.equal(JSON.stringify(status).includes("F:\\workspace"), false);

  const filesystem = Object.assign(new Error(secret), { code: "EACCES", stack: `Error: ${secret}\n at x (C:\\other\\unknown.js:4:2)` });
  assert.deepEqual(sanitizeDemoLlmPreparationFailure("browser-call", filesystem), {
    schemaVersion: "0.1",
    operation: "demo-llm-prepare",
    outcome: "failed",
    phase: "browser-call",
    phaseIndex: 4,
    failureClass: "node-io",
    failureCode: "node.eacces",
  });

  const timeout = new Error(secret);
  timeout.name = "TimeoutError";
  const timeoutStatus = sanitizeDemoLlmPreparationFailure("flow-open-call", timeout);
  assert.equal(timeoutStatus.failureClass, "playwright-timeout");
  assert.equal(timeoutStatus.failureCode, "playwright.timeout");
  assert.equal(JSON.stringify(timeoutStatus).includes(secret), false);
});

test("status parser rejects arbitrary text and inconsistent fixed-schema values", () => {
  const tracker = new DemoLlmPreparationPhaseTracker();
  tracker.set("evidence-finalize-returned");
  const passed = tracker.status("passed");
  assert.deepEqual(passed, {
    schemaVersion: "0.1",
    operation: "demo-llm-prepare",
    outcome: "passed",
    phase: "complete",
    phaseIndex: 20,
    failureClass: "none",
    failureCode: "none",
  });
  for (const invalid of [
    { ...passed, message: "SENTINEL" },
    { ...passed, phase: "arbitrary-stage" },
    { ...passed, phaseIndex: 17 },
    { ...passed, sourceLocation: "C:\\secret\\demo-workspace.js:1:2" },
    { ...passed, outcome: "failed" },
    { ...passed, failureClass: "node-io", failureCode: "node.arbitrary" },
  ]) assert.throws(() => parseDemoLlmPreparationStatus(invalid), /status is invalid/);
});

test("persists and reuses only the protected bounded status schema", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "fluxiq-prepare-status-"));
  const secret = "SENTINEL_PASSWORD_PIN_OR_KEY";
  try {
    const failed = sanitizeDemoLlmPreparationFailure("connect-diagnostic-call", new Error(secret));
    await writeDemoLlmPreparationStatus(directory, failed);
    assert.deepEqual(await readDemoLlmPreparationStatus(directory), failed);
    const rawFailure = await readFile(path.join(directory, "demo-llm-prepare-status.json"), "utf8");
    assert.equal(rawFailure.includes(secret), false);
    assert.equal(rawFailure.includes("message"), false);
    assert.deepEqual(Object.keys(JSON.parse(rawFailure)).sort(), [
      "failureClass", "failureCode", "operation", "outcome", "phase", "phaseIndex", "schemaVersion",
    ].sort());

    const tracker = new DemoLlmPreparationPhaseTracker();
    await writeDemoLlmPreparationStatus(directory, tracker.status("passed"));
    const passed = await readDemoLlmPreparationStatus(directory);
    assert.equal(passed.outcome, "passed");
    assert.equal(passed.phase, "complete");

    const target = path.join(directory, "demo-llm-prepare-status.json");
    await writeFile(target, JSON.stringify({ ...passed, message: secret }), "utf8");
    await assert.rejects(() => readDemoLlmPreparationStatus(directory), /status is invalid/);
    await writeFile(target, Buffer.alloc(4_097, 65));
    await assert.rejects(() => readDemoLlmPreparationStatus(directory), /status is invalid/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
