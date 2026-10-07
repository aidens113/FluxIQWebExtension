import { readdir } from "node:fs/promises";
import path from "node:path";
/** Complete host source and owning generator/cache source inventory, excluding tests. */
export async function hostSourceInventory(root) {
  async function files(directory, suffix) {
    const entries = await readdir(path.join(root, directory), { withFileTypes: true });
    return (await Promise.all(entries.filter(entry => entry.name !== "tests").map(entry => entry.isDirectory()
      ? files(`${directory}/${entry.name}`, suffix) : entry.name.endsWith(suffix) ? [`${directory}/${entry.name}`] : []))).flat();
  }
  return [...await files("domain/src", ".ts"), ...await files("domain/scripts", ".mjs"), ...await files("scripts/build-cache", ".mjs"), "domain/package.json"].sort();
}
