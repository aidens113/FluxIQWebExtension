# t1017 report: Lab runs that share one Core hold a shared reader lease

Worker: worker-heavy (Opus 5.5). Trees: Core `fxwork/t1017/!FluxIQ`, downstream `fxwork/t1017/!FluxIQWebExtension`, branch `task/t1017-core-reader-lease` in both. No git commands that change state were run.

## Outcome

Done. A Lab run now takes each Core library's step lock as a shared reader. Any number of runs read one Core at the same time. A build waits until no live reader is left, and readers wait while a build holds the lock or is waiting for it. All acceptance checks pass (outputs below).

## What changed and why

### Core (`scripts/build-cache/**`, one owned mechanism)

- `lock/lock-file.mjs` (new): the owner-file primitives that used to be private to `acquire-step-lock.mjs` (create-only link, holder read with the Windows transient retry, rename-aside break, token-owned release). It adds `isStaleHolder` (dead pid, or untouched past `staleMs`), `releaseLockFileSync` (for `process.on("exit")`) and `touchLockFileSync` (a heartbeat that checks the token first).
- `lock/reader-entries.mjs` (new): each reader is one owner file beside the writer's lock, `<stamp>.lock.reader-<uuid>`, and a single directory listing finds them all. `.tmp` link sources are never counted as entries.
- `lock/acquire-step-read-lock.mjs` (new, `acquireStepReadLock`):
  - It never enters while the writer's lock file exists. That covers a running build and a build still waiting for earlier readers, so new readers queue behind a waiting build and builds cannot be starved.
  - A stale writer lock is broken the same way a writer breaks one.
  - Entering takes two steps: create the entry, then look for a lock file again. The writer does the mirror image: create the lock, then list the entries. Because of that ordering, at least one side always sees the other. A reader that sees a lock file after creating its entry withdraws the entry and waits.
  - Core heartbeats the entry, by default every 30 s and set by `heartbeatMs`, which must be shorter than the stale bound. It calls `onLost` once if the entry is removed or replaced, and skips one beat on a Windows EPERM/EACCES/EBUSY.
  - It returns `{ waitedMs, heldBy, path, token, assertHeld, release, releaseSync }`.
- `lock/acquire-step-lock.mjs` (writer):
  - Existing behaviour is unchanged.
  - Once it has created the lock file, it waits until no live reader entry remains. It removes stale ones: dead pid, or older than the stale bound (30 min by default).
  - While it waits it keeps its own lock file fresh, so no second writer can judge it stale during a long run of readers. If its file is found broken or replaced, it queues again.
  - It returns a new `heldAs: "write" | "read" | null` next to `waitedMs` and `heldBy`.
  - There are no fixed waits and no retry caps. Every wait polls the lock state at the existing `pollMs`.
- `lock/index.mjs` and `index.mjs` export `acquireStepReadLock`, and their header comments were updated.
- `run-step.mjs`: when a build waited on a reader, the reason now says `waited Ns for pid P's read lock on this step, then …`. The existing `run of this step` wording is unchanged for waits on another build.
- `tests/step-read-lock.test.mjs` (new, 13 tests): two readers at once; a writer waits for both, then runs; a reader waits for a writer; a new reader queues behind a waiting writer; a waiting writer keeps its lock fresh against a second writer; a dead reader is removed; a 31-minute-old reader with a live pid is removed; heartbeat keeps a live reader from a writer with a 100 ms stale bound; a reader breaks a dead writer lock; a replaced entry is reported lost and is left alone by both releases; synchronous release; a heartbeat at or past the stale bound is refused; a real `runStep` build waits for a read lock and then decides again.
- `docs/operations/quality-and-security.md`: added to the step-lock sentence in the build-cache section.

### Downstream

- `scripts/lab/core/build-lease/lease.mjs`:
  - It now takes Core's `acquireStepReadLock`, resolved from the exact checkout's `scripts/build-cache/index.mjs` as before, for each library in `CORE_PACKAGES`.
  - Heartbeating now belongs to Core. The lease forwards `heartbeatMs` and turns Core's `onLost` into its own heartbeat-failed error.
  - Exit cleanup calls each hold's `releaseSync()` (synchronous and token-owned).
  - A Core without `acquireStepReadLock` is refused as unsupported, like the existing check for a missing API.
  - Its public API, `acquireCoreBuildLease`, is unchanged.
- `scripts/lab/core/build-lease/index.mjs`: header comment only.
- `scripts/lab/core/build-lease/tests/fixture.mjs`: added `readerPaths(step)`.
- `scripts/lab/core/build-lease/tests/lease.test.mjs`:
  - Assertions that read the exclusive lock file now read reader entries.
  - New test: two leases on one Core held at once (both entries on all four libraries), with a real forced build that waits until both have released.
  - The other eight tests keep their intent: a build waits for the lease; a prior build blocks the lease; a store restore cannot replace output under a lease; distinct roots are independent; dead owners are recovered; exit cleanup; heartbeat loss; an unsupported cache is refused.
- `docs/architecture/testing-facility.md`, "Core library builds during a Lab run": rewritten for shared read holds. It now names all four libraries; it said three before, but the code already took `ui-components:build`.
- `scripts/lab/run-lab.mjs`: not changed. The call and its options were already correct for the new behaviour.

## Commands run and observed results

- Core: `node --test scripts/build-cache/tests/step-read-lock.test.mjs scripts/build-cache/tests/step-lock.test.mjs` → `# tests 19 / # pass 19 / # fail 0`.
- Core: `node --test "scripts/build-cache/tests/*.test.mjs"` → `# tests 87 / # pass 87 / # fail 0` (run twice, the second after the audit fixes).
- Core: `node --test "scripts/build-cache/tests/step-read-lock.test.mjs"`, three repeats → `# pass 13 / # fail 0` each time.
- Core: `node --test "scripts/web-build/**/tests/*.test.mjs"` (the other `acquireStepLock` caller) → `# tests 39 / # pass 39 / # fail 0`.
- Core: `node scripts/structure-audit.mjs`:
  - First run: 2 `swallowed-failure` violations in my new code (`acquire-step-lock.mjs` lines 92 and 101, `lock-file.mjs` line 116).
  - I fixed them with `best-effort:` reasons in the handlers.
  - Re-run: `structure-audit: passed (571 warning(s), 903 baselined).` The only new advisory warning near my work is `scripts/build-cache/tests/: 17 source files is past the 15-file advisory threshold` (limit 25).
- Downstream: `node --test scripts/lab/core/build-lease/tests/lease.test.mjs` → `# tests 9 / # pass 9 / # fail 0` (run four times, all passed).
- Downstream: `node scripts/structure-audit.mjs` → `structure-audit: passed (259 warning(s), 551 baselined).` Nothing flagged in `build-lease`.
- Downstream: `node scripts/check/core-mirror.mjs` → `core-mirror: 1 mirror set(s) match FluxIQ Core at C:\Users\osrs_\FluxStuff\fxwork\t1017\!FluxIQ: structure-audit (82 files).`

## Not verified

- No live Lab run and no paid run (outside the brief). Concurrent lanes on one real Core are proven only by the fixture tests.
- Core `pnpm check` and full suites were not run (narrow-check policy). Core `scripts/task` tests and the downstream worktree and heavy-gate tests were not run. They call `runStep` or `acquireStepLock`, whose behaviour without readers is unchanged and is covered by the existing build-cache and web-build tests above.
- Biome ignores `scripts/**` in Core, so lint was not applicable.

## Open questions or contradictions found

- **Merge order:** downstream now refuses a Core that lacks `acquireStepReadLock`. Merge Core's side first, or both in the same unit, and sync the shared Core (`fxwork/!FluxIQ`) before running Lab from downstream `dev`. Otherwise every Lab run refuses at setup with "missing owning resolver or shared read lock API".
- A process that holds a read lock on a step and then builds the same step waits on itself. This is the same as the old exclusive lease, and the comment in `acquire-step-lock.mjs` documents it.
- Core's working tree checks out CRLF (autocrlf). My new and edited Core files are LF in the working tree; git reports it will normalize them, and `git diff --stat` shows only the real changes.
