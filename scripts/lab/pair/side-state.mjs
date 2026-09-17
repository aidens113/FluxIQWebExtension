// One worktree of the pair as it is now: where HEAD is, what the requested
// revision resolves to, what is uncommitted, which lockfile the target commit
// holds, and what the pair last installed and built there.

import { realpath, stat } from "node:fs/promises";
import { runGit } from "./git-command.mjs";
import { readMarker } from "./markers.mjs";
import { samePath } from "./path-identity.mjs";

/**
 * @param {{ side: "ext" | "core", root: string, target: string | null, buildable: boolean, distPaths: string[] }} input
 */
export async function readSideState({ side, root, target, buildable, distPaths }) {
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
