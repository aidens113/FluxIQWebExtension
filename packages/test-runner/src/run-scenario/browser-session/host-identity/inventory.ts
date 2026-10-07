import { readdir } from "node:fs/promises";
import path from "node:path";
/** Matches the host generator's complete input inventory, including generator and cache code. */
export async function hostSourceInventory(root: string): Promise<string[]> {
  async function files(directory: string, suffix: string): Promise<string[]> {
    const entries = await readdir(path.join(root, directory), { withFileTypes: true });
    return (await Promise.all(entries.filter(entry => entry.name !== "tests").map(entry => entry.isDirectory()
      ? files(`${directory}/${entry.name}`, suffix) : entry.name.endsWith(suffix) ? [`${directory}/${entry.name}`] : []))).flat();
  }
  return [...await files("domain/src", ".ts"), ...await files("domain/scripts", ".mjs"), ...await files("scripts/build-cache", ".mjs"), "domain/package.json"].sort();
}
