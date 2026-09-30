// Every file under a set of labelled roots, as (label, absolute path) pairs in
// a stable order: the list a fingerprint or an output digest hashes.
//
// Directories named in `EXCLUDED_DIRECTORY_NAMES` are skipped at any depth, and
// each root's `exclude` paths are skipped wherever they fall. A root that does
// not exist is listed once with `path: null`, so a directory or file appearing
// or disappearing changes the digest instead of hashing the same as before.
// A symbolic link is followed; a linked directory already walked is not walked
// twice, so a cycle ends.

import { readdir, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { EXCLUDED_DIRECTORY_NAMES } from "./excluded-directory-names.mjs";

/**
 * @param {{ label: string, path: string, exclude?: string[] }[]} roots
 * @param {{ match?: RegExp | null }} [options] keep only files whose name matches
 * @returns {Promise<{ label: string, path: string | null }[]>}
 */
export async function listInputFiles(roots, options = {}) {
  const listed = [];
  for (const root of roots) {
    const excluded = new Set((root.exclude ?? []).map(key));
    let stats;
    try {
      stats = await stat(root.path);
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
      listed.push({ label: root.label, path: null });
      continue;
    }
    if (stats.isFile()) {
      listed.push({ label: root.label, path: root.path });
      continue;
    }
    const files = [];
    await walk(root.path, "", excluded, new Set([key(await realpath(root.path))]), files);
    for (const file of files) {
      if (options.match && !options.match.test(path.basename(file.path))) continue;
      listed.push({ label: `${root.label}/${file.relative}`, path: file.path });
    }
  }
  return listed.sort((left, right) => (left.label < right.label ? -1 : left.label > right.label ? 1 : 0));
}

async function walk(directory, relative, excluded, visited, files) {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    const shown = relative === "" ? entry.name : `${relative}/${entry.name}`;
    if (excluded.has(key(target))) continue;
    let isDirectory = entry.isDirectory();
    let isFile = entry.isFile();
    if (entry.isSymbolicLink()) {
      const linked = await stat(target);
      isDirectory = linked.isDirectory();
      isFile = linked.isFile();
      if (isDirectory) {
        const real = key(await realpath(target));
        if (visited.has(real)) continue;
        visited.add(real);
      }
    }
    if (isDirectory) {
      if (!EXCLUDED_DIRECTORY_NAMES.has(entry.name)) await walk(target, shown, excluded, visited, files);
    } else if (isFile) {
      files.push({ relative: shown, path: target });
    }
  }
}

function key(target) {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
