# `ak-http-control-test-placement` — remove the ratchet regression

**Status:** complete; placement repair and required validation passed. No Lab run.

## Outcome

The HTTP control subject and its two directly owning auth/readiness test files
now form one cohesive `packages/test-runner/src/http-control/` feature. The
feature's `index.ts` is its barrel and remains re-exported by the package root,
so the public package seam and all exported HTTP-control symbols are preserved.
Internal consumers now import through that barrel.

The move reduces `packages/test-runner/src/tests/` from 51 to 49 source files.
No unrelated tests moved, no behavior or assertion changed, and the structure
baseline was not edited or enlarged. The audit reports two existing baseline
entries can now be lowered; leaving that baseline reduction to the supervisor
avoids combining an automated baseline rewrite with this bounded worker task.

## Files changed

- Moved `packages/test-runner/src/http-control.ts` to
  `packages/test-runner/src/http-control/index.ts`.
- Moved the auth and readiness tests from `src/tests/http-control-*.test.ts` to
  `src/http-control/tests/auth.test.ts` and `wait.test.ts`.
- Updated direct internal imports and the package root barrel to the feature
  barrel; updated the two source-wiring assertions for the new import path.

## Verification

- `pnpm --filter @fluxiq-web-extension/test-runner check` — passed.
- `pnpm --filter @fluxiq-web-extension/test-runner test` — passed: 716 tests,
  zero failures (711 Node subtests).
- `pnpm structure:check` — passed with warnings only; 17 baselined findings and
  two baseline entries eligible to be lowered, with no new baseline growth.
- `git diff --check` — passed; only existing line-ending notices were printed.
- Residual search for `http-control.js` under test-runner source — zero stale
  imports.

## Not verified

Per the brief, I did not run Lab, commit, push, or update the structure
baseline. The supervisor must review integration with the concurrent W11 edits
and decide when to record the reported baseline reductions.
