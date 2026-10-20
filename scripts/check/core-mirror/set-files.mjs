// The files of one repository that a mirror set covers, given every file the
// repository lists. An excluded path is left out even when an include covers
// it; an excluded path ending in `/` leaves out everything under it.

const covers = (pattern, file) => (pattern.endsWith("/") ? file.startsWith(pattern) : file === pattern);

/**
 * @param {{ include: readonly string[], exclude?: readonly string[] }} set
 * @param {readonly string[]} files POSIX paths relative to the repository root
 * @returns {string[]} the covered files, sorted
 */
export function mirrorSetFiles(set, files) {
  const exclude = set.exclude ?? [];
  return files
    .filter((file) => set.include.some((pattern) => covers(pattern, file)))
    .filter((file) => !exclude.some((pattern) => covers(pattern, file)))
    .sort();
}
