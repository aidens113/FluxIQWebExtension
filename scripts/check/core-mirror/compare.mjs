// Compare every mirror set between this repository and FluxIQ Core.
//
// Each side's files are what git would commit there (tracked plus untracked,
// not ignored), so a mirror file written but not yet added is still compared.
// Contents are compared after CRLF is normalised to LF: Core's working tree is
// checked out with CRLF while its index holds LF, and a line-ending difference
// is not a difference in the code.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { listRepositoryFiles } from "../../structure-audit/repository-files.mjs";
import { mirrorSetFiles } from "./set-files.mjs";

const normalise = (buffer) => buffer.toString("utf8").replaceAll("\r\n", "\n");

/**
 * @param {{ extRoot: string, coreRoot: string, sets: readonly { name: string, include: readonly string[], exclude?: readonly string[] }[], listFiles?: (root: string) => string[] }} input
 * @returns {Promise<{ inSync: boolean, sets: { name: string, files: number, differences: { path: string, kind: "differs" | "extension-only" | "core-only" }[] }[] }>}
 */
export async function compareMirrors({ extRoot, coreRoot, sets, listFiles = listRepositoryFiles }) {
  const extFiles = listFiles(extRoot);
  const coreFiles = listFiles(coreRoot);
  const results = [];
  for (const set of sets) {
    const ext = mirrorSetFiles(set, extFiles);
    const core = new Set(mirrorSetFiles(set, coreFiles));
    const differences = [];
    for (const file of ext) {
      if (!core.has(file)) {
        differences.push({ path: file, kind: "extension-only" });
        continue;
      }
      const [mine, theirs] = await Promise.all([readFile(path.join(extRoot, file)), readFile(path.join(coreRoot, file))]);
      if (normalise(mine) !== normalise(theirs)) differences.push({ path: file, kind: "differs" });
    }
    const extSet = new Set(ext);
    for (const file of core) {
      if (!extSet.has(file)) differences.push({ path: file, kind: "core-only" });
    }
    differences.sort((a, b) => a.path.localeCompare(b.path));
    results.push({ name: set.name, files: new Set([...ext, ...core]).size, differences });
  }
  return { inSync: results.every((set) => set.differences.length === 0), sets: results };
}
