# t435 required-session test hang: worker report

Brief: the two "captured effects" tests in Core's
`runtime/service/command-execution/tests/service.test.ts` swing between about 2 s and the 15 s
timeout. The suspicion was t427's reconcile allowance, or the answer timers racing a result that
had already arrived. Trees are `fxwork/t435/!FluxIQ` and `fxwork/t435/!FluxIQWebExtension`, both
on `task/t435-required-session-test-hang`, with dev and t434 merged in. Nothing is committed and
nothing changed in either tree; the temporary probe and trace lines are removed.

## Outcome

**Done**, after the follow-up below.

- The coordinator chose **(a)**: keep the storage lookup and the database connection between
  reads. It is implemented in Core, and nothing is committed.
- The first pass, described further down, found the cause and changed nothing.

## Follow-up: decision (a) implemented

### What changed (Core, `packages/fluxiq/src/`)

- **`programs/_shared/state-root.ts` (new), `programStateRoot`.** It replaces the walk up the
  directories for `config.json` and the parse of that config, which `sqliteStateForPath` did on
  every read.
  - The answer is kept per starting directory, at most 1,024 of them.
  - A kept answer is used again only while the same `config.json` is there, unchanged. Its
    device, inode, size and modification time are checked on every use.
  - A config that was rewritten, replaced or removed is walked to again.
  - A config that cannot be parsed still throws, and is not kept.
  - Only where the root is and its config are kept, never a document.
  - Not detected: a new `config.json` created later between the starting directory and the kept
    root. Storage roots are laid out before use and never nested.
- **`programs/database-manager/storage/operation-queue.ts` (new).** It holds the per-file
  operation queue, moved out of `sqlite-repository.ts` without changing what it does. It now uses
  the audit's "queue tail" form.
- **`programs/database-manager/storage/connection-pool.ts` (new), `SQLiteConnectionPool`.**
  - **Kept only inside a unit of work.** It keeps one connection per database file, but only inside
    `keepWhile(...)`. Outside that, every operation opens and closes its own connection, exactly as
    before.
  - **Closed when the work ends.** When the last `keepWhile` ends, every kept connection is closed
    before it returns. `closeAll()` does the same for an owner that is disposed.
  - **One operation at a time.** Every use runs inside the file's queue, so a kept connection
    serves one operation at a time.
  - **No reuse after replacement.** A kept connection is reused only while the file still has the
    same device and inode.
  - **No reuse after failure.** A failed operation closes its connection instead of keeping it.
  - **Nothing else is kept.** Only the handle is kept, never data.
  - **Why scoped.** A first version kept connections for 50 ms after each operation. It made 7
    tests that delete their temporary root fail with Windows `EBUSY`, so it was replaced by this
    scoped version.
- **`programs/database-manager/storage/sqlite-repository.ts`.**
  - New option `connections?: SQLiteConnectionPool`. `withDatabase` and `transaction` go through
    a new `connected()`, which uses the pool when there is one and otherwise the old open, use,
    close.
  - Setup moved into `prepare()`, which runs once per connection and table when pooled.
  - A repository without a pool behaves exactly as before.
- **`programs/_shared/state-connections.ts` (new), `programStateConnections`.** The one pool for
  program state. It is re-exported from `storage.ts` and from the `programs` barrel.
- **`programs/_shared/storage.ts`.** `sqliteStateForPath` uses `programStateRoot`, and the
  repositories it builds use `programStateConnections`. Its strict and non-strict error behaviour
  is unchanged.
- **`programs/automation-studio/runtime/service.ts`.** `runRuntimeSession` runs inside
  `programStateConnections.keepWhile(...)`. That is the only unit of work that opts in. The line
  count is unchanged against the baseline.
- **`framework/index.ts`.** `FluxIQ.close()` also awaits `programStateConnections.closeAll()`.

The exactly-once guard is untouched. Each of the 43 fingerprint reads still reads and digests the
stored session. They now reuse the resolved root and an open connection.

### Measured (filtered `captured effects`; probe copy of the test with timing marks)

**Idle machine**, 3 runs each:

| | Before | After |
| --- | --- | --- |
| Run 1 | 834-1716 ms; 43 session reads, 265-529 ms | 473-584 ms; 43 reads, 44-48 ms |
| Run 2 | 563-725 ms; 43 reads, 243-333 ms | 262-295 ms; 43 reads, 37-42 ms |
| Whole test | io 1688-2655 ms, runtime 1579-1646 ms | io 961-1045 ms, runtime 859-962 ms |

**Under 8 CPU burners**, 2 runs each:

- **Before:** both tests timed out both times (io 15075/15086 ms, runtime 15004/15014 ms). One
  run took 6.1-8.8 s, of which the session reads took 2.5-3.2 s.
- **After:** both tests passed both times (io 8620 and 11872 ms, runtime 6914 and 11214 ms). One
  run took 2.6-6.5 s, of which the session reads took 0.36-1.13 s.
- The margin under that load is still only 3-8 s. The rest is CPU work, including the guard's
  digest of the whole session on every read.

**10 consecutive filtered runs** of the real test file after the change (idle, and before the
last two import-only edits):

| Run | io (ms) | runtime (ms) |
| --- | --- | --- |
| 1 | 836 | 711 |
| 2 | 875 | 721 |
| 3 | 795 | 712 |
| 4 | 805 | 701 |
| 5 | 789 | 727 |
| 6 | 832 | 706 |
| 7 | 821 | 702 |
| 8 | 841 | 728 |
| 9 | 1001 | 904 |
| 10 | 985 | 900 |

All are under 5 s. Three more runs after the final edits gave io 961-1030 ms and runtime
859-962 ms.

### Tests (new)

- `programs/database-manager/storage/tests/connection-pool.test.ts` (4). Every test removes its
  temporary root with no retries, which fails on Windows if a handle is still open.
  - Outside a unit of work: 2 operations open 2 connections, and the file can be removed at once.
  - Inside one: a put, a put to another table, a transaction and two gets open 1 connection, and
    the file can be removed as soon as the work ends.
  - A failed transaction closes its connection, and the next operation opens a fresh one.
  - `closeAll` releases a unit of work's connection, so the file can be removed while the work is
    still open.
- `programs/_shared/tests/state-root.test.ts` (3):
  - finds the nearest config;
  - reads it again after a rewrite, and walks again after removal;
  - an unparseable config throws, is not kept, and is read once fixed.

### Commands run and observed results

- `cd packages/fluxiq && pnpm run check`: build-cache `fluxiq:check` line, exit 0. That was the
  final run.
- `npx vitest run src/programs/_shared src/programs/database-manager src/framework src/client-gateway src/runtime/tests <AS>/storage <AS>/runtime/service <AS>/runtime/executor`
  printed `Test Files 2 failed | 305 passed | 2 skipped (309)  Tests 2443 passed | 5 skipped (2448)`.
  - `runtime/service` covers command-run, command-execution, runtime-session, flows and projects.
  - The 2 failed files fail at import time with
    `TypeError: Cannot read properties of undefined (reading 'notIssued')` in
    `runtime/recovery/annotation/step-evidence-resolution.ts:66`. They are
    `candidate-drafts/tests/source.test.ts` and
    `flow-bootstrap-commands/tests/generation-context.test.ts`.
  - **These two failures were already on dev.** With my changes reverse-applied, the same two
    files failed the same way.
  - An earlier run of this set had one more failure: my own `closeAll` test, which raced under
    load. It now waits for its write instead of using a timer, and passed 3 times in a row after
    the fix.
- `npx vitest run …/command-execution/tests/service.test.ts src/client-gateway/tests/durable-reconcile.test.ts …/effect-check/tests/required-outcome.test.ts`
  printed `Test Files 3 passed (3)  Tests 16 passed (16)`. The whole file took 6355 ms.
- `node scripts/structure-audit.mjs` (Core) printed `structure-audit: passed (324 warning(s), 1160 baselined).`
  - **Two failures along the way, both fixed:**
    - `service.ts` went one line over its baseline. I folded the import into the existing
      `storage.ts` import.
    - One packed line in the new test. I unpacked it.
  - **Advisory warnings, not failures:**
    - `sqlite-repository.ts` is 455 lines;
    - `_shared/storage.ts` has 9 exported values, which is unchanged because a re-export does not
      count.

### Not verified (follow-up)

- **Only `runRuntimeSession` keeps connections.** Other heavy service calls, such as Flow saves
  and builds, still open a connection per operation. They could opt in the same way.
- **Another process deleting a root during a run.** A run holds its root database open. Removing
  that root from another process while a run is going on is not tested. Nothing in the product
  does that.
- **No downstream rebuild or tests.** The `programs` barrel now exports `programStateConnections`.
  That only adds to Core's public surface.
- **The guard's per-read session digest** is still the main CPU cost under load. I did not touch
  it, by decision.

## Outcome of the first pass

**Partial: cause found, no product change made.**

**t427 does not cause the failures, and nothing hangs.** The tests are slow because the machine is
loaded. A required-mode run is a long chain of SQLite and file reads one after another, so when
CPU and disk are contended its wall time balloons. The suspected race does not happen:

- no answer timer ever fired;
- no reconcile question was ever asked;
- nothing went uncertain.

**The code from before t427 fails identically under the same load.** Fixing the actual cost needs
a decision about code outside this brief. See "Open questions".

## Evidence

### 1. The durable dispatch, traced

I added temporary trace points to `command-ledger/dispatch.ts` at:

- execute, ledger resolve, accept;
- the answer timer, `uncertain`;
- the outcome, and the completed observer.

Then I reproduced the failure by running the test beside 8 CPU-busy Node processes on this
8-core machine. Both tests timed out (`io 15081ms`, `runtime 15003ms`).

Every one of the 9 traced commands ran the same normal sequence. Two examples (times are
`Date.now() % 100000`):

```
5442 execute 043ad5ac wait=4000 | 5452 resolved | 5644 accept phase=waiting status=succeeded | 6805 outcome completed | 6937 observed
7923 execute e9a0ddd4           | 8087 resolved | 8962 accept phase=waiting status=succeeded | 10411 outcome completed | 11083 observed
```

- No `timer`, `uncertain` or reconcile line appears.
- Each answer is accepted while still `waiting`, and reaches `completed` well inside the
  4,000 ms answer window.
- The runtime path's reconcile allowance (19 s deadline) is never reached.

Under load, each step simply takes about 1.5 s: about 1.2 s from accept to the committed receipt,
and about 0.1 to 0.7 s for the observer. Between run 1's last command and run 2's first there is
7.4 s of plain storage work.

### 2. The same test on the pre-t427 code, under the same load

I reverse-applied `git diff 8500e1a2 HEAD -- packages/fluxiq/src`. That covers all five merges
since this morning's passing sweep: t427, t431, t429, t430 and t434. No other package changed in
that range. I then ran the same loaded test:

- **Base:** `× io 15075ms`, `× runtime 15015ms`. The base was even slower: about 5.5 s from run
  start to the first send, against about 4.6 s on the current code.
- **Current:** `× io 15072ms`, `× runtime 15015ms`.

I re-applied the patch and confirmed the tree was back to its merged state with no diff. So the
loaded failure was already there before t427, and t434 does not change it either. The sweep that
passed this morning ran on a less loaded machine.

### 3. Where a required run's time goes (idle machine, in-process CPU profile of both runs)

- **The main thread is mostly waiting.** Of the 1,560 ms profiled, 924 ms is idle. The test's
  wall time is waiting on native SQLite and file input/output.
- **Session reads.** One two-step required run calls `getRuntimeSession` 43 times (46 for the
  second run). Together those calls take about 290 ms of a 650-900 ms run.
  - Nearly all of them come from `service/command-run/controller.ts`. Its `live()` and
    `fingerprint()` re-read the stored session and digest the whole Flow before and after each
    ledger operation. That is the owner-change guard.
- **Each read is expensive.** Through `getRuntimeSession` → `readProjectIndex`, and
  `_shared/storage.ts` `sqliteStateForPath`, every read:
  - walks up the directories with `existsSync` looking for `config.json`, and parses it;
  - builds a new `SQLiteRepository`;
  - `open`s the database (the profile also shows `Backup` and `mkdir`).
- **On contention.** An operation that costs a few milliseconds idle costs tens to hundreds of
  milliseconds under contention. Two required runs plus setup then cross 15 s.

## Commands run and observed results

- **Filtered test on an idle machine, before any probe:** 3 runs of
  `npx vitest run src/programs/automation-studio/runtime/service/command-execution/tests/service.test.ts -t "captured effects"`.
  - io/runtime: 8471/3137, 1797/2493, 2078/2026 ms.
  - The 8.4 s run coincided with heavy machine load: collect took 114 s.
- **Idle, real file:** 5 runs gave io 1742-1874 ms and runtime 1623-1866 ms. A temporary
  probe copy of the file gave the same.
- **Under 8 CPU burners:**
  - current code, twice: both tests `× … 15081ms / 15003ms` and `15072ms / 15015ms` (timed out);
  - pre-t427 code, once: `× 15075ms / 15015ms`.
- **10 consecutive filtered runs at the end, current tree, no change made:**

  | Run | io (ms) | runtime (ms) |
  | --- | --- | --- |
  | 1 | 2397 | 4065 |
  | 2 | 3906 | 3738 |
  | 3 | 4422 | 3868 |
  | 4 | 1738 | 1615 |
  | 5 | 1808 | 1610 |
  | 6 | 3067 | 2874 |
  | 7 | 1779 | 1607 |
  | 8 | 1684 | 1579 |
  | 9 | 2261 | 1598 |
  | 10 | 1890 | 1648 |

  All are under 5 s. The spread follows other agents' load on the machine, not any change: I made
  none.
- **The whole file plus my t427 tests:**
  `npx vitest run …/command-execution/tests/service.test.ts src/client-gateway/tests/durable-reconcile.test.ts …/effect-check/tests/required-outcome.test.ts src/runtime/tests/service.test.ts`
  printed `Test Files 4 passed (4)  Tests 33 passed (33)`. `service.test.ts` took 8226 ms over all
  5 of its tests.
- **Not run:** the wider vitest set, `pnpm run check` and the structure audit. No product or test
  source changed, so there was nothing new for them to check.

## Not verified

- I measured the CPU-burner load only. I did not separate disk contention from CPU contention.
- I did not test any optimisation. Both candidates are listed under "Open questions".

## Open questions or contradictions found

1. **The brief's premise does not hold.** No timer or reconcile race exists, and the old code
   fails the same way under the same load. A product change that makes this test reliably fast
   under load means cutting storage round trips. That is outside t427's code. There are two
   candidates, and both need your decision:
   - **(a) Cache the storage resolution per database root** in `_shared/storage.ts`
     (`sqliteStateForPath` / `sqliteState`): the `config.json` walk and parse, and the repository
     open, for every read.
     - This is cross-cutting: every program's storage reads change.
     - It probably removes most of the per-read cost.
   - **(b) Read the session fingerprint less often** in `service/command-run/controller.ts`. Today
     `live()` runs before and after every ledger operation, which gives 43 session reads per
     two-step run.
     - This touches the exactly-once owner-change guard, so it needs a security-minded design.
       One option is to compare a cheap stored revision instead of re-reading and digesting the
       whole session.

   My recommendation is **(a)**. It does not weaken any guard, and it speeds up every program.
2. **The test's 15 s budget is fine on an idle machine (about 2 s).** It fails whenever full
   suites, Lab runs or other agents saturate the machine. That is the condition the coordinator's
   failing runs were in; at the time of their failure, t434 was being merged and validated.
