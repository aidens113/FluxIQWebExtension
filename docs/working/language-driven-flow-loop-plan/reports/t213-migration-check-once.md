# t213: the project store checks its migrations once per connection

## Outcome

**Done.** A store opened on a connection that has already checked its migration set now costs one probe instead of the full check. The full check still runs on a connection's first open, after any schema change by anyone, and whenever the state row is not `ready`.

Round trips per test (load-independent, from the t206 async_hooks probe):
- reauthor service tests: 5,084 -> 4,371-4,375 (-14%).
- run-detail-preservation #1: 5,313/5,317 -> 4,646/4,650 (-12.5%).

Wall time could not be measured meaningfully. Three other lanes held build slots throughout, and the same build varied by 2-3x between runs. The figures are below.

The saving is smaller than the ~850 round trips t206 predicted, for two reasons. The pool still closes a connection on its last release (an idle pool was declined), so 61 of the ~170 store opens in preservation #1 are first opens on a new connection and must run the full check. Each memo hit also still costs a 2-hop probe.

## What changed and why

All changes are in Core, `packages/fluxiq/src/programs/automation-studio/storage/`.

**`schema-migrations.ts`**
- **The memo.** A module-level `WeakMap<AutomationStudioProjectDatabase, Map<fingerprint, schemaCookie>>`.
  - The fingerprint is the set's ordered `id:checksum` list. It is computed once per set array (a `WeakMap` on the array).
  - Keying by the connection object means a closed connection's memo goes with it, and a new connection always checks in full.
  - Nothing is held open; the pool is unchanged.
- **The fast path.** It is the first step of `migrateExclusive`, still inside the per-file migration queue. It runs one probe, `select status, (select schema_version from pragma_schema_version) from automation_schema_state`.
  - The memo is used only if the status is `ready` and SQLite's schema cookie equals the cookie read during the check.
  - Any DDL from any connection or process moves the cookie: another set's migration, another process migrating, or a restore. That forces the full check.
  - A lock taken or a failure recorded by anyone makes the status not `ready`. That also forces the full check, so a concurrent migration in another process is refused with "lock was lost" exactly as before. This is the cross-process correctness the brief asked for, and it removes the trade-off t206 raised.
  - The cost is 2 hops (prepare + get) in place of 7.
- **When the memo is recorded.** Only in the "nothing pending" path, after `markReady`. The cookie used is the one read in the same statement as the ledger, so any change after that read invalidates the memo.
  - A run that applies migrations itself records nothing. Its own DDL moved the cookie, so its next open checks in full once and then memoises.
  - A failure removes the entry.
- **Trimming the first-open cost (these two together removed the last ~130 hops):**
  - The cookie is read as a column of the ledger select, with no extra query.
  - The `automation_schema_state` seed insert now rides in the lifecycle `exec` script, with its time inlined as `Math.trunc(now())`. Lifecycle setup is now one hop where it was three.
  - A side effect: the no-pending path no longer refreshes `updated_at_ms` on memo hits. No test or reader depends on it.

**`tests/schema-migrations-ready-memo.test.ts` (new, 4 tests)**
- The same connection uses the memo: a data-only ledger edit goes unread. A new connection checks in full and re-applies.
- A second connection's DDL forces the full check.
- A lock held by another connection is still refused ("lock was lost"), and the memo works again once the lock is released.
- A different set on the same connection checks in full, and its DDL invalidates the first set's memo.

## Commands run and observed results

**Measurement.** Command: `heavy.sh "t213 measure …" bash <scratchpad>/t213/count.sh`. It runs `vitest run --config probe.fluxiq.config.mjs reauthor-service run-detail-preservation --maxWorkers=1 --minWorkers=1` with the t206 probe setup copied to `scratchpad/t213/`.

| Run | reauthor round trips (7 tests) | reauthor file time | preservation #1 round trips | preservation #1 wall | preservation file time |
| --- | --- | --- | --- | --- | --- |
| before1 | 5084 x4, 5497, 5085, 2883 | 115.4 s | 5313 | 14.6 s | 20.9 s |
| before2 | same | 95.3 s | 5317 | 26.8 s | 34.5 s |
| after3 (final code) | 4371, 4371, 4375, 4375, 4718, 4376, 2539 | 77.5 s | 4650 | 23.1 s | 29.5 s |
| after4 (final code) | same ±4 | 218.6 s (ELU 0.2, external load) | 4646 | 21.5 s | 30.6 s |

- The other preservation tests went 2225 -> 2010 and 775 -> 713 round trips.
- after1 and after2 were the intermediate version, before the two trims: reauthor 4503, preservation #1 4890.
- Wall times swing 2-3x run to run, with ELU between 0.2 and 0.58. The machine was shared with other lanes holding b1-b3 (r3e scenario-lab test, t191, t211, t214).
- Probe site breakdown, intermediate version: 61 full checks and 24 real migration transactions remain in preservation #1.

**Validation.**
- `heavy.sh "t213 tsc" npx tsc -p packages/fluxiq/tsconfig.json --noEmit` -> exit 0, no output.
- `node scripts/structure-audit.mjs` (Core) -> `structure-audit: passed (203 warning(s), 354 baselined).` It also printed "1 baseline entries can be lowered". That is not from this change.
- `npx vitest run schema-migrations --maxWorkers=2 --minWorkers=1` -> `Tests 8 passed (8)`. That is the existing 4 plus the new 4.
- `heavy.sh "t213 vitest" npx vitest run src/programs/automation-studio/storage src/programs/automation-studio/runtime/service schema-migrations runtime/conversations/tests/store --maxWorkers=2 --minWorkers=1`
  -> `Test Files 3 failed | 81 passed (84)`, `Tests 4 failed | 544 passed | 1 skipped (549)`.
  - All 4 failures are timeouts ("Test timed out in 15000ms" x3, "60000ms" x1), with three other heavy jobs running.
  - They were: the known million-event case (t206 §4.5); preservation #1 (15.3 s); and the reader's "still rebuilds…" (15.2 s) and "reads nothing…" (15.7 s).
- Rerun of those files alone: `heavy.sh "t213 rerun" npx vitest run run-detail-preservation flow-run-detail-reader --maxWorkers=2 --minWorkers=1` -> `Test Files 2 passed (2)`, `Tests 7 passed (7)`. Preservation #1 took 7.7 s; the reader cases took 6.2 s and 7.7 s.

## Not verified

- Two real OS processes. Cross-connection behaviour was tested with two pools in one process. The pools have separate sqlite connections and the cookie is read from the file header, so the result should carry over, but the in-process migration queue is shared between them.
- An idle-machine wall-time comparison.
- A full Core suite, and `pnpm check`.
- The downstream tree: only this report changed there, so its audit was not run.

## Open questions or contradictions found

- The remaining migration cost is about 61 first-open full checks per preservation run, set by the pool closing on last release. Removing it needs a longer-lived connection, which is the declined idle pool. The next win t206 named, statement caching (about 1,460 `Prepare` hops), is now larger than the migration check.

Ready to commit: Core `packages/fluxiq/src/programs/automation-studio/storage/schema-migrations.ts`, `packages/fluxiq/src/programs/automation-studio/storage/tests/schema-migrations-ready-memo.test.ts`; downstream `docs/working/language-driven-flow-loop-plan/reports/t213-migration-check-once.md`; validation: `npx tsc -p packages/fluxiq/tsconfig.json --noEmit` -> exit 0; `vitest run schema-migrations` -> 8 passed; storage+runtime/service vitest -> 544 passed, 4 timeouts under load, which pass on rerun alone (7/7) except the known million-event case; `node scripts/structure-audit.mjs` -> passed.
