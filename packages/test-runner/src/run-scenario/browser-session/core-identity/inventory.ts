import { readdir } from "node:fs/promises";
import path from "node:path";

/** Exact generator inventory: both package source/artifact trees, excluding directories named tests. */
export async function coreRuntimeBuildInventory(root: string): Promise<{ sources: string[]; artifacts: string[] }> {
  async function files(directory: string, suffix: string): Promise<string[]> {
    const entries = await readdir(path.join(root, directory), { withFileTypes: true });
    const found = await Promise.all(entries.filter(entry => entry.name !== "tests").map(entry => entry.isDirectory()
      ? files(`${directory}/${entry.name}`, suffix) : entry.name.endsWith(suffix) ? [`${directory}/${entry.name}`] : []));
    return found.flat();
  }
  const sources: string[] = [], artifacts: string[] = [];
  for (const packageId of ["contracts", "fluxiq"]) {
    sources.push(...await files(`packages/${packageId}/src`, ".ts"), `packages/${packageId}/package.json`);
    artifacts.push(...await files(`packages/${packageId}/dist`, ".js"));
  }
  return { sources: sources.sort(), artifacts: artifacts.sort() };
}
