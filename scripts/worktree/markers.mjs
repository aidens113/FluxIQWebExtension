// What was last completed in a worktree: the lockfile blob installed there and
// the commit built there. Each marker sits in that worktree's ignored
// `node_modules`, is cleared before its step starts and written only after the
// step succeeded, so it never claims work that did not finish.
//
// The on-disk names still say `lab-pair` because they are state, not code: the
// Lab's pair already holds files under these names, and renaming them would
// make every existing pair reinstall and rebuild once for nothing.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const FILES = { install: ".lab-pair-installed-lock", build: ".lab-pair-built-commit" };

function markerPath(root, kind) {
  const file = FILES[kind];
  if (file === undefined) throw new Error(`Unknown worktree marker ${JSON.stringify(kind)}`);
  return path.join(root, "node_modules", file);
}

/** The recorded value, or null when this step has never completed in `root`. */
export async function readMarker(root, kind) {
  try {
    return (await readFile(markerPath(root, kind), "utf8")).trim();
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
}

/** Records that `kind` completed in `root` for `value`. */
export async function writeMarker(root, kind, value) {
  const file = markerPath(root, kind);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${value}\n`);
}

/** Forgets `kind` in `root`, before the step is run again. */
export async function clearMarker(root, kind) {
  await rm(markerPath(root, kind), { force: true });
}
