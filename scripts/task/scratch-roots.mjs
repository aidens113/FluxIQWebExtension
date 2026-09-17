// Where disposable build output accumulates, and therefore what a prune is
// allowed to look inside.
//
// Two mechanisms key build output by a label so that concurrent workers never
// overwrite each other. EXTENSION_TEST_BUILD_LABEL and DOMAIN_TEST_BUILD_LABEL
// send test bundles to `<package>/.test-build-scratch/<label>/`
// (apps/extension/scripts/test-extension.mjs), and FLUXIQ_LAB_INSTANCE sends
// one Lab instance's build to `<package>/.lab-instances/<instance>/`
// (scripts/lab/lab-instance.mjs). Each directory is cleared when its own label
// is used again, so a label that keeps being used costs nothing -- but a label
// used once by a worker that has since exited is never touched again by
// anything. Measured 2026-09-17: 162 label directories holding 1.4 GB under
// `apps/extension/.test-build-scratch`, 99 holding 178 MB under
// `domain/.test-build-scratch`, and 298 MB across four `.lab-instances`.
//
// The roots are found rather than listed. Both names may appear under any
// workspace package -- the ignore rules match `.lab-instances/` at any depth
// for exactly that reason -- so a hard-coded list would quietly stop covering a
// package added later, and the space it leaked would be invisible.
//
// Only the CHILDREN of a root are ever deleted. The root itself is what the
// ignore rules name and what the next build writes into, and removing it buys
// nothing: it is an empty directory.
//
// `test-runs/` is deliberately not a scratch root. It is ignored and
// disposable in the same sense, but it holds evidence bundles somebody may
// still want to read and a `persistent-isolated` topology whose whole point is
// that it survives. Reclaiming it is a decision about evidence, not about build
// output, so it stays a decision somebody makes on purpose.

import { readdir } from "node:fs/promises";
import path from "node:path";

const SCRATCH_NAMES = new Set([".test-build-scratch", ".lab-instances"]);
// `apps/extension/.lab-instances` is three segments below the root, and a
// workspace package is never deeper than `apps/*` or `packages/*`. Bounding the
// walk keeps it from descending the whole tree looking for something that
// cannot be there.
const MAX_DEPTH = 3;
const SKIPPED = new Set(["node_modules", ".git", "dist", "test-runs"]);

/**
 * @param {string} repositoryRoot
 * @param {{ names?: Set<string>, maxDepth?: number }} [options] overridden only by tests
 * @returns {Promise<string[]>} absolute paths, sorted, of every scratch root present
 */
export async function findScratchRoots(repositoryRoot, options = {}) {
  const names = options.names ?? SCRATCH_NAMES;
  const maxDepth = options.maxDepth ?? MAX_DEPTH;
  const found = [];

  await walk(path.resolve(repositoryRoot), 0);
  return found.sort();

  async function walk(directory, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      // A directory that vanished or that this process may not read is not a
      // scratch root it can prune; a prune must not fail over one.
      if (error?.code === "ENOENT" || error?.code === "EACCES" || error?.code === "EPERM") return;
      throw error;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (names.has(entry.name)) {
        found.push(path.join(directory, entry.name));
        continue;
      }
      if (SKIPPED.has(entry.name) || entry.name.startsWith(".")) continue;
      await walk(path.join(directory, entry.name), depth + 1);
    }
  }
}
