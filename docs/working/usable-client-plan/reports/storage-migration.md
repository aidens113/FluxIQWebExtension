# storage-migration (t932) worker report

Worker: worker-heavy (Claude Opus 5.5), 2026-11-17. Trees: Core
`C:/Users/osrs_/FluxStuff/fxwork/t932/!FluxIQ`, extension
`C:/Users/osrs_/FluxStuff/fxwork/t932/!FluxIQWebExtension`, both on
`task/t932-storage-migration`. Nothing committed.

## Outcome

Done. A v1 root that has run before (`.fluxiq/artifacts/runtime` present)
migrates and then sets up. A migration stopped at any of its renames either
resumes to v2 or rolls back to the exact original files. A second migration
changes nothing. Every acceptance command passed (listed below). The original
reproduction showed the cause; fixing it exposed five more defects in the same
file, all fixed here.

Round 2 (lead's follow-up after acceptance) is also done:
- The Core docs section is rewritten.
- The stale-lock takeover race is fixed with an atomic takeover; it was
  reproduced on the old logic and tested across real processes.
- A second explicit `migrateStorage()` is unchanged, as instructed.

Round 3 (lead's last item) is done: each acquire now clears what a crashed
attempt left beside the lock, so leftovers never accumulate.

## Round 3

**Change**, in `migration-lock.ts` only. `acquireMigrationLock` first runs
`removeLeftovers(lockPath)`, then the takeover logic (now the internal
`claimFile`). The cleanup applies the lock's own owner check: the owner must be
on this machine and its pid must have exited.
- **Takeover markers** (`migration.lock(.takeover-<32 hex>)+`). A dead holder's
  marker is claimed through the same marker protocol and only then removed.
  Removing it after a plain read could delete a marker a live contender had
  just taken over, which would reopen the race. A live holder's marker is left
  alone.
- **Half-made claims** (temp files). Their names now carry the writer's machine
  and process: `<target>.<first 8 hex of sha256(hostname)>.<pid>.<uuid>.tmp`. A
  temp file is only ever used by the process that wrote it, so one whose writer
  on this machine has exited is removed outright. A live writer's file, or
  another machine's, is kept.

**Test.** Added "clears the marker and the half-made claim a crashed attempt
left, and only those" to `tests/migration-lock.test.ts`.
- Setup: a dead owner's marker, a dead writer's half-made claim, a dead
  writer's half-made claim for a nested marker, a live writer's half-made
  claim, another machine's half-made claim, and a live holder's marker.
- Result: the acquire succeeds, and exactly the last three remain.

**Round 3 commands:**
- The race probe against the updated module (no slot; plain node with two child
  processes per round) ->
  `{"module":"migration-lock.ts","rounds":10,"inProcessRoundsWithoutExactlyOneWinner":0,"crossProcessRoundsWithoutExactlyOneWinner":0}`.
- One slot, `heavy-slot.mjs run t932 -- bash round3-steps.sh`, on the round 3
  code. Each line is the script's own exit marker:
  - `=== EXIT 0: pnpm --filter fluxiq exec vitest run src/framework/tests/migration-lock.test.ts src/framework/tests/storage-migration-recovery.test.ts src/framework/tests/storage-migration.test.ts src/framework/tests/uncommitted-v2-adoption.test.ts --maxWorkers 1 --minWorkers 1`
  - `=== EXIT 0: pnpm --filter fluxiq check`
  - `=== EXIT 0: node scripts/structure-audit.mjs`, then `slot exit 0`.
- Caveat on that vitest step: my copy of the step script printed the tail of
  round 2's step log instead of its own (a `sed` replaced only the first of two
  file names on a line). So the per-test lines for round 3 were not captured;
  only the exit code was. Vitest exits non-zero on any failing or empty listed
  file, so exit 0 means all four files ran and passed, but I cannot quote the
  round 3 count. Round 2 ran the same four files: 22/22 passed, and round 3 adds
  one test. A rerun to capture the count was queued, then withdrawn: the
  machine was at 0.3 to 0.8 GB free with six jobs ahead, and the count adds
  nothing to the exit code.
- `node scripts/structure-audit.mjs` (Core, run directly to capture the
  summary) -> `structure-audit: passed (549 warning(s), 914 baselined)` and
  `1 baseline entries can be lowered`, unchanged from round 2.

## Round 2

**Takeover race, reproduced.** The old `acquireMigrationLock` had every
contender that judged a stale lock remove it and then create its own. A slower
contender therefore removed the faster one's fresh lock, and both proceeded. A
probe (old function copied verbatim; new module imported) ran 10 rounds against
a stale lock left by an exited process. Each round ran 8 takeovers in one
process, then 2 real processes released together. Winners stayed alive until
every contender had answered.

```
{"module":"old-lock.mjs","rounds":10,"inProcessRoundsWithoutExactlyOneWinner":4,"crossProcessRoundsWithoutExactlyOneWinner":6}
{"module":"migration-lock.ts","rounds":10,"inProcessRoundsWithoutExactlyOneWinner":0,"crossProcessRoundsWithoutExactlyOneWinner":0}
rerun of the old logic, counting winners in failing rounds: "in-process winners 2" x4, "in-process winners 3" x1, "cross-process winners 2" x1
```

**Fix.** The lock now lives in its own module,
`packages/fluxiq/src/framework/migration-lock.ts`, which exports
`acquireMigrationLock(lockPath): Promise<boolean>` and imports only Node
built-ins.
- **Whole claims.** A claim (`pid`, `host`, `startedAt`, a random `token`) is
  written to a temp file and hard-linked into place. The link is the exclusive
  create, so no reader ever sees a half-written lock.
- **Atomic takeover.** If the lock is held by an exited process on this
  machine, the contender takes a takeover marker
  `migration.lock.takeover-<sha256 of the stale claim>` with the same function.
  Under the marker it reads the lock again. Only if the lock still holds that
  exact claim does it remove it and create its own, and it then removes the
  marker.
- **Why only one wins.** Every contender that judged the same stale claim
  competes for one marker. A contender arriving after a takeover finds a
  different claim under the marker and backs off. Nobody else can remove the
  stale claim, because its owner is dead and every other remover must hold the
  same marker.
- **Crashed takeovers.** A marker left by a contender that crashed is itself
  taken over the same way (recursively). A marker held by a running process
  makes the contender back off.
- **Refusals.** A lock on another machine, or one that is unreadable or empty,
  is treated as held, as before.

`storage-migration.ts` drops its own lock code and its `open`/`os` imports.
There were no behaviour changes otherwise.

**Docs.** Core `docs/operations/data-and-state.md`, "Storage Migration", now
covers:
- that the extension's setup migrates automatically, while Core `setup()` does
  not;
- the lock, its re-check under the lock and the atomic takeover;
- the five stages: staging, collision check, archive, cutover, commit;
- that a migration never touches state outside the legacy roots: the root's
  `artifacts/` stays with `artifacts/runtime` beside the migrated
  `artifacts/automation-studio`, and `logs`, `cache`, `security` and `tmp`
  stay too;
- resume from the journalled stage, exact rollback before the commit marker,
  and the unchanged rejection of a second `migrateStorage()`.

**Tests** in `packages/fluxiq/src/framework/tests/migration-lock.test.ts`:
1. A free lock is taken; while its holder runs it is refused.
2. **Two real processes, 20 rounds.** Each round leaves a stale lock, starts
   two node processes running `migration-lock.ts`, releases them together, and
   keeps the winner alive until both have answered. Exactly one wins, the lock
   is no longer the stale claim, and nothing is left beside it.
3. Eight concurrent takeovers in one process: exactly one wins, nothing left
   beside the lock.
4. A marker left by a crashed takeover does not block: the lock is taken, the
   marker is gone.
5. A takeover marker held by a running process: back off, stale lock untouched.
6. A lock from another machine, and an empty lock, are refused.

**Round 2 commands** (one slot,
`heavy-slot.mjs run t932 -- bash round2-steps.sh`):
- `pnpm --filter fluxiq exec vitest run src/framework/tests/migration-lock.test.ts src/framework/tests/storage-migration-recovery.test.ts src/framework/tests/storage-migration.test.ts src/framework/tests/uncommitted-v2-adoption.test.ts --maxWorkers 1 --minWorkers 1`
  -> `Test Files 4 passed (4)`, `Tests 22 passed (22)`, `Duration 155.85s`. The
  two-process test took 6.25 s; the stop-at-every-rename matrix took 28.4 s.
- `pnpm --filter fluxiq check` -> `"step":"fluxiq:check" ... "ms":60907`,
  exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (549
  warning(s), 914 baselined)`, plus `structure-audit: 1 baseline entries can be
  lowered. Run "pnpm structure:baseline" to record the improvement.` This is
  most likely the `failure-as-empty` count for `storage-migration.ts`, which
  lost two `.catch(() => null)` calls with the old lock code.
  `.structure-baseline.json` is outside my paths, so I did not run it.
  `storage-migration.ts` is now 477 lines (advisory only).
- Not re-run in round 2: the Core library build, extension `pnpm build`, the
  domain setup tests and check, and the two `setup-fluxiq.mjs` runs. The
  extension uses Core's built `dist`, which still holds round 1's lock code
  until the next Core library build.

## Cause

A v1 Core instance always resolves `paths.artifacts` to `.fluxiq/artifacts`, and
`programs/_shared/runtime.ts` puts its `FileRuntimeStore` at
`artifacts/runtime`, so every v1 root that ever ran has that directory.
`artifacts` is not one of the legacy root names (`config data databases inputs
outputs streams domains recordings policies`), so it is never archived. Staging
builds `.migration/v2/staged/artifacts/automation-studio` whenever the root has
Automation Studio data. The cutover renamed each whole staged entry into the
root and threw when the destination existed, but only after the legacy roots
had already been moved to `legacy/`. Result: `migration_incomplete`, data in
`legacy/`.

Reproduced on the original code (a probe of `git show HEAD:` copies of
`storage-migration.ts` and `storage-layout.ts`, run with
`node --experimental-strip-types`, then deleted):

```
{"which":"original","outcome":"threw: Migration source and target both exist during cutover: ...\\.fluxiq\\artifacts","layout":"migration_incomplete","runtime":"{\"kept\":true}", ... ,"rollback":"{\"rolledBack\":true,\"restoredRoots\":[\"...\\\\.fluxiq\\\\data\"]} runtime-after-rollback=missing ENOENT layout=v1"}
{"which":"fixed","outcome":"migrated","layout":"v2","runtime":"{\"kept\":true}","artifacts":["automation-studio","runtime"],"rollback":"not attempted"}
```

That probe also showed a second defect the t911 takeover did not report: the
original `rollbackFluxIQStorageMigration()` ran `rm -r` over the whole
`.fluxiq/artifacts`, so "restoring" such a root deleted its runtime store
(`runtime-after-rollback=missing ENOENT`).

Found while testing, all in the same file:

3. Rollback could not restore roots archived by a migration stopped part way
   through archiving: `archiveRoot` was only written to the journal after every
   root had moved, and rollback used only the journalled value, so it skipped
   the restore and deleted `.migration`, stranding data in `legacy/`.
4. Domain databases in the active domain's scoped tree
   (`.fluxiq/<domain>/databases/domains/*.sqlite`, where a v1 host with a
   domain id writes them) were archived but never staged, so their records did
   not reach v2.
5. Merging a second source database that shares a table with one already
   staged threw `table already exists`: SQLite stores CREATE text without
   `IF NOT EXISTS` (checked: `create table if not exists "x"` is stored as
   `CREATE TABLE "x" (...)`). Any v1 root with both an unscoped and a scoped
   `global.sqlite` hit this.
6. Reading a WAL-mode legacy database read-only leaves an empty `-wal` and a
   `-shm` beside it, which a read-only connection cannot delete; archived and
   rolled-back roots gained stray sidecar files.
7. `migrateFluxIQStorage` inspected the root before taking the lock, so a
   caller that waited behind another process's finished migration ran a second
   migration over its result (overwriting `migration-history.json`, an empty
   archive). Reported by the takeover.

## Fix

Core, `packages/fluxiq/src/framework/storage-migration.ts`:

- Before archiving anything, the migration lists every place the cutover will
  fill (`promotionTargets`: a staged file's own place; for a staged directory,
  each child inside the root's directory of that name) and stops, having moved
  nothing, if any is taken outside a legacy root (`promotionCollisions`). It
  then journals `archiveRoot` and `promoted` before the first root moves.
- The cutover (`promoteStagedEntry`) moves a staged directory child by child
  into an existing directory of the same name, so `artifacts/runtime` stays and
  `artifacts/automation-studio` joins it; a resumed cutover moves only what is
  left.
- Rollback removes exactly the journalled `promoted` paths, and only at stage
  `archived` (the only stage where the cutover may have run). For journals
  written by the old code it removes `global.sqlite`, `domains` and
  `artifacts/automation-studio`, which is exactly what the old cutover could
  have put there. It restores from `journal.archiveRoot` or, failing that, the
  same journal-derived `legacy/v1-<startedAt>` the migration uses, then
  removes the emptied archive directories.
- The layout is checked again once the lock is held (`assertMigratable`).
- Domain databases are staged from every database root the migration reads,
  the active domain's scoped tree included.
- `mergeSQLiteDatabase` creates a table only when the staged database lacks it,
  and removes the empty sidecars its own read-only connection left when the
  source had none before.

Core, `storage-layout.ts`: `FluxIQMigrationJournal` gains optional `promoted`.

What I took from the t911 patch: the lock-held inspection, the collision check
before archiving, and the child-by-child cutover (rewritten). What I did not
take: its `setup()` change (not wanted), the lock-waiting and in-process
sharing (`ensureFluxIQStorageMigrated`, `FluxIQStorageMigrationLockedError`),
which only served implicit migration in `setup()`. Its tests were adapted into
direct `migrateFluxIQStorage` calls. Its patch did not fix defects 2 to 6.

Extension, `domain/src/setup.ts`: the instance that runs `migrateStorage()` is
now closed in a `finally`, so a failed migration does not leave its databases
open. `domain/src/tests/setup.test.ts`: a new test for a v1 root that has run
before (`artifacts/runtime` plus Automation Studio data).

Unchanged: Core `setup()` and `framework/index.ts`; a second explicit
`migrateStorage()` on a migrated root still rejects with "FluxIQ storage
already uses layout v2." and changes nothing on disk.

## Tests added

Core, `packages/fluxiq/src/framework/tests/storage-migration-recovery.test.ts`
(real-sql group). Its fixture is a v1 root that ran: program JSON, an Automation
Studio project, unscoped and scoped `global.sqlite` sharing a table, domain
databases in both trees, `artifacts/runtime/store.json`, and `logs/runtime.log`.

1. Migrates through `FluxIQ.migrateStorage()`, keeps the runtime store, then a
   new instance's `setup()` resolves (`created: []`) and lists the project.
2. A second `migrateFluxIQStorage` rejects with "already uses layout v2", and
   the file snapshot is unchanged.
3. Stop-at-every-rename matrix. `node:fs/promises` `rename` is wrapped
   (`vi.mock`) so the n-th rename throws. A dry run counts the renames, with an
   asserted minimum of 13: every journal stage write, each archived root, each
   promoted child, the commit marker and the history. For every n, one root
   resumes and must end fully migrated. A second root rolls back and must be
   `v1` with the same file hashes and no `legacy/`; past the commit marker,
   rollback must refuse instead. That root then migrates and must end fully
   migrated.
4. Resumes a migration stopped mid-staging, past a lock left by a process that
   has exited.
5. With unrelated `global.sqlite` already at the root, migration stops with
   "stopped before moving anything". Files are unchanged and there is no
   `legacy/`; rollback returns it to `v1` unchanged.

Extension, `domain/src/tests/setup.test.ts`: a new test, "setup upgrades a v1
root that has run before, keeping its runtime store".

## Commands run and observed results

All heavy steps ran through `heavy-slot.mjs run t932`.

- Probes of original vs fixed code (outputs under Cause): original throws at
  cutover, and its rollback deletes `artifacts/runtime`. Fixed migrates. In a
  second probe, the original code half-migrates a root, then the fixed code
  resumes it (`layout v2`, `artifacts: [automation-studio, runtime]`, runtime
  kept) or rolls it back (`layout v1`, `entries: [artifacts, data]`, runtime
  and data intact).
- `pnpm --filter fluxiq exec vitest run src/framework/tests/storage-migration-recovery.test.ts src/framework/tests/storage-migration.test.ts src/framework/tests/uncommitted-v2-adoption.test.ts --maxWorkers 1 --minWorkers 1`
  - First run: 14 passed, 2 failed. Both failures were stray `-wal`/`-shm`
    sidecars after a rollback (defect 6). That run also loaded the new scoped
    `global.sqlite` fixture after the table fix.
  - After the fix: `Test Files 3 passed (3)`, `Tests 16 passed (16)`,
    `Duration 152.41s`. The matrix test took 33 s.
- `pnpm --filter fluxiq check` -> `"step":"fluxiq:check" ... "ms":96187`, exit 0.
  An earlier queued attempt was stopped by the lead's gate change before it ran
  and is not counted.
- `node scripts/build-cache/cli.mjs contracts:build sdk:build fluxiq:build client-gateway-websocket:build ui-components:build`
  (Core) -> exit 0. `fluxiq:build` and `ui-components:build` rebuilt; the
  others were reused.
- `pnpm build` (extension) -> exit 0. Chrome, Firefox and e2e-chromium each
  report "verified 26 files"; test-runner built; Core build "current with its
  source".
- `node domain/scripts/test-domain.mjs tests/setup` -> `# tests 3`, `# pass 3`,
  `# fail 0`.
- `pnpm --filter @fluxiq-web-extension/domain check` -> `domain:check` built,
  exit 0.
- `node scripts/structure-audit.mjs`:
  - Core: `passed (549 warning(s), 914 baselined)`. The only new line is the
    advisory `storage-migration.ts: 504 lines is past the 400-line advisory
    threshold`; the file was already 407 lines.
  - Extension: `passed (252 warning(s), 551 baselined)`.
- User data: copied `C:/Users/osrs_/FluxStuff/!FluxIQWebExtension/.fluxiq` to
  `<scratchpad>/t932/user-copy/.fluxiq` and ran
  `FLUXIQ_WEB_AUTOMATION_ROOT=<copy> node domain/scripts/setup-fluxiq.mjs`.
  - Result: exit 0, with stderr "Upgraded your FluxIQ data to the current
    layout". `config.json` was written (`layoutVersion: 2`), the four
    `runtime-*.log` files and `runtime-refactor-sweep/` stayed in place, and
    `legacy/v1-<ts>` is empty (this root has no legacy roots), plus
    `global.sqlite` and `migration-history.json`. `recordingDomains`:
    web-automation, 17 events.
  - The original was untouched: its sha256 list is identical before and after
    ("original unchanged").
- Synthetic v1 root that ran (`data/programs/automation-studio/projects.json`,
  `data/programs/deployment-sync/state.json`, `artifacts/runtime/store.json`,
  `logs/runtime.log`), same command:
  - Result: exit 0 and `config.json` written. The root holds
    `artifacts/automation-studio` and `artifacts/runtime/store.json`
    (`{"kept":true}`), with `data/` under `legacy/v1-<ts>/`.
  - Second run: exit 0, no upgrade message, still one archive.

## Not verified

- A real process crash. The matrix throws at each rename, and the `finally`
  then removes the lock. Recovery from a lock left by a dead process is tested
  separately (test 4), but a kill between `writeFile` and `rename` inside
  `atomicWriteJson` (it would leave a stray `.tmp` file) was not exercised.
- Two whole migrations racing on one root. The lock takeover is raced across
  real processes (round 2), and the re-check under the lock was read, but no
  test starts two full migrations at once.
- Leftovers from a crash mid-takeover are cleared by the next acquire (round
  3). Ones whose owner's pid was reused by a live process stay until that
  process exits, the same conservative rule the lock uses.
- Full suites (`pnpm check`, `pnpm test`, Core's whole vitest run) were not
  run, per the twice-a-day rule.
- No browser or live run. No paid calls.

## Open questions or contradictions found

1. The takeover note said `rollbackStorageMigration()` "can restore" the
   half-migrated root. It restores `data`, but it deletes `artifacts/runtime`
   (shown above). That is fixed here.
2. The docs were updated in round 2 (granted by the lead).
3. A second explicit `migrateStorage()` still rejects with "already uses layout
   v2", as the lead confirmed.
4. `pnpm structure:baseline` in Core would record one lowered baseline entry
   (`.structure-baseline.json`, not mine to edit).
