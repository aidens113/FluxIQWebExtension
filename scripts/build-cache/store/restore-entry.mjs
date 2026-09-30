// Restores a step's result from the shared store instead of building it.
//
// The entry is the one stored under the step's current fingerprint. Restoring
// replaces every file the step's output digest covers with the stored files,
// sets their modification time to now (a restore is exactly as current as a
// build, and mtime-based staleness guards must agree), then requires that
//   - the outputs, digested again from disk, equal the stored output digest;
//   - every required output exists.
// Only then is the local stamp written, so the next run in this tree is an
// ordinary reuse. Anything else -- an entry for another step, a missing or
// altered blob, a digest that does not match -- discards the entry, removes
// what was copied and answers "not restored", and the caller builds.
// A check's entry has no files: restoring it is writing the stamp that says
// these exact inputs passed.

import { existsSync } from "node:fs";
import { copyFile, mkdir, rm, utimes } from "node:fs/promises";
import path from "node:path";
import { outputDigest } from "../fingerprint/index.mjs";
import { STAMP_VERSION, writeStamp } from "../stamp/index.mjs";
import { entryDirectory, ENTRY_FORMAT } from "./entry-location.mjs";
import { listOutputFiles } from "./list-output-files.mjs";
import { readEntry } from "./read-entry.mjs";

/**
 * @param {string} storeDir
 * @param {{ name: string, repoRoot: string, outputs: { label: string, path: string, match: RegExp | null }[], required: string[], stampPath: string }} resolved
 * @param {{ fingerprint: string, roots: Record<string, string> }} decision
 * @param {{ hash(file: string): Promise<string> }} statCache
 * @returns {Promise<{ restored: boolean, reason: string | null }>} `reason` is null when the store simply has no entry
 */
export async function restoreEntry(storeDir, resolved, decision, statCache) {
  const dir = entryDirectory(storeDir, decision.fingerprint);
  const entry = await readEntry(dir);
  if (entry === null) {
    if (existsSync(dir)) return discard(dir, resolved, "its description is missing or unreadable");
    return { restored: false, reason: null };
  }
  if (entry.format !== ENTRY_FORMAT || entry.fingerprint !== decision.fingerprint || entry.step !== resolved.name || !Array.isArray(entry.files)) {
    return discard(dir, resolved, `it does not describe ${resolved.name} at this fingerprint`);
  }
  const outputs = new Map(resolved.outputs.map((output) => [output.label, output]));
  const unknown = entry.files.find((file) => !outputs.has(file.output));
  if (unknown !== undefined) return discard(dir, resolved, `it holds a file of ${unknown.output}, which is not an output of this step`);

  await removeOutputs(resolved);
  const now = new Date();
  for (const [index, file] of entry.files.entries()) {
    const target = targetOf(outputs.get(file.output), file.relative);
    await mkdir(path.dirname(target), { recursive: true });
    try {
      await copyFile(path.join(dir, "files", String(index)), target);
    } catch (error) {
      if (error?.code === "ENOENT") return discard(dir, resolved, `blob ${index} (${file.output}/${file.relative}) is missing`);
      throw error;
    }
    await utimes(target, now, now);
  }

  const digest = await outputDigest(resolved, statCache);
  if (digest !== entry.outputDigest) return discard(dir, resolved, `the restored outputs digest to ${digest.slice(0, 12)}, not the stored ${String(entry.outputDigest).slice(0, 12)}`);
  const missing = resolved.required.find((file) => !existsSync(file));
  if (missing !== undefined) return discard(dir, resolved, `it lacks the required ${path.relative(resolved.repoRoot, missing).split(path.sep).join("/")}`);

  await writeStamp(resolved.stampPath, { version: STAMP_VERSION, step: resolved.name, fingerprint: decision.fingerprint, outputDigest: digest, roots: decision.roots });
  await utimes(path.join(dir, "entry.json"), now, now);
  return { restored: true, reason: null };
}

function targetOf(output, relative) {
  return relative === "" ? output.path : path.join(output.path, ...relative.split("/"));
}

async function removeOutputs(resolved) {
  for (const file of await listOutputFiles(resolved)) await rm(file.path, { force: true });
}

/** Deletes a bad entry and whatever of it was copied, so the build that follows starts from nothing stale. */
async function discard(dir, resolved, why) {
  await removeOutputs(resolved);
  await rm(dir, { recursive: true, force: true });
  return { restored: false, reason: `store entry discarded, because ${why}` };
}
