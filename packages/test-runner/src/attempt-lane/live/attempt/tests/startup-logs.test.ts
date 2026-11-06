// A failed startup's logs stay in the run's own folder, and the failure line says where (lane B,
// run-mw499mns-1532a49a: the isolated Core's web build failed and its log went with the run root).
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { RunnerFailure } from "../../../../failure.js";
import { attemptStartupLogs } from "../startup-logs.js";

test("a failing build leaves its log in the run folder, and the failure names where", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "attempt-startup-logs-"));
  try {
    const logs = path.join(root, "allocation", "logs");
    await mkdir(logs, { recursive: true });
    await writeFile(path.join(logs, "core-web-build.log"), "[core-web-build] next build: out of memory\n");
    const runFolder = path.join(root, "attempts", "run-x", "startup-logs");
    const kept = attemptStartupLogs(runFolder);
    // What `startTopology` does on a startup failure: copy the logs out, then remove the run root.
    await kept.copy(logs);
    await rm(path.join(root, "allocation"), { recursive: true, force: true });
    assert.equal(await readFile(path.join(runFolder, "core-web-build.log"), "utf8"), "[core-web-build] next build: out of memory\n");
    const failure = kept.named(new RunnerFailure("process.startup", "Core web panel production build did not succeed", { details: { process: "core-web-build" } }));
    assert.ok(failure instanceof RunnerFailure);
    assert.equal(failure.category, "process.startup");
    assert.equal(failure.message, `Core web panel production build did not succeed. Its startup logs are in ${runFolder}`);
    assert.deepEqual(failure.details, { process: "core-web-build", startupLogs: runFolder });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("a failure with no logs copied, or not the runner's own, is thrown as it was", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "attempt-startup-logs-none-"));
  try {
    const kept = attemptStartupLogs(path.join(root, "never-written"));
    const failure = new RunnerFailure("process.startup", "Core did not start");
    assert.equal(kept.named(failure), failure);
    const other = new Error("boom");
    assert.equal(kept.named(other), other);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
