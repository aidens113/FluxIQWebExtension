# t377 W1: Flow listing reads only its own rows

Worker W1 (`worker-high`), Core tree `fxwork/t377/!FluxIQ`, branch `task/t377-workspace-read-scaling`. Nothing committed.

## Outcome

Done. A cold `service.listFlows` on a copy of lane A's 193 MB workspace (`t342-a`) went from about 10.8 s (9.5-11.9 s across all nine projects) to 36-128 ms. Every project's listing is byte-identical before and after (same sha256). The two new tests fail on the old code and pass on the new.

## What changed and why

Cause (as the round 8 debug said): `ProgramJsonStore.listDirectoryDocuments` and `ProgramJsonStore.deletePath` called `SQLiteRepository.list()`. That runs `select ... from "automation.state"` with no `where`, `JSON.parse`s every row (120 rows, 192 MB, mostly 10-15 MB `runtime/sessions/trial.*`), then filters by prefix in JavaScript. `legacy/store.ts` runs four of these per cold `listFlows` (tasks, routines, configs, flows).

- `packages/fluxiq/src/programs/database-manager/storage/sqlite-repository.ts`: two new methods on `SQLiteRepository`.
  - `listByIdPrefix(prefix, { scope?, select? })` first reads ids only, with `where id >= ? and id < ?` on the primary key. `EXPLAIN QUERY PLAN` on the copied database shows `SEARCH ... USING COVERING INDEX sqlite_autoindex_automation.state_1 (id>? AND id<?)`, so no row data is read. It then filters the ids with `select`. Only the chosen rows are fetched, in `where id in (...)` batches of 200 (`SEARCH ... USING INDEX (id=?)`), and only those are parsed.
  - `listIdsByPrefix(prefix, scope?)` returns ids from the index alone.
  - The upper bound raises the prefix's last code point. Text compares as UTF-8 bytes (BINARY collation), which sorts the same way as code points. The bound skips surrogates and returns null for an empty prefix. A `startsWith` filter always runs after it, so an over-wide bound can never wrongly include or drop an id. There is no `LIKE`, so `%` and `_` in a prefix are literal.
- `packages/fluxiq/src/programs/_shared/storage.ts`:
  - `listDirectoryDocuments` uses `listByIdPrefix` with the same predicate as before. The predicate is unchanged, including its existing quirk that a document directly at `<dir>/<file>` also matches. The redundant `structuredClone` is gone, because each record is freshly parsed.
  - `deletePath` (directory case) deletes `[id, ...listIdsByPrefix(prefix)]` one by one, the same semantics as before (returns whether anything was deleted) without reading any row's data.
- `legacy/store.ts` and `runtime/service.ts` are unchanged; the call shape did not need to change. I checked the rest of the `listFlows` path: `catalogue.listCanonicalFlowArtifacts` and `readRecordingFlowProposals` go through index documents and `get` by id, so they are not whole-table reads.
- Tests:
  - `database-manager/storage/tests/sqlite-repository.test.ts` gains two tests.
    - Prefix listing: malformed-JSON rows sit at sibling ids (`projects/p/flows`, `projects/p/flows0`, `projects/p/flowsX/...`), at another project, at a run session, and inside the prefix but refused by `select`. `list()` throws on them; `listByIdPrefix` returns exactly the five wanted rows. The test also checks literal `%_` and non-ASCII prefixes, the empty result, and that `listIdsByPrefix` names a malformed in-prefix row without parsing it.
    - Batching: 450 rows, more than one batch.
  - `_shared/tests/storage.test.ts` gains a "directory reads in layout v2" block on an initialized layout. A malformed 1 MB `projects/one/runtime/sessions/trial.big` row stands in for an unrelated session, and a malformed row sits in another project. The listing returns only the direct-child `flow` documents (not nested, not `flows-old`). The directory delete removes the subtree and keeps `flows-old`, `manifest` and both malformed rows untouched.

## Commands run and observed results

All run in `fxwork/t377/!FluxIQ/packages/fluxiq` unless noted.

- Measurement (temporary vitest harness, since removed from the tree; a copy is kept at `<scratchpad>/t377-w1/t377-w1-measure.test.ts.txt`). It runs on a fresh copy of `fxwork/t342/.../t342-a/fluxiq-root/.fluxiq/{global.sqlite,config.json}` for each run. The lane's workspace was copied once, read-only, and the copies are deleted.
  - Before, project `0f1263b8...`:
    - four legacy folder listings: cold 11369 ms, warm 11549 ms, 8 SQL queries, 480 rows returned
    - `service.listFlows`: cold 10767 ms, warm 9389 ms, 30 queries, 489 rows, 1 Flow `flow.7999d370-...`
  - After, same project:
    - four legacy listings: cold 26 ms, warm 13 ms, 10 queries, 7 rows
    - `service.listFlows`: cold 64 ms, warm 42 ms, 32 queries, 16 rows, the same Flow
  - Every project, one service, old code then new (sha256 of `JSON.stringify(listing)`):

    | project | Flows | sha256 | old (ms) | new (ms) |
    | --- | --- | --- | --- | --- |
    | e25fc7e5 | 0 | 4f53cda18c2baa0c | 10346 | 48 |
    | 0f1263b8 | 1 | a22c58120bac3ace | 9551 | 51 |
    | f2762330 | 2 | 37da59d394308f40 | 10700 | 62 |
    | b35b7fd6 | 2 | 463feea0c7f9cb62 | 11022 | 71 |
    | 143e4f1e | 1 | 1ec86bacd24eec8e | 11862 | 128 |
    | 31aa0e0f | 1 | a81bc49a90f8555f | 11262 | 54 |
    | 715de4af | 1 | de3afd4fc67e4aa0 | 10183 | 36 |
    | 99c4b41d | 1 | a84393025c632a60 | 10282 | 39 |
    | 936f5b95 | 0 | 4f53cda18c2baa0c | 10080 | 36 |

- `npx vitest run src/programs/_shared/tests/storage.test.ts` with `storage.ts` temporarily restored from `HEAD`: both new tests fail with `SyntaxError: Expected property name or '}' in JSON at position 1` (2 failed, 8 passed). My version was restored afterwards.
- `npx vitest run src/programs/_shared/tests src/programs/database-manager/storage/tests`: 8 files passed (storage.test.ts 10 tests, sqlite-repository.test.ts 8 tests).
- Callers of the changed helpers (directory deletes, bootstrap adaptations, legacy reads, Flow persistence, recordings):
  - Command: `npx vitest run` on `api/handlers/tests/caches.test.ts`, `service/projects/tests/delete-project-idle-database.test.ts`, `service/tests/bootstrap-adaptations.test.ts`, `tests/service-flows/tests/{canonical-persistence,change-feed}.test.ts`, `tests/service-recordings/tests/{assets,proposal-approval,task-proposals}.test.ts`, `model/tests/flow-compatibility.test.ts`, `storage/project/tests/graph-store.test.ts`.
  - Result: 10 files passed, 61 tests passed, 1 skipped.
- `pnpm run check` (package typecheck, `tsc --noEmit`): exit 0, cache `build` in 43924 ms. This run included W2's in-progress files.
- `pnpm structure:check` (repo root): `structure-audit: passed (291 warning(s), 710 baselined)`. New advisory warning: `sqlite-repository.ts: 446 lines is past the 400-line advisory threshold` (the hard limit is 800).
- `node scripts/docs-reference.mjs --check` (repo root): fails, `framework-reference.md is stale`. My change should not cause this: the reference lists `SQLiteRepository` as a class row only and names no methods (`listPage` and `getExistingReadOnlyMany` appear 0 times). W2's uncommitted `executor/index.ts` adds a public export, `automationStudioAttemptInputs`, which is the likely cause. I did not regenerate the reference because the file is shared.

## Not verified

- No live Core server or Lab run against the copy. I measured `service.listFlows` in-process (vitest, source TypeScript), not the HTTP `list-flows` endpoint or the built `dist`.
- I did not isolate the framework-reference failure from W2's changes; that would mean touching W2's files.
- I ran no full suites, as the rules require.
- `deletePath` now deletes ids found before the deletes start, as before; a row added concurrently under the prefix is not deleted in either version.

## Open questions or contradictions found

- The brief names "`sqlite-repository.ts:41`". That is `database-manager/storage/sqlite-repository.ts` (the repository `ProgramJsonStore` uses), not `automation-studio/storage/sqlite-repository.ts`, whose `list()` (also line 41) reads its own per-kind tables (`automation.flows` and others) and is not on this path. I left the automation-studio file unchanged.
- Other whole-table `list()` readers remain outside this brief. `catalogue.listFlowPublicationRecords` calls `repositories.flowPublications.list()` over the `automation.flow_publications` table, and `listCanonicalFlowArtifacts` in the memory-only path also uses `list()`. Neither reads the `automation.state` table where the session rows grow.
- The framework reference needs `pnpm docs:reference` once W2's export is final (supervisor).
