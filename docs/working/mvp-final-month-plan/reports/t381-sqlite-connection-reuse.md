# t381: storage keeps its connections

## Outcome

Partial. The code and its tests are done and pass in the narrow runs. The whole `packages/fluxiq` run did not happen, because the session was ended before it. Nothing is committed. Tree: `fxwork/t381/!FluxIQ`, branch `task/t381-sqlite-connection-reuse`.

## What changed and why

- **New `database-manager/storage/sqlite-connection-pool.ts` (`SQLiteConnectionPool.shared`).**
  - Each database file has one process-wide queue and at most one connection, whichever table or repository is calling. The queue replaces the old per-file lock map.
  - The connection opens lazily. It stays open while operations are queued on the file or a holder keeps it, and it closes as soon as neither is true.
  - The pragmas (`foreign_keys`, `journal_mode=WAL`, `synchronous=FULL`) run once per connection, as one script.
  - A connection whose rollback failed is closed after its operation, so it is never reused inside a stale transaction.
  - `stats()` exists for tests and diagnostics.
- **`sqlite-repository.ts`:**
  - Every call goes through the pool.
  - `create table` and `create index` run once per connection and table.
  - The new `hold(scope)` returns a release function.
  - `put` is now one atomic `insert ... on conflict ... returning created_at_ms` statement, where it used to be a select followed by an upsert. It is measured as a write.
- **`canonical-authority/whole-operation.ts`:** `run` holds the global file for the whole create or save, through a new private `runHeld`. The roughly 13 global transactions and the body's reads and writes through other repositories now share one connection.
- **Lifetime decision: the connection lives while its owner needs it, not for the whole process.** This departs from the brief, so please review it.
  - Tests and project removal delete or copy the files right after an operation. On Windows that fails while a connection is open. t380's template and recovery-trace copies also require no WAL to remain.
  - So nothing outlives its holder, and the last close still checkpoints the WAL into the database file.
  - A service-lifetime hold, closed on `close()`, can be added later with the same API.
- **`synchronous=FULL` is kept, and now set explicitly, with the reason in a comment.**
  - `global.sqlite` holds the canonical authority's write-ahead records for effects applied to other files.
  - With `NORMAL`, a power loss or OS crash could lose a committed record while its effect in another file survived.
- **Multi-statement writes:** in the traced Flow create, every multi-statement global write was already inside `transaction()`. The canonical phases must stay separate transactions, because project-database and file effects come between them.
- **Tests added:**
  - `storage/tests/sqlite-connection-pool.test.ts`, 8 tests: unheld calls close and leave no sidecars; a hold shares one connection across repositories, with table setup once; queued calls share one connection; an unused hold opens nothing; a failed transaction rolls back on a held connection; a connection is discarded after a failed rollback; `put` keeps the creation time; the cross-process test.
  - The cross-process test pairs this process, holding its connection, with a forked process on its own connection (`tests/sqlite-process-probe.mjs`). Each sees the other's committed writes, and our writer waits on the other process's write lock instead of failing.
  - In `whole-operation.test.ts`: one `global.sqlite` open per Flow create and per save, and nothing left open afterwards.

## Measurements

Each round is one project create, one Flow create and one Flow save, run 8 times. The before and after runs were back to back, on the same machine and the same probe.

| | global.sqlite opens | global statements | Median wall time |
| --- | --- | --- | --- |
| createProject, before / after | 6 / 1 | 80 / 76 | about 580 / 600 ms |
| createFlow, before / after | 25 / 1 | 164 / 139 | about 665 / 450 ms |
| saveFlow, before / after | 24 / 1 | 153 / 129 | about 660 / 380 ms |

- The machine was noisy, with single rounds up to 5.7 s in both runs.
- In an earlier quiet run of the new code, every create and save took 230 to 320 ms. The baseline in an earlier noisy run was 950 to 1,440 ms.
- `project.sqlite` is unchanged: 3 opens and about 234 to 275 statements. That is the project pool, which is outside this brief.

## Commands run and observed results

Commands ran in `packages/fluxiq` unless a repository-root run is noted.

- `npx tsc --noEmit -p .`: no output.
- `pnpm structure:check` (repository root):
  - First run: it failed on `failure-as-empty` in the pool's close path.
  - After the fix: `structure-audit: passed (295 warning(s), 708 baselined)`.
  - One warning is new: `sqlite-repository.ts` has 423 lines, past the advisory 400.
- `pnpm docs:check` (before the last one-line fix): `Deterministic framework reference is current.`
- Narrow set (database-manager, canonical-authority, service flows, projects and summaries, `programs/tests`, framework storage-migration and v2-adoption, `_shared/tests`, automation-studio storage tests, secret-keys):
  - 69 files and 380 tests. One failed: `performance-metrics` expected `rowsChanged > 0` from `put`.
  - I fixed that by recording the upsert as a write, and the test then passed.
- Final run after the last edit (database-manager, `performance-metrics`, canonical-authority, service flows): `15 passed (15)`, `111 passed (111)`.

## Not verified

- The whole `packages/fluxiq` run. The session ended first. It must run once before merge.
- The canonical-authority process tests fork `dist/` code, which I did not rebuild. Their child processes ran the old repository code against the new code in this process.
- Behaviour in the live product, the Lab or the web panel.

## Open questions

1. Should the runtime service hold `global.sqlite` for its whole lifetime, as the brief literally asks? I chose holds scoped to the operation, for the reasons above.
2. `reserve()` re-runs 7 `create ... if not exists` statements inside every operation. A memo per connection would need a hook in `SQLiteTransaction`.
3. The canonical whole operation creates its own project pool with `idleCloseMs` 0, so each create or save opens `project.sqlite` 3 times. That is outside this brief.
