// Comparing paths the way this machine's file system does: Windows paths are
// case-insensitive and accept either slash, so two spellings of one directory
// must compare equal before the pair can refuse to be the working checkout.

import path from "node:path";

function key(value) {
  const resolved = path.resolve(value).replace(/[\\/]+$/u, "");
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

/** Whether `a` and `b` name the same directory. */
export function samePath(a, b) {
  return key(a) === key(b);
}

/** Whether `child` is `parent` or lies below it. */
export function pathInside(child, parent) {
  const relative = path.relative(key(parent), key(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}
