// Loads a module of FluxIQ Core's developer tooling from the Core beside this
// checkout.
//
// Core owns the build-cache engine and the task rules both repositories share
// (id allocation, id refs, branch naming, the git runner); this repository
// imports them instead of keeping a copy, and keeps only its own configuration.
// Every such import goes through here so that a Core too old to have the module
// fails with what to do about it, not with a bare module-not-found: a worktree
// whose Core branch predates a tooling change needs Core's `dev` merged into it,
// and the main checkout's Core needs updating to Core's `dev`.

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { existsSync } from "node:fs";
import { coreRootOf } from "./core-root.mjs";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * @param {string} relativePath a module path inside Core, e.g. "scripts/task/task-id.mjs"
 * @param {{ extRoot?: string }} [options] the checkout whose Core to use (default: this one)
 * @returns {Promise<Record<string, unknown>>} the module's namespace
 */
export async function importCoreScript(relativePath, options = {}) {
  const extRoot = options.extRoot ?? REPOSITORY_ROOT;
  const coreRoot = coreRootOf(extRoot);
  const modulePath = path.join(coreRoot, ...relativePath.split("/"));
  if (!existsSync(coreRoot)) {
    throw new Error(`FluxIQ Core is not beside ${extRoot}: ${coreRoot} does not exist, so ${relativePath} cannot be loaded. Create the Core sibling (pnpm task start makes it for a task worktree).`);
  }
  if (!existsSync(modulePath)) {
    throw new Error(`FluxIQ Core at ${coreRoot} has no ${relativePath}: that Core predates the shared tooling this checkout imports. Merge Core's dev into it (or update it to Core's dev), then retry.`);
  }
  return import(pathToFileURL(modulePath).href);
}
