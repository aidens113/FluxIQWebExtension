# t206: tests that pass alone and fail under load

Worker report. Trees: `fxwork/t206/!FluxIQWebExtension` and `fxwork/t206/!FluxIQ`, branch `task/t206-load-sensitive-tests` in both. No Lab or browser run. Round 1 (sections 1-4) is merged; round 2 is at the end and is uncommitted.

## Outcome

**Partial.**

Six of the named failures had a real timing dependency. Each one is removed, and its test now passes alone and beside a heavy suite:
- lab build lock
- navigation `waitedMs`
- clone-cache race
- clone-cache lock timeout
- conversation store (both cases)
- core-contract

One product slowness is fixed: every existence check read five files, and now reads one. This cut round trips by 20-26% in the slow Core tests, and the service-bootstrap timeouts went from 1 per run to 0.

**Still load-sensitive:**
- `run-detail-preservation` "keeps a repaired run's…": 15.15-15.38 s under load, 6.8-14.9 s otherwise.
- `reauthor-service`: passes its 60 s budget, but one case reached 42 s under deliberate load.

Neither test waits on anything. Each runs about 6,400 storage round trips in sequence (section 3). The fixes that remain change product storage behaviour, so I have proposed them (section 4) and not made them.

**The supervisor's mid-task question.** Is there "one wait in the run path" behind the ~15 s stall? No, not in anything I could reproduce. Section 3 has the evidence.

## 1. What changed and why

### Downstream

**`scripts/lab/build-lock.mjs` and `scripts/lab/tests/lab-instance.test.mjs`**

- **Timing dependency.** The waiter set its deadline from `Date.now()` before its first look at the lock, and checked the deadline before announcing the wait. The test had a 40 ms timeout. When the first `open` and `readFile` took more than 40 ms (on a busy thread pool), the waiter timed out without ever calling `onWait`, and `observedWait` stayed false.
- **Product fix.**
  - The waiter announces before it judges the deadline, so a waiter that times out has always said whom it waited for.
  - The deadline uses the injected `now`, the same clock as the heartbeat.
- **Test fix.** The waiter's clock advances 15 ms per reading. The timeout now depends on how many times the waiter looks, not on wall time.

**`packages/test-runner/src/clone-cache.ts`**

This fixes both the race test and the "clone-cache lock timeout".

- **Timing dependency.** A real lock under contention, with a wall-clock deadline.
  - Each `save` held the scope lock while it ran `hardenWindowsPrivatePath` three times: on the lock directory, the temp file and the target. Each call spawns `icacls` about four times.
  - Twelve concurrent operations queued behind about 100 process spawns. The last waiter's fixed 10 s deadline (counted from its first look) expired even though every holder was healthy.
- **Fix.**
  - The temp file is written and hardened before the lock is taken, because its name is unique to this call. Only the rename and the prune hold the lock.
  - The empty lock marker is no longer hardened. It inherits the hardened directory's current-user-only ACL, and it holds nothing.
  - The target is not re-hardened. The rename carries the ACL the temp file was given.
  - The deadline now restarts when the lock changes hands (the lock's `ino` and birthtime). It bounds one holder, not the queue. The 30 s stale-lock reclaim is unchanged.
- **ACL check.** `icacls` on a saved entry printed only `DESKTOP-RT2TFLI\osrs_:(F)`, not inherited. The directory is still hardened on every operation.

**`packages/test-runner/src/run-scenario/tests/extension-control-page.test.ts`**

- **Timing dependency.** "Any other navigation failure…" asserted `waitedMs: 0` against the real `Date.now`. It held only when no millisecond passed between two calls.
- **Fix.** The test injects a clock that does not move, as the neighbouring tests already do.

### Core

**`runtime/conversations/tests/store.test.ts`**

- **Timing dependency: shared state between processes.** The root was the fixed path `process.cwd()/.tmp/automation-studio-conversation-store-test`. Two runs of the file in one checkout (two lanes validating the shared Core) deleted each other's databases and wrote onto each other's change feed. That produces both the feed assertion failure and the stuck case.
- **Reproduction.** Two copies started 3 s apart in one checkout: copy A 15/15 passed, and copy B failed 15/15.
- **Fix.** Each case gets its own `mkdtemp` root.
- **Also.** The migrated project is now seeded once per file and copied into each case. The measured cost of a case was 0.6-0.9 s to migrate a new project, against about 0.1 s for the rest.

**`apps/web/.../capabilities/tests/core-contract-world.ts` and `core-contract.test.ts`**

- **Timing dependency.**
  - Every one of 53 variants seeded its own world: a new project plus about 15 Core operations.
  - The four classification tests opened a whole seeded world just to read endpoint classifications, which come from registering the handlers alone. That seeding ran under the web package's default 5 s timeout, which explains the 5 s timeouts. The 30 s timeouts came from the per-variant seeding.
- **Fix.**
  - `seedContractData` builds the seed once per file. Each world copies it into its own directory and opens its own service, so no variant sees another's writes.
  - `contractClassifications()` registers the handlers on an unseeded service.
  - `closeContractSeed()` runs in the file's `afterAll`.
- **Result.** 53/53 variants are still accepted, and all 60 tests pass.
- **One cost moved.** The first variant now carries the seed. It measured 9-19 s against its 30 s budget, where before it measured 4 s.

**`runtime/service/projects/store.ts` (`requireProject`) and 12 service files**

- **Slow product step.** Sixty-eight service operations checked that the project exists with `findProject`, and discarded the result. `findProject` also reads the project's hierarchy and workspace documents (four more files). A repaired run made about 1,700 of its 2,800 file reads this way.
- **Fix.** `requireProject(projectId)` throws exactly as `findProject` does for an unknown project, and reads only the index.
  - Every statement-form `await this.projects.findProject(...)` (and the one `ports.` call) now uses it.
  - Calls that use the returned record are unchanged.
  - The three test doubles that fake the store gain `requireProject`.

## 2. Commands run and observed results (before -> after)

**Lab build lock**
- Scratch reproduction: saturate libuv's four threads with `pbkdf2`, then run the test's waiter 10 times.
  - Old code: `10/10 rounds timed out without announcing the wait`.
  - New code: `0/10`.
- `node --test tests/lab-instance.test.mjs`: `# pass 10 # fail 0` alone. It also passed 3 of 3 times while 3 heavy Core suites ran.

**test-runner**
- `pnpm --filter @fluxiq-web-extension/test-runner build` (through heavy.sh), then `node --test dist/tests/clone-cache.test.js dist/run-scenario/tests/extension-control-page.test.js`.
  - **Before, alone:** `not ok 4 - serializes simultaneous…`, `error: 'Timed out waiting for the scoped clone cache lock'`. The race test took 14,470 ms, the other cases 7.5-18.5 s, and the file 64 s.
  - **After, alone:** 16/16 passed, race 3,876 ms.
  - **After, beside 3 heavy suites:** 16/16 passed both times; the file took 30.0 s and 19.3 s, with the race at 3,211 ms.
- Neighbouring suites: `node --test dist/tests/commands.test.js dist/tests/clone-source-exporter.test.js dist/run-scenario/tests/*.test.js` -> `# tests 60 # pass 60 # fail 0`.

**Core conversation store**
- Before, twin runs: copy B failed 15/15.
- After, twin runs: `15 passed` twice.
- Alone:
  - Before: the per-case sum was about 16.5 s.
  - After: tests 3.30 s.
- Beside the deliberate Core storage and service-bootstrap suite: `Tests 15 passed (15)`, tests 1.51 s.

**core-contract** (apps/web, through heavy.sh)
- Before: `Tests 60 passed`, tests 254 s (median variant 4.5 s, max 9.2 s), duration 298 s. This run already had `requireProject`.
- After, alone: `Tests 60 passed`, tests 66 s (median 0.7 s), duration 143 s.
- After, beside the deliberate heavy suite: `Tests 60 passed`, `53/53 variants accepted`, tests 107 s.

**service-bootstrap, run-detail-preservation, reauthor-service**
- Command: `vitest run <three paths> --maxWorkers=2 --minWorkers=1`, through heavy.sh, interleaved after/before/after/before. "Before" means the `requireProject` patch reverse-applied.

| Run | Wall | Result | Max, run-detail-preservation | Max, reauthor |
| --- | --- | --- | --- | --- |
| after1 | 284 s | 107/107 passed | 14.9 s | 26.4 s |
| before1 | 305 s | 1 timeout (`plan-parameters` "refuses to persist a plan that still names a handle", 15.8 s) | 13.2 s | 19.0 s |
| after2 | 194 s | 107/107 passed | 6.8 s | 21.6 s |
| before2 | 218 s | 107/107 passed | 12.1 s | 14.0 s |

- Most service-bootstrap files ran faster after: extend 20-35 s against 36-77 s, rejections 11-21 s against 23-77 s.
- reauthor was slower in both "after" runs. The round-trip counts below show it does less work, so I read this as load moving between runs, not as the change.
- **Load-independent round trips** (sqlite plus fs callbacks, counted with an async_hooks probe):

| Test | Before | After |
| --- | --- | --- |
| run-detail-preservation #1 | 8,045 | 6,389 |
| reauthor "uses the run's caller" | 8,071 | 6,451 |
| adaptation "bridges…" | 8,335 | 6,145 |

- Beside the deliberate heavy suite: `run-detail-preservation` #1 still timed out (15,154 ms), and reauthor passed with cases up to 42 s.

**Checks**
- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` -> no output.
- `apps/web: npx tsc --noEmit -p .` -> no output.
- Core `node scripts/structure-audit.mjs` -> `passed (200 warning(s), 354 baselined)`, none of them in my files.
- Downstream audit -> `passed (132 warning(s), 120 baselined)`.
- Core `vitest run src/programs/automation-studio/runtime/service …/api …/runtime/conversations --maxWorkers=2` -> `Tests 2 failed | 496 passed`. Neither failure comes from this change:
  - `run-detail-preservation` #1 is the 15 s case above.
  - `datasets/service-wiring` fails with "pool is closing". That is the t207 regression, fixed on t207's branch, which is not in this tree.

## 3. The "~15 s stall": evidence

I wrote a vitest setup file that records every libuv-level async resource. It dumps what is pending at 11 s and reports each test's longest idle gap between callbacks.

**Runs:**
- 6 runs of reader plus preservation.
- 8 runs of the reader beside a deliberate heavy suite.
- 3 rounds of 4 reader copies at once.

**What it showed:**
- **The preservation timeouts (15,184 ms and 15,380 ms) had no idle gap over 100 ms.** At 11 s the last callback had run 1 ms earlier. Nothing was pending longer than 1.5 s except vitest's own timers. The process was never waiting; it was completing I/O the whole time.
- **The reader never stalled in 26 runs** (max 13.7 s).
- **Four simultaneous copies slowed together.** In round 3, all four copies' last case took 13.2-13.7 s, a slowdown across processes at the same moment. The only idle gaps were 13-14 of 100-173 ms, and most were ended by a `sqlite3.Database.Close`, which is the WAL checkpoint and fsync on the last connection's close.
- t207's "all four cases at 15.1 s" is each case reaching the timeout, not a shared wait.

**Where the time goes in one repaired run** (about 6,400 round trips, all sequential):

| Step | Round trips | Share | Why it matters under load |
| --- | --- | --- | --- |
| Opening and closing the project database | 120-215 open/close cycles per test | Close 1.4-3.7 s and the open-time PRAGMA script 1.0-2.2 s | Most sensitive to contention: fsync, and WAL file create and delete |
| Statements | 1,800 prepares, 800 runs, 550 gets | The largest count | Each one is a separate thread-pool hop |
| Project index reads | 166-220 per test | | One `index.json` read per operation |
| Event-chunk reads | Every run-detail save reads the run's whole event stream twice (`getRunDetail`, then `putRunDetail`), and each save appends a chunk | Quadratic in saves | |

**Prototype, not kept.** Holding one project lease across `runRuntimeSession` gave Close 158 -> 52 and run time 7.7/5.5 s -> 5.5/4.2 s (-25-30%).

## 4. Proposals (not done; product storage decisions)

1. **Operation-scoped project lease.** `runRuntimeSession`, `reviewFlowAdaptation` and generation would hold one lease for their own duration. The pool still closes on last release, and nothing stays open while idle, which is the option you declined. The prototype measured -25-30%.
2. **Read a saved run's events once.** The run-detail save should reuse the events `getRunDetail` already read. Later, keep the latest envelope and the event ids in the `runtime_runs` table, so a save does not scan the whole event stream (it is quadratic today).
3. **Cache `index.json` per service, keyed by stat.** Invalidate on `mtime`, `size` and `ino`. That is one stat in place of a read for each `requireProject`.
4. **The same cross-process defect in 37 other Core test files.** They use a fixed `process.cwd()/.tmp/...` root. Examples are `storage/project/tests/*`, `conversations/commands/tests/execute.test.ts` and `datasets/tests/run-datasets.test.ts`; the full list comes from `grep -rln 'process.cwd(), ".tmp"' packages/fluxiq/src`. Proposal: a mechanical `mkdtemp` sweep, and a structure-audit rule that fails the build on a fixed temp root in a test.
5. **Another load-sensitive test I saw:** `storage/project/tests/runtime-stream-store.test.ts` "…at a million events" timed out at 60 s beside other suites. t193 already knew about it.

## Not verified

- An idle-machine measurement. Every run shared the machine with 2-4 other lanes.
- The full Core suite and the full downstream suite.
- t207's exact reader stall. It did not reproduce in 26 runs.
- Anything on Linux: the ACL path is Windows-only, and the POSIX `chmod` path is unchanged in logic.

## Open questions or contradictions found

- The brief lists `run-detail-preservation` and `reauthor` as timing bugs. They are product slowness, with no wait involved, and they remain until one of the proposals in section 4 is chosen.
- The first core-contract variant now pays the seed: up to 19 s of its 30 s budget under load.

Round 1 was verified and merged into dev by the supervisor: Core `9d9f1df8`, downstream `8d381586`.

## Round 2 (2026-09-30): the proposals, made

Brief from the supervisor:
1. The operation-scoped lease, plus the single event read per save and the index stat-cache if each is a clear win.
2. The sweep of the 37 fixed-root Core test files.
3. A structure-audit rule, mirrored into this repository.

Unit tests only. Both branches start from dev (the fast-forward to `9d9f1df8` / `8d381586`).

### Outcome

**Partial.**
- **Done:** all three items. Each storage change is a measured win on its own.
- **Much less load-sensitive:**
  - reauthor, file time: -39% under deliberate load.
  - run-detail-preservation, round trips: -14%.
  - Timeouts under load went from 2 of 3 runs to 1 of 3.
- **Still one timeout in 3 under deliberate load:** run-detail-preservation #1 (15.1 s against 15 s). The step that remains is named below. It is a change to the migration machinery, so I have proposed it and not made it.

### What changed and why (Core)

**1a. Operation-scoped project lease**
- New file: `runtime/service/projects/database-hold.ts`, exported from the barrel.
- `runRuntimeSession`, `reviewFlowAdaptation` and `generateFlowBootstrapAdaptation` now hold one lease on their project database for the whole operation. Inner acquires reuse the open database; they used to open and close it once per store call.
- The pool still closes the database on the operation's own release. Nothing stays open while idle.
- It holds only a project the index lists. Acquiring creates the database file, and an unknown project must still fail as before.
- It never holds on a closing pool:
  - `AutomationStudioProjectDatabasePool.isClosing` is new, in `storage/project/database.ts`.
  - The closing check runs again right before `acquire`, with no await between the check and the call.
  - So a run whose storage was closed under it still ends as a failed run with a record (t207's datasets test).

**1b. Single event read per save**
- `runtime-stream-store.ts`: `readRunForUpdate(runId)` returns the detail and the stream it was read from. `putRunDetail(detail, { existingEvents })` reuses that stream in place of reading it again.
- `run-detail-writer.ts` uses both.
- This is safe: `putRunDetail` has one caller, which runs under the per-run lock, and it is the only writer of the run's events.
- `getRunDetail` is unchanged, including the spy t207's reader test puts on it.

**1c. Index stat-cache**
- `projects/store.ts` caches the parsed `index.json` under the file's identity: dev, ino, size and mtime in nanoseconds, read with a bigint `stat`.
- A write replaces the file through a rename, which gives it a new ino. This store's own writes also drop the cached copy.
- It is cached only when `ProgramJsonStore.isFileBacked()` (new, in `_shared/storage.ts`). An index kept in SQLite may leave a stale file behind, and that file's identity would never change.
- Each hit hands out a `structuredClone`.
- The stat names ENOENT as "no file" and rethrows anything else (the failure-as-empty rule).

**2. The sweep**
- All 37 files, plus `storage/project/tests/result-check-state.test.ts` (a fixed `os.tmpdir()` root that the new rule found), now create their root with `mkdtemp(path.join(os.tmpdir(), "<old-name>-"))`.
  - In most files this happens in `beforeEach`. In the one test that declared its own root inline, it happens in that test.
  - Both `client-gateway/tests/bridge*.test.ts` files gain a `beforeEach`.
  - In `reusable-llm-context-service.test.ts`, `dataDir` and `automationRoot` are now derived inside the hook.
- `apps/web/src/lib/tests/fluxiq.test.ts`: the "missing host module" path now sits inside a `mkdtempSync` directory.
- A stale comment in `runtime-stream-store.test.ts` no longer says sibling tests use the working directory.

**3. The audit rule**
- New files: `scripts/structure-audit/rules/shared-temp-root.mjs` and `rules/tests/shared-temp-root.test.mjs` (8 tests), in Core. Copied byte-for-byte (LF) into this repository's `scripts/structure-audit/rules/`.
- **What it fails** (`severity: "fail"`, `ratchet: false`, no baseline):
  - In test files and under test roots, a `join`/`resolve` whose first argument is `os.tmpdir()`/`tmpdir()` and whose other arguments are all fixed strings.
  - The same with `process.cwd()`, when the first segment is `tmp`/`.tmp`/`temp`/`.temp`.
- **Exempt:** the same call as `mkdtemp`'s or `mkdtempSync`'s prefix, and any computed name.
- **Downstream finding fixed:** `domain/scripts/tests/test-domain.test.mjs` used a fixed `tmpdir()` path. The test never writes there; the path now carries `process.pid`.

### Measurements

**Round trips per test.** These are sqlite plus fs completions, counted by the async_hooks probe. They do not depend on load. Base is the merged dev tree; each column adds one change.

| Test | Base | + lease | + single read | + index cache | Change |
| --- | --- | --- | --- | --- | --- |
| run-detail-preservation #1 | 6,195 | 5,978 | 5,703 | 5,313 | -14% |
| reauthor "uses the run's caller" | 6,447 | 6,030 | 5,460 | 5,077 | -21% |
| adaptation "bridges…" | 6,145 | 5,631 | 5,516 | 5,021 | -18% |

- Database closes per test, from the lease: reauthor 158 -> 52, preservation 148 -> 57 opens, bridges 215 -> 82.

**Under deliberate load.**
- Command: `vitest run run-detail-preservation reauthor-service --maxWorkers=2`, through heavy.sh, interleaved after/before three times.
- Load: a loop of `vitest run src/programs/automation-studio/storage …/service-bootstrap --maxWorkers=2` through heavy.sh, running the whole time (4 iterations).
- "Before" is the three storage changes reverse-applied.

| Run | reauthor file sum (max case) | preservation file sum (max case, timeouts) |
| --- | --- | --- |
| after1 | 64.5 s (19.1 s) | 26.3 s (15.1 s, 1 timeout) |
| before1 | 107.6 s (27.3 s) | 24.2 s (15.1 s, 1 timeout) |
| after2 | 42.6 s (12.2 s) | 16.9 s (9.6 s, 0) |
| before2 | 114.4 s (21.5 s) | 21.3 s (15.1 s, 1 timeout) |
| after3 | 84.9 s (13.8 s) | 23.3 s (14.9 s, 0) |
| before3 | 93.1 s (20.2 s) | 20.6 s (14.5 s, 0) |

- reauthor: mean 105 s -> 64 s.
- preservation: timeouts 2 of 3 -> 1 of 3.

**The sweep, in twin runs.** Two copies of `catalog`, `content-store`, `commands/execute` and `graph-store` were started 2 s apart in one checkout.
- Before: `3 failed | 25 passed` and `20 failed | 8 passed`.
- After: `28 passed` twice.

### What still makes preservation marginal, and the decision it needs

- **The step.** The largest remaining step is the migration check each store open makes on the held connection. On every open it runs the lifecycle `CREATE`s (`exec`), the insert, the ledger select and the `markReady` update. That is 170 store opens in preservation #1, about 850 round trips, or 16%.
- **The proposal.** Memoise "this migration set is applied and ready" on the open connection. The connection now lives exactly one operation.
- **The cost.** A second process that starts migrating mid-operation would not be seen until the next operation. Today that makes every store open throw "lock was lost".
- **Why I did not make it.** It is a change to the migration machinery, the same trade t193 raised with option A, so I left it for your decision.
- **Next after that.** Caching prepared statements per connection: about 1,600 `Prepare` hops per test, each a thread-pool round trip.

### Round 2 commands and results

- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` (through heavy.sh) -> no output.
- `apps/web: npx tsc --noEmit -p .` (through heavy.sh) -> no output.
- Core `vitest run …/storage …/runtime/service …/runtime/conversations …/api …/client-gateway …/testing …/reusable-llm-context-service …/service-bootstrap --maxWorkers=2` -> `Tests 1 failed | 863 passed | 1 skipped (865)`. The one failure is the million-event case (60,127 ms), which is load-sensitive and was already known (report section 4.5). The new files are all green: `database-hold` 5/5, `store-index-cache` 3/3, `runtime-stream-store-update` 2/2. `bridge` 25/25, `bridge-restart` 4/4 and `reusable-llm-context-service` 4/4 also pass.
- `apps/web: npx vitest run src/lib/tests/fluxiq.test.ts` -> `Tests 16 passed`.
- After the final edits (inlining the review wrapper, the ENOENT naming, a tsc fix in the new test): `vitest run runtime/service/projects/tests storage/project/tests/runtime-stream-store-update service-bootstrap/tests/adaptation reauthor-service run-detail-preservation run-detail-read --maxWorkers=2` -> `37 passed | 1 failed`.
  - The failure was the reader's first case at 16.3 s, while t200's `pnpm check` held a slot.
  - Rerun three times with the stall probe: 4/4 each time.
  - The first case measured 9.9 s, 15.5 s and 5.2 s, with no idle gap longer than 412 ms. That is busy work, not a wait. The first case in a file is consistently the slowest, which I read as cold start.
  - That case holds no lease. It passes through `runRuntimeSession` inside `completedRun` and nothing more.
- Rule tests: `node --test scripts/structure-audit/rules/tests/*.test.mjs scripts/structure-audit/tests/*.test.mjs` -> Core `# pass 200 # fail 0`, downstream `# pass 200 # fail 0`.
- Audits:
  - Downstream `node scripts/structure-audit.mjs` -> `passed (134 warning(s), 120 baselined)`.
  - Core -> 1 violation, not from this change: `[directory-files] runtime/llm/evidence-loop/: 26 source files exceeds the 25-file limit`. It came in with dev's t196 merge `957a0226`, and I did not touch that directory.
- `node --test domain/scripts/tests/test-domain.test.mjs` -> `# pass 19 # fail 0`.

### Round 2: not verified

- A full Core suite run.
- An idle machine. Every timing shares the machine with other lanes.
- Behaviour against an index kept in SQLite (storage layout v2). The cache is off in that mode by construction, but no test exercises it.

### Round 2: open questions

- **Core audit on dev.** It is red on dev (evidence-loop, 26 files), so Core `pnpm check` fails whatever this task does.
- **Line endings of the mirrored rule.** Core files are CRLF in the working copy and the downstream copies are LF, like every other mirrored rule file.

Ready to commit (round 2):
- **Core:**
  - `packages/fluxiq/src/programs/_shared/storage.ts`
  - `packages/fluxiq/src/programs/automation-studio/`: `runtime/service.ts`, `runtime/service/projects/{database-hold.ts,index.ts,store.ts}`, `runtime/service/projects/tests/{database-hold,store-index-cache}.test.ts`, `runtime/service/summaries/run-detail-writer.ts`, `storage/project/{database.ts,runtime-stream-store.ts}`, `storage/project/tests/runtime-stream-store-update.test.ts`, and the 39 swept test files (`git status` in the Core tree lists them)
  - `apps/web/src/lib/tests/fluxiq.test.ts`
  - `scripts/structure-audit/rules/shared-temp-root.mjs` and `scripts/structure-audit/rules/tests/shared-temp-root.test.mjs`
- **Downstream:**
  - `scripts/structure-audit/rules/shared-temp-root.mjs` and `scripts/structure-audit/rules/tests/shared-temp-root.test.mjs`
  - `domain/scripts/tests/test-domain.test.mjs`
  - this report

Validation (round 2):
- Round trips: -14%, -21% and -18%.
- Under load: reauthor 105 s -> 64 s mean; preservation timeouts 2/3 -> 1/3.
- Sweep twin runs: 23 failures -> 0.
- Suites: 863/865 (the one failure is the known million-event case); new tests 10/10.
- Rule tests 200/200 in both repositories.
- Both `tsc` runs clean.
- Downstream audit passed. The Core audit's only failure is dev's evidence-loop.

## Round 3 (2026-09-30): the failed-start timeouts, scale-pages and the million-event case

Tree: Core at dev `fd2f7e6b`, which already contains round 2. Unit tests only.

### Outcome

**Done for failed-start and scale-pages. The million-event case is named, not fixed.**

- **failed-start: no regression from the operation lease.**
  - The lease is released on every exit path, including a start that throws before or after the session is marked running. A new test now pins that.
  - The 15 s timeouts are the same storage cost as preservation: about 2,400 round trips per case, setup included. They were not a hang.
- **scale-pages "10,000 Subflow summaries": 27-56 s -> 1.4 s.**
  - The slow step was the test's own seeding, not the reads it tests.
  - Its wall-clock budget is replaced by a budget on how many rows the reads return, which does not depend on load.
- **The million-event case: the slow step is named, and the one fix I tried did not help.** Details below.

### failed-start

**Evidence that the lease is released**
- A scratch probe read `pool.stats()` after a run whose start threw: `openProjects: 0`. After the next successful run it was also 0.
- The stall probe found no idle gap over 130 ms in any case. The cases are busy for their whole run; they never wait.

**Evidence that the lease does not slow these tests**
- First comparison: the file run alternately with and without the hold, by a temporary env switch in `database-hold.ts`, since removed.
  - Five pairs. With hold, file sums were 81, 56, 65, 62 and 45 s. Without, 48, 48, 44, 21 and 50 s.
  - That looked like a slowdown. But the same configuration ranged from 21 s to 81 s, so I re-ran it so that both sides saw the same load.
- Second comparison: hold and no-hold copies started at the same moment, three rounds.
  - With hold: 87.6, 42.8 and 32.1 s.
  - Without: 93.9, 43.5 and 34.7 s.
  - With the hold, it is slightly faster every round. The no-hold copy also timed out once.
- Round trips for case 1: 2,379 with the hold, 2,457 without.
- So the earlier gap was load moving between sequential runs, not the lease.

**Test added** to `runtime/tests/service-adaptation/tests/failed-start.test.ts`:
- `releases every project database lease it took when it throws before it is marked running / after it was marked running`.
- It wraps `AutomationStudioProjectDatabasePool.prototype.acquire` to count leases that are taken and not released.
- It requires at least one lease taken, and none outstanding after the rejection.
- With the release in `database-hold.ts` disabled, both cases fail (`2 failed`). With it restored, both pass.

### scale-pages "pages and filters 10,000 Subflow summaries"

**The slow step: the seed.** 10,000 single-row inserts made 20,000 SQLite round trips (a prepare and a run each): 22 s of prepares plus 28 s of runs, 56 s of wall time under the probe. The two reads under test took under a second.

**Fix to the seed.** It now inserts 1,000 rows per statement: 648 round trips, 1.4 s.

**Second timing dependency.** With the seed fixed, the test failed on its own `expect(pageElapsedMs).toBeLessThan(500)`, at 888 ms beside other suites; t193 had seen 853 ms.
- The wall-clock budget is replaced by a work budget. Each read runs inside `withEndpointPerformanceScope`, and the rows it returned from SQLite must stay at or below 1,000, a tenth of the 10,000-row table.
- Measured: 106 rows for the page and 57 for the search. That is the page and its count, plus the migration-ledger rows each store open reads, which grow by one with every migration. A read that loaded the table to cut a page from it would return 10,000 rows and fail.
- I left out the `possibleFullScan` heuristic: it flags 4 parameterless ledger selects on every read.

**The other two cases in the file:** 17.7 s and 13.2 s of their 60 s budgets. The first seeds 10,000 Subflows through `createFlowSubflow`, one service call each. That is not in this brief.

### runtime-stream-store "…at a million events"

**The slow step.** I timed the inner steps of each `appendRuntimeEvents` (10,000 action events), 15 appends:
- per append: mean 1,299 ms;
- `writeActionSummaries`: 983 ms (76%);
- the chunk write: 246 ms, of which `putBytes` was 185 ms.

So the cost is the upsert of 10,000 `runtime_action_summaries` rows per append: a primary key and two secondary indexes, and each row carries its detail JSON. That is about 100 µs a row on this machine, roughly 100 s for a million rows under load.

**Tried and reverted.** The probe attributed 18 s to statement prepares, so I prepared the 200-row upsert once per write, through a new `runMany` on the executor.
- Timed alternately: after 981 and 1,246 ms per append, before 865 and 1,183 ms. No gain.
- The probe had counted the per-statement work as "prepare". Both files are back at HEAD.

**Not fixed: it is a product decision.** The test exists to prove sequence tailing at a million events, and it also asserts `actionAttemptCount: 1_000_000`. The options:
- (a) Write the action-summary projection lazily. `ensureActionSummaryProjection` can already rebuild it from the stream when a listing asks.
- (b) Give the test events that project nothing, and assert the count elsewhere.

### Round 3 commands and results

- `vitest run service-adaptation/tests/failed-start service-flows/tests/scale-pages --maxWorkers=2 --minWorkers=1` -> `Test Files 2 passed (2)`, `Tests 13 passed (13)`.
- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` (through heavy.sh) -> no output.
- Core `node scripts/structure-audit.mjs` -> `passed (203 warning(s), 354 baselined)`. dev's evidence-loop failure is gone after the merge.

### Round 3: not verified

- An idle machine.
- The million-event case after any fix, since none was made.

Ready to commit (round 3), Core only:
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-adaptation/tests/failed-start.test.ts`
- `packages/fluxiq/src/programs/automation-studio/runtime/tests/service-flows/tests/scale-pages.test.ts`

Downstream: this report.

## Round 4 (2026-09-30): the million-event case, option (b)

Tree: Core at dev `c5dbcf83`, which already contains round 3. Test change only; no product change.

**What changed** (`storage/project/tests/runtime-stream-store.test.ts`):

- **"…at a million events".** It now appends `subflow_execution` events, through a new `subflowEvent()` helper. These write no action summaries.
  - What it proves is unchanged: tailing (`afterSequence: 999_990`) and reconnecting give sequences 999,991 to 1,000,000.
  - The run's summary row is still found by search, now with `actionAttemptCount: 0`.
  - Before, three quarters of each append was the projection's upsert of 10,000 action-summary rows, and the case timed that and not the stream.
- **New case: "projects every appended action attempt into the run's count and action pages, and rebuilds a lost projection from the stream".**
  - It appends 2,500 action attempts in three appends (1,000, 1,000 and 500). That size crosses every batch boundary the projection has: several chunks, the 200-row upsert, and the 500-event pages its rebuild reads.
  - It asserts:
    - the run's `actionAttemptCount` is 2,500;
    - the last action page holds attempts 2,498 to 2,500, out of a total of 2,500.
  - Then it deletes every summary row past sequence 1,200 and sets `definition_id = 'unknown'` on the first 10 rows. The next `listRunActions` runs `ensureActionSummaryProjection`. The case asserts:
    - the last page is again 2,498 to 2,500, with a total of 2,500;
    - the table holds 2,500 rows, none with an unknown definition.
- **Why the case is not in a file of its own.** I first put it in a new file, but that made `storage/project/tests/` 26 files, and the `directory-files` rule fails above 25. It stays in this file, which is now 420 lines (an advisory warning, not a failure).

**Wall time of the file** (`vitest run storage/project/tests/runtime-stream-store.test --reporter=verbose`, through heavy.sh, beside other lanes):

| | Duration | Tests | Million case | Projection case |
| --- | --- | --- | --- | --- |
| Before (dev `c5dbcf83`) | 63.6 s | 56.1 s | 51.3 s (60 s budget; timed out at 60 s in earlier runs) | none |
| After, four runs | 22.3 / 23.1 / 33.0 / 46.9 s | 12.8 / 12.6 / 21.5 / 36.2 s | 6.1 / 6.5 / 8.9 / 19.1 s | 1.3 / 1.4 / 1.3 / 2.4 s |

**Checks**
- All four runs: `Tests 11 passed (11)`.
- `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` (through heavy.sh) -> no output.
- Core `node scripts/structure-audit.mjs` -> `passed (204 warning(s), 354 baselined)`. The one new warning is this file's 420 lines.

**Not verified:** an idle machine.

Ready to commit (round 4), Core: `packages/fluxiq/src/programs/automation-studio/storage/project/tests/runtime-stream-store.test.ts`. Downstream: this report.
