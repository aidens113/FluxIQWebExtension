// What the runs a launch produced cost and ended on, read from their bundles.
//
// A run is a `run-<base36 start time>-<hex>` directory under the runs
// directory (`packages/test-runner/src/run-scenario.ts` names it) that started
// at or after the launch. The start time in the name is what selects it, so
// the thousands of older runs beside it are never opened. Its cost is
// `snapshots/live-llm.json` `observed.totalEstimatedCostUsd`; its balance
// failure, if any, comes from `provider-failures.local.json`. A run that died
// before writing a file has that field null, not zero.
//
// The cost is the run's sum, which a build followed by a repair may rightly
// take past $0.25. What the user's rule bounds is each build, so the outcome
// also carries the run's spend per build against the ceiling it was planned
// under (`perBuildSpend`, the same reading the live campaign's rows use): the
// ceiling, the most any one build spent, and how many builds went past it.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { perBuildSpend } from "../live-campaign/row/index.mjs";
import { detectBalanceFailure } from "./balance-failure.mjs";

const RUN_DIRECTORY = /^run-([a-z0-9]+)-[0-9a-f]{8}$/u;
// Clock skew between this process's `Date.now()` and the runner's timestamps.
const SKEW_MS = 5_000;

/**
 * @typedef {{ runId: string, startedAt: string | null, verdict: string | null, totalEstimatedCostUsd: number | null, buildCeilingUsd: number | null, maxBuildCostUsd: number | null, buildsOverCeiling: number | null, balanceFailure: ReturnType<typeof detectBalanceFailure> }} RunOutcome
 */

/**
 * @param {string} runsDirectory
 * @param {{ sinceMs: number, knownRunIds: Set<string> }} options
 * @returns {Promise<RunOutcome[]>} oldest first
 */
export async function readRunOutcomes(runsDirectory, { sinceMs, knownRunIds }) {
  let names;
  try {
    names = await readdir(runsDirectory);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const outcomes = [];
  for (const name of names) {
    const named = RUN_DIRECTORY.exec(name);
    if (named === null || knownRunIds.has(name) || !(parseInt(named[1], 36) >= sinceMs - SKEW_MS)) continue;
    const directory = path.join(runsDirectory, name);
    if (!(await stat(directory)).isDirectory()) continue;
    const run = await readJson(path.join(directory, "run.json"));
    const startedAt = typeof run?.startedAt === "string" ? run.startedAt : new Date(parseInt(named[1], 36)).toISOString();
    const liveLlm = await readJson(path.join(directory, "snapshots", "live-llm.json"));
    const failures = await readJson(path.join(directory, "provider-failures.local.json"));
    outcomes.push({
      runId: name,
      startedAt,
      verdict: typeof run?.verdict === "string" ? run.verdict : typeof run?.status === "string" ? run.status : null,
      totalEstimatedCostUsd: costOf(liveLlm),
      ...perBuildOf(liveLlm),
      balanceFailure: failures === null ? null : detectBalanceFailure(failures),
    });
  }
  return outcomes.sort((left, right) => String(left.startedAt).localeCompare(String(right.startedAt)));
}

/** The run's spend per build against its ceiling, or nulls where it recorded no ceiling. */
function perBuildOf(liveLlm) {
  const spend = perBuildSpend(liveLlm?.unreadable ? null : liveLlm, null);
  return spend === null
    ? { buildCeilingUsd: null, maxBuildCostUsd: null, buildsOverCeiling: null }
    : { buildCeilingUsd: spend.ceilingUsd, maxBuildCostUsd: spend.maxBuildCostUsd, buildsOverCeiling: spend.overCeiling };
}

function costOf(liveLlm) {
  const total = liveLlm?.observed?.totalEstimatedCostUsd;
  if (typeof total === "number" && Number.isFinite(total)) return total;
  const accounted = liveLlm?.observed?.accounting?.estimatedCostUsd;
  return typeof accounted === "number" && Number.isFinite(accounted) ? accounted : null;
}

async function readJson(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    // A run that died early never wrote this file; that is recorded as unknown.
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    // A run killed mid-write leaves a truncated file. Its fields read as
    // unknown, which the ledger records as null, rather than blocking every
    // later admission on one broken bundle.
    if (error instanceof SyntaxError) return { unreadable: `${file}: ${error.message}` };
    throw error;
  }
}
