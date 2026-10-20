// The build cache of this repository: FluxIQ Core's engine
// (`core-engine.mjs`), bound to this repository's configuration
// (`repository.mjs`: its registry, resolver and Core-package resolution). It
// gives content-fingerprinted stamp-and-skip for every package build and
// check, a per-step lock so two processes never build one step in one tree at
// once, and a shared store keyed by the path-independent fingerprint, so a new
// worktree restores what another tree built.
//
// `runStep` is what package scripts (through `cli.mjs`), the Lab prelude and
// the worktree's Core build call; `decideStep` answers without building;
// `buildOrder` lists a package's build steps dependencies first;
// `resolveCoreLibrary` resolves a Core library package as a step. The rest is
// exported for the Lab, the tests and the coverage proof (`prove-inputs.mjs`).
// Design, registry and coverage proof:
// docs/working/automated-testing-facility-plan/reports/t187-build-cache.md;
// the lock, the store and Core's libraries: t187-build-store.md beside it.

export {
  acquireStepLock,
  buildOrder,
  coversPath,
  decideStep,
  fingerprintStep,
  isProcessAlive,
  listStepInputs,
  openStatCache,
  pathSpellings,
  readStamp,
  readWorkspacePackages,
  resolveStep,
  runStep,
  scheduleSteps,
  STAMP_VERSION,
  storeDirectory,
  tsconfigReferences
} from "./bound-engine.mjs";
export { WEB_EXTENSION_REPOSITORY } from "./repository.mjs";
export { REPOSITORY_ROOT } from "./repository-root.mjs";
export { STEPS } from "./steps.mjs";
export { linkedCorePackages, resolveCoreLibrary, resolveExtensionStep } from "./workspace/index.mjs";
