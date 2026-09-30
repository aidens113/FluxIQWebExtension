// The content digest of a step's outputs, as they are on disk now. A stamp
// records it after a successful build, and a reuse requires it unchanged, so
// an output deleted, edited or half-overwritten since (by a crashed build, a
// clean, or a hand edit) is rebuilt rather than trusted. A check has no
// outputs, and its digest is that of the empty list.

import { digestFiles } from "./digest-files.mjs";
import { listInputFiles } from "./list-input-files.mjs";

/**
 * @param {{ outputs: { label: string, path: string, match: RegExp | null }[] }} resolved
 * @param {{ hash(file: string): Promise<string> }} statCache
 * @returns {Promise<string>}
 */
export async function outputDigest(resolved, statCache) {
  const files = [];
  for (const output of resolved.outputs) files.push(...(await listInputFiles([{ label: output.label, path: output.path, exclude: [] }], { match: output.match })));
  return digestFiles(files, statCache);
}
