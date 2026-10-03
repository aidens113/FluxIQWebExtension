# t194-w60b manifest contract

## Outcome
Done.

## What changed and why
- `packages/test-contracts/src/run.ts`: `RepositoryChange`, optional `changes`/`changesOmitted` on `RepositoryRevision`; `RunInvocationRecord` and optional `RunManifest.invocation`.
- `packages/test-contracts/src/run-validation.ts`: repository key list admits `changes`, `changesOmitted` (each change `{status, path, from?}` non-empty strings; omitted a non-negative integer); top level admits `invocation` (`via` enumerated run-lab/test-runner, optional `script`, `labInvocation` = "unreadable", `args` string array, `fluxiqEnvironment` matching `^FLUXIQ_[A-Z0-9_]+$`).
- `packages/test-runner/src/run-manifest/create-run-manifest.ts`: `revision()` uses `repositoryChanges(root)`; `dirty` = any change or omitted; spreads `changes`/`changesOmitted`. Manifest gets `invocation: input.invocation ?? runInvocation()`; new optional `invocation` input.
- Tests: `packages/test-contracts/tests/run-manifest.test.mjs` (+2: new fields accepted; malformed rejected; the existing "without the run-detail fields stays valid" test covers the older run.json); `packages/test-runner/src/run-manifest/tests/create-run-manifest.test.ts` (+1: writes invocation and changes, dirty consistent).

## Commands run and observed results
- Before implementation: test-contracts `pnpm test` -> pass 157, fail 2 (the two new tests).
- After: test-contracts `pnpm test` (heavy.sh) -> pass 159 fail 0.
- `npx tsc --noEmit -p packages/test-contracts/tsconfig.json` rc=0; `-p packages/test-runner/tsconfig.json` rc=0.
- test-runner `pnpm run build` (heavy.sh) ok; `node --test` on dist create-run-manifest, repository-changes, run-invocation tests -> pass 11 fail 0.
- `node scripts/structure-audit.mjs` -> passed (159 warnings, 118 baselined).

## Not verified
No Lab run; whole test-runner suite not run.

## Commit message
Lab: run.json records each repository's changed paths and how the run was invoked (contract + manifest wiring)

## Open questions or contradictions found
None.
