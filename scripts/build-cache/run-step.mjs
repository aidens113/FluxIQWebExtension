// Runs one step, or reuses a result that `decideStep` proves still stands --
// this tree's own stamp, or another tree's result from the shared store.
//
// In order:
//   1. A current local stamp is a reuse, with no lock taken.
//   2. Otherwise the step's lock is taken (`lock/`). A process that had to wait
//      for another one's run decides again, and normally reuses what that run
//      stamped.
//   3. Unless FLUXIQ_BUILD_FORCE=1, the shared store (`store/`) is asked for an
//      entry under the step's fingerprint. A verified restore is a reuse; an
//      entry that fails verification is discarded and the reason is kept.
//   4. Otherwise the command runs. The stamp is removed first, so a build that
//      is killed or crashes leaves nothing vouching for outputs it may have
//      half-written. After the command:
//        - a failure leaves the step unstamped and returns its exit code;
//        - a success is stamped only when the fingerprint taken again
//          afterwards is the one taken before, because an input that changed
//          while the step ran may or may not be in what it produced;
//        - a success that did not produce a required file fails, since
//          stamping it would let the next run reuse an incomplete output;
//        - a stamped result is offered to the store, which refuses outputs
//          that are not relocatable and says why in the reason.
// A check is a step without outputs, so it is stamped, and stored as a pass
// record, only when it passed. On a reuse the outputs' timestamps move to now
// (`touch-outputs.mjs`). A store that cannot be read or written costs the
// reuse, never the build: its failure is reported in the reason.

import { existsSync } from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { decideStep } from "./decide-step.mjs";
import { fingerprintStep } from "./fingerprint-step.mjs";
import { openStatCache, outputDigest } from "./fingerprint/index.mjs";
import { acquireStepLock } from "./lock/index.mjs";
import { runCommand } from "./run-command.mjs";
import { removeStamp, STAMP_VERSION, writeStamp } from "./stamp/index.mjs";
import { restoreEntry, saveEntry, storeDirectory } from "./store/index.mjs";
import { touchOutputs } from "./touch-outputs.mjs";
import { resolveStep } from "./workspace/index.mjs";

/**
 * @typedef {{ result: "reuse" | "build", step: string, reason: string, ms: number, exitCode: number, source: "stamp" | "store" | "command" }} StepOutcome
 * @typedef {(context: { resolved: ReturnType<typeof resolveStep>, env: NodeJS.ProcessEnv, stdio?: import("node:child_process").StdioOptions }) => Promise<number>} StepRunner
 */

/**
 * @param {string | ReturnType<typeof resolveStep>} step a registry name, or a step already resolved (a Core library, `resolve-core-library.mjs`)
 * @param {{ repoRoot?: string, env?: NodeJS.ProcessEnv, steps?: object, stdio?: import("node:child_process").StdioOptions, run?: StepRunner, lock?: Parameters<typeof acquireStepLock>[1] }} [options]
 *   `run` replaces running the step's command in its package directory and resolves to its exit code
 * @returns {Promise<StepOutcome>}
 */
export async function runStep(step, options = {}) {
  const started = performance.now();
  const env = options.env ?? process.env;
  const resolved = typeof step === "string" ? resolveStep(step, options) : step;
  const statCache = await openStatCache(resolved.statCachePath);
  const finish = (result, reason, exitCode, source) => ({ result, step: resolved.name, reason, ms: Math.round(performance.now() - started), exitCode, source });
  try {
    const first = await decideStep(resolved, { ...options, statCache });
    if (first.decision === "reuse") {
      await touchOutputs(resolved);
      return finish("reuse", first.reason, 0, "stamp");
    }
    const lock = await acquireStepLock(`${resolved.stampPath}.lock`, options.lock);
    try {
      return await runLocked(resolved, first, lock, { ...options, env, statCache, finish });
    } finally {
      await lock.release();
    }
  } finally {
    await statCache.save();
  }
}

async function runLocked(resolved, first, lock, options) {
  const { env, statCache, finish } = options;
  let decision = first;
  let waited = "";
  if (lock.waitedMs > 0) {
    waited = `waited ${(lock.waitedMs / 1000).toFixed(1)}s for pid ${lock.heldBy}'s run of this step, then `;
    decision = await decideStep(resolved, { ...options, statCache });
    if (decision.decision === "reuse") {
      await touchOutputs(resolved);
      return finish("reuse", `${waited}${decision.reason}`, 0, "stamp");
    }
  }

  const storeDir = storeDirectory(env);
  const forced = env.FLUXIQ_BUILD_FORCE === "1";
  let storeNote = "";
  if (storeDir !== null && !forced) {
    try {
      const restored = await restoreEntry(storeDir, resolved, decision, statCache);
      if (restored.restored) return finish("reuse", `${waited}restored from the shared store (${decision.reason})`, 0, "store");
      if (restored.reason !== null) storeNote = `; ${restored.reason}`;
    } catch (error) {
      storeNote = `; the shared store could not be read (${error?.message ?? error})`;
    }
  }
  const reason = `${waited}${decision.reason}${storeNote}`;

  await removeStamp(resolved.stampPath);
  const run = options.run ?? (({ env: runEnv, stdio }) => runCommand(resolved.command, { cwd: resolved.packageDir, repoRoot: resolved.repoRoot, env: runEnv, stdio }));
  const exitCode = await run({ resolved, env, stdio: options.stdio });
  if (exitCode !== 0) {
    await removeStamp(resolved.stampPath);
    return finish("build", `${reason}; the command failed with exit code ${exitCode}, so it is not stamped`, exitCode, "command");
  }

  const after = await fingerprintStep(resolved, { statCache });
  if (after.fingerprint !== decision.fingerprint) {
    const moved = Object.keys(after.roots).filter((label) => after.roots[label] !== decision.roots[label]);
    return finish("build", `${reason}; not stamped, because inputs changed while it ran (${moved.join(", ") || "step metadata"})`, 0, "command");
  }
  const missing = resolved.required.find((file) => !existsSync(file));
  if (missing !== undefined) {
    const shown = path.relative(resolved.repoRoot, missing).split(path.sep).join("/");
    return finish("build", `${reason}; the command succeeded but did not produce ${shown}, so it is not stamped`, 1, "command");
  }
  const digest = await outputDigest(resolved, statCache);
  await writeStamp(resolved.stampPath, { version: STAMP_VERSION, step: resolved.name, fingerprint: decision.fingerprint, outputDigest: digest, roots: decision.roots });
  if (storeDir === null) return finish("build", reason, 0, "command");
  let stored;
  try {
    stored = (await saveEntry(storeDir, resolved, { fingerprint: decision.fingerprint, outputDigest: digest })).reason;
  } catch (error) {
    stored = `not stored: the shared store could not be written (${error?.message ?? error})`;
  }
  return finish("build", `${reason}; ${stored}`, 0, "command");
}
