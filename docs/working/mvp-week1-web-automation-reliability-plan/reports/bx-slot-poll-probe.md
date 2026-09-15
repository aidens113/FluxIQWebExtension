# bx-slot-poll-probe report

Worktree: `F:\fxlab\fxlab-prod-core` (detached at `3d6ecd6`). No commit. Nothing touched in
`F:\!FluxIQWebExtension` or `F:\!FluxIQ`. `lease.ts` and the probe interface are unchanged.

## Outcome

Done. A waiter no longer runs the full process-identity probe (which starts `powershell.exe` on
Windows) on every 100 ms poll. In steady state, while the queue does not change, a waiter now runs
zero probes. It probes an owner when it first sees it, when a spawn-free check says the owner's PID
is gone (the probe confirms before anything is archived), and at most once per 60 s per owner to
catch PID reuse. The loop still does everything else on every poll: stale recovery, FIFO order,
memory admission, and failing closed on unreadable owners. Poll cadence, capacity, reserve, and
bytes-per-slot defaults are unchanged.

## What changed and why

Files, all under `packages/test-runner/src/bench/campaign/machine-slots/`:

- `pid-presence.ts` (new). `pidPresence(pid)` sends signal 0 through `process.kill` and maps the
  result: success or EPERM means `present`, ESRCH means `absent`, anything else means `unknown`. It
  starts no process. Measured on this machine (Node 22.11, Windows 10) with a scratch script: our
  own PID gave ok, System PID 4 gave EPERM, an exited child and PID 2147483647 gave ESRCH, and
  2^40 gave `ERR_INVALID_ARG_TYPE`. 1,000 checks took 1.4 ms.
- `cached-owner-liveness.ts` (new). `createCachedOwnerLiveness({ verify, presence, monotonicNowMs,
  reverifyIntervalMs })` returns `isLive(owner)` and `markVerified(owner)`. It keeps one timestamp
  per owner record, keyed by ticketId, pid, boot hash, and identity hash. The rules:
  - a record seen for the first time is always probed;
  - `absent` is probed, so it can never become a "not live" verdict by itself;
  - `unknown` is probed, which is exactly the old behavior;
  - `present` is trusted until `reverifyIntervalMs` has passed since the start of the last successful
    probe, then probed again.

  Only `verify` (the unchanged full identity probe) can return `false`, so a live owner is never
  archived on the cache's word. A probe failure propagates, so the loop still fails closed.
- `acquire-machine-cell-slot.ts`:
  - builds one cache per `acquireMachineCellSlot` call, with `verify` set to the existing
    `ownerIsLive`;
  - seeds its own ticket with `markVerified`, because its identity was probed a moment earlier;
  - passes the cache to `recoverStaleEntries` in place of probe and bootIdentity;
  - adds `OWNER_REVERIFY_INTERVAL_MS = 60_000` with a comment giving the reason;
  - adds two optional test seams to `MachineCellSlotOptions`: `pidPresence` and `monotonicNowMs`,
    which defaults to `performance.now()`;
  - widens the parameter type of `ownerIsLive` to a `Pick`.

  Nothing else in the loop changed.
- `index.ts`: also exports `createCachedOwnerLiveness`, `CachedOwnerLiveness`,
  `CachedOwnerLivenessOptions`, `pidPresence`, and `PidPresence`. I grepped `packages/` for these
  names and found no collisions.
- Tests:
  - `tests/pid-presence.test.ts` (new, 5 tests).
  - `tests/cached-owner-liveness.test.ts` (new, 9 tests).
  - `tests/acquire-machine-cell-slot.test.ts`: the `options()` helper now injects a presence check
    derived from the fake probe's identity map, so the existing tests do not depend on the real
    process table. I also added 6 tests that drive the wait loop poll by poll on a fake clock and
    count probe calls. Each fails fast if it needs more polls than expected:
    - steady state: 200 polls and exactly `[own, holder]` probes;
    - once per minute: over 150 s, exactly 3 probes per owner;
    - a crashed owner is recovered on the next poll (poll 3, and history holds 1 entry);
    - a reused PID is detected exactly at 60 s;
    - a live owner reported `absent` 30 times is probed 30 times and never archived (history 0);
    - with no injected check, the default signal-0 check is used (this process's PID probed once
      over 50 polls).

Why 60 s: the interval matters only when an owner crashes and another process takes its PID before
the waiter's next poll, which is 100 ms. Without PID reuse, a crash is seen on the next poll.
Owners release in `finally`, so a crash is already the exception. In that case the stale owner
holds its slot or queue place for at most 60 s plus one poll. That is small next to cells that run
for minutes and the 30-minute wait timeout. Old cost: every waiter probed every ticket and slot
owner on every poll, and with PowerShell's startup time that meant spawning back-to-back for the
whole wait. New cost: one probe per owner at first sight, then one per owner per minute per waiter,
plus one per `absent` report. Poll cadence stays at 100 ms because file reads were not the cost.
I did not measure a reason to change it.

Proposed text for `docs/architecture/testing-facility.md`, not edited. It replaces the sentence at
lines 1139-1142 that begins "More jobs do not bypass the machine-wide admission gate":

> More jobs do not bypass the machine-wide admission gate: at most two scenario cells may own
> global slots, waiters are FIFO across concurrent campaigns, available physical memory is checked
> again before every cell, and although a waiter re-reads the pool every 100 ms it runs the full
> process-identity probe (a PowerShell query on Windows) only when it first sees an owner, when a
> spawn-free signal-0 check reports that owner's PID gone (the probe confirms before a crashed
> owner is archived), and at most once a minute per owner to catch a reused PID.

## Commands run and observed results

Each was run once, one process at a time.

1. `node <scratch>/bx-kill-probe.mjs`: printed `self:"ok", system4:"EPERM", hugeOdd:"ESRCH",
   exitedChild:{result:"ESRCH"}, overInt32:"ERR_INVALID_ARG_TYPE"` and `1000 self checks ms 1.4`.
2. `node <scratch>/bx-focused.mjs real`. It compiles the real worktree files (the machine-slots
   tests plus their import closure: `lease.ts` and `durable-file.ts`) with the package's own
   compilerOptions into the private `<scratch>/bx-build/real/out`, then runs `node --test
   --test-concurrency=1`. Result: `build ok, exit 0, tests 30, pass 30, fail 0`. The slowest test
   was the 200-poll steady-state test at 619 ms. The whole run took 1.9 s.
3. `node <scratch>/bx-focused.mjs mutations > bx-mutations.jsonl`, summarized with
   `bx-summarize.mjs`. Each mutation is applied to a fresh copy of that closure, never to the
   worktree, because another worker shares the tree. That makes restoring nothing more than
   discarding the copy. The control copy had no mutation: `tests 30 pass 30 fail 0`. Every
   mutation built, and each failed the named tests:
   - M1, a first-seen owner trusted without a probe: 16 failed, including `reboot`, `pid-reuse`,
     the steady-state count test, and "an owner seen for the first time is always probed".
   - M2, `absent` returns `false` with no confirming probe: 5 failed, including "a live owner is
     never archived…", "a live owner is never reported not live…", and "a PID reported absent is
     confirmed…".
   - M3, `absent` trusted like `present`: 3 failed, including "a crashed owner is recovered on the
     next poll…".
   - M4, no interval re-verification: 4 failed, including "a PID reused by a different process is
     detected within one re-verification interval" and "re-probed at most once per minute".
   - M5, `unknown` trusted like `present`: 1 failed, "falls back to probing on every check".
   - M6, cache keyed by PID only: 3 failed, including "a different owner record on an already
     verified PID is probed on first sight" and `pid-reuse`.
   - M7, window stamped after the probe finishes: 1 failed, "re-verification is due exactly one
     interval after the last probe started".
   - M8, no cache (probe on every poll): 8 failed, including the steady-state and once-per-minute
     count tests.
   - M9, own ticket not seeded: 2 failed, the two count tests.
   - M10, default presence check not wired (always `unknown`): 1 failed, "without an injected
     presence check…".
   - M11, interval set to 120 s: 2 failed, "re-probed at most once per minute" and "PID reused…
     within one re-verification interval".
   - M12, EPERM classed as `absent`: 1 failed, "signal 0 success and EPERM both mean…".
   - M13, ESRCH classed as `unknown`: 2 failed, "ESRCH means no process holds the PID" and "the
     default checks the real process table".

   Two earlier attempts at this step are void, and I discarded them:
   - The first compiled the copies to CommonJS, because NodeNext takes the module format from the
     nearest `package.json` to the source and the copy had none. All files failed to load. The
     fix was a `{"type":"module"}` file at the copy root, and the control copy now proves the copy
     is faithful.
   - The second lost its output to a broken inline summary pipe.
4. `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` in `packages/test-runner`.
   I did not use `pnpm check`: `domain/dist` is absent, so its `domain:dist` step would build the
   domain package into shared output. Result: exit 2 with 22 errors, all outside my files and
   none in machine-slots, `sharded-bench.ts`, or `bench/campaign/index.ts`.
   - 14 are TS2307 errors: `Cannot find module '@fluxiq-web-extension/domain/node'` (7) and
     `'@fluxiq-web-extension/test-evidence'` (7). Both are unbuilt workspace packages.
   - 8 are TS7006/TS7031 implicit-any errors in those same importing files.
5. `node scripts/structure-audit.mjs` with the rules `exported-values`, `file-lines`, `imports`,
   `naming`, `test-placement`, and `directory-files`: exit 1 with 4 FAILs, none in files I touched.
   - `packages/test-runner/src/tests/` holds 50 files against a baseline of 49.
   - Barrel-bypass imports in `bench/shard-merge.ts`, `bench/tests/shard-merge.test.ts`, and
     `facility-failure/project-facility-failure.ts`.
   - No finding mentions machine-slots.
6. `git status --short` in the worktree: my 3 modified and 4 new files, plus the other worker's
   `packages/test-runner/src/core-web-build/`.

## Not verified

- **Live behavior:** no `pnpm lab` or live campaign run (not allowed by the brief), so I did not
  measure the PowerShell spawn-rate reduction in a real benchmark.
- **`pnpm check`:** not run as written. The direct `tsc --noEmit` still has 22 unrelated
  missing-package errors, and I did not confirm they also occur on the unmodified tree, because
  that would need a stash or checkout in a shared worktree.
- **Full test suite:** not run. The package-wide `pnpm test` builds into the shared `dist`. Only
  the 30 machine-slots tests ran, privately.
- **Structure audit:** it reads only `git ls-files`, so it cannot see the 4 new untracked files. I
  checked them by hand against the rules: one exported value each, a type-only import between
  sibling files, tests importing through `../index.js`, no shared filename prefix, and small files.
  Measured with `wc -l`: the largest changed file, the loop test, is 318 lines (the main file is
  300), both under the 400 advisory threshold.
  I could not confirm the 4 FAILs predate my change, but none is in a file I touched and I added
  no tracked files.
- **Other platforms:** Linux and macOS not run. The real-process-table test assumes PID 2147483647
  is ESRCH on POSIX, which holds because it is above any `pid_max`, but this is unobserved.
- **EPERM:** covered in tests only by injection. The real EPERM result for PID 4 comes from one
  scratch run.
- **Repeat runs:** every result above is a single observation, on a machine with known faulty RAM.
  I saw no flake.

## Open questions or contradictions found

- **Public option surface:** `pidPresence` and `monotonicNowMs` are now public optional fields on
  `MachineCellSlotOptions`, which `sharded-bench.ts` forwards as `machineSlotOptions`. They follow
  the existing `now`, `sleep`, and `randomId` seams. The supervisor may prefer to keep them
  internal.
- **Barrel exports:** the barrel's new exports reach the wider package surface through
  `export *` in `bench/campaign/index.ts`.
- **Per-call cache:** the cache lives for one call, not the whole process, to avoid module-level
  mutable state. So each new cell acquisition probes each visible owner once when it first sees
  it, which is the same as the old loop's first poll. Entries for owners that release normally are
  not pruned. They are bounded by the distinct owners seen during one wait, about 100 bytes each.
- **Doc location:** the brief pointed at the admission paragraph, but that paragraph never mentions
  stale recovery or probing. The proposal therefore extends that sentence rather than correcting
  it.
- **Other callers of the probe:** I did not review them. `lease.ts` is out of scope, and it probes
  only during lease acquisition and recovery attempts, not in a 100 ms poll.
