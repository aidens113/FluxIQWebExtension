// Which lockfile a worktree's dependencies were actually installed from.
//
// pnpm keeps its own copy of the lockfile it resolved at
// `node_modules/.pnpm/lock.yaml`, written by the install itself. That is better
// evidence than the marker this repository writes (`markers.mjs`), for one
// reason: the marker only exists when the install went through `pnpm task` or
// `pnpm lab:pair`. A Core worktree added by hand, or installed by a developer
// running `pnpm install` in it, has no marker at all -- and every checkout on
// this machine was in exactly that state on 2026-09-18, which made
// `pnpm task sync-core` plan a reinstall and a rebuild of a Core that was
// already correct, and then refuse the whole move because three live campaigns
// were running against it.
//
// So pnpm's record is read first and the marker is the fallback. When pnpm's
// copy is there it is the whole answer: a `node_modules` whose `.pnpm` was
// removed has no install left to trust, whatever a marker remembers.
//
// The comparison is by git blob id, because that is what the caller has for the
// committed lockfile and it needs no checkout of the file. A pnpm that ever
// wrote its copy non-verbatim would simply not match, and the worktree would be
// installed again -- the safe direction.

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readMarker } from "./markers.mjs";

/**
 * The git blob id of the lockfile `root` was last installed from, or null when
 * nothing on disk says.
 *
 * @param {string} root
 * @returns {Promise<string | null>}
 */
export async function installedLockfile(root) {
  const recorded = await pnpmLockfileId(root);
  return recorded ?? await readMarker(root, "install");
}

async function pnpmLockfileId(root) {
  let content;
  try {
    content = await readFile(path.join(root, "node_modules", ".pnpm", "lock.yaml"));
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return null;
    throw error;
  }
  return createHash("sha1").update(`blob ${content.length}\0`).update(content).digest("hex");
}
