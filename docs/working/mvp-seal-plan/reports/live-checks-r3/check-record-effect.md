# check-record-effect

Outcome: Done

## What changed and why
- `apps/extension/src/content/action-runtime/results.ts`, `challengeGateFailure`: builds the record as before, then returns `{ ...record, effect: "unacted" }` only when the original failure stated `effect: "unacted"`; otherwise the record unchanged. Doc comment gained a paragraph saying so.
- A missing target (`TARGET_NOT_FOUND`) is NOT treated as proof of unacted: the code row does not state it and the brief says not to invent it. Only the original failure's statement is carried.
- Tests appended to `tests/results.test.ts` (own fake robot-check page, `actionRejected` with a selector that matches nothing): unacted kept; no effect when not stated. A separate test file made the directory 26 files (limit 25), so they live in results.test.ts.

## Commands run
- With the change reverted: `not ok 376 - a missing target that stated unacted keeps it when the page is a robot check` (519 tests, 1 fail).
- `EXTENSION_TEST_BUILD_LABEL=t885-gate node scripts/test-extension.mjs content/action-runtime` -> 519 pass, 0 fail (first runs hit a mid-rebuild Core dist, ERR_MODULE_NOT_FOUND; waited and reran).
- `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0 (run before moving tests into results.test.ts; not rerun after).
- `node scripts/structure-audit.mjs` -> passed (after the move; the first attempt failed the 25-file limit).

## Not verified
- Extension check not rerun after the test relocation. No browser/live run.

## Open questions
- Other modified domain files in the worktree belong to other lanes.
