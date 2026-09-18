// Whether FluxIQ Core's build is older than the source it was built from.
//
// The Lab loads Core's COMPILED output, never its source. So a Core fix can sit
// in the working tree while every live run silently exercises the old build,
// and nothing anywhere says so. That is not hypothetical: on 2026-09-17 a token
// ceiling was raised in Core's source and three whole campaign slices -- 30
// live tasks across three agents -- ran to completion afterwards without
// reaching the provider once, every one rejected by the previous build's
// ceiling. Zero provider calls, zero tokens, and three reports whose real
// subject was the build rather than the product.
//
// `core-build-watch.mjs` could not catch it. It watches Core's OUTPUT, to keep
// a rebuild from deleting modules a run is importing, and by that measure a
// stale build looks perfectly quiet -- quieter than a fresh one. The two guards
// are complementary: that one asks "is Core changing under me?", this one asks
// "is Core's build what its source says?".
//
// Sources are compared against output by modification time, which is coarse and
// deliberately so. It cannot tell a meaningful edit from a touched file, and it
// does not need to: the cost of a false alarm is one rebuild, and the cost of a
// miss is a campaign that measures nothing and reads as a product result.

import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const SKIPPED = new Set(["node_modules", "dist", ".next", ".git", ".turbo"]);

/**
 * @param {string} coreRoot
 * @returns {Promise<{ newestMs: number, newestPath: string | null }>} the newest source file under Core's packages
 */
export async function scanCoreSources(coreRoot) {
  const found = { newestMs: 0, newestPath: null };
  let packages;
  try {
    packages = await readdir(path.join(coreRoot, "packages"), { withFileTypes: true });
  } catch {
    // No Core beside this checkout is not this module's problem to report; the
    // caller already fails on a Core it cannot resolve.
    return found;
  }
  for (const entry of packages) {
    if (entry.isDirectory()) await walk(path.join(coreRoot, "packages", entry.name, "src"), found);
  }
  return found;
}

async function walk(directory, found) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "EACCES" || error?.code === "EPERM") return;
    throw error;
  }
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED.has(entry.name)) await walk(target, found);
      continue;
    }
    if (!entry.isFile()) continue;
    let stats;
    try {
      stats = await stat(target);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (stats.mtimeMs > found.newestMs) {
      found.newestMs = stats.mtimeMs;
      found.newestPath = target;
    }
  }
}
