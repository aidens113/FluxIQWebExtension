# t805 ending words

Outcome: Done

## What changed and why
- `packages/fluxiq/src/programs/automation-studio/runtime/activity/wording/run-ending.ts`: new `coreFound`. When the run's verification has verdict `does_not_answer`, basis `core_observation` and code `core.result.computed_fact_failed`, the ending is Core's own sentence, in the same shape as the other endings: "it saved 15 rows, but Core counted 3 stored rows where the build declared 2." No repair ending is added, because nothing was being fixed. Without a row count it is the sentence alone. A sentence not starting with "Core" is prefixed "Core found: ". The sentence is screened and capped to 110 characters by the existing `automationStudioActivityReasonText`, so "Run failed: " plus it fits 160.
- The fact's sentence was already reachable: `computed-no.ts` sets `observation` to the failing facts' sentences joined, and `resultVerification.observation` is already read by this file. No change to the wording input was needed.
- Tests: `wording/tests/run-ending.test.ts`, new describe "a no Core reached from its computed facts (t805)" (3 tests: the ending and its length, no rows and non-Core voice, a judge's no on the same code left unchanged). They failed first on the old wording and the first regex slip, then passed.

## Commands run and observed results
- `npx vitest run .../activity/wording` -> 19 files, 197 tests passed.
- `pnpm test src/programs/automation-studio/runtime/activity` -> parallel group: 56 files, 476 tests passed; real-sql group: no test files in the filter (exit 0); "all groups passed".
- `pnpm exec tsc --noEmit -p .` in packages/fluxiq (8 GB heap) -> no output, clean. An earlier run without the heap flag hit a V8 out-of-memory crash, unrelated to the change.
- `pnpm structure:check` -> "structure-audit: passed (458 warning(s), 1152 baselined)". Run before a one-line regex fix in `run-ending.ts`, not re-run after.
- `pnpm docs:check` -> "Deterministic framework reference is current." Same timing as structure:check.
- Downstream `node scripts/check/model-text.mjs` -> "model-text: ok (208 scenario tokens, 379 model-facing Core files, 11861 string literals)".

## Not verified
- structure:check and docs:check were not re-run after the final regex edit (a single line in `run-ending.ts`).
- Not exercised end to end: a live run reaching this ending.

## Open questions or contradictions found
- None. A multi-fact observation longer than 110 characters is trimmed to whole sentences by the screen, so later failing facts may not be said in the status line.
