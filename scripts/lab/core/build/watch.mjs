// Watching FluxIQ Core's build output from outside FluxIQ Core's checkout.
//
// Every Lab run loads FluxIQ Core from the sibling `F:\!FluxIQ` checkout: the
// isolated web workspace junctions Core's `packages` into place, the host
// bundle imports `fluxiq/automation-studio`, and the runner itself imports
// `fluxiq`. Core's build cleans and re-emits `dist`, so a rebuild started
// while a run is in flight deletes files the run is about to import. That is
// not hypothetical: a four-run bench died in under a second on "Cannot find
// module 'F:\!FluxIQ\packages\fluxiq\node_modules\@fluxiq\contracts\dist\automation-studio.js'",
// and that file's mtime was eight minutes after the failure, inside a burst of
// 1988 rewritten files. The Lab's build lock is repository-wide and could not
// have helped: it serializes builds inside *this* repository.
//
// Three guards were considered.
//
// 1. A lock file inside the Core checkout. It is the only one that would
//    prevent the race outright, and it is the wrong trade. A bench runs for
//    thirty minutes to two hours and a Core build takes one to three, so a Lab
//    run holding a Core lock blocks a developer's build for the length of the
//    bench. It also only works if Core's own build takes the lock, which means
//    changing a repository this one does not own, for a guard that repository
//    gets nothing from.
// 2. Snapshotting or pinning what the run loads. The run does not load Core
//    from `dist` alone -- Next builds Core's *source* through a junction to
//    `packages/` -- so pinning means copying the whole checkout per run, and
//    what it buys is a run that silently tests a stale Core. That is the same
//    failure the per-instance extension build reasoning already rejected.
// 3. What this module does: check Core is quiescent before starting, wait a
//    bounded time if it is not, and afterwards detect that Core's output moved
//    while the run was in flight. It writes nothing into `F:\!FluxIQ`, costs
//    one directory walk (2144 files in 87 ms on this machine), and converts a
//    silent loss into either a short wait or a named cause.
//
// It deliberately does not refuse to run. A developer editing Core would find
// a Lab that refuses to start worse than the race, and the requirement is that
// the loss stop being silent, not that the run be forbidden.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

/** Core must have been untouched this long before a run starts. */
export const DEFAULT_QUIET_MS = 30_000;
/** How long to wait for that quiet before giving up and running anyway, loudly. */
export const DEFAULT_WAIT_TIMEOUT_MS = 10 * 60_000;
/** A walk that finds more files than this is not Core's build output; stop rather than crawl. */
const MAX_FILES = 100_000;

/**
 * Where FluxIQ Core is, resolved exactly as the runner CLI resolves it, so the
 * directory watched here is the one the run will load.
 *
 * @param {NodeJS.ProcessEnv} env
 * @param {string} root this repository's root
 * @returns {string}
 */
export function coreRepositoryRoot(env, root) {
  const declared = env.FLUXIQ_CORE_ROOT?.trim();
  return declared ? path.resolve(declared) : path.resolve(root, "..", "!FluxIQ");
}

/**
 * @typedef {{ root: string; files: number; newestMs: number; newestPath: string | null }} CoreOutputScan
 */

/**
 * Walks every `<core root>/packages/<package>/dist` and reports how many files
 * are there and which was written most recently.
 *
 * Only the built output, and only one level of packages: `node_modules` is not
 * entered (Core's `@fluxiq/*` entries there link back into these same `dist`
 * directories), and Core's sources are not watched, because a developer
 * editing a source file is not the race this guards.
 *
 * @param {string} coreRoot
 * @returns {Promise<CoreOutputScan>}
 */
export async function scanCoreOutput(coreRoot) {
  /** @type {CoreOutputScan} */
  const scan = { root: coreRoot, files: 0, newestMs: 0, newestPath: null };
  let packages;
  try {
    packages = await readdir(path.join(coreRoot, "packages"), { withFileTypes: true });
  } catch {
    return scan;
  }
  for (const entry of packages) {
    if (!entry.isDirectory()) continue;
    await walk(path.join(coreRoot, "packages", entry.name, "dist"), scan);
  }
  return scan;
}

/**
 * @param {string} directory
 * @param {CoreOutputScan} scan
 */
async function walk(directory, scan) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (scan.files >= MAX_FILES) return;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await walk(target, scan);
      continue;
    }
    if (!entry.isFile()) continue;
    scan.files += 1;
    let stats;
    try {
      stats = await stat(target);
    } catch {
      // A file that vanished between readdir and stat is itself a rebuild in
      // progress; the count already recorded it and the next scan will see it.
      continue;
    }
    if (stats.mtimeMs > scan.newestMs) {
      scan.newestMs = stats.mtimeMs;
      scan.newestPath = target;
    }
  }
}

/**
 * Waits until Core's build output has been untouched for `quietMs`, then
 * returns the scan a later `coreOutputChange` compares against.
 *
 * `absent` means no Core build output was found, so there is nothing to guard
 * and nothing to wait for. `disabled` means the caller set `quietMs` to 0.
 * `timed-out` means Core was still moving after `timeoutMs`; the caller runs
 * anyway and says so.
 *
 * @param {string} coreRoot
 * @param {{ quietMs?: number; timeoutMs?: number; pollMs?: number; now?: () => number; sleep?: (ms: number) => Promise<void>; scan?: (root: string) => Promise<CoreOutputScan>; onWait?: (scan: CoreOutputScan, quietMs: number) => void }} [options]
 * @returns {Promise<{ status: "quiet" | "absent" | "disabled" | "timed-out"; scan: CoreOutputScan; waitedMs: number }>}
 */
export async function waitForQuietCoreOutput(coreRoot, options = {}) {
  const quietMs = options.quietMs ?? DEFAULT_QUIET_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_WAIT_TIMEOUT_MS;
  const pollMs = options.pollMs ?? 2_000;
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? (ms => new Promise(resolve => setTimeout(resolve, ms)));
  const scanOutput = options.scan ?? scanCoreOutput;
  const startedAt = now();
  let announced = false;
  for (;;) {
    const scan = await scanOutput(coreRoot);
    const waitedMs = now() - startedAt;
    if (scan.files === 0) return { status: "absent", scan, waitedMs };
    if (quietMs <= 0) return { status: "disabled", scan, waitedMs };
    if (now() - scan.newestMs >= quietMs) return { status: "quiet", scan, waitedMs };
    if (waitedMs >= timeoutMs) return { status: "timed-out", scan, waitedMs };
    if (!announced) {
      announced = true;
      options.onWait?.(scan, quietMs);
    }
    await sleep(pollMs);
  }
}

/**
 * Whether Core's build output moved between two scans, and by how much.
 *
 * Both a newer mtime and a changed file count count as movement: a clean
 * deletes before it emits, and during that window the newest file left can be
 * older than the newest file was.
 *
 * @param {CoreOutputScan} before
 * @param {CoreOutputScan} after
 * @returns {{ before: CoreOutputScan; after: CoreOutputScan; fileDelta: number } | null}
 */
export function coreOutputChange(before, after) {
  if (before.files === 0 || after.files === 0) return null;
  if (before.newestMs === after.newestMs && before.files === after.files) return null;
  return { before, after, fileDelta: after.files - before.files };
}
