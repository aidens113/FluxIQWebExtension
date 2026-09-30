// Puts a step's just-stamped result into the shared store, keyed by its
// fingerprint, so another tree whose inputs fingerprint the same restores it
// instead of building.
//
// A build stores its output files; a check has none, so its entry is the
// record that it passed. The fingerprint is path-independent -- every label is
// relative to its tree or to Core, and an environment value that is an
// absolute path is fingerprinted relative to the tree (`resolve-step.mjs`) --
// so the same inputs in two checkouts give the same key.
//
// Only relocatable outputs are stored. An output under a path outside the tree,
// or any output file holding the absolute path of the tree or of the Core it
// links, in any spelling (`path-spellings.mjs`), would point back at this tree
// from wherever it was restored; such a step is refused, with the reason.
//
// The write is atomic: the entry is assembled in `tmp/` and renamed into
// place, so a reader sees a whole entry or none. An entry already stored
// under the key with the same output digest is kept and marked used; one with
// a different digest (a forced rebuild that came out differently) is replaced.
//
// entry.json: { format, step, kind, fingerprint, outputDigest, bytes,
//               storedAt, files: [{ output, relative, size }] }

import { randomUUID } from "node:crypto";
import { copyFile, mkdir, rename, rm, stat, utimes, writeFile } from "node:fs/promises";
import path from "node:path";
import { entryDirectory, ENTRY_FORMAT, temporaryDirectory } from "./entry-location.mjs";
import { findEmbeddedPath } from "./find-embedded-path.mjs";
import { listOutputFiles } from "./list-output-files.mjs";
import { pathSpellings } from "./path-spellings.mjs";
import { pruneStore } from "./prune-store.mjs";
import { readEntry } from "./read-entry.mjs";

/**
 * @param {string} storeDir
 * @param {{ name: string, kind: string, repoRoot: string, outputs: { label: string, path: string, match: RegExp | null }[], relocationRoots: string[] }} resolved
 * @param {{ fingerprint: string, outputDigest: string }} result
 * @returns {Promise<{ stored: boolean, reason: string }>}
 */
export async function saveEntry(storeDir, resolved, result) {
  const outside = resolved.outputs.find((output) => output.label === ".." || output.label.startsWith("../"));
  if (outside !== undefined) return { stored: false, reason: `not stored: output ${outside.label} is outside the tree` };

  const files = await listOutputFiles(resolved);
  const embedded = await findEmbeddedPath(files.map((file) => file.path), pathSpellings(resolved.relocationRoots));
  if (embedded !== null) {
    const shown = path.relative(resolved.repoRoot, embedded.file).split(path.sep).join("/");
    return { stored: false, reason: `not stored: ${shown} holds this tree's absolute path (${embedded.spelling}), so it is not relocatable` };
  }

  const final = entryDirectory(storeDir, result.fingerprint);
  const existing = await readEntry(final);
  if (existing !== null && existing.outputDigest === result.outputDigest) {
    const now = new Date();
    await utimes(path.join(final, "entry.json"), now, now);
    return { stored: true, reason: "already in the shared store" };
  }

  const temporary = path.join(temporaryDirectory(storeDir), `${process.pid}-${randomUUID()}`);
  await mkdir(path.join(temporary, "files"), { recursive: true });
  try {
    const described = [];
    let bytes = 0;
    for (const [index, file] of files.entries()) {
      await copyFile(file.path, path.join(temporary, "files", String(index)));
      const { size } = await stat(file.path);
      bytes += size;
      described.push({ output: file.output, relative: file.relative, size });
    }
    const entry = { format: ENTRY_FORMAT, step: resolved.name, kind: resolved.kind, fingerprint: result.fingerprint, outputDigest: result.outputDigest, bytes, storedAt: new Date().toISOString(), files: described };
    await writeFile(path.join(temporary, "entry.json"), `${JSON.stringify(entry)}\n`);
    await mkdir(path.dirname(final), { recursive: true });
    // Absent, damaged or holding a different result: whatever is there goes.
    await rm(final, { recursive: true, force: true });
    const placed = await renameInto(temporary, final);
    const pruned = await pruneStore(storeDir);
    const note = pruned.removed > 0 ? `, pruned ${pruned.removed} old entr${pruned.removed === 1 ? "y" : "ies"}` : "";
    return { stored: true, reason: `${placed ? "stored in the shared store" : "already in the shared store"} (${files.length} file(s), ${bytes} bytes${note})` };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

/** Renames the assembled entry into place; `false` when another writer placed the same key first. */
async function renameInto(temporary, final) {
  try {
    await rename(temporary, final);
    return true;
  } catch (error) {
    if (["EEXIST", "ENOTEMPTY", "EPERM", "EBUSY"].includes(error?.code) && (await readEntry(final)) !== null) return false;
    throw error;
  }
}
