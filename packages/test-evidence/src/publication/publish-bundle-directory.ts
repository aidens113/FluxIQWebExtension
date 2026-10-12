import { cp, rename, rm, stat } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import path from "node:path";
import { EvidenceBundlePublicationError, type EvidenceBundlePublicationStage } from "./publication-error.js";

/** What Windows answers a rename or copy while another process holds a handle inside the folder. */
const TRANSIENT_CODES = new Set(["EBUSY", "EPERM", "EACCES"]);

/**
 * The waits between rename attempts: about 15 s in all, the budget graceful-fs
 * gives a rename on Windows. On Windows a directory cannot be renamed while any
 * process holds a handle on a file inside it -- an antivirus or indexer scan of
 * the files written milliseconds earlier, an Explorer window, or an agent
 * tailing `events.ndjson` -- and 85 ms, the budget before 2026-10-11, lost run
 * run-mv4912r9-53b05a51's bundle to one of them.
 */
const RENAME_DELAYS_MS = [10, 25, 50, 100, 200, 400, 800, 1_600, 2_000, 2_000, 2_000, 2_000, 2_000, 2_000] as const;

export type PublishBundleDirectoryHooks = {
  renameDirectory?: ((source: string, destination: string) => Promise<void>) | undefined;
  copyDirectory?: ((source: string, destination: string) => Promise<void>) | undefined;
  removeDirectory?: ((target: string) => Promise<void>) | undefined;
  wait?: ((milliseconds: number) => Promise<unknown>) | undefined;
};

export type PublishedBundleDirectory = {
  /** `rename`: the staging folder became the bundle. `copy`: a reader held the staging folder, so a copy of it did. */
  method: "rename" | "copy";
  /** Rename attempts made on the staging folder. */
  attempts: number;
  /** After a copy, the errno that kept the sealed staging folder from being removed; it is then left beside the bundle. */
  stagingLeftBehind?: string;
};

/**
 * Publishes a sealed staging folder under its final name.
 *
 * First a rename, retried with back-off for about 15 s while a reader blocks
 * it. A plain reader does not stop a copy, so when the rename stays blocked the
 * folder is copied aside to `.publishing-<name>` -- a folder nobody has open --
 * and that copy is renamed into place, which keeps the bundle appearing whole
 * or not at all; the staging folder is then removed when it can be. Any other
 * failure, or a fallback that fails, throws `EvidenceBundlePublicationError`
 * naming the stage, the errno and the folder the sealed bundle stays in.
 */
export async function publishBundleDirectory(stagingPath: string, destination: string, hooks: PublishBundleDirectoryHooks = {}): Promise<PublishedBundleDirectory> {
  const renameDirectory = hooks.renameDirectory ?? rename;
  const wait = hooks.wait ?? delay;
  const removeDirectory = hooks.removeDirectory ?? ((target: string) => rm(target, { recursive: true, force: true, maxRetries: 3 }));
  const copyDirectory = hooks.copyDirectory ?? ((source: string, target: string) => cp(source, target, { recursive: true, errorOnExist: true, force: false, verbatimSymlinks: true }));
  const renamed = await renameWithBackOff(stagingPath, destination, renameDirectory, wait);
  if (renamed.failure === undefined) return { method: "rename", attempts: renamed.attempts };
  const renameCode = codeOf(renamed.failure);
  const fail = (stage: EvidenceBundlePublicationStage, cause: unknown, attempts: number) => new EvidenceBundlePublicationError({ stage, code: codeOf(cause), ...(stage === "rename-staging" ? {} : { renameCode }), attempts, stagingPath, destination, cause });
  if (!TRANSIENT_CODES.has(renameCode)) throw fail("rename-staging", renamed.failure, renamed.attempts);

  const copyPath = path.join(path.dirname(destination), `.publishing-${path.basename(destination)}`);
  try {
    await removeDirectory(copyPath); // A copy an earlier failed publication left.
    await copyDirectory(stagingPath, copyPath);
  } catch (error) {
    await removeDirectory(copyPath).catch(/* best-effort: the publication failure thrown next is what matters; a partial copy is never a bundle */ () => undefined);
    throw fail("copy-staging", error, renamed.attempts);
  }
  const published = await renameWithBackOff(copyPath, destination, renameDirectory, wait);
  if (published.failure !== undefined) {
    await removeDirectory(copyPath).catch(/* best-effort: the publication failure thrown next is what matters; the sealed staging folder is untouched */ () => undefined);
    throw fail("rename-copy", published.failure, published.attempts);
  }
  try {
    await removeDirectory(stagingPath);
    return { method: "copy", attempts: renamed.attempts };
  } catch (error) {
    return { method: "copy", attempts: renamed.attempts, stagingLeftBehind: codeOf(error) };
  }
}

async function renameWithBackOff(
  source: string,
  destination: string,
  renameDirectory: (source: string, destination: string) => Promise<void>,
  wait: (milliseconds: number) => Promise<unknown>,
): Promise<{ attempts: number; failure?: unknown }> {
  for (let attempt = 0; ; attempt += 1) {
    if (await pathExists(destination)) throw new Error(`Evidence bundle already exists: ${destination}`);
    try {
      await renameDirectory(source, destination);
      return { attempts: attempt + 1 };
    } catch (error) {
      if (!TRANSIENT_CODES.has(codeOf(error)) || attempt >= RENAME_DELAYS_MS.length) return { attempts: attempt + 1, failure: error };
      await wait(RENAME_DELAYS_MS[attempt]!);
    }
  }
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
}

function codeOf(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,32}$/u.test(code) ? code : "unknown";
}
