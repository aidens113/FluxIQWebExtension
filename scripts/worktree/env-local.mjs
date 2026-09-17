// Carrying `.env.local` into a new worktree.
//
// A worktree is a fresh checkout and `.env.local` is gitignored, so a task
// worktree starts without the provider key a live run needs, and a run started
// there is refused for a reason that has nothing to do with the commit under
// test. Copying the file across is the one thing that fixes it.
//
// The contents are never read into this process, logged, or returned: the copy
// is a file-system copy, and what comes back names the source, the destination
// and what happened. A secret that is never a value here cannot reach a log
// line, an error message or a JSON result by accident.
//
// An absent source and a destination that already has one are both answers
// rather than failures. The first is the ordinary case on a machine that keeps
// its key in the environment; the second means somebody put a file there
// deliberately, and overwriting it would be the surprising thing to do. Any
// other failure is raised, so a missing destination directory is never
// reported as a missing source.

import { constants } from "node:fs";
import { copyFile, stat } from "node:fs/promises";
import path from "node:path";
import { samePath } from "./path-identity.mjs";

const NAME = ".env.local";

/**
 * @param {{ fromRoot: string, toRoot: string }} input
 * @returns {Promise<{ copied: boolean, from: string, to: string, why: string }>}
 */
export async function copyEnvLocal({ fromRoot, toRoot }) {
  if (samePath(fromRoot, toRoot)) throw new Error(`Refusing to copy ${NAME} onto itself: ${fromRoot} and ${toRoot} are the same directory.`);
  const from = path.join(fromRoot, NAME);
  const to = path.join(toRoot, NAME);
  if (!await isFile(from)) return { copied: false, from, to, why: `there is no ${NAME} in ${fromRoot}` };
  try {
    await copyFile(from, to, constants.COPYFILE_EXCL);
  } catch (error) {
    if (error?.code === "EEXIST") return { copied: false, from, to, why: `${toRoot} already has its own ${NAME}, which is left alone` };
    throw error;
  }
  return { copied: true, from, to, why: `copied from ${fromRoot}` };
}

async function isFile(target) {
  try {
    return (await stat(target)).isFile();
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
