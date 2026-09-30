// One sha256 over a listed set of files: each file's label and content hash,
// in the listed order, so a rename, an edit, an addition or a removal all
// change it. An absent root (`path: null`) contributes its label and a marker.
// Files are hashed a bounded number at a time, so a Core `dist/` of thousands
// of files does not exhaust file handles.

import { createHash } from "node:crypto";

const CONCURRENCY = 64;

/**
 * @param {{ label: string, path: string | null }[]} files as `listInputFiles` returns them
 * @param {{ hash(file: string): Promise<string> }} statCache
 * @returns {Promise<string>}
 */
export async function digestFiles(files, statCache) {
  const hashes = new Array(files.length);
  let next = 0;
  async function worker() {
    while (next < files.length) {
      const index = next;
      next += 1;
      const file = files[index];
      hashes[index] = file.path === null ? "absent" : await statCache.hash(file.path);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
  const digest = createHash("sha256");
  for (let index = 0; index < files.length; index += 1) digest.update(`${files[index].label}\0${hashes[index]}\n`);
  return digest.digest("hex");
}
