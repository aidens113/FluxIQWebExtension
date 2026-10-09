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
//
// A run killed before `finalize` renamed it is still a `.staging-run-*`
// directory. It is read as that run, `verdict: "killed"`, with the cost and
// balance failure its step log proves (`step-log-outcome.mjs`), so its spend
// reaches the ledger, an empty balance it hit still stops later launches, and
// the debug rule still asks for its debug. Once its bundle exists, the bundle
// is read instead.
//
// A run that failed on the facility before any provider call never tested the
// product: lane A's `run-mv0fu9uq-107ab0de` timed out on the Lab's own
// `list-flows` read before the instruction was typed, and the `unchanged` rule
// then refused its task on that source as though the product had failed. Such
// a run carries `facilityFailureBeforeProvider`, read from the bundle's
// `evaluation.json` (`facilityFailure`, `llm.calls`) and checked against its
// step log, which must hold no provider call either. Anything less certain --
// no evaluation, a call count it did not record, a step log with a call --
// leaves the field null, and the run counts as it always did.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { perBuildSpend } from "../live-campaign/row/index.mjs";
import { detectBalanceFailure } from "./balance-failure.mjs";
import { readStepLogOutcome } from "./step-log-outcome.mjs";

const RUN_DIRECTORY = /^run-([a-z0-9]+)-[0-9a-f]{8}$/u;
const STAGING_DIRECTORY = /^\.staging-(run-([a-z0-9]+)-[0-9a-f]{8})$/u;
/** The verdict of a run whose process died before its bundle was finalized. */
const KILLED_VERDICT = "killed";
// Clock skew between this process's `Date.now()` and the runner's timestamps.
const SKEW_MS = 5_000;

/**
 * @typedef {{ stage: string, reason: string, endpoint?: string }} FacilityFailureBeforeProvider
 * @typedef {{ runId: string, startedAt: string | null, verdict: string | null, totalEstimatedCostUsd: number | null, buildCeilingUsd: number | null, maxBuildCostUsd: number | null, buildsOverCeiling: number | null, balanceFailure: ReturnType<typeof detectBalanceFailure>, facilityFailureBeforeProvider: FacilityFailureBeforeProvider | null, killed?: true }} RunOutcome
 */

/**
 * @param {string} runsDirectory
 * @param {{ sinceMs: number, knownRunIds: Set<string>, labRunsDirectory?: string | null }} options
 *   `labRunsDirectory`: the machine-wide `lab-runs/`, where a killed run's step log is read
 * @returns {Promise<RunOutcome[]>} oldest first
 */
export async function readRunOutcomes(runsDirectory, { sinceMs, knownRunIds, labRunsDirectory = null }) {
  let names;
  try {
    names = await readdir(runsDirectory);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const outcomes = [];
  const finalized = new Set(names.filter((name) => RUN_DIRECTORY.test(name)));
  for (const name of names) {
    const staged = STAGING_DIRECTORY.exec(name);
    if (staged !== null) {
      const runId = staged[1];
      const startMs = parseInt(staged[2], 36);
      if (finalized.has(runId) || knownRunIds.has(runId) || !(startMs >= sinceMs - SKEW_MS)) continue;
      if (!(await stat(path.join(runsDirectory, name))).isDirectory()) continue;
      outcomes.push(await killedOutcome(runId, startMs, labRunsDirectory));
      continue;
    }
    const named = RUN_DIRECTORY.exec(name);
    if (named === null || knownRunIds.has(name) || !(parseInt(named[1], 36) >= sinceMs - SKEW_MS)) continue;
    const directory = path.join(runsDirectory, name);
    if (!(await stat(directory)).isDirectory()) continue;
    const run = await readJson(path.join(directory, "run.json"));
    const startedAt = typeof run?.startedAt === "string" ? run.startedAt : new Date(parseInt(named[1], 36)).toISOString();
    const liveLlm = await readJson(path.join(directory, "snapshots", "live-llm.json"));
    const failures = await readJson(path.join(directory, "provider-failures.local.json"));
    const verdict = typeof run?.verdict === "string" ? run.verdict : typeof run?.status === "string" ? run.status : null;
    outcomes.push({
      runId: name,
      startedAt,
      verdict,
      totalEstimatedCostUsd: costOf(liveLlm),
      ...perBuildOf(liveLlm),
      balanceFailure: failures === null ? null : detectBalanceFailure(failures),
      facilityFailureBeforeProvider: verdict === "passed" ? null : await facilityFailureBeforeProvider(directory, name, liveLlm, labRunsDirectory),
    });
  }
  return outcomes.sort((left, right) => String(left.startedAt).localeCompare(String(right.startedAt)));
}

/** A run killed before its bundle was finalized: what its step log proves it spent, or an unknown cost when it has none. */
async function killedOutcome(runId, startMs, labRunsDirectory) {
  const logged = labRunsDirectory === null ? null : await readStepLogOutcome(labRunsDirectory, runId);
  return {
    runId,
    startedAt: new Date(startMs).toISOString(),
    verdict: KILLED_VERDICT,
    totalEstimatedCostUsd: logged?.totalEstimatedCostUsd ?? null,
    buildCeilingUsd: null,
    maxBuildCostUsd: null,
    buildsOverCeiling: null,
    balanceFailure: logged?.balanceFailure ?? null,
    facilityFailureBeforeProvider: null,
    killed: true,
  };
}

/** The run's spend per build against its ceiling, or nulls where it recorded no ceiling. */
function perBuildOf(liveLlm) {
  const spend = perBuildSpend(liveLlm?.unreadable ? null : liveLlm, null);
  return spend === null
    ? { buildCeilingUsd: null, maxBuildCostUsd: null, buildsOverCeiling: null }
    : { buildCeilingUsd: spend.ceilingUsd, maxBuildCostUsd: spend.maxBuildCostUsd, buildsOverCeiling: spend.overCeiling };
}

const CODE = /^[A-Za-z0-9._-]{1,64}$/u;
const ENDPOINT = /^\/api\/[a-z0-9/-]{1,120}$/u;

/**
 * The facility failure a finalized run ended on, when it is certain no
 * provider call was made: the evaluation names a facility failure and counts
 * zero model calls, the run recorded no cost, and its step log, when it has
 * one, holds no provider call. Only the diagnostic's closed codes are kept.
 */
async function facilityFailureBeforeProvider(directory, runId, liveLlm, labRunsDirectory) {
  const evaluation = await readJson(path.join(directory, "evaluation.json"));
  const facility = evaluation?.facilityFailure;
  if (facility === null || typeof facility !== "object") return null;
  if (evaluation.llm?.calls !== 0) return null;
  const cost = costOf(liveLlm);
  if (cost !== null && cost !== 0) return null;
  const logged = labRunsDirectory === null ? null : await readStepLogOutcome(labRunsDirectory, runId);
  if (logged !== null && logged.calls !== 0) return null;
  if (typeof facility.stage !== "string" || !CODE.test(facility.stage) || typeof facility.reason !== "string" || !CODE.test(facility.reason)) return null;
  return {
    stage: facility.stage,
    reason: facility.reason,
    ...(typeof facility.endpoint === "string" && ENDPOINT.test(facility.endpoint) ? { endpoint: facility.endpoint } : {}),
  };
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
