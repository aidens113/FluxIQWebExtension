// `pnpm task start` and `pnpm task finish` build and check only through the
// build cache: this repository through `pnpm build` and `pnpm check` (whose
// package scripts run scripts/build-cache/cli.mjs), and Core's libraries
// through `buildCore` (scripts/worktree/core-build.mjs), which runs each one
// through the cache and its shared store. A direct `pnpm --filter ... build`,
// `tsc` or `esbuild` anywhere else in these two directories would rebuild
// what the store already holds, so this reads their sources and fails on one.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const SCRIPTS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ALLOWED = new Set(["worktree/core-build.mjs"]);

function sources(directory) {
  return readdirSync(path.join(SCRIPTS, directory), { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".mjs"))
    .map((entry) => `${directory}/${entry.name}`);
}

test("task and worktree scripts build nothing except through pnpm build, pnpm check and buildCore", () => {
  const offending = [];
  for (const file of [...sources("task"), ...sources("worktree")]) {
    if (ALLOWED.has(file)) continue;
    const code = readFileSync(path.join(SCRIPTS, file), "utf8").split(/\r?\n/u).filter((line) => !/^\s*(?:\/\/|\*|\/\*)/u.test(line));
    for (const [index, line] of code.entries()) {
      if (/["']--filter["']/u.test(line) || /\b(?:tsc|esbuild)\b["'\s]/u.test(line) || /runPnpm\([^)]*\[\s*["'](?!build["']|check["']|install["']|\.\.\.INSTALL)/u.test(line)) {
        offending.push(`${file}: ${line.trim()}`);
      }
    }
  }
  assert.deepEqual(offending, []);
});

test("task start builds the worktree with pnpm build and Core with buildCore; task finish runs pnpm check only on --full-check", () => {
  const start = readFileSync(path.join(SCRIPTS, "task", "start.mjs"), "utf8");
  assert.match(start, /runPnpm\(created\.root, \["build"\]/u);
  assert.match(start, /await buildCore\(created\.coreRoot/u);
  assert.match(readFileSync(path.join(SCRIPTS, "worktree", "apply-move.mjs"), "utf8"), /runBuild = buildCore/u);
  assert.match(readFileSync(path.join(SCRIPTS, "task", "finish.mjs"), "utf8"), /runPnpm\(workRoot, \["check"\]/u);
});
