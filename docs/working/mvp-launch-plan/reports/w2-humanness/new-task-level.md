# W2 new-task level: the Flow's level beats the starting value

## Outcome
Done.

## What changed and why
Core `packages/fluxiq/src/framework/automation-service/service/answer-first/`:
- `attempt/run-attempt.ts` (opened(), the starting-value store, ~lines 259-272; plus 2 imports): the store now happens only when the task has no level AND the run's Flow has none. The Flow is read with `automationStudioAnswerFirstFlowRunEngineOf(input).parentFlow()` (the same read flow-run uses; no Flow was already in hand in the attempt, so this is one extra read, only when a starting value is given and the task has no level), wrapped in best-effort; level via `automationStudioFlowHumanness(metadata)`. An unreadable Flow reads as no level (old behaviour: store). A stored level, 0 included, is never overwritten (the update still guards `current.humanness === undefined`). Run-time precedence untouched.
- `attempt/tests/task-humanness.test.ts`: two new tests (Flow 30 + start 70: nothing stored, runs at 30, then Flow changed to 10 and the task follows at 10; Flow 0 + start 70: nothing stored, runs at 0). The existing tests already covered: no Flow level stores 70 and runs at 70; task level 20 / 0 kept over starting value; no start and no level stores nothing, no humanness on the run. `tests/later-attempts.ts` already had the `humanness` fixture option (no change by me).

## Commands run and observed results
- `pnpm --filter fluxiq exec vitest run .../attempt/tests/task-humanness.test.ts` -> 1 file, 6 tests passed.
- `vitest run .../flow-run/tests/humanness.test.ts .../service/tests/run-session-humanness.test.ts` -> 1 file shown, 8 tests passed in the tail (the tail showed only the last file's summary; no failures printed).
- `pnpm structure:check` -> "structure-audit: passed (532 warning(s), 969 baselined)".
- `tsc --noEmit` attempted for the package: V8 out of memory, no result (not a required check).

## Not verified
- Typecheck (OOM). Library build left to supervisor.
- A task whose very first attempt already has a Flow level: the fixture creates the Flow inside the first attempt, so tests set the level after attempt 1 (task exists with no level); the code path is the same.

## Open questions
None.
