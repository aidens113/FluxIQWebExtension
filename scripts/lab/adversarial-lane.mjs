#!/usr/bin/env node
// Run every adversarial condition the corpus declares, and say which recovery
// absorbed each one and what it cost.
//
// The recovery ladder landed in Core built, unit-tested and proved to run live,
// and had never been shown to absorb anything -- because no variant in the
// corpus was absorbable by it. The corpus was written to prove *model* repair,
// so every fault in it was a fault only a model could answer. This lane is the
// other half: fixtures armed with the faults a deterministic runtime is
// supposed to survive, and a number per fault saying whether it did.
//
// Each condition runs with no provider grant at all. That is the design, not a
// saving. A run with a grant that went unspent shows the model was not needed
// this time; a run with no grant shows that whatever finished it was the
// deterministic runtime, because nothing else was available. The
// `expected.providerCalls` declarations on the same rows are the guard for the
// live case, when the campaign runs them with a grant.
//
// Usage:
//   node scripts/lab/adversarial-lane.mjs [--only <condition-id>]... [--list] [-- <extra lab args>]
//
// `--list` prints the conditions and runs nothing. Exit status is 0 when every
// condition was absorbed by what it declared, at no more than the attempts it
// declared, for no provider calls.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { conditionArguments, conditionHeld, loadAdversarialConditions, measureCondition, measurementTable } from "./adversarial/index.mjs";
import { repositoryRoot } from "./lab-instance.mjs";
import { displayCommand, labEnvironment, spawnLab } from "./live-campaign/lab-run/index.mjs";
import { readRunBundle } from "./live-campaign/row/index.mjs";

const argv = process.argv.slice(2);
const passThroughAt = argv.indexOf("--");
const own = passThroughAt === -1 ? argv : argv.slice(0, passThroughAt);
const extraLabArgs = passThroughAt === -1 ? [] : argv.slice(passThroughAt + 1);
const only = own.flatMap((value, index) => (own[index - 1] === "--only" ? [value] : []));
const listOnly = own.includes("--list");
const outputDir = path.join(repositoryRoot, "test-runs", ".adversarial", new Date().toISOString().replace(/[:.]/gu, "-"));

const conditions = (await loadAdversarialConditions()).filter((condition) => only.length === 0 || only.includes(condition.id));
if (conditions.length === 0) {
  process.stderr.write(only.length ? `No condition matched ${only.join(", ")}\n` : "No corpus row declares expected.recovery, so there is nothing to measure.\n");
  process.exit(1);
}

if (listOnly) {
  for (const condition of conditions) process.stdout.write(`${condition.id}\t${condition.declared.absorbedBy}\t${condition.declared.because}\n`);
  process.exit(0);
}

await mkdir(path.join(outputDir, "logs"), { recursive: true });
const labScript = path.join(repositoryRoot, "scripts", "lab", "run-lab.mjs");
const execute = spawnLab(labScript);
const rows = [];

for (const [position, condition] of conditions.entries()) {
  const args = [...conditionArguments(condition), ...extraLabArgs];
  process.stderr.write(`[adversarial] ${position + 1}/${conditions.length} ${condition.id}: ${displayCommand(args)}\n`);
  const attempt = await execute({ args, env: labEnvironment(process.env, condition.secrets), logPath: path.join(outputDir, "logs", `${condition.id.replace(/\//gu, "_")}.log`) });
  const runPath = runDirectoryOf(attempt.stdout);
  const row = measureCondition(condition, attempt, runPath ? await readRunBundle(runPath) : { evaluation: null, run: null, liveLlm: null, flowLane: null, repairLane: null });
  rows.push(row);
  process.stderr.write(`[adversarial] ${condition.id}: absorbed by ${row.absorbedBy.join("+") || "nothing"}, ${row.providerCalls} provider call(s), ${row.verdict ?? "no result"}\n`);
  await writeFile(path.join(outputDir, "measurement.json"), `${JSON.stringify({ schemaVersion: "0.1", measuredAt: new Date().toISOString(), rows }, null, 2)}\n`);
}

const table = measurementTable(rows);
await writeFile(path.join(outputDir, "measurement.txt"), `${table}\n`);
process.stdout.write(`${table}\n`);
process.stdout.write(`\nwritten to ${path.relative(repositoryRoot, outputDir)}\n`);

const held = rows.filter(conditionHeld).length;
process.stdout.write(`${held}/${rows.length} condition(s) absorbed as declared, for ${rows.reduce((sum, row) => sum + row.providerCalls, 0)} provider call(s) in total\n`);
process.exitCode = held === rows.length ? 0 : 1;

/** The run directory the Lab printed, absolute, or `null` when it printed none. */
function runDirectoryOf(stdout) {
  for (const line of String(stdout ?? "").split(/\r?\n/u).reverse()) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const value = JSON.parse(line);
      if (value && typeof value.path === "string" && typeof value.runId === "string") return path.resolve(repositoryRoot, value.path);
    } catch { /* best-effort: the Lab prints many lines and only one of them is its run result, so a line that does not parse is simply not it */ }
  }
  return null;
}
