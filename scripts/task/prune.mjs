// Reclaiming what the task and Lab lifecycles cannot reclaim themselves.
//
// Three things leak, and none of them is a bug in the thing that made them.
// A label directory under `.test-build-scratch/` or `.lab-instances/` is
// cleared when its own label is reused, so a label nobody uses again is never
// touched. The shared Core beside a flat task worktree is used by every task
// there at once, so no task can know it was the last and remove it. And git's
// worktree registrations outlive a directory deleted by anything other than
// `pnpm task`. Each is the right local behaviour; together they need something
// that runs across the whole picture occasionally, which is this.
//
// All of it is ignored space. Nothing here can lose a commit or an edit,
// because nothing here deletes anything tracked -- but a recursive delete is
// still a recursive delete, so it is guarded twice rather than trusted once:
//
//   Age says the owner is gone. A directory touched within `--days` is left
//   alone even if nothing is running in it, because a worker between two builds
//   still owns its label.
//   A running process says the owner is here. A directory something is working
//   inside is left alone however old it looks, because an mtime says when a
//   tree was last written, not whether a browser has it loaded.
//
// Neither guard is sufficient. The age filter would delete the build a
// long-running Lab browser is holding open; the process check would delete a
// tree whose owning worker is idle mid-run. Both must pass.
//
// `--dry-run` decides every refusal and reports exactly what would go, without
// removing anything, on the same convention as the other task commands.

import { rm, rmdir } from "node:fs/promises";
import path from "node:path";

import { assertDisposable, noteProgress, processesUsingRoots, removeWorktree, runGit, samePath } from "../worktree/index.mjs";
import { listWorktrees } from "./locate.mjs";
import { orphanedCores } from "./orphaned-cores.mjs";
import { findScratchRoots } from "./scratch-roots.mjs";
import { staleDirectories } from "./stale-directories.mjs";
import { DEFAULT_BASE_NAME } from "./roots.mjs";

// Three days. An agent session does not last three days, so anything older than
// that belongs to a worker that has certainly exited -- while a day would put
// the age filter close enough to a long Lab campaign to be doing real work,
// which is the running-process check's job and not this one's.
export const DEFAULT_PRUNE_DAYS = 3;

export async function pruneTasks({ repositoryRoot, coreRepositoryRoot, base, days = DEFAULT_PRUNE_DAYS, dryRun = false, allowRunning = false, note = noteProgress, now = Date.now() }) {
  if (!Number.isFinite(days) || days < 0) throw new Error(`--days needs a number of days, not ${JSON.stringify(days)}.`);
  const disposableBase = path.resolve(base ?? path.join(repositoryRoot, "..", DEFAULT_BASE_NAME));
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  // First, so the worktree lists below describe what is actually on disk. A
  // registration whose directory was deleted by hand would otherwise make a
  // Core look occupied by a task that no longer exists.
  note({ step: "worktree-prune", repositoryRoot });
  await runGit(repositoryRoot, ["worktree", "prune", ...dryRun ? ["--dry-run"] : []]);
  if (coreRepositoryRoot) {
    // Core is a sibling repository this command does not own, and on a checkout
    // without the sibling it is not there at all. Failing to tidy its
    // registrations is reported rather than thrown: it cannot make this
    // repository's own reclaim wrong, and refusing over it would mean a machine
    // with no Core beside it could never reclaim anything.
    await runGit(coreRepositoryRoot, ["worktree", "prune", ...dryRun ? ["--dry-run"] : []])
      .catch((error) => note({ step: "worktree-prune-skipped", repositoryRoot: coreRepositoryRoot, reason: error.message }));
  }

  note({ step: "scan", cutoff: new Date(cutoff).toISOString() });
  const scratchRoots = await findScratchRoots(repositoryRoot);
  const stale = await staleDirectories(scratchRoots, { cutoff });

  const cores = coreRepositoryRoot
    ? orphanedCores({
        base: disposableBase,
        extWorktrees: (await listWorktrees(repositoryRoot)).map((entry) => entry.root),
        coreWorktrees: (await listWorktrees(coreRepositoryRoot)).map((entry) => entry.root)
      })
    : [];

  // One process listing for every candidate at once: reading the listing is by
  // far the expensive part, and asking per directory would make the cost scale
  // with how much there is to reclaim.
  const candidates = [...stale.map((entry) => entry.root), ...cores];
  const busy = allowRunning || candidates.length === 0 ? [] : await processesUsingRoots(candidates);
  const inUse = (root) => busy.some((entry) => comparablePath(entry.commandLine).includes(`${comparablePath(root)}/`));

  const scratch = stale.map((entry) => ({ ...entry, skipped: inUse(entry.root) ? "in use" : null }));
  const scratchToRemove = scratch.filter((entry) => entry.skipped === null);
  const coreToRemove = cores.filter((root) => !inUse(root));

  const summary = {
    days,
    cutoff: new Date(cutoff).toISOString(),
    // Per root rather than per directory. A prune routinely selects a couple of
    // hundred label directories, and naming every one turns the result into
    // tens of kilobytes that neither an agent nor a person reads. What is worth
    // naming individually is the exception: a directory old enough to go that
    // something is still working inside.
    scratch: summarizeByRoot(scratchRoots, scratch),
    skipped: scratch.filter((entry) => entry.skipped !== null).map((entry) => ({ root: entry.root, reason: entry.skipped })),
    cores: cores.map((root) => ({ root, skipped: inUse(root) ? "in use" : null })),
    directories: scratchToRemove.length,
    bytes: scratchToRemove.reduce((total, entry) => total + entry.bytes, 0),
    applied: false
  };
  if (dryRun) return summary;

  for (const entry of scratchToRemove) {
    assertScratchChild(entry);
    note({ step: "delete", root: entry.root });
    // Retries for the same reason removeWorktree needs them: on Windows a
    // just-exited child or an antivirus scan can hold a file open for a moment.
    await rm(entry.root, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  }

  for (const root of coreToRemove) {
    assertDisposable({ base: disposableBase, root, repositoryRoot, workingRoots: [repositoryRoot, coreRepositoryRoot].filter(Boolean) });
    note({ step: "remove-core", root });
    await removeWorktree({ repositoryRoot: coreRepositoryRoot, root, allowRunning, note });
    // A Core-paired task nests as `<base>/<id>/{<repo>,!FluxIQ}`, so removing
    // the Core can leave the task's own directory behind holding nothing.
    // rmdir removes it only when it is genuinely empty, which is the check.
    const parent = path.dirname(root);
    if (!samePath(parent, disposableBase)) {
      await rmdir(parent).catch((error) => {
        // A non-empty directory is the check itself, not a failure: the task
        // still holds something of its own, so its directory is not this
        // command's to remove. Anything else went wrong with a directory this
        // command had just decided was disposable, and must not pass silently.
        if (error?.code === "ENOTEMPTY" || error?.code === "ENOENT") return;
        throw error;
      });
    }
  }

  return { ...summary, applied: true };
}

/**
 * The one guard standing in front of the recursive delete: the target must be
 * an immediate child of a scratch root this run discovered. A scratch root
 * itself is never a target -- it is what the ignore rules name and what the
 * next build writes into -- and nothing outside one can reach here at all.
 */
function assertScratchChild(entry) {
  if (!samePath(path.dirname(entry.root), entry.parent)) {
    throw new Error(`Refusing to delete ${entry.root}: it is not an immediate child of the scratch root ${entry.parent}.`);
  }
  if (samePath(entry.root, entry.parent)) {
    throw new Error(`Refusing to delete ${entry.root}: it is the scratch root itself, which the next build writes into.`);
  }
}

/**
 * One row per scratch root, including the roots nothing was selected under, so
 * a root that has stopped being reclaimed is visible rather than absent.
 */
function summarizeByRoot(scratchRoots, scratch) {
  return scratchRoots.map((root) => {
    const selected = scratch.filter((entry) => samePath(entry.parent, root));
    const removing = selected.filter((entry) => entry.skipped === null);
    return {
      root,
      directories: removing.length,
      bytes: removing.reduce((total, entry) => total + entry.bytes, 0),
      skipped: selected.length - removing.length
    };
  });
}

function comparablePath(text) {
  return text.replaceAll("\\", "/").toLowerCase();
}
