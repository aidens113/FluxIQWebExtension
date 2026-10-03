# t215: the heavy Core service tests time out at 15 s

Worker report. Trees: `fxwork/t215/!FluxIQ` and `fxwork/t215/!FluxIQWebExtension`, branch `task/t215-slow-service-tests` in both. No Lab run. No commits.

## State at stop

All four levers are in place in the Core worktree; nothing is committed. Every listed case now passes when its file runs alone, and is inside 15 s in every after-run except one. That one is preservation #1 in two probe runs, at 31.7 s and 35.8 s. The machine was at 100% CPU for the whole session, with all four build slots taken by other lanes. The same case, with the same round-trip count, took 4.3 s in a quieter moment. Wall times in this report measure the machine at least as much as the code. Round-trip counts do not depend on load, so they are the figures to compare.

The full automation-studio suite did **not** pass on its first run: 45 tests in 22 files timed out at 100% machine load. All 22 files then passed when run sequentially (128/128). There is no regression. The definition of done says "no timeouts", and that has not been observed for the whole suite at once.

**Changed (Core, `packages/fluxiq/src/programs/`):**

- `database-manager/storage/sqlite-repository.ts`: lever 1.
- `automation-studio/storage/project/statement-cache.ts` (new) and `storage/project/database.ts`: lever 2.
- `automation-studio/runtime/service/flows/writer.ts` and `runtime/service/summaries/store.ts`: lever 3.
- `runtime/tests/service-flows/tests/instruction-readiness.test.ts` and `subflow-pagination.test.ts`: test-side fixes.
- `storage/project/tests/database.test.ts`: 5 new cases for the statement cache.
- `runtime/service.ts` is **unchanged** (see lever 3).

## What changed and why

1. **Lever 1: one setup script per `SQLiteRepository` open.** The two pragmas, `create table if not exists` and `create index if not exists` now go to SQLite as one `db.exec` script. They run in the same order and stop at the first error, as before. That takes 4 prepare+run pairs per open down to 1 exec. One addition: if the setup fails, the connection is now closed before the error is rethrown. Before, it leaked.
2. **Lever 3: operation holds.**
   - `AutomationStudioFlowWriter.saveFlowInternal` now runs under `withAutomationStudioProjectDatabaseHeld`. This covers every `saveFlow` path, including bootstrap and legacy migration, which all enter here.
   - `AutomationStudioSummaryStore.listFlowSubflowSummaries` and `listFlowInstructionSummaries` are each held. These are the reads at `service.ts` ~2866/2869, which only delegate to the summary store, so `service.ts` needed no change.
   - **Dropped: the hold on `saveFlowInstruction`.** Measured, one instruction save acquires the project database exactly once (`flows/store.ts` `writeSqlFlowInstruction`). A hold there saves nothing. It also needed a new method on `AutomationStudioService`, which raised that class from 222 to 223 methods and failed the structure audit's `class-methods` baseline. I reverted it, so `service.ts` is untouched. The 102 reopens in instruction-readiness are now removed on the test side (item 4).
3. **Lever 2: per-connection statement cache (`storage/project/statement-cache.ts`).**
   - `AutomationStudioProjectDatabase` sends every direct statement through `AutomationStudioStatementCache`.
   - **What is cached:**
     - `all` statements;
     - `run` statements that can only step to completion: insert, update, delete or replace without RETURNING, and begin, commit, rollback, savepoint or release.
   - **What is never cached:**
     - `get`, for the un-reset-snapshot reason in the earlier report;
     - pragmas;
     - selects sent through `run`;
     - any call with no bound values whose SQL contains a parameter marker. A reused statement would keep its old bindings where a fresh one binds NULL.
   - A statement that fails is finalized and dropped from the cache.
   - The cache holds at most 128 statements, least recently used out first.
   - `close()` finalizes every cached statement before it closes the connection. SQLite refuses to close a connection that still has prepared statements.
   - A statement that is already prepared bypasses node-sqlite3's serialize queue. So every call on a connection, cached or not, now waits for the previous call to finish. That keeps statements in the order they were issued.
4. **Test-side seeding.**
   - **subflow-pagination:** the per-case copy and the snapshot copy now use `cpSync` instead of `fs/promises.cp`. The 64-subflow case went from 7,996 to 2,803 round trips.
   - **instruction-readiness:** every one of the 102 instructions is still saved through `service.saveFlowInstruction`. The seeding loop now runs inside `withAutomationStudioProjectDatabaseHeld` on the service's own pool, as one operation would, so the project database is not reopened for each save. Project-database opens fell from 213 to 111. The remaining opens are the per-call `SQLiteRepository` summary writes, which are the product's design.

## Measurements

The previous worker's before-figures, kept as recorded (shared machine):

| Case | Wall | Round trips | Biggest costs |
| --- | --- | --- | --- |
| instruction-readiness "finds one active…" | 19.7 s / 21.0 s | 6,992 | Run 1,659; Prepare 2,303; 215 Close; 109 project-db opens |
| run-detail-preservation #1 | 14.5 s / 18.2 s | 4,646 | Prepare 1,340; 85 opens (57 project, 28 SQLiteRepository) |
| execution-digest #2 "binds…transitive" | 11.8 s | 3,866 | Prepare 1,037; 157 opens |
| execution-digest #1 "changes the LLM…" | 10.4 s | 3,314 | 97 fresh project opens, 1 reused |
| adaptive-loop "auto-applies…" | 10.0 s / 5.7 s | 3,017 | Prepare 879; 50 opens |
| subflow-pagination "bounds concurrent…" | 8.9 s / 15.9 s | 7,515 | 4,383 fs calls in the test's own `cp` of the 64-subflow seed (line 102) |

**This session, before and after.** Same probe for both columns: an async_hooks counter of every non-promise and non-timer async resource, which is sqlite work plus fs completions, counted per test. One file at a time, `--maxWorkers=1`, through heavy.sh. The machine was at 100% CPU throughout. "Before" is base.log on unchanged code. "After" is after.log, with every change in place.

| Case | Before wall | Before trips | After wall | After trips | Opens before → after |
| --- | --- | --- | --- | --- | --- |
| instruction-readiness "finds one active…" | 37.0 s | 7,639 | 13.2 s (11.1 s, 8.4 s plain) | 4,989 | 213 → 111 |
| preservation #1 "keeps a repaired run's…" | 18.7 s | 5,224 | 31.7 s / 35.8 s loaded; 4.3 s quieter | 4,710 | 85 → 74 |
| preservation #2 "refuses to rebuild…" | 9.1 s | 2,227 | 5.8 s | 1,977 | → 37 |
| preservation #3 "fails a save…" | 4.1 s | 786 | 1.4 s | 686 | → 11 |
| execution-digest #1 "changes the LLM…" | 23.5 s | 3,540 | 2.6 s | 3,024 | 143 → 124 |
| execution-digest #2 "binds…transitive" | 16.8 s | 4,230 | 5.3 s | 3,728 | → 130 |
| execution-digest #3 "binds a domain Flow's…" | 27.6 s | 3,703 | 4.5 s | 3,079 | 139 → 118 |
| execution-digest #4 "tracks missing publication…" | 26.5 s | 4,896 | 6.9 s | 4,284 | → 133 |
| adaptive-loop #1 "auto-applies…" | 33.6 s | 3,375 | 3.1 s | 2,994 | → 41 |
| adaptive-loop #2 "completes an adaptive…" | 33.1 s | 4,408 | 2.7 s | 3,905 | → 51 |
| subflow-pagination "bounds concurrent…" (64) | 9.0 s | 7,996 | 2.5 s | 2,803 | 68 → 69 |
| subflow-pagination "does not hydrate…" (32) | 5.3 s | 3,544 | 0.4 s | 1,050 | → 2 |

**Prepares fell by about a third in every case.** In preservation #1 they went from 1,340 to 946. In execution-digest #1 they went from 1,011 to 707.

**Plain after-runs** (no probe, `--maxWorkers=1`, per file):

| File | Tests | Test time |
| --- | --- | --- |
| instruction-readiness | 1 | 8.43 s |
| run-detail-preservation | 3 | 9.49 s total |
| execution-digest | 4 | 19.38 s total |
| adaptive-loop | 2 | 7.04 s total |
| subflow-pagination | 5 | 41.95 s total, mostly its 64-subflow `beforeAll` seed, whose own timeout is 180 s |

All passed.

## Commands run and observed results

- `heavy.sh "t215 baseline probe" bash count.sh base.log <5 files>` on unchanged code -> each file passed (1, 3, 4, 2 and 5 tests). The figures are in the before columns above.
- `heavy.sh "t215 levers probe" … lev.log` after levers 1-3 -> all 15 passed.
- `heavy.sh "t215 after probe" … after.log` with every change in place -> `Tests 1 passed`, `3 passed`, `4 passed`, `2 passed`, `5 passed`.
- Plain per-file runs: `heavy.sh "t215 after <file>" npx vitest run --maxWorkers=1 --minWorkers=1 --reporter=verbose <file>` -> all passed, with the times in the table above.
- `npx vitest run src/programs/automation-studio/storage/project/tests/database.test.ts` -> `Tests 9 passed (9)`. That is 4 existing cases and 5 new statement-cache cases.
- `heavy.sh "t215 storage tests" npx vitest run src/programs/automation-studio/storage src/programs/database-manager src/programs/tests/global-database-manager.test.ts` -> `4 failed | 234 passed (238)`. All 4 were 15 s timeouts, in parallel workers at full machine load. Rerunning those 3 files with `--maxWorkers=1` -> `Tests 26 passed (26)`.
- In `packages/fluxiq`: `heavy.sh "t215 automation-studio suite" npx vitest run src/programs/automation-studio`.
  - Result: `Test Files 22 failed | 479 passed (501)`, `Tests 45 failed | 4621 passed | 1 skipped (4667)`, Duration 821 s.
  - Every failure was a timeout: "Test timed out in 15000ms" (one each at 60000 ms and one hook timeout), or EBUSY/ENOTEMPTY cleanup that followed a timed-out body.
  - CPU load was 100% during the run.
  - Rerun of exactly those 22 files: `heavy.sh "t215 rerun failed files" npx vitest run --maxWorkers=1 --minWorkers=1 <22 files>` -> `Test Files 22 passed (22)`, `Tests 128 passed (128)`, Duration 397 s.
- In `packages/fluxiq`: `heavy.sh "t215 tsc final" npx tsc --noEmit -p .` -> exit 0, no output.
- Core root: `node scripts/structure-audit.mjs` -> `structure-audit: passed (204 warning(s), 354 baselined)`, exit 0. It also said "1 baseline entries can be lowered".
  - With the `saveFlowInstruction` method in place, the audit failed on `class-methods` (223 > 222). That is why the method was dropped.
  - A 26th test file in `storage/project/tests/` failed `directory-files`. That is why the cache cases went into `database.test.ts`.

## Not verified

- **Wall times "alone" on an idle machine.** None was available. Every wall figure was taken at 100% CPU with other lanes' heavy jobs running.
- **A full automation-studio suite run with no timeouts.** It was not observed. A baseline suite run on unchanged code under the same load, for comparison, was not done.
- **The probe itself.** Its counter is my own rebuild, not the previous worker's. Its before-figures (for example 7,639 for instruction-readiness) differ from theirs (6,992), so compare within one column set only.
- **Which entry is the lowerable structure-audit baseline entry.** The baseline file is outside my ownership, so I did not run `pnpm structure:baseline`.
- **Live or browser behaviour.** It was not exercised. No Lab run was made.

## Open questions or contradictions found

- **The brief says "six slow files".** There are five files, which hold the six listed cases.
- **The next lever, if wanted, needs `runtime/service.ts`.**
  - Of the ~120-133 project-database opens in each execution-digest case, about half come from `getLlmExecutionDependencyDigest` (`service.ts` ~1305-1345). It calls `getFlow`, the two summary listings, `getFlowSubflow` and `getLlmExecutionGraphRevisionBindings`, and each call takes its own lease.
  - One hold around that method would collapse them. But that means either re-indenting about 40 lines, or adding a method, which the audit's 222-method baseline refuses. I left it for the supervisor to decide, because another task is editing `service.ts`.
- **preservation #1 is still the largest per-case cost:** 4,710 trips and 74 opens. Its opens are spread out: runtime-stream-store and content-store leases in run-detail reads and writes, plus run and adaptation holds.

Ready to commit: the seven modified files and the new `statement-cache.ts` listed above, in the Core worktree.
