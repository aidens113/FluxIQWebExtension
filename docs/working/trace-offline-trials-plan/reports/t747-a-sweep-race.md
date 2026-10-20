# t747-a sweep race: worker report

## Outcome

Done. All three windows are closed. Each one has a deterministic race test on real SQLite with real files. Every one of those tests failed before the fix and passes after it. Pending removals are now keyed by file path (migration `0036`). `deleteObject` is gone. No gateway-trace-rekey file needed a change.

Paths below are relative to `packages/fluxiq/src/programs/automation-studio/storage/project/` (S) in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t747/!FluxIQ`.

## The protocol, and why each window is closed

**Writer (`putBytes`)** works in three steps:

1. It puts the bytes in place before it commits. On the plain path it writes the staged file when no row exists yet. On the sealed address path it reads and verifies the candidate's stored bytes, and keeps them.
2. W1: one transaction (`objects.holdObject`) inserts the object row or gets the existing one by sha256, and upserts the owner's reference.
3. W2: after commit, `ensureObjectFile` checks that the committed row's file exists with the right byte count. If it is missing, it rewrites the file from the bytes it holds, including the stored ciphertext on the address path. If the size is wrong, it throws a collision error that names the object id.

**Drain (`drainOne` -> `objects.removePendingFileIfUnheld`)** does everything in one `begin immediate` transaction:

1. It re-reads the pending row by path. If another drain already settled it, it stops (`gone`).
2. If any objects row names that path, it deletes the pending row and keeps the file (`reheld`).
3. Otherwise it removes the file while it still holds SQLite's write lock, then deletes the pending row and calls `requestContentAddressScrub`, both in the same transaction.
4. If the file removal fails, the pending row stays and the drain reports the error code.

**Sweep** lists unreferenced objects. It releases each one with `deleteObjectIfUnreferenced`, which runs the reference check, the row delete and the pending-row insert in one transaction. Then it drains. `deleted` lists the released objects the drain removed. An object stored again before the drain keeps its file. A file that fails to delete is retried by a later drain.

Why each window is closed:

- **Window 1 (sweep).** The sweep no longer deletes a file outside a transaction. A release transaction lands either wholly before the writer's W1 or wholly after it:
  - Before: the row is gone, W1 inserts it again, and W2 rewrites the file if the drain already took it.
  - After: the release sees the reference and does nothing.
- **Window 2 (drain).** The held check and the file removal sit inside one write-lock transaction. No writer in any process can commit a row that names the path between those two steps. SQLite's file lock gives this guarantee across processes; it is not an in-process lock.
  - A writer that renamed its file in before the drain's transaction, but commits after it, will find the file gone at W2 and rewrite it.
  - A writer whose W1 committed first makes the drain report `reheld` and keep the file.
- **Window 3 (writer).** The row step and the reference step are now one transaction (W1), so a release cannot land between them. A reference can therefore never name a released row: the schema's FK trigger used to refuse that with `SQLITE_CONSTRAINT`. If the file went before W1, W2 restores it. That includes the sealed object reused through its keyed address, which is restored from the stored bytes the writer read.

**Why I changed the suggested trash protocol.** The brief suggested renaming the file to a trash name, checking, then restoring. I replaced that with removal under the write lock, for three reasons:

1. The trash protocol briefly renames away the file of a live row whenever a writer re-stores the bytes in that gap, so a concurrent reader of a live object can get ENOENT. Removing under the lock never moves a held file.
2. The trash protocol needs a trash directory, a way to encode the original path in the trash name, restore-or-drop logic, and a trash sweep at open. Removal under the lock has no crash state of its own. If the process crashes after the file is removed but before commit, the transaction rolls back and the pending row stays. The next drain then finds no file and finishes, because a missing file counts as removed.
3. The cost is one unlink while the write lock is held.

Because no trash exists, there is no trash sweep at open.

Residual risk: a reader can see a row without its file in the short gap between W1 and W2. This happens only for a brand-new row whose freshly renamed file a drain removed. W2 rewrites the file straight away.

**Pending removals keyed by path (0036).** Added in the new file `S/content-address/pending-removal-path-migration.ts`, exported from the barrel, and added to the object repository's migration list after 0033. Every content store runs it.

- SQLite cannot change a primary key in place, so the migration builds `object_pending_removals_by_path (relative_path PK, object_id, released_at_ms)`, copies every row across, drops the old table and renames the new one to `object_pending_removals`.
- If a path appears twice, the later release wins.
- It also adds `objects_relative_path_idx` for the held check.

This is a deviation from "additive", which needs your decision: every row and column survives and the table name stays the same, but the old table is rebuilt. I kept the name so that the rekey test's `select object_id from object_pending_removals`, which I must not touch, still works.

Other changes in the object repository:

- `releaseObjectIfUnreferenced` goes through the new public static `releaseObjectFile(sql, {objectId, relativePath}, now)`. The later re-seal unit can use it to release an old path while the object row lives on.
- `listPendingRemovals` pages by `afterRelativePath`.
- `dropPendingRemovalIfHeld`, `finishPendingRemoval` and `deleteObject` are removed. Nothing else used them.

**Errors and seams.**

- The read errors `digest mismatch` and `byte count mismatch` now name the object id instead of the file path. Existing tests match only the substrings, and those still match.
- `ContentStore.open` takes an internal `seams` option (`beforeWriterCommit`, `beforeDrainRemove`) for the race tests. Production code passes none.

## Failing-first evidence

The seams were added to the old code first, without changing its behavior. Then the tests were run against the old code (`pnpm exec vitest run .../content-address/tests/removal-races.test.ts .../content-address/tests/durable-removal.test.ts`). Observed output:

```
× keeps its file when a sweep releases the object it holds before it records the reference
× keeps its row and file when the object it resolved is released before its reference
× restores a sealed object it reuses through its keyed address from the stored bytes it read, when that object is released first
× keeps its file when another process's drain found the pending file unheld just before the writer stored the same bytes
× are carried over from 0033 by the 0036 migration, which keys them by path
× remove an old path an object row no longer names, though the object lives on at a new path
Error: SQLITE_CONSTRAINT: object_references.object_id references missing objects.object_id   (windows 1, 3, 3-sealed)
AssertionError: expected false to be true                                                     (window 2: file gone, row present)
AssertionError: expected { removed: [], …(2) } to deeply equal { …(3) }                       (old path kept as "reheld")
Tests  6 failed | 3 passed (9)
```

After the fix, all 9 pass, and they passed three runs in a row.

The window 2 test uses two pools, meaning two SQLite connections, standing in for two processes. After the fix it asserts the drain reported `removed`, which proves the bad interleaving really happened, and that the writer rewrote the file.

## Files

- `S/content-store.ts`: writer commit and `ensureObjectFile`, the drain through `removePendingFileIfUnheld`, sweep as release then drain, seams, error messages, class comment.
- `S/object-repository.ts`: `holdObject`, `insertOrGetObject` and `upsertReference` helpers, `releaseObjectFile`, `removePendingFileIfUnheld`, path-keyed listing, 0036 added to the migration list, three methods removed.
- `S/content-address/pending-removal-path-migration.ts` (new), `S/content-address/index.ts` (barrel), `S/content-address/migration.ts` (comment only, so the checksum is unchanged).
- `S/content-address/tests/removal-races.test.ts` (new), `S/content-address/tests/durable-removal.test.ts` (two cases for 0036 and the path-keyed held check), `S/content-address/tests/object-address-fixture.ts` (`openStore` passes seams).
- Not touched: `S/tests/*`, because their existing cases still pass and the brief allows no new files there; `S/gateway-trace-rekey/**`, because nothing forced a change.

## Commands run and observed results

All run from `packages/fluxiq`.

- The brief's validation command, last run:
  ```
  pnpm exec vitest run src/programs/automation-studio/storage/project/tests/content-store.test.ts src/programs/automation-studio/storage/project/tests/object-repository.test.ts src/programs/automation-studio/storage/project/tests/retention-store.test.ts src/programs/automation-studio/storage/project/content-address src/programs/automation-studio/storage/project/gateway-trace-rekey
  ```
  Observed: `Test Files 12 passed (12)`, `Tests 55 passed (55)`. The baseline before my work was 11 files, 49 tests.
- Two earlier runs of the same command each had one rekey test hit the 15 s timeout: `rotation > keeps two projects apart`, and in another run `interruption > stopped by its batch limit`. The machine was heavily loaded at the time; total test time was about 210 s against 40 s at baseline.
  - I timed the slow test on its own, swapping between the original and new code: new code 1607, 1703 and 2383 ms; original code 2806, 3204 and 2931 ms.
  - Running the whole rekey folder, the original code also took 86 s against 89-92 s for the new code.
  - So the timeouts come from machine load, not from this change. The final run passed cleanly.
- `pnpm exec tsc --noEmit -p .` -> no output, `exit=0`.
- Extra checks of code that calls sweep:
  ```
  pnpm exec vitest run .../gateway-trace/tests/store-chunk-lifecycle.test.ts .../gateway-trace/tests/store-completeness.test.ts .../tests/object-stream-edge-cases.test.ts
  ```
  Observed: `Tests 15 passed (15)`.
- `node scripts/structure-audit.mjs` (from the Core root) -> `structure-audit: passed (431 warning(s), 1152 baselined)`.
  - It also said "1 baseline entries can be lowered". I did not run `structure:baseline`, because the baseline is shared.
  - `content-store.ts` is 472 lines. That is past the 400-line advisory threshold; it was already 409.

## Not verified

- Two real OS processes. The race test uses two connections in one process. Real processes rely on the same SQLite file lock, but that was not exercised.
- Whole-package suites and any test outside the files named above.
- Starving node's threadpool: if four or more connections in one process are all waiting on the write lock, the lock holder's unlink can wait for a thread. Every multi-statement SQLite transaction in node-sqlite3 shares this exposure; I did not test it.

## Open questions or contradictions found

1. 0036 rebuilds the table rather than only adding to it. The brief said "additive". Is the rebuild acceptable? The reasons are under "Pending removals keyed by path (0036)" above.
2. I replaced the suggested trash protocol with removal under the write lock, and there is no trash sweep at open. The reasons are under "Why I changed the suggested trash protocol" above.
3. A pending path pointing at a directory, as in the existing "blocked" test, is still reported as `failed` and kept. That behavior is unchanged.
4. A `releaseObjectFile` was added as public API for the planned re-seal unit, but nothing calls it yet apart from `releaseObjectIfUnreferenced`.
