# Report: t747-storage-followups

Lead: t747 (Core project storage follow-ups to t745's notes 3-5). Worktrees: Core
`C:/Users/osrs_/FluxStuff/fxwork/t747/!FluxIQ`, downstream `C:/Users/osrs_/FluxStuff/fxwork/t747/!FluxIQWebExtension`,
both on `task/t747-storage-followups`. Paths below are relative to Core
`packages/fluxiq/src/programs/automation-studio/storage/project/` unless they say otherwise.

## Audit (2026-10-20)

- `content-store.ts` `sweepUnreferencedObjects` lists unreferenced objects, removes each file, then calls
  `deleteObject` (which throws if a reference appeared). A writer that found the row, verified the file and added a
  reference in between keeps a row whose file is gone. Every other removal already uses t745's release
  (`releaseObjectIfUnreferenced` inside a transaction, then `drainPendingRemovals`): `removeIfUnreferenced`,
  `gateway-trace-rekey/{artifacts,events,release-object}.ts`.
- The drain itself has t745's residual race (note 3): check "held" -> writer stores the same bytes (file renamed into
  place, row inserted) -> drain removes the file. And the writer side is not atomic: `putBytes` reads the row, then
  upserts, then adds a reference in separate statements, so a release between them leaves a reference to a deleted
  row or a row without a file.
- Structure limits that shape every unit: `maxPathSegments` 9 (so `gateway-trace/<sub>/x.ts` is 10; test roots are
  exempt); `directoryFiles` 25 hard; the storage/project root already holds 25 files and `storage/project/tests/`
  25 files, so no unit adds a file to either; the prefix-group rule counts file stems only, so sibling directories
  (`gateway-trace-rekey/` precedent) are allowed.
- External importers of storage `gateway-trace/`: `storage/project/index.ts`, `retention-store.ts`,
  `gateway-trace-rekey/**`, `runtime/service/tests/object-documents-trace.test.ts` (fixture), and t746-owned
  `runtime/gateway-trace/wiring/project-store.ts` (imports `gateway-trace/index.ts` for the store class), so the
  `gateway-trace/index.ts` barrel and the store stay where they are.
- t743 changes nothing under `storage/project/**` (it does change `runtime/host-runtime.ts`); t746 changes nothing
  under `storage/**`.

## Plan

- (a) worker-high: sweep and drain race, writer atomicity, pending removals keyed by file path (0036) so (b) can
  release an object's old file while its row lives on under a new path. Files: `content-store.ts`,
  `object-repository.ts`, `content-address/migration.ts` or a new migration const, their tests.
- (c) worker-high, in parallel with (a) (disjoint files): split storage `gateway-trace/` into sibling directories
  by responsibility; callers switched; `storage/project` barrel exports unchanged.
- (b) worker-high after (a) and (c): the re-seal job (design note below, written before dispatch).
- Lead: framework reference regeneration, `persistence.md`, final validation.

## Progress log

### 2026-10-20 - audit and dispatch of (a) and (c)
- Audit above. Briefs: (a) `t747-a-sweep-race.md`, (c) `t747-c-trace-layout.md` (worker reports in this directory).

### 2026-10-20 - (c) gateway-trace layout (worker-high; report `t747-c-trace-layout.md`)
- Decision: three sibling directories by responsibility, each with a barrel: `gateway-trace-schema/` (the four trace
  migrations and the trace migration list, 5 files), `gateway-trace-chunk-codec/` (pure chunk encoding: bounds, media
  type, keyed digests, pack/unpack, seal/open, content-defined split, prepare-body, types; 11 files with
  `tests/split-content-defined.test.ts`), `gateway-trace-chunk-rows/` (chunk rows in SQL: write, read bodies, delete
  uses, sweep unused, protect in place; 6 files). `gateway-trace/` keeps the store, manifest row, measures and the
  fixtures (6 files, from 25). Moves by `git mv`; callers switched (`gateway-trace/{index,store,manifest-row}.ts`,
  five gateway-trace tests, rekey `{artifacts,event-bodies,events,rekey}.ts` and `tests/migrated-project.ts`,
  `retention-store.ts`, `index.ts`). `storage/project/index.ts` exports the same 323 names before and after (worker's
  diff), and `automation-studio/index.ts` the same 3422. t746's import of `gateway-trace/index.ts` for the store is
  unaffected.
- Lead verified the directory counts (`gateway-trace` 6, `-schema` 5, `-chunk-codec` 11, `-chunk-rows` 6) and the
  checks below.

### 2026-10-20 - (a) sweep and drain race (worker-high; report `t747-a-sweep-race.md`)
- Protocol (reviewed): the writer commits its object row (insert or get) and its reference in one transaction
  (`object-repository.ts` `holdObject`), then checks the file and rewrites it from the bytes it holds when missing
  (`content-store.ts` `ensureObjectFile`, dedupe-by-address path keeps the stored bytes it verified); the drain
  checks "no objects row names this path" and removes the file inside one `begin immediate` transaction
  (`removePendingFileIfUnheld`), so no writer commits a row naming that path in between; the sweep releases each
  object through `deleteObjectIfUnreferenced` and drains. The worker replaced my suggested trash-rename with this
  (no trash, nothing to sweep at open); I checked `database.ts` runs `begin immediate`, so the check and the removal
  hold the write lock.
- `0036_object_pending_removal_paths` (`content-address/pending-removal-path-migration.ts`) rebuilds
  `object_pending_removals` keyed by relative path (SQLite cannot change a primary key in place); every column and
  row carried over; index on `objects(relative_path)` for the held check. Decision (lead): accepted; it is a lossless
  rebuild, not additive in form, and keying by path is what (b) needs. `deleteObject`, `dropPendingRemovalIfHeld`
  and `finishPendingRemoval` removed (no other callers); public static `releaseObjectFile` added for (b). Errors now
  name object ids, not file paths.
- Failing first (worker, quoted in its report): the race and 0036 tests against the old code with the seams added ->
  `Tests 6 failed | 3 passed (9)`; after -> 9 passed, three runs in a row.
- Placement note: the race tests live in `content-address/tests/removal-races.test.ts` because `storage/project/tests/`
  is at 25 files; the migration subject is in `content-address/`. Audit passes.

### 2026-10-20 - lead checks after (a) and (c)
- From `packages/fluxiq`: `pnpm exec vitest run $A/storage/project $A/runtime/gateway-trace src/client-gateway/trace
  src/client-gateway/tests/trace-tap.test.ts $A/runtime/tests/reusable-llm-context-service.test.ts
  $A/api/handlers/tests/caches.test.ts $A/runtime/service/tests/object-documents-trace.test.ts
  $A/runtime/service/projects` -> `Test Files 100 passed | 2 skipped (102)`, `Tests 668 passed | 4 skipped (672)`
  (t745 baseline 662 passed).
- `pnpm exec tsc --noEmit -p .` -> exit 0. Core root `node scripts/structure-audit.mjs` -> `passed (431 warning(s),
  1152 baselined)` (433 before; "1 baseline entries can be lowered" predates t747).
UNIT READY: (c) Core S/{gateway-trace/**,gateway-trace-schema/**,gateway-trace-chunk-codec/**,gateway-trace-chunk-rows/**,gateway-trace-rekey/{artifacts,event-bodies,events,rekey}.ts,gateway-trace-rekey/tests/migrated-project.ts,retention-store.ts,index.ts}
UNIT READY: (a) Core S/{content-store.ts,object-repository.ts,content-address/{index,migration,pending-removal-path-migration}.ts,content-address/tests/{removal-races.test.ts,durable-removal.test.ts,object-address-fixture.ts}}

## Design note (b): re-seal for host key rotation and retirement (2026-10-20, before dispatch)

- Sealed items (inventory by `grep seal(|open(`): content-store objects (files; trace artifacts and reusable
  contexts are objects), trace chunk rows (`gateway-trace-chunk-codec/seal-chunk.ts`), trace manifests
  (`gateway-trace/manifest-row.ts`), and wrapped address keys (`content_address_keys`, current and retired).
- Selection by envelope, not by cursor: the protection interface gains an optional `sealedKeyId(encryption)`
  (the AES-GCM adapter reads its authenticated envelope). The job re-seals every item whose envelope names a key the
  host is retiring (`retiringKeyIds`). This makes it resumable without job state: a crash rolls back the open batch,
  and a rerun finds exactly the items still under a retiring key. A provider without `sealedKeyId` is refused with
  a clear error rather than re-sealing blindly. No migration is needed.
- Each batch is one transaction with compare-and-swap on the old sealed form, so a concurrent writer or rekey is never
  overwritten; a re-seal that comes back still under a retiring key (the host has not made the new key current) is
  refused before anything is written.
- Objects: open, seal under the current key, write the new file at its new sha256 path (staged), then in one
  transaction update the row in place (sha256, byte count, path, encryption; object id and content address unchanged)
  and release the old path with (a)'s `releaseObjectFile`; drain after. Readers that raced the path change re-read
  the row once. Everything that stores an object's sha256 instead of its id must be audited first.
- Completion: a final verification scan over every kind finds no readable item under a retiring key (it loops, so a
  write sealed under the old key just before the switch is caught). Items that no longer open are reported by id as
  `unreadable`, never re-sealed; they were already lost. Each batch requests t745's scrub, and the job runs it at the
  end, so old ciphertext under a possibly leaked key does not survive in free pages.
- Host contract (content-protection JSDoc and `persistence.md`): 1. make the new key current while still resolving
  the old id; 2. run the job for every project until it reports complete (safe to interrupt and rerun); 3. only then
  stop resolving the old id. Released before completion, content still under the old key is lost.

### 2026-10-20 - (b) re-seal job (worker-high; report `t747-b-reseal.md`)
- New `content-reseal/` (job `resealAutomationStudioProjectContent`, retiring-key standing from `sealedKeyId`, a
  shared row pass for chunks, manifests and address keys, the object pass, trace-table presence, tests and fixture).
  `content-protection.ts` gains optional `sealedKeyId` (AES-GCM reads its envelope) and JSDoc stating the host order;
  `content-store.ts` `resealObjects`, reader re-read on a missing file; `object-repository.ts`
  `moveObjectsToResealedFiles` (checks the new file and compare-and-swaps the row inside one `begin immediate`
  transaction, releases the old path, requests a scrub); `index.ts` exports; `persistence.md` "Host key retirement".
  No migration.
- sha256-consumer audit (worker): only trace artifacts and reusable contexts seal objects and both read by object id;
  one break found and fixed in this unit: a writer reusing a sealed object by address after the job moved it
  (`insertOrGetObject`, `commitWrite`; race test added).
- Deviation (accepted after review): new object files are recorded as pending removal before they are written, so a
  stopped job leaves nothing behind; safe because the row move checks the file inside the write-locked transaction
  and drains remove files only under that same lock. `complete` also requires old object files removed.
- Failing first (worker): against a stub job, 7 of 9 tests failed; with k1 removed and no re-seal, reads fail with
  "Content address key ... could not be opened".

### 2026-10-20 - lead final checks
- Framework reference: `pnpm docs:reference` -> "Wrote ... (4061 public declarations)"; name diff against HEAD has no
  removals, only additions (0036 migration const, the reseal job and its types, `GATEWAY_TRACE_SEALED_MANIFEST_PREFIX`)
  plus path moves from (c). `pnpm docs:check` -> "Deterministic framework reference is current".
- From `packages/fluxiq`: the brief's vitest set (storage/project, runtime/gateway-trace, client-gateway trace,
  trace-tap, reusable-llm-context-service, caches, object-documents-trace, runtime/service/projects) ->
  `Test Files 102 passed | 2 skipped (104)`, `Tests 678 passed | 4 skipped (682)`. `pnpm exec tsc --noEmit -p .` ->
  exit 0.
- Core `node scripts/structure-audit.mjs` -> `passed (434 warning(s), 1152 baselined)`; new advisories:
  `content-store.ts` 596 lines and 28 class methods, `object-repository.ts` 419 lines, `reseal-fixture.ts` 10
  exported values. Downstream `node scripts/structure-audit.mjs` -> `passed (218 warning(s), 618 baselined)`.
UNIT READY: (b) Core S/{content-reseal/**,content-protection.ts,content-store.ts,object-repository.ts,gateway-trace/index.ts,index.ts,tests/content-protection.test.ts}, docs/architecture/automation-studio/persistence.md, docs/reference/framework-reference.md, packages/fluxiq/docs/reference/framework-reference.md

## Not verified
- Real two-process races and real process kills (two SQLite connections in one process; stops simulated by seams).
- The reader's re-read of a moved object's row on a missing file has no deterministic test.
- Full suites (left to the twice-daily sweep); no live, paid or browser runs (none needed).

## Follow-ups
- `content-store.ts` is at 28 methods and 596 lines (advisory): the removal and re-seal methods are a natural
  collaborator to split out before the 40-method limit.
- `storage/project/` root and `storage/project/tests/` stay at 25 files; the next storage change needs a directory.
