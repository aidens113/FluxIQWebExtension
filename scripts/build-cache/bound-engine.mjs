// Core's build-cache engine as this repository uses it, by name: the functions
// that work on a repository's steps, bound to this one (`repository.mjs`), and
// the ones that need no repository, as Core exports them. Callers here -- the
// package scripts through `cli.mjs`, the Lab prelude, the worktree's Core
// build -- import these from `index.mjs` and never pass a repository.
//
// `runStep`, `decideStep` and the rest still accept `repoRoot` and `steps`, to
// point one call at a scratch checkout, as the tests do.

import { coreEngine } from "./core-engine.mjs";
import { WEB_EXTENSION_REPOSITORY } from "./repository.mjs";

export const { buildOrder, decideStep, fingerprintStep, proveInputs, resolveStep, runCli, runStep, scheduleSteps, storeDirectory, tsconfigReferences } =
  coreEngine.buildCacheFor(WEB_EXTENSION_REPOSITORY);

export const { acquireStepLock, coversPath, isProcessAlive, listStepInputs, openStatCache, pathSpellings, readStamp, readWorkspacePackages, STAMP_VERSION } = coreEngine;
