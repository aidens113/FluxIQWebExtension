// Root `pnpm check` runs the script suites as ONE `node --test` over every
// suite's globs instead of four `pnpm <suite>:test` calls in a row: measured
// 2026-09-29 at 27 s against 36-42 s, with the same 474 passing (t187-build-store.md).
// The individual scripts stay for running one suite. This keeps the combined
// glob list equal to theirs, so a suite added to one is not missing from the other.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { REPOSITORY_ROOT } from "../index.mjs";

const SUITES = ["structure:test", "lab:test", "task:test", "build-cache:test"];
const scripts = JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, "package.json"), "utf8")).scripts;

function globsOf(command) {
  assert.match(command, /^node --test /u, command);
  return [...command.matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
}

test("pnpm check starts with one node --test over exactly the suites' globs", () => {
  const [prefix, ...rest] = scripts.check.split(" && ");
  assert.deepEqual(globsOf(prefix), SUITES.flatMap((suite) => globsOf(scripts[suite])));
  assert.deepEqual(rest, ["node scripts/structure-audit.mjs", "pnpm -r check"]);
});
