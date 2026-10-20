// What esbuild reads for a step that bundles (`bundles: true`), one listing
// per browser entry, for the coverage proof (`prove-inputs.mjs`) to hold
// against the step's inputs beside tsc's listings. Each entry is bundled
// through `bundleExtensionEntry` with `write: false` into a scratch directory,
// so nothing on disk changes; the listings are taken once per package.

import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const taken = new Map();

/**
 * @param {{ bundles?: boolean, packageDir: string }} resolved
 * @returns {Promise<{ project: string, files: string[] }[]>}
 */
export async function bundleListings(resolved) {
  if (resolved.bundles !== true) return [];
  if (!taken.has(resolved.packageDir)) taken.set(resolved.packageDir, takeListings(resolved.packageDir));
  return taken.get(resolved.packageDir);
}

async function takeListings(packageDir) {
  const script = path.join(packageDir, "scripts", "build-extension.mjs");
  const { EXTENSION_ENTRY_NAMES, bundleExtensionEntry } = await import(pathToFileURL(script).href);
  const scratch = mkdtempSync(path.join(os.tmpdir(), "build-cache-proof-"));
  const listings = [];
  try {
    for (const entry of EXTENSION_ENTRY_NAMES) {
      const inputs = new Set();
      await bundleExtensionEntry(entry, scratch, { logLevel: "error", write: false, inputs });
      listings.push({ project: `esbuild ${entry}`, files: [...inputs] });
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
  return listings;
}
