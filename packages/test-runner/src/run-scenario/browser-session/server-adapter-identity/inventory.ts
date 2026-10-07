import { readdir } from "node:fs/promises";
import path from "node:path";
/** Exact owning native server input inventory: complete source, generator and cache key sets. */
export async function serverAdapterSourceInventory(root: string): Promise<string[]> {
  async function files(directory: string, suffix: string): Promise<string[]> {
    const entries = await readdir(path.join(root, directory), { withFileTypes: true });
    return (await Promise.all(entries.filter(entry => entry.name !== "tests").map(entry => entry.isDirectory()
      ? files(`${directory}/${entry.name}`, suffix) : entry.name.endsWith(suffix) ? [`${directory}/${entry.name}`] : []))).flat();
  }
  return [...await files("apps/web/src/server", ".ts"), ...await files("apps/web/scripts", ".mjs"), ...await files("scripts/build-cache", ".mjs"),
    "apps/web/src/lib/fluxiq.ts", "apps/web/src/instrumentation.ts", "apps/web/package.json", "package.json", "pnpm-lock.yaml"].sort();
}
