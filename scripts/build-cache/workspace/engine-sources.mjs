// The build-cache sources every fingerprint taken here covers, so a change to
// how a fingerprint is taken invalidates every stamp taken the old way: this
// repository's configuration (`scripts/build-cache`) and the engine it runs,
// Core's `scripts/build-cache` beside this checkout, each without its tests.
//
// Both are walked rather than listed by git: a Core library step resolves
// against the Core checkout (`resolve-core-library.mjs`), whose git does not
// list this repository, and Core's engine is in another repository for every
// step. Each is labelled by its place in its own tree, so the same sources in
// two checkouts fingerprint the same.

import path from "node:path";
import { coreRootOf } from "../../core-scripts/index.mjs";
import { REPOSITORY_ROOT } from "../repository-root.mjs";

const SOURCES = ["scripts", "build-cache"];
const OWN = path.join(REPOSITORY_ROOT, ...SOURCES);
const ENGINE = path.join(coreRootOf(REPOSITORY_ROOT), ...SOURCES);

/**
 * @param {string} labelPrefix "" for this repository's steps; a Core library step prefixes its labels
 * @returns {{ kind: "walk", label: string, labelBase: string, path: string, exclude: string[] }[]}
 */
export function engineSourceRoots(labelPrefix = "") {
  return [
    { label: `${labelPrefix}scripts/build-cache`, dir: OWN },
    { label: `${labelPrefix}core:scripts/build-cache`, dir: ENGINE }
  ].map(({ label, dir }) => ({ kind: "walk", label, labelBase: label, path: dir, exclude: [path.join(dir, "tests")] }));
}
