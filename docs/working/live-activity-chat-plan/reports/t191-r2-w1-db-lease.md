# t191-r2-w1: Automation Studio project database lease race

## Outcome

Done. The race is reproduced by a deterministic test and fixed. That test and the other 3 in database.test.ts pass. One pre-existing failure exists in the wider storage suite and is unrelated (see "Not verified").

## What changed and why

Cause: `AutomationStudioProjectDatabasePool.acquire` read the pool entry promise from the map, awaited it, and only then incremented `leases`. If a caller released the last lease during that await, `release` saw `leases === 0` with the entry still current. It deleted the entry and closed its database. The waiting acquire then counted a lease on the closed entry and got a database whose every operation rejects with "Automation Studio project database <id> is closed."

Fix (Core tree `C:/Users/osrs_/FluxStuff/fxwork/t191/!FluxIQ`):

- `packages/fluxiq/src/programs/automation-studio/storage/project/database.ts`
  - Added a private method, `currentOrOpenEntry(projectId)`. It returns the current entry promise or opens and registers a new one. This is the old inline logic, including removing the entry when opening fails.
  - `acquire` now checks, after the await, that the awaited promise is still `this.entries.get(projectId)`. If it is not, the entry was released and closed (or `closeAll` cleared it) during the await. `acquire` then throws if the pool is closing; otherwise it re-acquires the current entry, opening a new one if there is none. The check and `leases += 1` run with no await between them, so a lease is only ever counted on a live, current entry.
  - The release closure captures `const` copies of the final entry and its promise. Release behaviour is unchanged: only the last release of the current entry deletes it from the map and closes it.
  - A side effect: an acquire that was waiting when `closeAll` ran now rejects with "pool is closing" instead of returning a closed database.
- `packages/fluxiq/src/programs/automation-studio/storage/project/tests/database.test.ts`: new case, "never hands a lease a database closed by the last release while that lease awaited its entry". It acquires `first`, starts a second `acquire` without awaiting it, then calls `first.release()`. It then asserts that the second lease can insert and read, that `openProjects` is 1, and that it drops to 0 after the second release.

## Commands run and observed results

All `vitest` and `pnpm` commands ran in `packages/fluxiq` of the Core worktree, unless noted.

1. Test first, before the fix: `npx vitest run src/programs/automation-studio/storage/project/tests/database.test.ts --minWorkers=1 --maxWorkers=2`. Result: 1 failed, 3 passed. The error was `promise rejected "Error: Automation Studio project database…"`, caused by `Error: Automation Studio project database project.race is closed.`, raised from `enqueue` at database.ts:183. This reproduces the race.
2. After the fix: `npx vitest run src/programs/automation-studio/storage/project/tests/database.test.ts`. Result: `Tests 4 passed (4)`.
3. `npx vitest run src/programs/automation-studio/storage --minWorkers=1 --maxWorkers=2`. Result: `Test Files 1 failed | 38 passed (39)`, `Tests 5 failed | 197 passed (202)`.
   - All 5 failures are in `project/tests/runtime-stream-store.test.ts`. The test "tails and reconnects runtime streams by sequence at a million events" hits `Test timed out in 60000ms`. The other 4 then fail on `EBUSY ... unlink ...project.million\project.sqlite(-shm|-wal)`, because the timed-out test is still holding its database files.
   - An earlier run of the whole folder was made while an edit had been refused and the file was half-written (the helper method was missing). That run failed broadly and was superseded; ignore it.
4. Baseline for that failure: I copied my fixed file to the scratchpad, restored the file with `git show HEAD:<database.ts>`, and ran `runtime-stream-store.test.ts` alone (`--maxWorkers=1`). The same million-event test timed out at 60020 ms, with the same EBUSY cascade. So the failure is present without my change. I then copied the fix back; `git diff --stat` shows only my two files changed (+43/-13).
5. From the Core root: `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t191 w1 core check" pnpm --filter fluxiq check`. It held slot b3 and ran `tsc --noEmit` (66.9 s). Exit 0, no errors.
6. From the Core root: `node scripts/structure-audit.mjs`. Exit 0: `structure-audit: passed (199 warning(s), 354 baselined)`. There is no warning for either file I touched. The audit also reports "1 baseline entries can be lowered"; that entry is not from my files and I did not change the baseline.

## Not verified

- I did not find the cause of the million-event timeout in `runtime-stream-store.test.ts`. It fails the same way on HEAD without my change. I have not checked whether it passes on another tree or with a longer timeout.
- I did not reproduce the panel conversation read failing mid-build live. The fix is proven only by the unit test.

## Open questions or contradictions found

- The `runtime-stream-store` million-event test fails on this branch at HEAD, so the storage suite is not green regardless of this fix. The supervisor should decide who owns that failure.
- `stats()` still pushes `projects` asynchronously, so the array it returns is empty at return time. This was there before, is outside this brief, and I left it unchanged.
