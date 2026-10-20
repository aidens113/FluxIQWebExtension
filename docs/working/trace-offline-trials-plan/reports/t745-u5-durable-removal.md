# Report: t745-u5-durable-removal

Worker: u5 (worker). Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t745/!FluxIQ`, branch `task/t745-keyed-content-addresses`. Nothing committed.
P = `packages/fluxiq/src/programs/automation-studio/storage/project/`; C = `P/content-address/`; R = `P/gateway-trace-rekey/`; D = `P/reusable-llm-context-digest/`; G = `P/gateway-trace/`.

## Outcome

Done. Both crash windows are closed:
- (a) A scrub request now commits with every conversion or deletion. It outlives a crash, a busy VACUUM and a failed VACUUM, and every protected open honours it.
- (b) A released object's row deletion and its pending-removal row commit together, inside the rekey batch. The file goes after commit, or at the next content store open.

The definition-of-done checks all pass: vitest, tsc, and the structure audit. Two mutations each made tests fail and were reverted.

## What changed and why

- **C/migration.ts (0033, edited in place):**
  - `content_address_scrub_requests` (singleton = 1 check, `requested_at_ms`).
  - `object_pending_removals` (`object_id` primary key, `relative_path`, `released_at_ms`).
  - `objects_content_address_key_idx` on `objects(content_address_key_id) where content_address_key_id is not null`.
  - The header comment explains both tables.
- **C/scrub-request.ts (new):** `requestContentAddressScrub(sql, now)` upserts the single row inside the caller's transaction. On conflict, the time becomes `max(now, old + 1)`, so it always grows. A scrub then deletes only the request it read (`where requested_at_ms = ?`), and a request made while a scrub is running survives it.
- **C/scrub-database.ts (new):** `scrubProjectDatabaseIfRequested(database)` returns `ContentAddressScrubStatus`, one of:
  - `not-requested`;
  - `done` with the checkpoint counts;
  - `busy` with a stage (`vacuum`, `checkpoint` or `clear`), and the counts when the stage is `checkpoint`;
  - `failed` with a stage and a reason.

  It runs VACUUM, then `checkpoint("truncate")`. It deletes the request only when both succeeded and busy is 0. It never throws on a VACUUM, checkpoint or clear failure. `SQLITE_BUSY` and `SQLITE_LOCKED` map to `busy`. The reason is SQLite's own message for an `SQLITE_*` error, otherwise only the error's class name, so no path or content is reported. It takes `Pick<AutomationStudioProjectDatabase, "get" | "run" | "checkpoint">`, so tests can inject failures.
- **C/index.ts:** exports both new modules.
- **P/object-repository.ts:**
  - New static `releaseObjectIfUnreferenced(sql, objectId, now)`, which works inside the caller's transaction. When no `object_references` row names the object, it deletes the row and upserts the pending-removal row.
  - `deleteObjectIfUnreferenced(objectId, now?)` now wraps that call in its own transaction.
  - New methods: `listPendingRemovals({ afterObjectId, limit })`; `dropPendingRemovalIfHeld(objectId)`, which drops the pending row when an objects row holds the id again, so the file belongs to a re-stored object and is kept; and `finishPendingRemoval(removal)`, guarded on `released_at_ms`.
  - The backfill retired-key filter is now `(content_address is null or content_address_key_id < ? or content_address_key_id > ?)`.
  - New exported type `AutomationStudioProjectObjectPendingRemoval`.
- **P/content-store.ts:**
  - `removeIfUnreferenced` = release (one transaction) + `drainPendingRemovals()`. It returns false when the object is referenced or absent. If this object's file could not be removed, it throws an error naming the error code; the row stays pending.
  - `drainPendingRemovals()` pages by object id. For each pending row it does one of three things:
    - re-held: drops the row and keeps the file;
    - otherwise it removes the file (`rm` with force, path checked against the root), then deletes the row;
    - if the file cannot be removed, it keeps the row and reports it in `failed` with the error code, never the message or path.
  - It returns `{ removed, reheld, failed }`. A database error throws.
  - Every `open` drains first. The result is exposed as `store.drainedAtOpen`.
- **R:**
  - `context.ts`: the content port is now `readBytesByObjectId | putBytes | drainPendingRemovals`.
  - `events.ts` and `artifacts.ts`: each releases the dropped object inside its batch transaction through the repository's static method. It is listed as released only when the row was actually deleted. Each requests a scrub in the same transaction: the event batch when any row converted; the artifact batch when any row changed or any object was released. After commit they call `drainReleasedGatewayTraceObjects`.
  - `chunk-cleanup.ts`: requests a scrub when it deleted chunks or uses.
  - `manifests.ts`: requests a scrub when it sealed a manifest.
  - `release-object.ts`: now exports `drainReleasedGatewayTraceObjects(context, released, what, skips)`. It drains once, returns how many of the batch's released objects were removed, and records a skip for each file that could not be removed (by kind and error code, never id or path).
  - `old-forms.ts`: the retired-key phase is now `(col < ? or col > ?)` with the current key id twice.
  - `rekey.ts`: the private vacuum and checkpoint code is gone. The run always ends with `scrubProjectDatabaseIfRequested`. The result drops `vacuum` and `checkpoint` and gains `scrub: ContentAddressScrubStatus`. The `GatewayTraceRekeyVacuum` and `GatewayTraceRekeyCheckpoint` types are removed; grep found no user outside R.
- **D/rekey.ts:** the batch requests a scrub when it wrote any row. The stale-row filter is now `(key is null or key < ? or key > ?)`.
- **P/reusable-llm-context-store.ts:** every protected open runs `scrubProjectDatabaseIfRequested` after the rekey. New public `scrub` (undefined without protection).
- **Indexes:**
  - G/keyed-address-migration.ts (0034): `client_gateway_trace_{chunks,events,artifacts}_key_idx`, each `where <key col> is not null`.
  - P/schema/reusable-llm-contexts.ts (0035): `reusable_llm_context_digest_key_idx`.
- **Tests** (new files start with `// @fluxiq-test-group real-sql`):
  - `C/tests/durable-removal.test.ts`, 3 tests:
    - A request survives a process stop before any scrub, plus an injected busy VACUUM (`busy`, stage `vacuum`) and a failed VACUUM (`failed`, reason `Error`; the injected path is not echoed). The next scrub reports `done`, clears the request, and `pragma freelist_count` is 0. A second request in the same millisecond still moves the time on.
    - A release committed without a drain is finished by the next content store open: `drainedAtOpen.removed` names it, the file is gone, the row is gone, and the referenced object is kept.
    - A re-stored object keeps its file (`reheld`). A pending path that is a non-empty directory stays in `failed`, its row is kept, and it is reported again by the next drain.
  - `R/tests/durable-removal.test.ts`, 2 tests:
    - The real rekey pieces run with a drain that throws after the event batch commits. Afterwards the pending row exists, the object row is gone, the file is still there, exactly 1 scrub request exists, and every event is converted. The next protected open finishes the conversion with `scrub: done`. Then no pending row, no request, no old object file and no needle remain (u3b's probe) after a pool restart, and the keyed end state holds.
    - A request left after the last batch, with free pages created, is honoured by the next protected open: batches 0, `scrub: done`, `freelist_count` 0. The open after that reports `not-requested`.
  - `R/tests/migration.test.ts`: expectations moved from `vacuum`/`checkpoint` to `scrub` (`done` with busy 0, then `not-requested`).
  - `P/tests/reusable-llm-context-store.test.ts`, new test: a migrated store with plain digests, where the plain digests are found in files before the reopen. The protected reopen rekeys 3, the scrub is `done`, and no plain SHA-256 (hex or raw) of any projection is in any file under the project directory, both while open and after `closeAll`. The next open is `not-requested`.

## Commands run and observed results

All from `packages/fluxiq` unless noted.

- Baseline, before any edit: `pnpm exec vitest run src/programs/automation-studio/storage/project` gave `Test Files 67 passed | 2 skipped (69)`, `Tests 476 passed | 4 skipped (480)`.
- `pnpm exec vitest run .../content-address .../tests/reusable-llm-context-store.test.ts .../tests/content-store.test.ts` gave `Test Files 6 passed (6)`, `Tests 47 passed (47)`.
- `pnpm exec vitest run src/programs/automation-studio/storage/project/gateway-trace-rekey` gave `Test Files 4 passed (4)`, `Tests 11 passed (11)`.
- Definition of done: `pnpm exec vitest run src/programs/automation-studio/storage/project` gave `Test Files 69 passed | 2 skipped (71)`, `Tests 482 passed | 4 skipped (486)`, Duration 109.94s.
- `pnpm exec tsc --noEmit -p .` printed `tsc exit 0`.
- From the worktree root, `node scripts/structure-audit.mjs` printed `structure-audit: passed (433 warning(s), 1152 baselined).` (exit 0).
  - New warning: `[file-lines] .../content-store.ts: 409 lines is past the 400-line advisory threshold` (advisory only).
  - It also printed "1 baseline entries can be lowered". That entry is not mine, and I left the baseline untouched.
- Mutation 1: the event batch's scrub request disabled (`changed.length > 0 && false`). Result: `R/tests/durable-removal.test.ts` > "finishes a pending removal..." failed with `expected +0 to be 1` (the scrub-request count after the crash). `Tests 1 failed | 10 passed (11)`. Reverted; grep for `&& false` gives 0.
- Mutation 2: the drain at content store open commented out. Both C pending-removal tests failed (`expected { removed: [], reheld: [], failed: [] } to deeply equal { …(3) }`, `expected [] to deeply equal [ Array(1) ]`). Reverted; grep for `//MUT` gives 0.
  - The R crash test still passed under this mutation, because the next open's artifact batch drains every pending row. The open-time drain is therefore proven by the C tests.

## Not verified

- The checkpoint `busy` path, with a real reader holding the WAL, is untested. Only VACUUM busy/failed is tested, and only by injection.
- A real `SQLITE_BUSY` from VACUUM under a concurrent connection is untested.
- VACUUM cost on a large project is not measured. It now runs on every protected open that finds a request, once per request.
- A concurrent put racing a drain (below) is not tested.
- Downstream (extension, Lab trace inspection) was not run. Tests outside `storage/project` were not run, beyond tsc over the package.

## Open questions or contradictions found

1. **The seal-in-place pass runs after the scrub.** `G/store.ts` runs `protectGatewayTraceChunks` (P3-E seal-in-place) after the rekey, and so after the scrub. Leftover unsealed chunks that this pass seals in place (for example the damaged-chunk case) can keep plaintext in a rebuilt page's free gap until some later scrub, and nothing requests one. Fix, in G, which I may not touch: have the protect pass call `requestContentAddressScrub(sql, now)` in its transaction, and/or move the scrub call after it.
2. **Draining does not request a scrub.** A pending row's `relative_path` for an unsealed object contains that object's plain SHA-256. Inside the rekey this is covered: the batch that released the object requested the scrub, and the scrub runs after the drains. But if a drain fails during a rekey open and a later, non-rekey open drains the row, no scrub follows. The same holds for `removeIfUnreferenced` callers outside the rekey (grep: none in production today). Requesting a scrub on each drain would make every protected open after any removal VACUUM, so I left it out.
3. **A pre-existing race is not removed.** A drain checks that the object is not held, then removes the file. A concurrent `putBytes` of the same unsealed bytes, landing between the two, would have its file removed under its new row. The old `removeIfUnreferenced` (row delete, then rm) had the same race. `dropPendingRemovalIfHeld` covers the common case of a re-store before the drain.
4. **`sweepUnreferencedObjects` is unchanged.** It still removes the file and then the row, and does not use pending removals. It was outside the brief.
5. **The scrub request is project-wide.** Whichever protected store (trace or reusable LLM context) opens first VACUUMs the whole `project.sqlite`.
