# t206: tests that pass alone and fail under load

Worker report. Trees: `fxwork/t206/!FluxIQWebExtension` and `fxwork/t206/!FluxIQ`, branch `task/t206-load-sensitive-tests` in both. Nothing is committed. No Lab or browser run.

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

Ready to commit:
- **Downstream:** `scripts/lab/build-lock.mjs`, `scripts/lab/tests/lab-instance.test.mjs`, `packages/test-runner/src/clone-cache.ts`, `packages/test-runner/src/run-scenario/tests/extension-control-page.test.ts`, and this report.
- **Core:**
  - `packages/fluxiq/src/programs/automation-studio/runtime/conversations/tests/store.test.ts`
  - `apps/web/src/features/automation-studio/conversation/capabilities/tests/core-contract-world.ts` and `core-contract.test.ts`
  - `packages/fluxiq/src/programs/automation-studio/runtime/service/projects/store.ts`, `runtime/service.ts`, and the `requireProject` call sites in `runtime/service/{bootstrap-adaptations,object-documents,ui-cache}.ts`, `runtime/service/flows/{graph-patch,store,writer}.ts`, `runtime/service/{indexes,legacy,summaries}/store.ts`, `runtime/service/problems/project-problem-listing.ts`, `runtime/service/projects/artifacts.ts` and `runtime/service/summaries/run-detail-writer.ts`
  - The test doubles in `runtime/service/tests/{bootstrap-adaptations,incomplete-drafts}.test.ts` and `runtime/tests/service-bootstrap/tests/incomplete-draft.test.ts`

Validation:
- `node --test tests/lab-instance.test.mjs` -> 10/10.
- test-runner `node --test` -> 16/16 and 60/60, including beside 3 heavy suites.
- Core `store.test` -> 15/15 alone, in twin runs and under load.
- `core-contract` -> 60/60, tests 254 s -> 66 s alone and 107 s under load.
- service-bootstrap, preservation and reauthor -> after 107/107 twice, before 1 timeout.
- Both `tsc` runs -> clean; both audits -> passed.
