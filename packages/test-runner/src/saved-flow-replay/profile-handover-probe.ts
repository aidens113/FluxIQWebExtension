// What the replay's browser profile looked like just before launch: whether
// Chrome's `lockfile` is there (Chrome on Windows holds it while it runs on the
// profile) and how long ago anything at the top of the profile or its `Default/`
// directory was last written.
//
// Recorded only, never a gate. Replay `replay-mv62rwy7-fcb23be8` lost its
// extension worker about a minute after a build had used the same profile, and
// the evidence could neither confirm nor exclude a Chrome process from that
// build still letting go of it. The next occurrence should decide that; this is
// the observation it needs. A boolean and an integer, never a path or a name.

import { lstat, readdir } from "node:fs/promises";
import path from "node:path";

export async function profileHandoverProbe(profileDir: string, now: () => number = Date.now): Promise<{ lockfile: boolean; sinceLastWriteMs: number | null }> {
  const lockfile = (await ifPresent(() => lstat(path.join(profileDir, "lockfile")))) !== undefined;
  let newest: number | null = null;
  for (const directory of [profileDir, path.join(profileDir, "Default")]) {
    // A profile never launched has no Default/, and a fresh workspace may have no profile yet.
    for (const name of (await ifPresent(() => readdir(directory))) ?? []) {
      // An entry Chrome removed while it was listed is not a write to measure.
      const stats = await ifPresent(() => lstat(path.join(directory, name)));
      if (stats && (newest === null || stats.mtimeMs > newest)) newest = stats.mtimeMs;
    }
  }
  return { lockfile, sinceLastWriteMs: newest === null ? null : Math.max(0, Math.round(now() - newest)) };
}

/** The value, or `undefined` only when the path does not exist; any other read failure propagates. */
async function ifPresent<T>(read: () => Promise<T>): Promise<T | undefined> {
  try {
    return await read();
  } catch (error) {
    const code = (error as NodeJS.ErrnoException | null)?.code;
    if (code === "ENOENT" || code === "ENOTDIR") return undefined;
    throw error;
  }
}
