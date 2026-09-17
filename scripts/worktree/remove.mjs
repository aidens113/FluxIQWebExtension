// Removing a task worktree, safely, without `git worktree remove --force`.
//
// That command does not work here, and this is measured rather than feared: on
// a worktree that has been installed it fails with "Directory not empty" on
// `node_modules`, and it is not atomic -- it deletes part of the tree and
// loses the `.git` file before it aborts, leaving something that is neither a
// working worktree nor removable by git. So the tree is deleted directly and
// `git worktree prune` is what tells git the entry is gone. The delete must
// therefore be guarded here, because nothing else is guarding it: see
// disposable-root.mjs, which a caller uses to check the path itself.
//
// Three refusals, all decided before a single file is deleted. The root must
// be a linked worktree of the repository it is being removed from -- not the
// main checkout, not an unrelated directory that merely happens to be a
// checkout. It must have nothing uncommitted or untracked, because a deleted
// worktree's edits are gone for good and nothing else holds a copy. And
// nothing may be running below it, or the delete pulls files out from under a
// build, a browser or a test run that has them open.

import { rm, stat } from "node:fs/promises";
import path from "node:path";
import { checkoutRepository } from "./checkout-repository.mjs";
import { runGit } from "./git-command.mjs";
import { samePath } from "./path-identity.mjs";
import { processesUsingRoots } from "./processes-using-roots.mjs";
import { noteProgress } from "./progress-note.mjs";

/**
 * @param {{ repositoryRoot: string, root: string, allowRunning?: boolean, note?: (line: Record<string, unknown>) => void }} input
 */
export async function removeWorktree({ repositoryRoot, root, allowRunning = false, note = noteProgress }) {
  const resolved = path.resolve(root);
  if (samePath(resolved, repositoryRoot)) throw new Error(`Refusing to remove ${resolved}: it is the checkout this process runs from.`);
  if (!await isDirectory(resolved)) throw new Error(`Refusing to remove ${resolved}: there is no directory there. If git still lists the worktree, run git worktree prune in ${repositoryRoot}.`);
  let common;
  try {
    common = await checkoutRepository(resolved);
  } catch (error) {
    throw new Error(`Refusing to remove ${resolved}: ${error.message}. This module deletes only a linked worktree of ${repositoryRoot}.`, { cause: error });
  }
  const expected = await checkoutRepository(repositoryRoot).catch((error) => {
    throw new Error(`Refusing to remove ${resolved}: the repository it should belong to, ${repositoryRoot}, is not the top of a git checkout.`, { cause: error });
  });
  if (!samePath(common, expected)) throw new Error(`Refusing to remove ${resolved}: it is a worktree of ${common}, not of ${repositoryRoot} (${expected}).`);
  const gitDir = await runGit(resolved, ["rev-parse", "--path-format=absolute", "--git-dir"]);
  if (samePath(gitDir, common)) throw new Error(`Refusing to remove ${resolved}: it is the repository's main checkout, not a linked worktree.`);

  const status = await runGit(resolved, ["status", "--porcelain=v1", "--untracked-files=normal"]);
  const dirtyLines = status.split(/\r?\n/u).filter((line) => line.trim() !== "");
  if (dirtyLines.length > 0) {
    throw new Error(`Refusing to remove ${resolved}: it has ${dirtyLines.length} uncommitted or untracked change(s) (${dirtyLines.slice(0, 3).map((line) => line.trim()).join("; ")}), which deleting it would lose. Commit, push or discard them first.`);
  }
  if (!allowRunning) {
    const busy = await processesUsingRoots([resolved]);
    if (busy.length > 0) {
      const named = busy.slice(0, 5).map((entry) => `${entry.name} (pid ${entry.pid})`).join(", ");
      throw new Error(`Refusing to remove ${resolved}: ${busy.length} running process(es) are working inside it, e.g. ${named}. Wait for them to finish, or pass allowRunning.`);
    }
  }

  note({ step: "delete", root: resolved });
  // Retries because on Windows an antivirus scan or a just-exited child can
  // hold a file in node_modules open for a moment after nothing is running.
  await rm(resolved, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
  note({ step: "prune", repositoryRoot });
  await runGit(repositoryRoot, ["worktree", "prune"]);
  return { root: resolved, removed: true, dirtyLines };
}

async function isDirectory(target) {
  try {
    return (await stat(target)).isDirectory();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
