// The FluxIQ Core packages one downstream package compiles against: every
// `link:` target it declares, plus the Core workspace packages those depend
// on, transitively. `fluxiq`'s declarations import `@fluxiq/contracts`, so a
// package linking only `fluxiq` still reads contracts, and a fingerprint that
// hashed only what was linked would miss a contracts change.
//
// A link that does not lead into a pnpm workspace is returned alone, with no
// Core root, so its directory is still hashed.

import { existsSync } from "node:fs";
import path from "node:path";
import { readWorkspacePackages } from "./workspace-packages.mjs";

/**
 * @param {string[]} links absolute link targets
 * @returns {{ coreRoot: string | null, dir: string, name: string }[]} sorted by directory, without duplicates
 */
export function linkedCorePackages(links) {
  const found = new Map();
  const workspaces = new Map();
  const pending = links.map((dir) => path.resolve(dir));
  while (pending.length > 0) {
    const dir = pending.pop();
    if (found.has(dir)) continue;
    const coreRoot = workspaceRootOf(dir);
    if (coreRoot === null) {
      found.set(dir, { coreRoot: null, dir, name: path.basename(dir) });
      continue;
    }
    if (!workspaces.has(coreRoot)) workspaces.set(coreRoot, readWorkspacePackages(coreRoot));
    const packages = workspaces.get(coreRoot);
    const own = [...packages.values()].find((candidate) => path.resolve(candidate.dir) === dir);
    if (own === undefined) throw new Error(`${dir} is linked but is not a package of the workspace at ${coreRoot}`);
    found.set(dir, { coreRoot, dir, name: own.name });
    for (const name of own.workspaceDeps) {
      const dependency = packages.get(name);
      if (dependency === undefined) throw new Error(`${own.name} depends on workspace package ${name}, which ${coreRoot} does not contain`);
      pending.push(path.resolve(dependency.dir));
    }
    pending.push(...own.links);
  }
  return [...found.values()].sort((left, right) => (left.dir < right.dir ? -1 : left.dir > right.dir ? 1 : 0));
}

function workspaceRootOf(dir) {
  for (let current = path.dirname(dir); ; current = path.dirname(current)) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    if (path.dirname(current) === current) return null;
  }
}
