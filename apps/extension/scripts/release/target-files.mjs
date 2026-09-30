import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Every file under a built target, keyed by its "/"-separated path relative to
 * the target root: the same shape `readZip` yields, so a directory and the
 * archive made from it are verified by the same code.
 *
 * @param {string} directory
 * @returns {Promise<Map<string, Buffer>>}
 */
export async function readTargetFiles(directory) {
  const files = new Map();
  async function walk(relative) {
    for (const entry of await readdir(path.join(directory, relative), { withFileTypes: true })) {
      const child = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await walk(child);
      else if (entry.isFile()) files.set(child, await readFile(path.join(directory, child)));
    }
  }
  await walk("");
  return new Map([...files].sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0)));
}
