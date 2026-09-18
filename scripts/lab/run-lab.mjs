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
import { coreBuildStaleness } from "./core/index.mjs";
import { scanCoreSources } from "./core/index.mjs";
import { repositoryRoot, resolveLabInstancePaths } from "./lab-instance.mjs";

const args = process.argv.slice(2);
const interactive = args[0] === "interactive";
const paths = resolveLabInstancePaths(process.env);
const instanced = paths.instance !== null;

// Subcommands that read what a past run wrote. They load no FluxIQ Core, so
// they neither wait for Core nor report a change in it.
const READ_ONLY_COMMANDS = new Set(["inspect", "compare", "auth", "clone-cache"]);
const loadsCore = !READ_ONLY_COMMANDS.has(args[0] ?? "");

/** The Core scan this run started from; `null` when the run does not load Core. */
let coreBefore = null;
if (loadsCore) {
  const coreRoot = coreRepositoryRoot(process.env, repositoryRoot);
  const quietMs = positiveInteger(process.env.FLUXIQ_LAB_CORE_QUIET_MS, DEFAULT_QUIET_MS);
  const timeoutMs = positiveInteger(process.env.FLUXIQ_LAB_CORE_WAIT_TIMEOUT_MS, DEFAULT_WAIT_TIMEOUT_MS);
  const guard = await waitForQuietCoreOutput(coreRoot, {
    quietMs, timeoutMs,
    onWait: (scan, quiet) => note({ lab: "core-build", state: "waiting", root: scan.root, files: scan.files, newest: iso(scan.newestMs), newestPath: scan.newestPath, quietMs: quiet, timeoutMs, why: "FluxIQ Core's build output was written moments ago; a rebuild underneath a run deletes modules the run imports" }),
  });
  coreBefore = guard.scan;
  note({ lab: "core-build", state: guard.status, root: guard.scan.root, files: guard.scan.files, newest: iso(guard.scan.newestMs), waitedMs: guard.waitedMs });
  if (guard.status === "timed-out") {
    note({ lab: "core-build", state: "proceeding-anyway", why: `FluxIQ Core's build output was still changing after ${Math.round(timeoutMs / 1000)}s. Running regardless; if this run fails on a missing module under ${guard.scan.root}, that is why.` });
  }

  // The quiescence guard above asks whether Core is changing under this run. It
  // cannot see the opposite problem: a Core whose build is OLDER than its
  // source, which looks quieter than a fresh one. The Lab runs Core's compiled
  // output, so that run tests the previous build and reports the answer as the
  // product's. On 2026-09-17 that cost three campaign slices -- thirty live
  // tasks, zero provider calls -- against a ceiling that had been raised in
  // source hours earlier.
  const staleness = coreBuildStaleness(await scanCoreSources(coreRoot), guard.scan);
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

try {
  await withBuildLock(paths.buildLockPath, async () => {
    await run("pnpm", ["--filter", "@fluxiq-web-extension/scenario-lab", "build"], buildEnvironment);
    await run("pnpm", ["--filter", "@fluxiq-web-extension/extension", "test:e2e:build"], buildEnvironment);
    // The host bundle is built before the workspace build, whose domain step
    // deletes only `tsc` output and deliberately keeps `dist/host/`.
    if (interactive || instanced) await run("pnpm", ["--filter", "@fluxiq-web-extension/domain", "host:build"], buildEnvironment);
    await run("pnpm", ["--filter", "@fluxiq-web-extension/test-runner...", "build"], buildEnvironment);
    if (instanced) {
      await mkdir(path.dirname(paths.hostModule), { recursive: true });
      await copyFile(paths.sharedHostModule, paths.hostModule);
    }
  }, { onWait: owner => process.stderr.write(`[lab] waiting for the build lock held by process ${owner.pid}\n`) });
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: "failed", category: "environment.missing", message: error instanceof Error ? error.message : String(error) })}\n`);
  process.exit(1);
}

const runEnvironment = {
  ...process.env,
  FLUXIQ_LAB_EXTENSION_PATH: paths.extensionPath,
  FLUXIQ_LAB_SCENARIO_ENTRYPOINT: paths.scenarioEntrypoint,
  ...(instanced ? { FLUXIQ_LAB_HOST_MODULE: paths.hostModule } : {})
};
process.stderr.write(`${JSON.stringify({ lab: "paths", instance: paths.instance, extensionPath: paths.extensionPath, scenarioEntrypoint: paths.scenarioEntrypoint, hostModule: paths.hostModule, runsDirectory: process.env.FLUXIQ_TEST_RUNS_DIR ?? null })}\n`);

process.exitCode = await run("node", [path.join(repositoryRoot, "packages", "test-runner", "dist", "cli.js"), ...args], runEnvironment, { tolerateFailure: true });

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
 * @param {"pnpm" | "node"} command
 * @param {string[]} commandArgs
 * @param {NodeJS.ProcessEnv} env
 * @param {{ tolerateFailure?: boolean }} [options]
 * @returns {Promise<number>}
 */
function run(command, commandArgs, env, options = {}) {
  const executable = command === "node" ? process.execPath : command;
  const child = spawn(executable, commandArgs, {
    cwd: repositoryRoot,
    env,
    stdio: "inherit",
    shell: command === "pnpm" && process.platform === "win32"
  });
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
