# B4b service report

Outcome: Done, except the 7-dispatch lane test (not written) and typecheck (not run, per brief).

## What changed
Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t899/!FluxIQ/packages`.
- contracts `fluxnode/run/result.ts`: optional `overridesDigest` (sha256 hex); test in `run/tests/result.test.ts`. No started event carries options, so no event change.
- svc `fluxnode-run.ts`: `FluxNodeRunCarried.overrides`; `FluxNodeRun.overridesDigest` (set by the run, read by result-of).
- `create-fluxnode-service.ts`: `request.overrides` carried; child runs still copy only options; resume spreads `held.run.carried`, so it keeps the first overrides. `finish` records the judge digest when the run is `achieved` and `verdict.by === "judge"`. Context gets `judgedWith(flowId)`.
- `run-registry.ts`: `judged(flowId, digest)` / `judgedWith(flowId)` (in memory, like `learned`).
- New `overrides-frame.ts` (`fluxNodeRunOverridesFrame`): resolved overrides + `nodeAttempts = retries + 1`, empty groups omitted, digest only when the spec or request had overrides. Named without the `run-` prefix because the structure audit's prefix rule fails otherwise.
- `run-fluxnode.ts`: resolves (spec.overrides, carried.overrides); the whole attempt (instruct, whenStopped, generateFlowBootstrapAdaptation) runs inside `runWithAutomationStudioRunOverrides`, always. Person wait = `deadlines.personWaitMs ?? context.personWaitMs`. Outcome carries `judgeDigest`.
- `caller-options.ts`: `humanness` passthrough line; `judgeChanged` input gives `judge: "always"` unless judge is `off`.
- Judge rule: "changed" = this run's judgeDigest differs from the recorded one; with none recorded the baseline is the digest of empty overrides, so criteria on a never-judged Flow force one judge.
- `result-of.ts`: adds `overridesDigest` to the result.

## Commands run
- `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/fluxnode` (first run, before fixing my own test's missing `start`): 4 files passed, 21 passed, 5 failed, all in the new test file. After the fix, `.../tests/run-overrides.test.ts` alone: 8 passed. The other 4 files (registry, runs, reregister, pipeline) passed in the first run; the final tree was not re-run in full.
- `pnpm --filter @fluxiq/contracts exec vitest run src/fluxnode` -> 26 files, 140 tests passed.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (529 warning(s), 969 baselined)`. (It failed once on `as never` and the `run-` prefix; both fixed.)

New tests (`svc/tests/run-overrides.test.ts`, fake service reading `automationStudioRunOverrides()`): frame contents and digest (retries 6 -> nodeAttempts 7); no-overrides frame is `{nodeAttempts: 4}` with no digest; two concurrent runs each see their own frame; `personWaitMs` honoured (1015 vs 1040); judge digest rule (same, other, unrecorded, none); off stays off; registry record; humanness passed when set, absent when not.

## Not verified
- `options.humanness` will not typecheck until lane t898 (11252f094) merges; the test casts to run now.
- No fluxiq typecheck (per brief).
- Not tested: resume keeping the first overrides and child runs not inheriting them (code reading only: `targetOf` spreads `held.run.carried`; `runChild` copies only `options`). `targetOf` and `runChild` are not exported and a lane test would need real SQL.
- Not tested: judge digest recorded end to end through `finish` (only the registry methods and the caller-options rule).
- The `retries: 6` -> 7 dispatches lane test is not written. The library lane has no fault injection for a failing dispatch, and it needs the parallel engine work; left for you.

## Open questions
- Judge digest is kept in memory only, so a restart makes a criteria-carrying Flow be judged once more.
