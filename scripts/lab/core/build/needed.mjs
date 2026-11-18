// Which Core packages this downstream workspace needs built.
//
// Core builds more than downstream uses (a CLI, a web panel), and Core's own
// standard library build does not build all of it. Demanding every Core package
// with a `build` script made a package nothing here imports -- `@fluxiq/cloud`
// -- refuse every downstream build, check and Lab run.
//
// No list is kept here. The set is read from manifests: the Core packages named
// in the dependencies of this workspace's own packages (the root, `apps/*`,
// `domain`, `packages/*`), plus the Core packages those depend on, transitively,
// as Core's manifests declare. A Core package downstream starts depending on is
// covered the day it is added; one nothing downstream reaches is never required.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEPENDENCY_FIELDS = ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"];

/** The downstream workspace this module sits in: scripts/lab/core/build/ is four levels below it. */
export const DOWNSTREAM_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

/**
 * @param {string} downstreamRoot
 * @param {Map<string, unknown>} coreManifests Core package name -> manifest
 * @returns {Promise<Set<string>>} names of the Core packages needed, transitive closure included
 */
export async function neededCorePackageNames(downstreamRoot, coreManifests) {
  const needed = new Set();
  const queue = [];
  const consider = (manifest) => {
    for (const field of DEPENDENCY_FIELDS) {
      for (const name of Object.keys(manifest?.[field] ?? {})) {
        if (coreManifests.has(name) && !needed.has(name)) {
          needed.add(name);
          queue.push(name);
        }
      }
    }
  };
  for (const manifest of await downstreamManifests(downstreamRoot)) consider(manifest);
  while (queue.length > 0) consider(coreManifests.get(queue.pop()));
  return needed;
}

/** @param {string} root */
async function downstreamManifests(root) {
  const manifests = [await readJson(path.join(root, "package.json"))];
  for (const group of ["apps", "packages"]) {
    for (const directory of await subdirectories(path.join(root, group))) manifests.push(await readJson(path.join(directory, "package.json")));
  }
  manifests.push(await readJson(path.join(root, "domain", "package.json")));
  return manifests.filter((manifest) => manifest !== undefined);
}

/** @param {string} parent */
async function subdirectories(parent) {
  try {
    return (await readdir(parent, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => path.join(parent, entry.name));
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return [];
    throw error;
  }
}

/** @param {string} file */
async function readJson(file) {
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") return undefined;
    throw error;
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`${file} is not valid JSON, so the Lab cannot tell which FluxIQ Core packages this workspace depends on: ${error instanceof Error ? error.message : String(error)}`);
  }
}
