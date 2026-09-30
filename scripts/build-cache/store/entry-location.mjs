// The store's layout, in one place:
//
//   <store>/v1/<fingerprint>/entry.json   what the entry is (see save-entry.mjs);
//                                         its mtime is when it was last used
//   <store>/v1/<fingerprint>/files/<n>    the n-th output file's bytes
//   <store>/tmp/<pid>-<uuid>/             an entry being written, renamed into
//                                         v1/ only once it is complete
//
// Blobs are numbered rather than named after the file, so an entry's paths
// stay short however deep the output tree is. The `v1` directory is the
// format: a new format gets a new directory, and the old one ages out.

import path from "node:path";

export const ENTRY_FORMAT = 1;
const ENTRIES = `v${ENTRY_FORMAT}`;

/** @param {string} storeDir */
export function entriesDirectory(storeDir) {
  return path.join(storeDir, ENTRIES);
}

/** @param {string} storeDir @param {string} fingerprint */
export function entryDirectory(storeDir, fingerprint) {
  if (!/^[0-9a-f]{64}$/u.test(fingerprint)) throw new Error(`build-cache: "${fingerprint}" is not a sha256 fingerprint`);
  return path.join(entriesDirectory(storeDir), fingerprint);
}

/** @param {string} storeDir */
export function temporaryDirectory(storeDir) {
  return path.join(storeDir, "tmp");
}
