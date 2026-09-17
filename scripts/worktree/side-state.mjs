// One worktree as it is now: where HEAD is, what the requested revision
// resolves to, what is uncommitted, which lockfile the target commit holds,
// and what was last installed and built there.
//
// `root` and `target` are the whole of what a caller needs to ask the
// question. The options are what a particular caller labels the answer with
// and what it also wants measured: a Lab pair names its two sides and tells
// this module which `dist` directories prove Core was built, while a task
// worktree wants neither.

import { realpath, stat } from "node:fs/promises";
import { runGit } from "./git-command.mjs";
import { readMarker } from "./markers.mjs";
import { samePath } from "./path-identity.mjs";

/**
 * @param {string} root
 * @param {string | null} target the revision to move to, or null to stay at HEAD
 * @param {{ side?: string, buildable?: boolean, distPaths?: string[] }} [options]
 */
export async function readSideState(root, target, options = {}) {
  const side = options.side ?? "worktree";
  const buildable = options.buildable ?? false;
  const distPaths = options.distPaths ?? [];
  const top = await runGit(root, ["rev-parse", "--show-toplevel"]);
  // Real paths on both sides: a junction or a short 8.3 name is the same directory.
  if (!samePath(await realpath(top), await realpath(root))) throw new Error(`The ${side} side ${root} is not the top of a git checkout (its checkout is ${top})`);
  const head = await runGit(root, ["rev-parse", "--verify", "HEAD"]);
  const resolved = target === null ? head : await runGit(root, ["rev-parse", "--verify", "--quiet", `${target}^{commit}`]).catch((error) => {
    throw new Error(`The ${side} revision ${JSON.stringify(target)} does not name a commit in ${root}`, { cause: error });
  });
  const status = await runGit(root, ["status", "--porcelain=v1", "--untracked-files=normal"]);
  const targetLock = await runGit(root, ["rev-parse", "--verify", `${resolved}:pnpm-lock.yaml`]);
  const presence = await Promise.all(distPaths.map(exists));
  return {
    side,
    root,
    head,
    target: resolved,
    dirtyLines: status.split(/\r?\n/u).filter((line) => line.trim() !== ""),
    targetLock,
    installedLock: await readMarker(root, "install"),
    buildable,
    builtCommit: buildable ? await readMarker(root, "build") : null,
    distPresent: presence.every(Boolean),
  };
}

async function exists(file) {
  try {
    await stat(file);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}
