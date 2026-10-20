# sql-test-pool (t740): real-SQL tests get their own low-concurrency vitest run

Worker report. Core worktree `fxwork/t740/!FluxIQ`, branch `task/t740-sql-test-pool`. Nothing committed.

## Outcome

Partial. The isolation is built, documented, and enforced by a check. The one full `packages/fluxiq` run did not
come back clean:

- **Parallel group**: 4 files failed. The new guard caught 4 real-SQL files that the static search had missed. They
  are now marked, and all 4 pass in the real-SQL group.
- **Real-SQL group**: 1 test failed. `whole-process.test.ts` "actual built file kill after project_complete
  preserves both-participant hold" hit the test's own 15 s timer that waits on a child process (not vitest's
  timeout). Run again in the group, its file passed 16 of 16.

No 15 s vitest timeout happened anywhere in the full run. Sweeps 1019b and 1020 had 10 and 4 of them.

## What changed and why

The rule is a marker line, `// @fluxiq-test-group real-sql`, in the test file's leading comment block. There is no
list.

- `packages/fluxiq/tests/test-groups.ts` (new): the marker, `hasRealSqlMarker`, `findRealSqlTestFiles` (walks the
  package and skips node_modules, dist, coverage and dot-directories), and `testGroupOptions(group)`:
  - no group: `{}`, so a plain `vitest run <path>` behaves as before;
  - `parallel`: `exclude` = the defaults plus every marked file;
  - `real-sql`: `include` = the marked files, with `maxWorkers: 2`.
  - Any other group name throws. So does a marked path containing glob syntax.
- `packages/fluxiq/tests/real-sql-guard.ts` (new): a setup file for every test file. Once per worker it wraps
  `sqlite3.Database` in a counting Proxy; the open itself still happens. After the file, it fails a file that opened
  a database without the marker, and the message names the line to add. Databases opened in child processes are not
  seen.
- `packages/fluxiq/vitest.config.ts`: adds `setupFiles: ["./tests/real-sql-guard.ts"]` and spreads
  `testGroupOptions(process.env.FLUXIQ_TEST_GROUP, ...)`. Timeouts are unchanged (15 s / 15 s).
- `scripts/vitest-groups.mjs` (new): `runVitestGroups` and `parseVitestGroupsArgs`.
  - Runs `vitest run --passWithNoTests` once per group, one after the other, with `FLUXIQ_TEST_GROUP` set.
  - Forwards any extra arguments to every group.
  - Always runs every group, and exits 1 if any group failed.
  - Spawns node plus vitest's own `vitest.mjs`, with no shell, so it works on Windows and Linux.
- `packages/fluxiq/package.json`: `test` is now `node ../../scripts/vitest-groups.mjs --groups=parallel,real-sql`.
  The root `pnpm test` (`pnpm -r`) and CI pick it up unchanged.
- 232 test files under `packages/fluxiq/src` got the marker as their first line. Where the set came from:
  - 228 from a probe run, kept outside the tree, over 289 statically likely candidates. All 228 opened at least
    one database, none in-memory only.
  - 4 that the guard caught in the full run: `api/handlers/tests/caches.test.ts`, `api/handlers/tests/flows.test.ts`,
    and `runtime/tests/deepseek-bootstrap/tests/answerability.test.ts` and `exploration.test.ts`.
  - The new `tests/real-sql-guard.test.ts` makes 233 marked files in all.
- Tests (new):
  - `packages/fluxiq/tests/test-groups.test.ts`: the marker's position rules, the scan, group options, the unknown
    group, and the package's own marked files.
  - `packages/fluxiq/tests/real-sql-guard.test.ts`: marked. It checks that the wrapper counts an open and leaves the
    database working, plus the guard's verdict and message.
  - `scripts/tests/vitest-groups.test.mjs`: order, env, argument forwarding, a later group still running after a
    failure, the exit code, and argument parsing. It runs in root `pnpm check` through the `scripts/tests/*.test.mjs`
    glob.
- Docs:
  - `docs/architecture/code-structure.md`: new subsection "Test groups" under Tests. It covers the rule, the reason,
    the guard, the runner, and the warning that a bare whole-package `vitest run` brings the starvation back.
  - `AGENTS.md` (Code Structure bullets): the marker rule, with a link to that section.

## Commands run and observed results

All runs were in `packages/fluxiq` unless noted. During every run, other agents (t738's vitest) kept the machine's
CPU at 78-100%.

- **Probe** (scratch config with a counting setup file, 289 candidates, 3 workers): 286 passed, 3 skipped, 1310 s.
  228 files opened SQLite.
- **The 12 previously timed-out files together**, `FLUXIQ_TEST_GROUP=real-sql npx vitest run <12 files>`. The files
  were controller, command-execution service, provider-unavailable, flow-index-read, whole-sql, whole-operation,
  database-manager index, scale-graph-store, creation, promotion-tier, cancel-parked-run and canonical-persistence.
  - Run 1: 2 failed, 61 passed, 145 s. The failures were vitest 15 s timeouts: `creation` "creates through all actual
    file effects" (17.4 s) and `controller` "uses production resolver..." (15.5 s).
  - Run 2: 12 files and 63 tests passed, 132 s. CPU was sampled every 4 s during this run: 83-100% almost
    throughout, with 2.8-4.7 GB free.
  - The CPU was mostly other agents' vitest. Run alone at that time, the same two tests took 587 ms and 971 ms.
- **Each of the 12 alone** in the group: all passed. Tests per file: controller 3, service 5, provider-unavailable 3,
  flow-index-read 1, whole-sql 14, whole-operation 6, index 8, scale-graph-store 1, creation 7, promotion-tier 3,
  cancel-parked-run 3, canonical-persistence 9.
- **Guard negative check**: I removed the marker from `tests/real-sql-guard.test.ts` and ran a plain `vitest run` on
  it. The file failed with "real-sql-guard.test.ts opened a real SQLite database 1 time(s) (first: :memory:) without
  the real-SQL marker. Add the line ...". I then restored the marker.
- **Group split**: `pnpm test -- tests/test-groups.test.ts tests/real-sql-guard.test.ts tests/vitest-config.test.ts`
  ran 2 files in the parallel group and 1 in the real-SQL group, and printed "all groups passed". The same split held
  again after the final marking.
- **Prompt contract tests**, run as the gate runs them:
  `pnpm --dir packages/fluxiq exec vitest run <system-prompt, extraction-vocabulary, issue-feedback>`. 3 files and
  63 tests passed.
- **Quality config**: `npx vitest run --config vitest.quality.config.ts` passed 3 files and 18 tests.
  `storage.test.ts` is marked, and the guard is inherited.
- **Runner tests**: `node --test scripts/tests/vitest-groups.test.mjs` passed 5 of 5.
- **Structure audit**: `node scripts/structure-audit.mjs` (repository root) printed "structure-audit: passed (422
  warning(s), 1152 baselined)". The first audit run failed one statement-packing line in my test, which I fixed.
- **The one full run**, `pnpm test` in `packages/fluxiq`: 2113 s wall, exit 1.

  | Group | Duration | Files | Tests | Cumulative time |
  | --- | --- | --- | --- | --- |
  | parallel | 813 s | 4 failed, 1277 passed, 3 skipped (1284) | 11869 passed, 6 skipped | collect 3335 s, tests 514 s |
  | real-sql | 1292 s | 1 failed, 228 passed (229) | 1 failed, 1465 passed, 1 skipped | collect 898 s, tests 1469 s |

  - The 4 parallel failures were all the guard: caches, flows, answerability and exploration. No test failed.
  - The real-SQL failure was `whole-process.test.ts`, "Error: whole writer child timeout". This is the test's own
    `setTimeout(..., 15000)` waiting for a spawned writer child.
  - For comparison, the sweeps took 1845 s (1020) and 2009 s (1019b). Their tests' cumulative time was 6020 s and
    6808 s.
- **Follow-up after marking**: the 4 guard-found files plus `whole-process` in the group, run together. 5 files and
  42 tests passed, 364 s. `whole-process` took 170.7 s for 16 tests; it passed in the sweeps at 201 s and 328 s.
- **Stopped by mistake, not counted as the full run**: `pnpm test -- tests/`. Vitest filters are substring matches,
  so `tests/` selected every file. I stopped it after under 10 minutes of the parallel group and confirmed no
  processes were left behind.

## Not verified

- I did not rerun the full suite after marking the last 4 files: the brief allows one full run. In that one run they
  ran unmarked in the parallel group, and all their tests passed there.
- I did not run Linux/CI, the Core `pnpm check` type checks, or `pnpm build`. The new `.ts` files are in
  `packages/fluxiq/tests/`, which the package `tsconfig.json` (`src/**` only) does not type-check, the same as the
  existing `tests/vitest-config.test.ts`.
- A quiet machine. Every measurement ran beside other agents' vitest at 78-100% CPU.

## Open questions or contradictions found

1. **The cost.** The real-SQL group runs after the parallel group with 2 workers: 1292 s here, about 61% of the
   package wall time. The whole package took 2113 s, against 1845 s and 2009 s in the sweeps.
   - The supervisor may want `REAL_SQL_MAX_WORKERS = 3` in `tests/test-groups.ts`. The probe ran the 289 candidates
     at 3 workers with no timeout, beside other agents' load.
   - 1 worker would be the most robust and the slowest.
2. **The starvation is not only our own run.** Even at 2 workers, the together run timed out 2 tests once because
   other agents' vitest held the CPU at 100%.
   - Isolation removes the self-starvation: tests' cumulative time fell from 6020 s to 514 s plus 1469 s.
   - It cannot protect against outside load. A sweep should run when no other lane is running vitest, or accept that.
3. **The real cost sits in collection, not in the tests.** Collecting one heavy file alone takes 26-41 s (cumulative
   collect: 3335 s parallel, 898 s real-SQL). Module graph size per test file is a separate, larger lever.
4. **`whole-process.test.ts` uses its own 15 s child-phase timer.** It also spawns child writers that the guard
   cannot see. It passed in both sweeps and in the follow-up, and failed once in the full run.
5. **No stale-marker check.** The guard fails an opener that lacks the marker, but not a marked file that never opens
   a database: a `-t` filter can legitimately skip every opening test. A stale marker only costs scheduling.

UNIT READY: packages/fluxiq/vitest.config.ts, packages/fluxiq/package.json, packages/fluxiq/tests/test-groups.ts,
packages/fluxiq/tests/test-groups.test.ts, packages/fluxiq/tests/real-sql-guard.ts,
packages/fluxiq/tests/real-sql-guard.test.ts, scripts/vitest-groups.mjs, scripts/tests/vitest-groups.test.mjs,
docs/architecture/code-structure.md, AGENTS.md, and the 232 marked test files under packages/fluxiq/src (each
one line: `// @fluxiq-test-group real-sql`) -- all in fxwork/t740/!FluxIQ.
