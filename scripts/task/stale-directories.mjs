// Which of a scratch root's label directories nothing has touched since a
// cutoff.
//
// A label directory's own mtime is not enough to answer that.
// `.test-build-scratch/<label>/` is deleted and recreated by each run, so its
// top-level mtime does track the run -- but `.lab-instances/<instance>/` is
// written through subdirectories (`extension/dist/`, `scenario-lab/dist/`,
// `host/`), and creating a file two levels down leaves the instance
// directory's own mtime at whenever the instance was first made. Reading only
// the top would call a Lab instance that built ten minutes ago six days stale
// and delete the build a browser is loading. A directory's mtime is also
// unchanged when a file already in it is overwritten in place, which is what a
// rebuild does, so directory mtimes alone are wrong in the other direction too.
//
// So the whole tree is walked and every entry's mtime is read, and the walk
// stops the moment anything at all is newer than the cutoff. Breadth-first,
// because a tree in use is almost always touched near its top, so a live
// directory is answered in a handful of stats. Only the directories that really
// are old get read to the end -- and those are the ones about to be deleted.
//
// Age is a heuristic and is not the safety guarantee. It catches a directory
// whose owner exited; what catches a directory whose owner is alive but
// currently idle is the running-process check the caller makes before deleting
// anything (scripts/worktree/processes-using-roots.mjs). Neither guard is
// sufficient alone.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

/**
 * @param {string[]} roots scratch roots; only their immediate children are considered
 * @param {{ cutoff: number }} options epoch milliseconds; a child untouched since then is stale
 * @returns {Promise<Array<{ root: string, parent: string, name: string, modified: number, bytes: number }>>}
 */
export async function staleDirectories(roots, { cutoff }) {
  const stale = [];

  for (const parent of roots) {
    let entries;
    try {
      entries = await readdir(parent, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const root = path.join(parent, entry.name);
      const measured = await measure(root, cutoff);
      if (measured !== null) stale.push({ root, parent, name: entry.name, ...measured });
    }
  }

  return stale;
}

/**
 * The newest mtime anywhere below `target` and the bytes it occupies, or null
 * as soon as anything there is at or after `cutoff` -- at which point the
 * answer cannot change the caller's decision, so the rest of the tree is not
 * read. The size costs nothing extra: the walk has already stat'd every entry,
 * and it is what lets the prune report what it actually reclaimed rather than
 * a directory count.
 *
 * @param {string} target
 * @param {number} cutoff
 * @returns {Promise<{ modified: number, bytes: number } | null>}
 */
async function measure(target, cutoff) {
  let newest = 0;
  let bytes = 0;
  const pending = [target];

  for (let index = 0; index < pending.length; index += 1) {
    const current = pending[index];
    let info;
    try {
      info = await stat(current);
    } catch (error) {
      // Something else owns this tree and is changing it underneath the walk.
      // That is a reason to leave the tree alone, not to fail the prune.
      if (error?.code === "ENOENT") continue;
      if (error?.code === "EACCES" || error?.code === "EPERM" || error?.code === "EBUSY") return null;
      throw error;
    }
    if (info.mtimeMs >= cutoff) return null;
    if (info.mtimeMs > newest) newest = info.mtimeMs;
    if (!info.isDirectory()) {
      bytes += info.size;
      continue;
    }

    let entries;
    try {
      entries = await readdir(current);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      if (error?.code === "EACCES" || error?.code === "EPERM") return null;
      throw error;
    }
    for (const entry of entries) pending.push(path.join(current, entry));
  }

  return { modified: newest, bytes };
}
