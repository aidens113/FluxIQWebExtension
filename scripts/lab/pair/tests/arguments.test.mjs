import assert from "node:assert/strict";
import test from "node:test";
import { parsePairArgs } from "../arguments.mjs";

test("no arguments moves nothing and names the default instance", () => {
  assert.deepEqual(parsePairArgs([]), { ext: null, core: null, extRoot: null, instance: "lab-pair", buildCore: false, allowRunning: false, dryRun: false, help: false });
});

test("both sides, the root, the instance and every flag are read", () => {
  const options = parsePairArgs(["--", "--ext", "dev", "--core", "42bd90a", "--ext-root", "F:/fxlab/lab-ext", "--instance", "lab-b", "--build-core", "--allow-running", "--dry-run"]);
  assert.deepEqual(options, { ext: "dev", core: "42bd90a", extRoot: "F:/fxlab/lab-ext", instance: "lab-b", buildCore: true, allowRunning: true, dryRun: true, help: false });
});

test("ordinary revision spellings are accepted", () => {
  for (const revision of ["origin/dev", "HEAD~2", "dev^", "v1.2.3", "HEAD@{1}", "79839f43e74fb7ba43e73ba843619cd40c564473"]) {
    assert.equal(parsePairArgs(["--ext", revision]).ext, revision);
  }
});

test("a revision git could read as an option, or with a shell character, is refused", () => {
  assert.throws(() => parsePairArgs(["--ext", "-p"]), /not a revision/u);
  assert.throws(() => parsePairArgs(["--core", "dev;rm"]), /not a revision/u);
  assert.throws(() => parsePairArgs(["--core", "dev main"]), /not a revision/u);
  assert.throws(() => parsePairArgs(["--core", ""]), /not a revision/u);
});

test("a missing value, a malformed instance and an unknown argument are refused", () => {
  assert.throws(() => parsePairArgs(["--ext"]), /--ext requires a value/u);
  assert.throws(() => parsePairArgs(["--core", "--dry-run"]), /--core requires a value/u);
  assert.throws(() => parsePairArgs(["--instance", "Lab_A"]), /kebab-case/u);
  assert.throws(() => parsePairArgs(["dev"]), /Unknown argument "dev"/u);
});

test("help is recognised in both spellings", () => {
  assert.equal(parsePairArgs(["--help"]).help, true);
  assert.equal(parsePairArgs(["-h"]).help, true);
});
