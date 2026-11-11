# routes-isolation (t898 W2)

## Outcome
Done, no change needed. The failing combination does not reproduce in this worktree. There is no shared state between the files.

## What changed and why
Nothing edited. Findings:
- Task memory (`task-memory/store.ts`) keeps its in-memory `memory`/`indexes` maps as instance fields, and `store-of.ts` keys one store per service in a WeakMap. With a data root (which `createCacheApiTestService` always gives: a fresh mkdtemp dir per `world()`), nothing is held in memory at all. The attempt locator is likewise per instance. Every `world()` has its own service, data dir and projects, so no id, map or database is shared across tests or files.
- The failure ("outcomes.length" 0) was a time flake, not shared state: before dev commit 1c34609dc (t904 "Fix today's sweep failures", merged into this worktree) the test's attempt times were a constant fixed at module load. `outcomesOfConversation` only lists attempts with `startedAtMs >= thread sinceMs` (stamped by `Date.now()` in `noteConversation`), so when file load was slow (running beside the task-memory tests) the attempts started before the thread held the Flow and were dropped. t904's fix takes the times from the clock after the thread is noted (`SOON`), which is the root cause fix. Checkpoint-6 additions are not involved (t904 saw dev pass only because its test file already had the fix or ran faster).

## Commands run and observed results
- `pnpm --filter fluxiq exec vitest run <project-task-routes.test.ts> <task-memory>` x3 -> each: Test Files 6 passed, Tests 51 passed.
- `... project-task-routes.test.ts` alone -> 1 file, 7 tests passed.
- `... task-memory attempt/tests/task-humanness.test.ts api/tests` -> 22 files, 192 tests passed.
- `pnpm structure:check` -> FAIL [as-never] on `server/program-route/tests/handle-program-request.test.ts` line 22 (one `as never` cast). That file is on the must-not-touch list (another worker); not caused by this task's files.

## Not verified
- I did not re-run the old (pre-1c34609dc) test to watch it fail; the cause is from code reading plus the t904 commit message.

## Open questions
- The `as never` structure failure in `server/program-route/tests/handle-program-request.test.ts` needs the worker owning `server/program-route/**`.
