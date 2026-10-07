// The build stamp: which source files a built extension target was made from,
// and their content hashes, so anything that loads the target can tell whether
// it still matches the tree.
//
// Why it exists: the Playwright fixture (e2e/fixtures/extension-context.ts)
// detected a *missing* artifact but not a *stale* one, so `playwright test` run
// by hand after an edit certified the previous build. The inputs are the ones
// esbuild actually read (its metafile) plus the files the build copies, so the
// check is exact: an edit to a file the bundle never reads does not mark the
// build stale, and an edit to any file it does read always does. A new file can
// only enter a bundle through an edit to a file already in it.
//
// Paths are stored relative to the repository root with "/" separators, so the
// stamp names the same files on every platform and in every worktree layout.

import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const BUILD_INFO_FILE = "build-info.json";
const SCHEMA = 1;

/** @param {Buffer | string} data */
function sha256(data) {
  return createHash("sha256").update(data).digest("hex");
}

/**
 * Hashes each input file. Paths esbuild reports that are not files on disk
 * (virtual namespaces) are skipped by the caller before this point.
 *
 * @param {string} repoRoot
 * @param {Iterable<string>} absolutePaths
 * @returns {Promise<Record<string, string>>} repository-relative path -> sha256
 */
export async function hashBuildInputs(repoRoot, absolutePaths) {
  const unique = [...new Set([...absolutePaths].map((file) => path.resolve(file)))];
  const entries = await Promise.all(unique.map(async (file) => [toStampPath(repoRoot, file), sha256(await readFile(file))]));
  entries.sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return Object.fromEntries(entries);
}

/**
 * @param {string} targetDir
 * @param {{ target: string, version: string, inputs: Record<string, string>, identity?: object }} info
 */
export async function writeBuildInfo(targetDir, info) {
  const body = { schema: SCHEMA, target: info.target, version: info.version, inputs: info.inputs, ...(info.identity ? { identity: info.identity } : {}) };
  await writeFile(path.join(targetDir, BUILD_INFO_FILE), `${JSON.stringify(body, null, 2)}\n`, "utf8");
}

/**
 * Compares a built target's stamp with the files on disk now.
 *
 * @param {string} targetDir  a built target, e.g. apps/extension/dist/e2e-chromium
 * @param {string} repoRoot   the repository the target was built from
 * @returns {Promise<{ state: "current" } | { state: "unstamped", reason: string } | { state: "stale", changed: string[], removed: string[] }>}
 */
export async function compareBuildInfo(targetDir, repoRoot) {
  let stamp;
  try {
    stamp = JSON.parse(await readFile(path.join(targetDir, BUILD_INFO_FILE), "utf8"));
  } catch (error) {
    const reason = /** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT"
      ? `${BUILD_INFO_FILE} is missing, so this build predates the staleness stamp or was not produced by scripts/build-extension.mjs`
      : `${BUILD_INFO_FILE} is unreadable: ${error instanceof Error ? error.message : String(error)}`;
    return { state: "unstamped", reason };
  }
  if (stamp?.schema !== SCHEMA || typeof stamp.inputs !== "object" || stamp.inputs === null) {
    return { state: "unstamped", reason: `${BUILD_INFO_FILE} has schema ${String(stamp?.schema)}, expected ${SCHEMA}` };
  }
  const changed = [];
  const removed = [];
  await Promise.all(Object.entries(stamp.inputs).map(async ([relative, expected]) => {
    let actual;
    try {
      actual = sha256(await readFile(path.resolve(repoRoot, relative)));
    } catch {
      removed.push(relative);
      return;
    }
    if (actual !== expected) changed.push(relative);
  }));
  if (changed.length === 0 && removed.length === 0) return { state: "current" };
  return { state: "stale", changed: changed.sort(), removed: removed.sort() };
}

function toStampPath(repoRoot, file) {
  return path.relative(repoRoot, file).split(path.sep).join("/");
}
