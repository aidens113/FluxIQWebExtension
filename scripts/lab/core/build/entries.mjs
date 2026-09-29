// Which of FluxIQ Core's compiled entry points exist on disk.
//
// The staleness guard compares Core's newest source file with its newest built
// file, and so has nothing to say about a Core with no build at all: a fresh
// checkout has sources and no `dist`, and "nothing built" is not "stale". The
// quiescence guard sees an absent `dist` as nothing to wait for. So a Core that
// was never built passed every guard the Lab had, and the run died inside on a
// missing module, recorded as a product failure.
//
// What "built" means is taken from Core's own manifests, not from a list kept
// here: every package under `packages/` that declares a `build` script promises
// the files its `exports`, `main`, `types` and `bin` name, and a Core is built
// when those files exist. A fourth Core package is covered the day it is added,
// and a `dist` that a clean emptied and a build never refilled reads as the
// incomplete Core it is, rather than as a directory that exists.

import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

/**
 * @typedef {{ name: string, directory: string, expected: string[], missing: string[] }} CorePackageEntries
 * @typedef {{ coreRoot: string, packagesFound: boolean, installed: boolean, packages: CorePackageEntries[] }} CoreBuildEntries
 */

/**
 * @param {string} coreRoot
 * @returns {Promise<CoreBuildEntries>}
 */
export async function scanCoreBuildEntries(coreRoot) {
  const packagesRoot = path.join(coreRoot, "packages");
  const installed = await exists(path.join(coreRoot, "node_modules"));
  let directories;
  try {
    directories = await readdir(packagesRoot, { withFileTypes: true });
  } catch (error) {
    if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    // Said as a finding, not as an empty answer: the verdict names the root
    // that holds no Core, which is the thing a person has to fix.
    return { coreRoot, packagesFound: false, installed, packages: [] };
  }
  const packages = [];
  for (const entry of directories) {
    if (!entry.isDirectory()) continue;
    const directory = path.join(packagesRoot, entry.name);
    const manifest = await readManifest(path.join(directory, "package.json"));
    if (manifest === undefined || typeof manifest.scripts?.build !== "string") continue;
    const expected = entryPoints(manifest);
    const missing = [];
    for (const relative of expected) {
      if (!(await exists(path.join(directory, relative)))) missing.push(relative);
    }
    packages.push({ name: typeof manifest.name === "string" ? manifest.name : entry.name, directory, expected, missing });
  }
  return { coreRoot, packagesFound: true, installed, packages };
}

/**
 * The files a package's manifest promises, relative to the package. A package
 * that declares a build and names no entry point still has to have built
 * something, so it is held to its `dist` directory existing.
 *
 * @param {Record<string, any>} manifest
 * @returns {string[]}
 */
function entryPoints(manifest) {
  const found = new Set();
  // `exports` targets must start with `./`; `main`, `types` and `bin` may be
  // written bare (`dist/index.js`), and mean the same file.
  const add = (value, bareAllowed) => {
    if (typeof value === "string") {
      const relative = bareAllowed && !value.startsWith("./") && !value.startsWith("/") && !value.startsWith("..") ? `./${value}` : value;
      // A pattern export (`./*`) names no one file to look for.
      if (relative.startsWith("./") && !relative.includes("*")) found.add(path.normalize(relative));
      return;
    }
    if (Array.isArray(value)) for (const item of value) add(item, bareAllowed);
    else if (value && typeof value === "object") for (const item of Object.values(value)) add(item, bareAllowed);
  };
  add(manifest.exports, false);
  for (const field of ["main", "module", "types", "typings", "bin"]) add(manifest[field], true);
  if (found.size === 0) found.add("dist");
  return [...found].sort();
}

/**
 * @param {string} file
 * @returns {Promise<Record<string, any> | undefined>} `undefined` only when there is no manifest; a malformed one throws
 */
async function readManifest(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    // A directory under `packages/` with no manifest is not a package.
    if (error?.code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`FluxIQ Core's ${file} is not valid JSON, so the Lab cannot tell what Core is meant to have built: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/** @param {string} target */
async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return false;
    throw error;
  }
}
