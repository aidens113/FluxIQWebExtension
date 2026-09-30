// The build cache: content-fingerprinted stamp-and-skip for every package
// build and check, a per-step lock so two processes never build one step in
// one tree at once, and a shared store (`store/`) keyed by the
// path-independent fingerprint, so a new worktree restores what another tree
// built. `runStep` is what package scripts (through `cli.mjs`) and
// the Lab prelude call; `decideStep` answers without building; `buildOrder`
// lists a package's build steps dependencies first. The rest is what they are
// made of, exported for tests and the coverage proof (`prove-inputs.mjs`).
// Design, registry and coverage proof:
// docs/working/automated-testing-facility-plan/reports/t187-build-cache.md;
// the lock, the store and Core's libraries: t187-build-store.md beside it.

export { buildOrder } from "./build-order.mjs";
export { decideStep } from "./decide-step.mjs";
export { fingerprintStep } from "./fingerprint-step.mjs";
export { acquireStepLock, isProcessAlive } from "./lock/index.mjs";
export { digestFiles, EXCLUDED_DIRECTORY_NAMES, isInsideRoots, listInputFiles, openStatCache, outputDigest } from "./fingerprint/index.mjs";
export { REPOSITORY_ROOT } from "./repository-root.mjs";
export { runCommand } from "./run-command.mjs";
export { runStep } from "./run-step.mjs";
export { readStamp, removeStamp, STAMP_VERSION, writeStamp } from "./stamp/index.mjs";
export { STEPS } from "./steps.mjs";
export { entryDirectory, findEmbeddedPath, pathSpellings, pruneStore, readEntry, restoreEntry, saveEntry, storeDirectory } from "./store/index.mjs";
export { touchOutputs } from "./touch-outputs.mjs";
export { linkedCorePackages, readWorkspacePackages, resolveCoreLibrary, resolveStep, tsconfigReferences } from "./workspace/index.mjs";
