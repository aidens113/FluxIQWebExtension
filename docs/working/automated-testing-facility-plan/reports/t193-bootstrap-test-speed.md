# t193 Core service-bootstrap test speed: lane report

Status: **Round 1: ready.** The work is in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t192/!FluxIQ`, at dev
`fb05385a`, and is uncommitted. The next step needs a decision; it is in section 4.

## 1. Why each test costs 10-15 s (diagnosis, with evidence)

A test's cost is not fixed waits, real timers or assertions. It is storage round trips, and machine contention
multiplies them.

- **About 75% of a test's wall time is idle.** An in-worker CPU profile of `apply-graph-index` (taken with a
  `node:inspector` setup file) measured 5,132 ms in total, of which 3,867 ms was idle.
  - Idle here means waiting on libuv's four-thread pool, which runs every SQLite call and every async `fs` call.
  - CPU work was small. The largest CPU cost was `existsSync` at 418 ms, from the storage layout lookup.
  - No `setTimeout`-based wait or polling loop runs in these paths. The only real sleeps are the 25 ms retry backoffs
    in `object-store.ts` and `recording-index-store.ts`, and none fired.
- **The round trips, counted by instrumenting sqlite3 and `fs` inside the vitest worker.** Three catalog tests made:
  - **115 SQLite opens.** The project pool closes a database on its last release, so every store operation reopens
    it.
  - **Five PRAGMAs per open, each a separate round trip.**
  - **About 440 separate `CREATE` and `ALTER` round trips for every new project.** The migration runner sent each
    statement with its own `run`.
  - **Per acquire:** the migration-lifecycle `CREATE`s, a ledger `SELECT` and a status `UPDATE`.
  - **645 `readFile` calls,** for JSON program state.
  - **10,017 synchronous `existsSync` calls.** `_shared/storage.ts` `sqliteStateForPath` walks from each file's
    directory up to the drive root looking for `config.json`, and the test directories have none.
- **Intrinsic cost versus contention.**
  - Natively, a test is about 3-5 s. A scratch reproduction of the 10 s catalog test measured about 0.7 s to create a
    project and 1.3 s to generate, per service.
  - Beside 3-5 live Lab lanes, the same test measured anywhere from 5 s to 32 s across runs. `apply-graph-index`
    took 5.0 s, 13.4 s, 13.5 s, 17.5 s and 32.3 s on five runs of unchanged code. That is how "a different 3-7 tests"
    cross 15 s on each run.
- **Per-file overhead is small once warm.** The first file in a worker pays about 50 s to transform and collect
  modules; each later file pays 3-4 s. So at one worker the 673 s is mostly test execution.
- **The EBUSY on `-shm`** is in `storage/project/tests/runtime-stream-store.test.ts`, not in service-bootstrap.
  - Every test in that file shared one fixed temp root.
  - The million-event test times out at 60 s and leaves its databases open and still writing. Each later test's
    `rm` of the shared root then fails with EBUSY, a cascade of 4 failures on every run.
  - In service-bootstrap, the ENOTEMPTY on `flows/flow.generated` has the same cause: work still in flight after a
    timeout, when `rm` runs without retries.

## 2. Fix log (Round 1)

1. **Product, behaviour-identical, fewer round trips** (`packages/fluxiq/src/programs/automation-studio/storage/`):
   - `project/database.ts`: the executor gains an optional `exec(script)`. The five open PRAGMAs run as one script in
     the same order. `exec` still records one SQL performance metric.
   - `schema-migrations.ts`: `runStatements` sends a migration's statements as one script inside the same
     transaction, and the lifecycle `CREATE`s likewise.
     - Statements are joined with a newline, ";" and a newline, so a trailing `--` comment cannot swallow the
       separator.
     - An executor without `exec` falls back to one `run` per statement.
   - Unchanged: the statements, their order, atomicity, the ledger, the checksums and every error path.
   - I considered memoizing checksums and validation and did not do it. The migration constants are not frozen, so a
     memo could go stale, and the gain was 30-70 ms of CPU per file.
2. **Tests, cleanup** (meaning unchanged):
   - `service-bootstrap/tests/{accounting,catalog,flow-size,generation,rejections}.test.ts` now remove their temp
     root with `maxRetries: 10, retryDelay: 25`, as the other 12 files there already did.
   - `storage/project/tests/runtime-stream-store.test.ts`:
     - Each test gets its own `mkdtemp` root, still under `os.tmpdir()` as the file's comment requires.
     - All 11 pools are created through `openPool()` and closed in `afterEach`, whether the test passed or not. A
       closing pool refuses the next acquire, which stops a timed-out writer.

**Measured effect.**

SQLite calls per file, counted, so load does not affect them:

| File | Before | After | Change |
| --- | --- | --- | --- |
| generation (8 tests) | 7,206 | 3,698 | -49% |
| catalog (3 tests) | 3,333 | 1,524 | -54% |

`fs` calls are unchanged: 26,119 and 10,952.

Wall time for the whole directory, interleaved before, after, before, after in one series. The load moved during
the series (3-5 live lanes):

| Workers | Before: wall s / timeouts | After: wall s / timeouts |
| --- | --- | --- |
| 1 | 406 / 0 of 91 | 473 / 4 of 91 |
| 2 | 348 / 6 of 91 | 285 / 1 of 91 |

Wall time cannot show the batching's effect under this load: one unchanged test ranged from 5 s to 32 s.
Timeouts still happen on both sides.

**EBUSY.** `runtime-stream-store` now passes 9 of its 10 tests even when the million-event test times out; before,
that timeout cascaded into 4 EBUSY failures. The million-event test itself, which writes about 158 MB, still exceeds
60 s under load. Its own comment puts it near 20 s on an idle disk.

## 3. Validation (observed)

- **Core `pnpm check`** (through `heavy.sh`): exit 0 in 147 s, with 263 pass and 0 fail, and the structure audit
  passed. It re-ran `fluxiq`, `contracts`, gateway and web checks because their inputs had changed.
- **Storage, `_shared` and `database-manager` suites at 2 workers:** 340 of 345 passed. All 5 failures were the
  `runtime-stream-store` cascade described above, which was already failing on the unmodified tree. After the test
  fix, that file passes 9 of 10.
- **service-bootstrap, 91 tests:** every test passes whenever it does not time out. There are no assertion failures
  on either side.
- **Line endings:** every changed file is still CRLF in the working copy, matching a Core checkout.
- **Full fluxiq suite**, default workers, with the change: 4,542 of 4,584 passed.
  - 34 failures are 15 s or 60 s timeouts.
  - 1 is the wall-clock budget in `scale-pages` (853 ms against 500 ms).
  - 1 is an assertion: `runtime/tests/native-node-runtime.test.ts` "registers manifests and isolates implementation
    inputs to declared ports" (`expected NaN to be 8`). It also fails deterministically with the two storage files
    swapped back to HEAD, so it already fails on dev and is not caused by this change (Core source did not change
    it here). I have not investigated it.
  - No test asserting `sqlQueryCount` failed.

## 4. What still makes these tests slow, and the decision it needs

After Round 1, a test still makes about 460 SQLite calls and about 3,300 `fs` calls. Under 3-5 live lanes, that can
still exceed 15 s. The remaining large cuts change product behaviour, so I have not made them without a decision:

- **A. Keep project databases open while idle.**
  - The change: a short grace period after the last release, with `closeAll` and project deletion closing at once.
    It would be paired with a per-open-handle memo of "migration set ready".
  - What it removes: the reopen, PRAGMAs, lifecycle, ledger read and status write on nearly every acquire. That is
    about 60% of the remaining SQL calls.
  - The cost: it changes a tested contract, since `run-datasets.test.ts` asserts `openProjects` returns to 0 after
    release. It also checks the "migrating elsewhere" lock once per open instead of once per acquire.
  - **My recommendation, if you approve the contract change.**
- **B. Cache `sqliteStateForPath`'s upward `config.json` walk.** This is unsafe without invalidation, because a
  layout migration can create `config.json` mid-process. Not recommended as it stands.
- **C. Reduce the repeated JSON state reads (645 per 3 tests).** This needs caching in the program stores, which is
  product behaviour.

Two things are not options:
- **Test-only in-memory storage** is impossible. Every operation reopens its database, and a `:memory:` database
  would be empty each time.
- **Raising the timeouts** was not done, as instructed.

## 5. Not verified

- **An idle-machine measurement.** Every run shared the machine with 2-5 live Lab lanes.
- **Whether any endpoint test asserts `sqlQueryCount`,** which would now be lower for DDL and PRAGMAs. None failed in
  the suites I ran.
