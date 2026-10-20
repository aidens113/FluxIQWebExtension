# t731 sweep-1019b fixes (lead report)

Trees: `fxwork/t731/!FluxIQWebExtension` (base f28d5eb5) and `fxwork/t731/!FluxIQ` (base 4077d0a0), both on `task/t731-sweep-1019b-fixes`.

## Plan

1. Rerun each of the 7 failing Core files alone, timed, and the scenario-lab crossborder browser-paths test alone (headed, provider-free).
2. For a file that fails alone: trace the slow or blocking step (real I/O the test need not do, a lock never released, a SQLite handle left open before unlink) and fix that side. Never raise a timeout or loosen an assertion.
3. For a file that passes alone: run it with its package directory and look for shared temp paths, ports or globals; remove the contention. Check whether other lanes' load was a factor, but do not assume it.
4. Run the downstream packages after scenario-lab in `pnpm -r` order and fix what fails.
5. Validation: each fixed file alone and with its package directory, three times each, pass counts recorded here.

Excluded files (other lanes, L1 t724 status): recorded in the scratchpad check; any root cause landing there is reported, not edited.

## Progress log

### 2026-10-19 Baseline: every failing Core file passes alone

Workers could not be dispatched (the session was at its 20-subagent limit from other lanes), so the lead does the units directly.

`npx vitest run <file>` from `packages/fluxiq`, each file alone: creation 5/5 (file-effects test 1690 ms, sql 2222 ms); promotion-tier 3/3 (target test 1077 ms); cancel-parked-run 3/3 (2628 and 1503 ms); whole-operation 6/6 (1210-2881 ms each); whole-sql 14/14 (7.3 s total); scale-graph-store 1/1 (578 ms); database-manager index 8/8 (target test 3305 ms).
In the sweep the same tests took 9.6-16.3 s (a 5 to 26 times slowdown). The scale-graph-store EBUSY is a consequence of its timeout: afterEach's `rm` ran while the timed-out body still held `project.sqlite`.

Load check (not assumed): during this session, with other lanes active, CPU was 100% on 8 logical processors (27 node and 30 chrome processes) and average disk write latency was 2 ms. A probe of 130 small SQLite commits took 5.8 s on one kept connection at `synchronous=FULL`, 14.3 s reopened per commit, 1.2 s kept at `NORMAL` and 4.5 s reopened at `NORMAL`: each fsync (`FlushFileBuffers`) costs tens of ms under contention, and each close of the last WAL connection adds a checkpoint (two more flushes) plus a sidecar delete. Load is the multiplier; the defect is tests and stores that make far more flushes than their work needs.

### 2026-10-19 Unit DBM: database-manager `filters, sorts, counts, and pages records in SQLite`

Root cause: the case seeded 130 records through 130 unpooled `put`s; each opened `global.sqlite`, readied its WAL, made one fsynced commit and closed it again (checkpoint and delete of `-wal`/`-shm`). The case tests paging, not `put` (concurrent puts have their own case).
Change: `packages/fluxiq/src/programs/database-manager/tests/index.test.ts` seeds the same 130 rows in one `repo.transaction` into the repository's own table (`repo.tableName`); every assertion still reads through `listPage`. A pooled `keepWhile` seed was tried first: 0.76-4.6 s under load, because it still made 130 fsynced commits.
Check: the file alone, 3 runs: 8/8, 8/8, 8/8; the target test 798, 897, 1697 ms (under 100% CPU from other lanes; was 3305 ms alone on a quieter machine and over 15 s in the sweep).

### 2026-10-19 Unit CA: canonical-authority whole-operation and whole-sql

Root cause (product): `CanonicalAuthorityWholeOperation` reads and writes `global.sqlite` through an unpooled `SQLiteRepository`, so each of its ~12 transactions per operation, and each of the repositories' operations it drives, opened and closed the file; every close was the last connection, so it checkpointed and deleted the WAL. A CPU profile of fixture setup plus `createFlow` showed the main thread idle 75% of the time, waiting on native SQLite I/O.
Change: `packages/fluxiq/src/programs/automation-studio/storage/canonical-authority/whole-operation.ts` gives its repository a `SQLiteConnectionPool` and runs each operation inside `keepWhile` (the t435 pool, built for exactly this). Outside an operation nothing changes; inside it, one connection stays open, so the other connections' closes are not the last, and the single checkpoint happens when the operation ends.
Deterministic count (sqlite3 instrumented in a probe test, since deleted), one `createFlow`: sql mode opens 28 -> 13, WAL-checkpointing closes 26 -> 2; file mode opens 20 -> 5, checkpointing closes 18 -> 2; commits 16 -> 16.
Check: both files together, 3 runs: 20/20 each; per-test max under full load 5.2 s ("has one sql writer admission"; it was over 15 s in the sweep).

### 2026-10-19 Unit CA revised: the pool change is withdrawn; the cost is round trips

An interleaved A/B of one operation's I/O pattern (16 commits and 25 open/close cycles, 6 rounds each way) showed no wall-time gain from keeping the connection (median 1567 ms unkept, 1741 ms kept), and `synchronous=NORMAL` gave only 1.45x (772 vs 533 ms). So `whole-operation.ts` is restored to HEAD; the deterministic checkpoint reduction was real but not worth an unproven Core change.
What the failing tests actually spend (sqlite3 instrumented through a probe vitest config kept outside the tree): the flows create-and-save makes 1,445 sequential SQLite calls; each service test about 505-526 calls with only 1-2 commits; whole-operation's admission case 1,458. Alone each call costs about 1 ms; under CPU starvation each async round trip stretches many times. Of one create-and-save, 348 calls are `mutation_records` history-join re-verification in `storage/project/authority-guard/records.ts` (integrity design, no polling or sleeps; not changed here, see Notes for supervisor).
Machine state at the time, measured: CPU 100% on 8 logical processors; commit charge 1,042 MB free of 36,796 MB, with `OneDrive.Sync.Service` holding about 16 GB of commit; one vitest run died with `memory allocation of 448 bytes failed`, and one shell spawn failed (`uv_spawn` EUNKNOWN). The same fixture took 1.8 s to 32 s back to back. Load is proven as the multiplier here; the test-side defect is per-case setup that is not the case's subject.

### 2026-10-19 Unit CA (final): canonical-authority tests stop recreating their project

- `storage/canonical-authority/tests/whole-fixture.ts`: a project-only template (`wholeProjectTemplate`, `wholeProjectFromTemplate`), and `wholeFlowTemplate(mode, project?)` builds the Flow in a copy of a project template; the shared at-rest and copy logic is one `template`/`fromTemplate` pair.
- `whole-operation.test.ts`: every case copies a per-mode project template (one `beforeAll` per mode) instead of creating the project; each case's subject (the Flow create or save) is unchanged.
- `whole-sql.test.ts`: two hooks (project template, then the Flow template from a copy of it) instead of one hook doing both; the "binds actual SQL privilege" case copies the project template. Calls in that case 1,061 -> 683.
- `factory-provenance.test.ts` (not in the sweep list, but it failed 3 of 3 directory runs and alone): the framework was imported with `await import` inside the timed body, so the whole framework transform (over 60 s alone under this load; 7.4 s in the sweep, where the worker had transformed most of it) counted against the test. Static imports in the same order keep "framework first" (module evaluation follows import order); the body now takes 32 ms. The explicit 60 s timeout is removed because nothing slow remains in the body.
Check: whole-operation + whole-sql + whole-process together: 30/30; `npx tsc --noEmit -p tsconfig.json` exit 0; `node scripts/structure-audit.mjs` clean for these files (statement packing fixed).

### 2026-10-19 Unit SVC: promotion-tier and cancel-parked-run share their setup

Both files built a whole service, project, Flow (and, for promotion-tier, the primary router) in every case, then examined one thing on it. Now each file builds them once in `beforeAll` and each case does only its subject: cancel-parked-run queues, rewrites and cancels its own run (every case ends with its run cancelled); promotion-tier saves its own adaptation under its own id and asks for the decision (the decision never applies anything, so the Flow is the same for every case, as the file's own header says).
Calls per case: cancel-parked-run 505 -> 76; promotion-tier 526 -> 154-185. Cases now 0.3-0.8 s alone.

### 2026-10-19 Unit SGS: scale-graph-store teardown

The EBUSY was afterEach removing the directory while a timed-out body still held `project.sqlite`. The directory is now created and removed inside the case, after the benchmark has settled and closed its pool. The benchmark's own work (1 open, 35 commits, ~600 sequential calls, 0.6-1.1 s alone) is its subject; the per-entity import in `storage/project/graph-store.ts` (about 6.6 statements per node or edge) is product design and not changed.

### 2026-10-19 ~19:58 Supervisor redirection: the sweep ran inside the OneDrive memory window

The supervisor reported OneDrive's sync service grew to 14.4 GB on this 12 GB machine from 14:34 to about 19:50 (restarted ~19:50), and directed: rerun each failing file on the recovered machine; one passing alone and with its directory three times is environmental, and no test is changed merely because it failed before 19:50.
Action: the validation of the modified tests was stopped; every Core test change was saved as a patch, `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/t731-core-test-reductions.patch` (443 lines: the DBM single-transaction seed, the canonical-authority project templates and split hooks, the factory-provenance static import, the shared setup in promotion-tier and cancel-parked-run, the scale-graph-store teardown), and the Core tree restored to HEAD. Two restored source files (`whole-operation.ts`, `sqlite-repository.ts`, content identical to HEAD, checked with `git diff --quiet HEAD`) had their mtimes set back one minute before Core's newest dist file so the downstream Core-freshness guard would not demand a rebuild of identical source.
Machine at 19:58: free commit 17,234 MB, free physical 3,485 MB, CPU load 100% (other lanes still active).
Partial result before the stop (modified tests, ~19:50-19:58): creation.test.ts alone 2 of 3 passed; one run failed `Hook timed out in 15000ms` in its own unchanged `beforeAll` (the project template build).

### 2026-10-19 Downstream on the recovered machine (no code changed)

- `apps/scenario-lab` crossborder `browser-paths.test.js` alone (`node --test dist/scenarios/crossborder-marketplace/tests/browser-paths.test.js`), 3 runs: pass 17 fail 0, three times. Its directory (`node --test "dist/scenarios/crossborder-marketplace/**/*.test.js"`), 3 runs: tests 57 pass 57 fail 0, three times. Verdict: environmental (the traffic screen is counted server-side per `/search` request, so the step's target is deterministic; the 6 s miss was a slow load during memory exhaustion).
- Packages `pnpm test` never reached: only `@fluxiq-web-extension/test-runner` (pnpm -r excludes the root package). `pnpm --filter @fluxiq-web-extension/test-runner test`: exit 0, tests 2363 pass 2358 fail 0 skipped 5.

### 2026-10-19 ~20:00-21:30 Original Core files on the "recovered" machine (each alone x3, each directory x3)

Command: `npx vitest run src/programs/<path>` from `packages/fluxiq`, Core tree at HEAD. Machine during these runs: free commit 13-17 GB (recovered), but CPU 100% and free physical memory 540 MB at a mid-run sample (lanes t726, t729, t730 and this validation active).
- creation.test.ts alone: fail (sql case 16,386 ms; that run overlapped my test-runner suite), pass, pass. Directory `runtime/service/flows`: FAIL (`Hook timed out in 15000ms`, the beforeAll building both projects), FAIL (sql case 15,143 ms), pass. -> not environmental.
- promotion-tier alone 3/3 pass; `runtime/tests/service-adaptation` 23/23 files, 111/111 tests, three times. -> environmental; no change.
- cancel-parked-run alone 3/3 pass; `runtime/tests/service-flows` 15/15 files 65/65, then 64/65 (the failure was canonical-persistence "exposes and executes explicitly bound domain-native nodes only in their project scope", 15,536 ms; cancel-parked-run passed), then 65/65. -> environmental for cancel-parked-run; no change.
- whole-operation alone: 6/6, then 4 failed (admission sql 15,008 ms, admission file 15,269 ms, unsupported 15,054 ms, rereads 15,013 ms), then 2 failed. -> not environmental.
- whole-sql alone: 14/14, 14/14, then `Hook timed out in 15000ms`. -> not environmental.
- factory-provenance (not in the sweep list) alone: 3/3 FAIL at 60 s. -> deterministic, not environmental.
- scale-graph-store alone 3/3; `automation-studio/testing` 5/5 files 10/10 tests three times. -> environmental (the EBUSY only follows a timeout); no change.
- database-manager index alone: pass, pass, FAIL (paging case 15,039 ms); directory: FAIL (15,098 ms), 40/40, 40/40. -> not environmental.
- `storage/canonical-authority` directory, 3 runs: 4 of 9 files failed every time (whole-operation, whole-sql hook, factory-provenance, plus whole-process child-kill cases at 30 s, owner-store "rejects foreign replacements..." 15,041 ms once, project-coordinator "global-only finalization..." 15,147 ms once).
Was it a wait or slowness? A probe repeating the sql admission case 5 times (since deleted) logged phases: the loser is refused 0.05-0.25 s after the winner pauses every time (no lock or queue wait); setup 0.95-4.8 s, create 1.3-5.5 s, winner save 1.0-2.5 s; totals 4.6-12 s. The four whole-operation cases that timed out are the four heaviest alone (2.1-2.9 s), the two that passed the lightest (1.2-1.8 s). Slowness, not a hang.

### 2026-10-19 Fixes re-applied only where the file still fails after 19:50

From the saved patch (`git apply --include=...`): `database-manager/tests/index.test.ts`, `canonical-authority/tests/{whole-fixture.ts, whole-operation.test.ts, whole-sql.test.ts, factory-provenance.test.ts}`. Not re-applied: promotion-tier, cancel-parked-run, scale-graph-store (environmental above).
New for creation.test.ts (`runtime/service/flows/tests/`): one beforeAll per mode for the project template; a Flow template per mode created in a copy of it (own hook); the combined case split into "creates through all actual <mode> effects" (create on a project copy; asserts the generated id and that the canonical record, Flow document and SQL row read "Original Flow", 2 receipts, 1 feed entry) and "saves through all actual <mode> effects" (save on a Flow-template copy; the original final assertions: "Changed" in all three places, 4 receipts, 2 feed entries). Every effect the old case certified is still certified, each case now carries one canonical operation. First run: 6/6 (create sql 2,913 ms, file 1,395 ms; save sql 1,275 ms, file 1,699 ms).
Checks: `node scripts/structure-audit.mjs` no FAIL; `npx tsc --noEmit -p tsconfig.json` exit 0.

### 2026-10-19 Validation of the re-applied fixes

Each alone x3, each directory x3 (`npx vitest run src/programs/<path>`):
- database-manager index alone 8/8 x3; `database-manager` 40/40 x3.
- whole-sql alone 14/14 x3. factory-provenance alone 1/1 x3 (was 0/3).
- creation.test.ts (split cases), first round: alone 7/7, FAIL (save file case reported 19,558 ms: the 15 s timer fired 4.5 s late, so the process was not being scheduled; CPU 100% at the time), 7/7; `runtime/service/flows` 10/10, 10/10, `Hook timed out`.
- whole-operation, first round: alone 6/6 x3; `storage/canonical-authority` 1 fail (file admission 15,021 ms), 1 fail (sql admission 15,021 ms), 59/59.
Then whole-operation's admission and unsupported-input cases were moved onto a Flow template (their "Original" Flow was setup; the concurrent saves are the subject): admission cases 537 and 805 ms alone (were 2.1-2.4 s). Final round: whole-operation alone 6/6 x3; creation alone 7/7 x3; `storage/canonical-authority` 9/9 files 59/59 x3; `runtime/service/flows` 2/2 files 10/10 x3.
Checks after the last edit: `node scripts/structure-audit.mjs` no FAIL; `npx tsc --noEmit -p tsconfig.json` exit 0.

UNIT READY: Core packages/fluxiq/src/programs/database-manager/tests/index.test.ts, packages/fluxiq/src/programs/automation-studio/storage/canonical-authority/tests/{whole-fixture.ts,whole-operation.test.ts,whole-sql.test.ts,factory-provenance.test.ts}, packages/fluxiq/src/programs/automation-studio/runtime/service/flows/tests/creation.test.ts (downstream: this report only)

## Outcome by failing file

| File | Recovered-machine verdict | Change |
| --- | --- | --- |
| database-manager index | fails (2 of 6) | seed in one transaction |
| canonical-authority whole-operation | fails (2 of 3 alone) | project and Flow templates; cases do only their subject |
| canonical-authority whole-sql | fails (hook, 1 of 3) | project template, two hooks |
| flows creation | fails (alone and directory) | one hook per template; create and save split |
| factory-provenance (found in directory runs) | fails 3/3, deterministic | static import order |
| promotion-tier | environmental (3/3 alone, 3/3 dir) | none |
| cancel-parked-run | environmental (3/3 alone, 3/3 dir for the file) | none |
| scale-graph-store | environmental (3/3, 3/3) | none |
| scenario-lab crossborder browser-paths | environmental (17/17 x3, 57/57 x3) | none |
| test-runner (never reached) | 2358 pass, 0 fail, 5 skipped | none |

## Notes for the supervisor

- Environment, measured during this lane: commit memory exhausted until ~19:50 (OneDrive ~16 GB; vitest died once with "memory allocation of 448 bytes failed"); after that commit recovered but CPU stayed at 100% and free physical memory fell to 540 MB at one sample, with timers firing up to 4.5 s late. These SQLite-heavy integration tests make 500-1,500 sequential async SQLite calls per case, so any full sweep run beside other lanes' work will stretch them. A sweep gate on free physical memory and CPU (lane H, scripts/**) would make sweep results mean something.
- Product hot spot, not changed (integrity code): one canonical create plus save makes 348 `mutation_records` reads and 116 `authority_guard_legacy` reads (history-join re-verification in `storage/project/authority-guard/records.ts`). It is the largest share of each canonical operation's ~700 calls.
- Durability option, not taken: `global.sqlite` runs at `synchronous=FULL`; `NORMAL` measured only 1.45x on the operation pattern and would let a power loss keep a project claim while losing the global reservation before it.
- Unapplied, saved for reference: promotion-tier and cancel-parked-run shared setup (505-526 -> 76-185 calls per case) and the scale-graph-store teardown move, in `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/t731-core-test-reductions.patch`.
- Two Core source files restored to HEAD had their mtimes set back (content identical) so the downstream Core-freshness guard does not ask for a rebuild.
- Also seen once in a directory run, not in the brief and not changed: service-flows canonical-persistence "exposes and executes explicitly bound domain-native nodes only in their project scope" 15,536 ms (1 of 3).
