#!/usr/bin/env node
// The Lab launcher: build, then run, with every output an instance owns.
//
// `pnpm lab` and `pnpm lab:interactive` both come through here. The build
// phase is serialized across instances by one repository-wide lock; the run
// phase is not, so N instances build one after another and then run at the
// same time.
//
// With FLUXIQ_LAB_INSTANCE set, the extension bundle, the scenario lab bundle,
// and the web panel host are built into `.lab-instances/<instance>/` and the
// absolute paths are handed to the runner in its environment. Without it every
// path is the one it has always been.

import { spawn } from "node:child_process";
import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { withBuildLock } from "./build-lock.mjs";
import { coreOutputChange, coreRepositoryRoot, DEFAULT_QUIET_MS, DEFAULT_WAIT_TIMEOUT_MS, scanCoreOutput, waitForQuietCoreOutput } from "./core/index.mjs";
import { coreBuildMissing, coreBuildStaleness, scanCoreBuildEntries } from "./core/index.mjs";
import { repositoryBuilds, staleRepositoryBuild } from "./domain-build-staleness.mjs";
import { coreCommitStaleness, readCoreCommit } from "./core/index.mjs";
import { scanCoreSources } from "./core/index.mjs";
import { labInvocationEnvironment } from "./lab-invocation.mjs";
import { repositoryRoot, resolveLabInstancePaths } from "./lab-instance.mjs";
import { admitLiveRun, formatRefusals, recordLiveRunFinish, recordLiveRunStart } from "./live-guards/index.mjs";
import { createStepTimer, runBuildPhase } from "./prelude/index.mjs";
import { buildOrder, runStep } from "../build-cache/index.mjs";

const args = process.argv.slice(2);
const interactive = args[0] === "interactive";
const paths = resolveLabInstancePaths(process.env);
const instanced = paths.instance !== null;

// Subcommands that read what a past run wrote. They load no FluxIQ Core, so
// they neither wait for Core nor report a change in it.
const READ_ONLY_COMMANDS = new Set(["inspect", "compare", "auth", "clone-cache"]);
const loadsCore = !READ_ONLY_COMMANDS.has(args[0] ?? "");
const timer = createStepTimer(note);

// The live-run waste guards, asked before anything else a live run does: an
// empty provider balance, a relaunch loop, an undebugged previous
// run, or a rerun of a failed task on unchanged source is refused here, before
// Core is waited on, before the build and before any provider call. On
// 2026-09-30 launcher loops with no agent watching spent $4.25 on 47 runs that
// fixed nothing and fired about 1,050 more against an empty balance; a rule in
// a note did not stop them. There is no flag past a refusal, only a file the
// user creates (docs/architecture/testing-facility.md, "Live-run waste guards").
const liveAdmission = await admitLiveRunOrExit();

/** The Core scan this run started from; `null` when the run does not load Core. */
let coreBefore = null;
if (loadsCore) {
  const coreRoot = coreRepositoryRoot(process.env, repositoryRoot);

  // Asked before the quiescence wait, which can hold a run for ten minutes:
  // a Core on the wrong COMMIT is wrong however quiet and however well built
  // it is, and waiting to say so wastes the one thing this check saves.
  //
  // This is the Lab's question rather than `pnpm task`'s, although `pnpm task
  // sync-core` is what fixes it. A worktree's Core is right when the worktree
  // is opened and goes wrong later, when Core's `dev` moves and this
  // repository's `dev` moves with it; `pnpm task` does not run again in
  // between, so a refusal there cannot catch the case that actually happens.
  // The Lab entry point does run, immediately before Core is loaded, and it
  // already asks the other two questions about the Core it is about to use.
  //
  // It refuses rather than warns because a warning is what this failure
  // already had: three worktree runs printed their way to "environment.missing"
  // and were written off as an undiagnosed worktree fault.
  const commit = await timer.time("core-commit", () => readCoreCommit(coreRoot, process.env.FLUXIQ_LAB_CORE_BRANCH?.trim() || "dev"));
  const behind = commit === null ? { stale: false } : coreCommitStaleness(commit);
  if (behind.stale) {
    note({ lab: "core-commit", state: "behind", root: coreRoot, behind: behind.behind, head: commit.head, target: commit.target, why: behind.message });
    if (process.env.FLUXIQ_LAB_ALLOW_BEHIND_CORE !== "1") {
      process.stderr.write(`${behind.message}
Set FLUXIQ_LAB_ALLOW_BEHIND_CORE=1 to run against it anyway.
`);
      process.exit(1);
    }
    note({ lab: "core-commit", state: "behind-allowed", why: "FLUXIQ_LAB_ALLOW_BEHIND_CORE=1 was set, so this run proceeds against a Core behind the branch it is measured from." });
  }

  const quietMs = positiveInteger(process.env.FLUXIQ_LAB_CORE_QUIET_MS, DEFAULT_QUIET_MS);
  const timeoutMs = positiveInteger(process.env.FLUXIQ_LAB_CORE_WAIT_TIMEOUT_MS, DEFAULT_WAIT_TIMEOUT_MS);
  const guard = await timer.time("core-quiet", () => waitForQuietCoreOutput(coreRoot, {
    quietMs, timeoutMs,
    onWait: (scan, quiet) => note({ lab: "core-build", state: "waiting", root: scan.root, files: scan.files, newest: iso(scan.newestMs), newestPath: scan.newestPath, quietMs: quiet, timeoutMs, why: "FluxIQ Core's build output was written moments ago; a rebuild underneath a run deletes modules the run imports" }),
  }));
  coreBefore = guard.scan;
  note({ lab: "core-build", state: guard.status, root: guard.scan.root, files: guard.scan.files, newest: iso(guard.scan.newestMs), waitedMs: guard.waitedMs });
  if (guard.status === "timed-out") {
    note({ lab: "core-build", state: "proceeding-anyway", why: `FluxIQ Core's build output was still changing after ${Math.round(timeoutMs / 1000)}s. Running regardless; if this run fails on a missing module under ${guard.scan.root}, that is why.` });
  }

  // Neither the quiescence guard above nor the staleness guard below can see a
  // Core that was never built: an absent `dist` is not changing, and it is not
  // older than its source. A fresh checkout used to pass all three guards and
  // die inside the run on a missing module, recorded as a product failure.
  //
  // Asked after the quiescence wait, so a Core caught mid-rebuild -- a clean
  // empties `dist` before the build refills it -- is waited out rather than
  // refused. It has no override, unlike the others: a stale or behind Core
  // still runs and measures something, while a Core missing its entry points
  // can only fail on "Cannot find module". The refusal is a setup failure and
  // is reported as one, before anything runs; `failure: "setup"` says so to a
  // reader of these lines, and the campaign already reads a `why` followed by a
  // non-zero exit as a task that never started rather than a product result.
  const built = coreBuildMissing(await timer.time("core-entries", () => scanCoreBuildEntries(coreRoot)));
  if (!built.built) {
    note({ lab: "core-build", state: built.state, failure: "setup", root: coreRoot, missing: built.missing, command: built.command, why: built.message });
    process.stderr.write(`${built.message}
`);
    process.exit(1);
  }

  // The quiescence guard above asks whether Core is changing under this run. It
  // cannot see the opposite problem: a Core whose build is OLDER than its
  // source, which looks quieter than a fresh one. The Lab runs Core's compiled
  // output, so that run tests the previous build and reports the answer as the
  // product's. On 2026-09-17 that cost three campaign slices -- thirty live
  // tasks, zero provider calls -- against a ceiling that had been raised in
  // source hours earlier.
  const staleness = coreBuildStaleness(await timer.time("core-staleness", () => scanCoreSources(coreRoot)), guard.scan);
  if (staleness.stale) {
    note({ lab: "core-build", state: "stale", root: coreRoot, behindMs: staleness.behindMs, why: staleness.message });
    if (process.env.FLUXIQ_LAB_ALLOW_STALE_CORE !== "1") {
      process.stderr.write(`${staleness.message}
Rebuild with: pnpm --filter fluxiq build (in ${coreRoot}). Set FLUXIQ_LAB_ALLOW_STALE_CORE=1 to run anyway.
`);
      process.exit(1);
    }
    note({ lab: "core-build", state: "stale-allowed", why: "FLUXIQ_LAB_ALLOW_STALE_CORE=1 was set, so this run proceeds against a build older than Core's source." });
  }
}

const buildEnvironment = {
  ...process.env,
  FLUXIQ_LAB_EXTENSION_BUILD_ROOT: paths.extensionBuildRoot,
  FLUXIQ_LAB_SCENARIO_OUT_DIR: paths.scenarioOutDir
};

// Every build the run loads, through the build cache: a step whose inputs and
// outputs are unchanged since its last successful build is reused without
// spawning anything, and the rest are rebuilt (`prelude/build-phase.mjs`).
try {
  await timer.time("build-lock", () => withBuildLock(paths.buildLockPath, () => runBuildPhase({
    interactive, instanced, env: buildEnvironment, runStep, buildOrder, timer, note,
    copyHostModule: async () => {
      await mkdir(path.dirname(paths.hostModule), { recursive: true });
      await copyFile(paths.sharedHostModule, paths.hostModule);
    }
  }), { onWait: owner => process.stderr.write(`[lab] waiting for the build lock held by process ${owner.pid}\n`) }));
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: "failed", category: "environment.missing", message: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
}

// The question Core's staleness guard asks, asked of this repository's own two
// builds, which a run loads exactly as it loads Core's: `domain/dist` for the
// web domain's nodes and rejections, and the extension's `dist/e2e-chromium`
// for what the browser runs.
//
// It cost two runs on 2026-09-26, both after Core was rebuilt and the domain
// was not: `run-muhp2yip-3a0f198b` hung for 675 s on its first provider call
// and produced nothing, and `run-muhs8hx3-6fd929e6` came back HTTP 400 on its
// build. Neither was a product result, neither said why, and the first was
// diagnosed wrongly before the second showed the pattern. Core's guard had
// existed for nine days; this side had none.
//
// Asked after the build phase, not before it. Before it, an edited domain was
// refused although the next step would have rebuilt it. After it, every output
// is either freshly built or, on a reuse, touched to now, so a stale answer
// means a source was edited while the prelude was building it.
{
  const stale = await timer.time("repository-staleness", () => staleRepositoryBuild(repositoryBuilds(repositoryRoot, paths.extensionBuildRoot)));
  if (stale) {
    note({ lab: "repository-build", state: "stale", build: stale.name, behindMs: stale.behindMs, why: stale.message });
    if (process.env.FLUXIQ_LAB_ALLOW_STALE_BUILD !== "1") {
      process.stderr.write(`${stale.message}
A source changed while the Lab was building it; run again, or rebuild with: ${stale.rebuild}. Set FLUXIQ_LAB_ALLOW_STALE_BUILD=1 to run anyway.
`);
      process.exit(1);
    }
    note({ lab: "repository-build", state: "stale-allowed", build: stale.name, why: "FLUXIQ_LAB_ALLOW_STALE_BUILD=1 was set, so this run proceeds against a build older than its source." });
  }
}

const runEnvironment = {
  ...process.env,
  // How this run was started, for its manifest: the argv after the script and the FLUXIQ_ names the person set, never a value.
  ...labInvocationEnvironment(args, process.env),
  FLUXIQ_LAB_EXTENSION_PATH: paths.extensionPath,
  FLUXIQ_LAB_SCENARIO_ENTRYPOINT: paths.scenarioEntrypoint,
  ...(instanced ? { FLUXIQ_LAB_HOST_MODULE: paths.hostModule } : {})
};
process.stderr.write(`${JSON.stringify({ lab: "paths", instance: paths.instance, extensionPath: paths.extensionPath, scenarioEntrypoint: paths.scenarioEntrypoint, hostModule: paths.hostModule, runsDirectory: process.env.FLUXIQ_TEST_RUNS_DIR ?? null })}\n`);

timer.finish();
const liveStart = liveAdmission === null ? null : await recordLiveRunStart(liveAdmission);
process.exitCode = await run("node", [path.join(repositoryRoot, "packages", "test-runner", "dist", "cli.js"), ...args], runEnvironment, { tolerateFailure: true });
if (liveStart !== null) await recordLiveFinish(liveAdmission, liveStart, process.exitCode);

// The race this catches is the one the guard above cannot prevent: Core was
// quiet when the run started and was rebuilt while it was in flight. Saying so
// here is the difference between a ten-minute mtime investigation and a
// glance, so it is reported whatever the exit status -- a run that overlapped
// a Core rebuild measured a moving target even when it passed.
if (coreBefore !== null) {
  const change = coreOutputChange(coreBefore, await scanCoreOutput(coreBefore.root));
  if (change !== null) {
    note({
      lab: "core-build", state: "changed-during-run", root: change.after.root,
      newestBefore: iso(change.before.newestMs), newestAfter: iso(change.after.newestMs),
      filesBefore: change.before.files, filesAfter: change.after.files, fileDelta: change.fileDelta,
      newestPath: change.after.newestPath, exitCode: process.exitCode,
      why: process.exitCode === 0
        ? "FluxIQ Core was rebuilt while this run was in flight. The run passed, but it did not load one fixed Core."
        : "FluxIQ Core was rebuilt while this run was in flight. A cross-repository build race is the first thing to rule out before treating this failure as a product defect.",
    });
  }
}

/**
 * Admits a live run or exits, refused, having spent nothing. Returns null for
 * an invocation that makes no provider call.
 */
async function admitLiveRunOrExit() {
  let admission;
  try {
    admission = await admitLiveRun({ args, env: process.env, repositoryRoot, coreRoot: coreRepositoryRoot(process.env, repositoryRoot) });
  } catch (error) {
    // Fail closed: a guard that cannot read its ledger or fingerprint the tree
    // does not guess that the run is allowed.
    admission = { refusals: [{ rule: "guard-error", why: `the live-run guards could not be evaluated: ${error instanceof Error ? error.message : String(error)}`, remedy: "Fix the file or checkout the message names, then run again." }] };
  }
  if (admission === null) return null;
  if (admission.refusals.length > 0) {
    const refusal = formatRefusals(admission.refusals);
    process.stderr.write(refusal.text);
    process.stderr.write(refusal.line);
    process.exit(1);
  }
  note({ lab: "live-guard", state: "admitted", instance: admission.launch.instance, task: admission.launch.task, fingerprint: admission.launch.fingerprint, ...(admission.overridden.length === 0 ? {} : { overridden: admission.overridden, why: "an OVERRIDE-<rule> file the user created let this run past those rules" }) });
  return admission;
}

/** Records a finished live run in the spend ledger, and says so when it stopped all live runs. */
async function recordLiveFinish(admission, start, exitCode) {
  try {
    const { finishes, stopped } = await recordLiveRunFinish(admission, start, { exitCode });
    note({ lab: "live-guard", state: "recorded", runs: finishes.map((finish) => ({ runId: finish.runId, verdict: finish.verdict, totalEstimatedCostUsd: finish.totalEstimatedCostUsd, buildCeilingUsd: finish.buildCeilingUsd, maxBuildCostUsd: finish.maxBuildCostUsd, buildsOverCeiling: finish.buildsOverCeiling })) });
    if (stopped !== null) {
      note({ lab: "live-guard", state: "stopped", file: stopped, why: "the provider reported an empty balance or exhausted quota; every live run is refused until a person tops the account up and deletes this file" });
    }
  } catch (error) {
    // The run already happened; the next admission reconciles an unfinished
    // start from the run directory, so this is reported rather than fatal.
    note({ lab: "live-guard", state: "finish-unrecorded", why: `the spend ledger could not record this run (${error instanceof Error ? error.message : String(error)}); the next live admission reconciles it` });
  }
}

/** @param {Record<string, unknown>} line */
function note(line) { process.stderr.write(`${JSON.stringify(line)}
`); }

/** @param {string | undefined} value @param {number} fallback */
function positiveInteger(value, fallback) {
  const parsed = Number(value?.trim());
  return value !== undefined && value.trim() !== "" && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

/** @param {number} ms */
function iso(ms) { return ms > 0 ? new Date(ms).toISOString() : null; }

/**
 * Runs one child to completion, inheriting this process's streams.
 *
 * @param {"node"} command
 * @param {string[]} commandArgs
 * @param {NodeJS.ProcessEnv} env
 * @param {{ tolerateFailure?: boolean }} [options]
 * @returns {Promise<number>}
 */
function run(command, commandArgs, env, options = {}) {
  const child = spawn(process.execPath, commandArgs, { cwd: repositoryRoot, env, stdio: "inherit" });
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => {
      const status = code ?? (signal ? 1 : 0);
      if (status !== 0 && !options.tolerateFailure) {
        reject(new Error(`${command} ${commandArgs.join(" ")} exited with ${signal ?? status}`));
        return;
      }
      resolve(status);
    });
  });
}
