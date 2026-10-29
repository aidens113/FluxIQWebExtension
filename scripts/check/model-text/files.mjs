// Directory walks for the model-text check: the TypeScript files under a root,
// without test folders, test files or build output.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const SKIPPED_DIRECTORIES = new Set(["tests", "node_modules", "dist", "build", ".test-build"]);

/** @param {string} root @returns {Promise<string[]>} absolute paths of the .ts files under root, sorted */
export async function typescriptFiles(root) {
  const found = [];
  async function visit(directory) {
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) await visit(full);
      } else if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts") && !entry.name.endsWith(".test.ts")) {
        found.push(full);
      }
    }
  }
  await visit(root);
  return found.sort();
}

/** @param {string} file @returns {Promise<string>} */
export function readText(file) {
  return readFile(file, "utf8");
}
