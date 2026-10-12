# t380: Core tests that fail only under load

## Outcome

Partial.

- **whole-sql** and **recovery-trace** are fixed at the cause. Each test was rebuilding setup that is not its subject. That setup is now built once per file and copied into each test.
- **creation**: the `EBUSY` that followed its timeout is fixed. Its setup is shared too, so each test drops from about 1.4 s to 1.0 s alone. The 1.0 s left is the subject itself (one Flow create plus one save). Under heavy machine load it can still pass 15 s: it did once in four paired runs, while the t378 lead's two vitest runs were going.
- No timeout was raised, because no test's cost alone justifies it.
- The last packages/fluxiq run finished with 8864 passed, 7 skipped and 0 failed. The baseline run had 1 failure.

Tree: `fxwork/t380/!FluxIQ`, branch `task/t380-load-sensitive-tests`. Nothing is committed.

## Cause, per finding (measured)

1. **No leaked handle, no sleep, no shared file, no lock contention.**
   - Lock contention: I forced `busy_timeout` to 0 on every product connection (global `SQLiteRepository` and project DB). In 24 rounds of the creation workload, run beside a full packages/fluxiq suite, no `SQLITE_BUSY` occurred. So no connection ever waits on another's lock.
   - Sleeps: the canonical-authority, flows, projects and project-DB code has none.
   - Shared files: every test has its own `mkdtemp` root.
2. **The `EBUSY ... global.sqlite / project.sqlite` is a side effect of the timeout, not a product leak.**
   - vitest does not stop a timed-out test body. `afterEach` deleted the directory while the body still held the database, and the plain `rm` failed.
   - The baseline run left `Temp/whole-flow-aN2Mt6` behind this way. I removed it.
   - With retrying cleanup, a later timeout (paired run 1) produced no `EBUSY`.
3. **The cost is the number of sequential SQLite round trips each test makes, and load stretches every one of them.**
   - One creation round makes about 1,300 SQL statements and 62 connection open/close cycles.

     | Step | SQL statements | Connection opens |
     | --- | --- | --- |
     | createProject | 247 | 7 |
     | createFlow | 398 | 28 |
     | saveFlow | 428 | 27 |

   - Each canonical Flow create or save:
     - opens `global.sqlite` about 25 times;
     - runs about 16 global write transactions at the default `synchronous=FULL`, plus about 12 project transactions.
   - `SQLiteRepository` opens a new connection on every call. Each open re-runs `pragma journal_mode=WAL` and two `create ... if not exists`. Each close of the last connection checkpoints and deletes the WAL and SHM files.
   - How one creation round grew under load (probe of the same workload):

     | Condition | Round time | vs alone |
     | --- | --- | --- |
     | Alone | 1.4 s | 1x |
     | 12 CPU-burning processes | about 3 s | 2x |
     | 6 fsync loops | up to 9.2 s | 6.5x |
     | Beside a full suite, plus other trees' suites | up to 21.8 s | 15x |

   - In the 21.8 s round, 13.9 s was statement latency, spread across ordinary SELECTs. Connection open/close took only 0.9 s and commits 1.3 s.
   - Keeping an extra connection open, so that a close does not checkpoint, saved only about 8%. I did not adopt it.
4. **Machine and load at the time:**
   - 4 physical cores and 8 threads, a SATA SSD, Defender real-time protection on, and 7 vitest workers.
   - Other trees ran suites throughout my measurements. While I measured, the t378 tree ran two vitest runs plus `tsc` at 100% CPU. During the after run I sampled 9 to 22 node processes from other trees.
   - Running two full suites at once failed 5 tests in 4 other files, recovery-trace among them. So the failing tests are just the most expensive members of a larger class.

## What changed and why

- **`storage/canonical-authority/tests/whole-fixture.ts`**
  - Adds `wholeFlowTemplate`, `wholeFlowFromTemplate` and `disposeWholeFlowTemplate`. A template is one created Flow, with every connection closed. It refuses to be used if any `-wal`, `-shm` or `-journal` file remains. Each test copies it and opens fresh owners over the copy.
  - Cleanup now uses `rm` with `maxRetries: 20, retryDelay: 50`.
  - `wholeFixture` behaves as before, and its other users (`whole-operation.test.ts`, `whole-process.test.ts`) still pass.
- **`whole-sql.test.ts`**
  - The 12 corruption probes now copy one template. Before, each probe rebuilt the fixture, the project and the Flow: about 850 ms of a 1 s test.
  - Each probe now also asserts the named refusal: `authority_guard.corrupt_claim`, `corrupt_mutation_join` or `canonical_whole.sql_parent_bounds`. A copy that failed for any other reason can no longer pass. The refusal strings came out identical before and after the change, for all 12 probes.
- **`runtime/service/flows/tests/creation.test.ts`**
  - `beforeAll` creates each mode's project once (about 400 ms and 250 statements). Each test copies it.
  - Cleanup retries.
  - No new `as never`: the first attempt added one, the structure audit refused it, and I removed it.
- **`runtime/tests/service-adaptation/tests/recovery-trace.test.ts`**
  - The failing Flow (create, save, primary subflow, graph, fallback: about 400 ms of each 750 ms test) is built once, with its service closed. Each of the three tests that use it copies it before constructing its own service.
  - The graph-failure test keeps its own different graph, unchanged.
  - Before adopting the copy, I checked that a closed service's data directory contains no absolute paths and no sidecar files.

## Commands run and observed results

All commands ran in `packages/fluxiq` unless stated otherwise.

**Root `pnpm -r --no-bail test`, before the change, 23:24 to 23:35:**
- fluxiq: 1 failed of 8871. creation's sql test timed out at 15199 ms, followed by `EBUSY unlink ...project.sqlite`.
- creation's file test took 9115 ms. The whole-sql tests took 1960 to 3091 ms each (the file took 28.9 s). recovery-trace took 1729 to 2155 ms per test.
- apps/web passed.

**Paired comparison** (original and new copies, sequential in one vitest run, repeated 5 times):

| Runs 2 to 5 | whole-sql test time | creation test time | creation slowest test |
| --- | --- | --- | --- |
| Original | 13.05 to 13.58 s | 3.06 to 3.26 s | 1.39 to 1.47 s |
| New | 2.94 to 3.04 s | 1.99 to 2.20 s | 1.01 to 1.18 s |

Run 1 ran during the t378 load spike:
- the original creation file took 17.1 s, with its slowest test at 12.2 s;
- the new creation file's file-mode test timed out at 15.5 s, with no `EBUSY` after it.

**Each fixed file, 5 times in a row alone (`npx vitest run <file>`): all 15 runs exited 0.**
- creation: 5/5 passed each time. Its two effect tests took 0.82 to 1.06 s, except 1.98 s in run 5.
- whole-sql: 14/14 passed each time. Corruption probes took 0.13 to 0.18 s in runs 2 to 5, and up to 0.64 s in run 1.
- recovery-trace: 4/4 passed each time. Tests took 0.35 to 0.74 s in runs 1 and 5, and up to 1.97 s in runs 2 to 4 (ambient load).
- Before the change, alone: about 1.0 s per whole-sql test, 1.5 s per creation effect test, and 0.75 to 0.8 s per recovery-trace test.

**Whole packages/fluxiq after the change, `npx vitest run`, 00:38 to 00:48 (9 m 45 s):**
- 909 files passed and 3 skipped. 8864 tests passed and 7 skipped, **0 failed**.
- whole-sql: the file took 7.8 s, with corruption probes at 0.23 to 1.30 s.
- creation: 4.2 s for the sql test and 2.3 s for the file test.
- recovery-trace: 0.61 to 1.40 s per test.

**Other checks:**
- `npx tsc --noEmit -p .`: no output.
- `pnpm structure:check` (repo root): `structure-audit: passed (292 warning(s), 710 baselined)`.
- `whole-operation.test.ts`, `whole-process.test.ts` and `recovery-trace.test.ts` run together: 26/26 passed.

## Not verified

- Root `pnpm test` after the change. I ran packages/fluxiq alone, as the brief asks. apps/web is unaffected because I changed no web files.
- Behaviour on a quiet machine. Other trees ran suites through every measurement, so absolute times vary between runs. The paired runs are the fair comparison.
- That creation can no longer time out. Under heavy load it still can (paired run 1).
- `docs:check`. I changed no documentation in Core.

## Open questions and recommendations (outside this brief's ownership)

1. **Product cost, a ticket for the supervisor.** Every canonical Flow create or save costs about 400 sequential SQL statements and about 25 `global.sqlite` connection opens, each opened and closed per call with its DDL re-run. Global writes use `synchronous=FULL`; the project DB already uses `NORMAL` in WAL. Fixing this would cut this whole class of tests and production save latency alike. These are product files I did not own, and nothing leaks.
2. **Sweep scheduling.** A full suite run while other trees run suites inflates statement latency up to 15x. Run the twice-daily sweep with no other suite in flight, or cap packages/fluxiq `maxWorkers` (the vitest config is not mine).
3. **Next tests at risk.** These have their own timeouts or were close to the limit in the after run:
   - `provider-unavailable.test.ts`: 14996 ms, against a 15 s limit;
   - `candidate-unusable-reply.test.ts`: 19.4 s;
   - `whole-process.test.ts`: 19.3 s;
   - `extension-chat.test.ts`: 13.9 s.

   The load2 run (two suites at once) failed tests in `command-execution/tests/service.test.ts`, `reusable-llm-context-service.test.ts` and `reusable-llm-context-store.test.ts`.
4. The supervisor's earlier narrow-run failure of recovery-trace (2 tests) did not reproduce on its own. The one recovery-trace failure I saw was in load2, from the same load mechanism.
