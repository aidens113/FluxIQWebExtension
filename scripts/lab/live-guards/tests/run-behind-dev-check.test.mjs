// `runBehindDevCheck` and its CLI: exit 1 with the Lab's refusal on a lacking
// ancestry, exit 0 and silence on a containing one.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { runBehindDevCheck } from "../index.mjs";

const ancestry = (root, contains) => ({ root, head: "aaaaaaa1", dev: "bbbbbbb2", contains, docsOnly: false, lacking: contains ? 0 : 3, error: null });
const output = () => ({ text: "", write(chunk) { this.text += chunk; } });

test("a lacking ancestry exits 1 with the refusal text and JSON line", async () => {
  const stderr = output();
  const code = await runBehindDevCheck({ repositoryRoot: "web", coreRoot: "core", slotsDirectory: "no-such-slots", stderr, devAncestry: async (root) => ancestry(root, root === "core") });
  assert.equal(code, 1);
  assert.match(stderr.text, /run refused by rule "behind-dev"/u);
  assert.match(stderr.text, /git merge dev/u);
  assert.equal(JSON.parse(stderr.text.trim().split("\n").at(-1)).category, "lab.live-guard");
});

test("a containing ancestry exits 0 and prints nothing", async () => {
  const stderr = output();
  const code = await runBehindDevCheck({ repositoryRoot: "web", coreRoot: "core", slotsDirectory: "no-such-slots", stderr, devAncestry: async (root) => ancestry(root, true) });
  assert.deepEqual([code, stderr.text], [0, ""]);
});

test("a failing reader exits 1 rather than admitting", async () => {
  const stderr = output();
  const code = await runBehindDevCheck({ repositoryRoot: "web", coreRoot: "core", stderr, devAncestry: async () => { throw new Error("no git"); } });
  assert.equal(code, 1);
  assert.match(stderr.text, /guard-error/u);
});

test("the script is wired and exits with the check's code", () => {
  const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "cli", "behind-dev.mjs");
  const result = spawnSync(process.execPath, ["--check", script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
});
