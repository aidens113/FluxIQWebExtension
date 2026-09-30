// A digest of the source a live run tests: every tracked and untracked file
// git does not ignore, in this repository and in the FluxIQ Core beside it,
// read from the working tree.
//
// What is left out is what a rerun cannot learn from. Build output and
// `test-runs/` are already ignored by git, and are dropped by name as well in
// case a checkout's ignore rules miss one. Documentation is dropped because
// writing a run's debug file (the debug rule demands one) or a working-document
// note changes no behaviour: `docs/` at the top of each root, and Markdown
// anywhere.
//
// The digest is path-independent: each root is named by its position, not its
// location, so the same source in another worktree digests the same.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const DROPPED_SEGMENTS = new Set(["node_modules", "dist", "build", "test-runs", ".lab-instances", ".lab-locks", ".fluxiq", ".test-build", ".script-build"]);
const READ_CONCURRENCY = 32;

/**
 * @param {string} file a git path, forward slashes, relative to its root
 */
function dropped(file) {
  const segments = file.split("/");
  return segments[0] === "docs" || file.toLowerCase().endsWith(".md") || segments.some((segment) => DROPPED_SEGMENTS.has(segment));
}

/**
 * @param {string[]} roots git working trees, in a fixed order
 * @returns {Promise<{ digest: string, files: number }>}
 */
export async function sourceFingerprint(roots) {
  const hash = createHash("sha256");
  let count = 0;
  for (const [position, root] of roots.entries()) {
    const { stdout } = await execFileAsync("git", ["-C", root, "ls-files", "--cached", "--others", "--exclude-standard", "-z"], { maxBuffer: 256 * 1024 * 1024, windowsHide: true });
    const files = [...new Set(stdout.split("\0").filter((file) => file !== "" && !dropped(file)))].sort();
    const digests = await mapConcurrently(files, READ_CONCURRENCY, (file) => contentDigest(path.join(root, file)));
    hash.update(`root ${position} ${files.length}\n`);
    for (const [index, file] of files.entries()) hash.update(`${file}\0${digests[index]}\n`);
    count += files.length;
  }
  return { digest: `sha256:${hash.digest("hex")}`, files: count };
}

async function contentDigest(file) {
  try {
    return createHash("sha256").update(await readFile(file)).digest("hex");
  } catch (error) {
    // A tracked file deleted in the working tree, or a submodule's directory:
    // both are states of the tree, and each is named rather than hashed.
    if (error?.code === "ENOENT") return "deleted";
    if (error?.code === "EISDIR") return "directory";
    throw error;
  }
}

async function mapConcurrently(items, limit, work) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}
