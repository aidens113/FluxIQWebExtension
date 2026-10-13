import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { replayErrorOf } from "../receipt-error.js";

const MESSAGE = "Timed out waiting for the Chrome extension service worker";

function workerTimeout(details: Record<string, unknown>) {
  return new RunnerFailure("extension.worker", MESSAGE, { details });
}

test("a worker-stage extension start failure keeps its closed diagnostic details in the receipt", () => {
  const error = replayErrorOf(workerTimeout({ extensionStage: "worker", workerMs: 30_004, timeoutMs: 30_000, observedWorkerCount: 0, browserConnected: false }));
  assert.deepEqual(error, {
    category: "extension.worker", message: MESSAGE,
    details: { extensionStage: "worker", workerMs: 30_004, timeoutMs: 30_000, observedWorkerCount: 0, browserConnected: false },
  });
});

test("an error that is not an extension start failure carries no details", () => {
  assert.deepEqual(replayErrorOf(new Error("Unit pairing failure")), { category: "unknown", message: "Unit pairing failure" });
  assert.equal("details" in replayErrorOf(new RunnerFailure("environment.missing", "Unit missing Core", { details: { extensionStage: "worker" } })), false);
  assert.deepEqual(replayErrorOf("Unit thrown string"), { category: "unknown", message: "Unit thrown string" });
});

test("details outside the closed projection are never kept", () => {
  const error = replayErrorOf(workerTimeout({
    extensionStage: "worker", workerMs: 30_004, timeoutMs: 30_000, observedWorkerCount: 0, browserConnected: false,
    url: "chrome-extension://abcdefghijklmnop/background.js", browserMessage: "Unit browser text with a token sk-unit",
  }));
  assert.deepEqual(Object.keys(error.details ?? {}).sort(), ["browserConnected", "extensionStage", "observedWorkerCount", "timeoutMs", "workerMs"]);
  assert.equal(JSON.stringify(error.details).includes("chrome-extension://"), false);
  assert.equal(JSON.stringify(error.details).includes("sk-unit"), false);
});

test("bare readiness details without the worker stage are not projected", () => {
  // `awaitExtensionWorker` alone sets no stage; only the session's control-page wrapper does, which is why the replay now uses it.
  assert.equal("details" in replayErrorOf(workerTimeout({ timeoutMs: 30_000, observedWorkerCount: 0, browserConnected: false })), false);
});
