// A bundle in which esbuild starts modules lazily can read exports before they
// exist; every bundle build in this repository refuses one.
export { assertEagerBundle } from "./assert-eager-bundle.mjs";
export { assertEagerFiles } from "./assert-eager-files.mjs";
export { findLazyModules } from "./find-lazy-modules.mjs";
