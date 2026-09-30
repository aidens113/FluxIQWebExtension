// Whether a file is covered by a resolved step's fingerprint: under one of its
// input roots, not under that root's excluded paths, and not under a directory
// the walk skips by name. This is the exact rule `list-input-files.mjs` walks
// by, asked of one path, so the coverage proof and the registry test measure
// what the fingerprint really hashes.

import path from "node:path";
import { EXCLUDED_DIRECTORY_NAMES } from "./excluded-directory-names.mjs";

/**
 * @param {string} file absolute path
 * @param {{ roots: { path: string, exclude: string[] }[] }} resolved
 * @returns {boolean}
 */
export function isInsideRoots(file, resolved) {
  const target = key(file);
  return resolved.roots.some((root) => {
    const base = key(root.path);
    if (target === base) return true;
    const relative = path.relative(base, target);
    if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) return false;
    if (root.exclude.some((excluded) => target === key(excluded) || target.startsWith(`${key(excluded)}${path.sep}`))) return false;
    return !relative.split(path.sep).slice(0, -1).some((segment) => EXCLUDED_DIRECTORY_NAMES.has(segment));
  });
}

function key(target) {
  const resolved = path.resolve(target);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}
