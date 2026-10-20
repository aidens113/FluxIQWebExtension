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

const SUITES = ["structure:test", "lab:test", "task:test", "build-cache:test", "check:test"];
const scripts = JSON.parse(readFileSync(path.join(REPOSITORY_ROOT, "package.json"), "utf8")).scripts;

// The Lab's tests import `packages/test-contracts/dist` (a Core refusal's
// sentence is screened with it and dropped when it is missing or stale), so
// `pnpm check` and `pnpm lab:test` gate Core's build and build test-contracts,
// through the build cache, before their `node --test` (2026-10-17: a dist from
// before that screen failed three Lab tests in the sweep).
const BUILD_FIRST = ["node scripts/check/core-build.mjs", "node scripts/build-cache/cli.mjs test-contracts:build"];

// `pnpm check` also refuses a drifted mirror of Core's code right after the
// Core build gate, before anything else spends time (scripts/check/core-mirror.mjs).
const CHECK_FIRST = ["node scripts/check/core-build.mjs", "node scripts/check/core-mirror.mjs", "node scripts/build-cache/cli.mjs test-contracts:build"];

/** A script's one `node --test` step. */
function testStep(command) {
  const step = command.split(" && ").find((part) => part.startsWith("node --test "));
  assert.ok(step, command);
  return step;
}

function globsOf(command) {
  return [...testStep(command).matchAll(/"([^"]+)"/gu)].map((match) => match[1]);
}

test("pnpm check builds what its tests import, then one node --test over exactly the suites' globs", () => {
  const steps = scripts.check.split(" && ");
  const at = steps.indexOf(testStep(scripts.check));
  assert.deepEqual(steps.slice(0, at), CHECK_FIRST);
  assert.deepEqual(globsOf(scripts.check), SUITES.flatMap((suite) => globsOf(scripts[suite])));
  // The Core build gate also stands before `pnpm -r check` bundles the extension
  // against Core's dist (scripts/check/core-build.mjs).
  assert.deepEqual(steps.slice(at + 1), ["node scripts/structure-audit.mjs", "pnpm -r check"]);
});

test("pnpm lab:test builds what its tests import before them", () => {
  const steps = scripts["lab:test"].split(" && ");
  assert.deepEqual(steps.slice(0, steps.indexOf(testStep(scripts["lab:test"]))), BUILD_FIRST);
});
