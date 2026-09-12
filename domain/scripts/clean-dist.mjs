// Remove the previous `tsc` emit from `dist/` before the next one.
//
// `tsc -p tsconfig.json` overwrites but never deletes, so a module that has
// been renamed or split leaves its old output behind for ever. That is not
// cosmetic: when `runtime/llm-evidence.ts` became `runtime/llm-evidence/`,
// `dist/runtime/` ended up holding both the stale `llm-evidence.js` and the
// new `llm-evidence/index.js`, and a Node consumer resolving
// `./llm-evidence` would have loaded the file that no longer has a source.
// `dist/runtime/{commands,flow-runner}.*` had outlived their sources the same
// way. Core cleans with `tsc -b --clean`; this package is not a build-mode
// project, so it cleans here.
//
// Only what `tsc` emits is removed. `dist/host/web-panel-host.mjs` is the
// esbuild panel-host bundle from `build-web-panel-host.mjs`, and
// `pnpm lab:interactive` builds it *before* the workspace build reaches this
// package, so deleting it here would break the interactive Lab.

import { readdir, rm, rmdir } from "node:fs/promises";
import path from "node:path";

const EMITTED = /\.(?:js|d\.ts)(?:\.map)?$/;

const outputRoot = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "..", "dist"));
const removed = await cleanDirectory(outputRoot);
console.log(`clean-dist: removed ${removed} emitted file(s) from ${path.relative(process.cwd(), outputRoot) || "."}`);

/** Removes every emitted file under `directory`, and the directory itself once it is empty. Returns the file count. */
async function cleanDirectory(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return 0;
    throw error;
  }
  let removed = 0;
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) removed += await cleanDirectory(target);
    else if (entry.isFile() && EMITTED.test(entry.name)) {
      await rm(target);
      removed += 1;
    }
  }
  if (directory !== outputRoot && (await readdir(directory)).length === 0) await rmdir(directory);
  return removed;
}
