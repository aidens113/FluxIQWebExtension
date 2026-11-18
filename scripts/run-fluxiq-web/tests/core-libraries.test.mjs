import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import test from "node:test";

import { runCaptured, summarizeBuildCache } from "../index.mjs";

// The build-cache summary line, and the captured run every preparation step uses.

const record = (step, outcome) => JSON.stringify({ "build-cache": outcome, step, reason: "dummy" });

test("a build-cache run that reused every step is current", () => {
  assert.equal(summarizeBuildCache("Core libraries", [record("contracts:build", "reuse"), record("fluxiq:build", "reuse")]), "Core libraries: current.");
});

test("a build-cache run names the steps it rebuilt, ignoring other output", () => {
  const lines = [record("contracts:build", "reuse"), "tsc output that is not a record", record("fluxiq:build", "build"), record("ui-components:build", "build")];
  assert.equal(summarizeBuildCache("Core libraries", lines), "Core libraries: rebuilt fluxiq, ui-components (they were out of date).");
});

test("runCaptured passes the command through as given and collects its output lines", async () => {
  let seen = null;
  const spawn = (command, args, options) => {
    seen = { command, args, options };
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    setImmediate(() => {
      child.stdout.on("end", () => setImmediate(() => child.emit("close", 3)));
      child.stdout.end("first\r\nsecond\n");
      child.stdout.resume();
    });
    return child;
  };
  const result = await runCaptured({ command: "tool", args: ["a b"], cwd: "C:/some dir", env: { MARK: "1" }, spawn });
  assert.deepEqual(result, { code: 3, lines: ["first", "second"] });
  assert.deepEqual(seen, { command: "tool", args: ["a b"], options: { cwd: "C:/some dir", env: { MARK: "1" }, shell: false, stdio: ["ignore", "pipe", "inherit"] } });
});
