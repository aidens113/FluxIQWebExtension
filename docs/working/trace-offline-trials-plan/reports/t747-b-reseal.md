# Report: t747-b-reseal (worker-high, Core project storage)

Worktree: Core `C:/Users/osrs_/FluxStuff/fxwork/t747/!FluxIQ`, branch `task/t747-storage-followups`. Below, S =
`packages/fluxiq/src/programs/automation-studio/storage/project/`. Nothing committed.

## Outcome

Done. `resealAutomationStudioProjectContent` (S/content-reseal/) re-seals every sealed item under a retiring host
key: content-store objects (in place), trace chunk rows, trace manifests, and content-address key rows (current and
retired). Tests (1)-(7) from the brief plus a writer-race test pass on real SQLite and real files. tsc is clean and the
structure audit passes.

## What changed and why

- `S/content-protection.ts`: added optional `sealedKeyId?(encryption)` to `AutomationStudioProjectContentProtection`,
  with JSDoc stating the host order (1. new key current while the old id still resolves; 2. run the job until
  `complete`, rerun after an interruption; 3. only then stop resolving the old id). The AES-GCM adapter implements it
  from its parsed envelope (`parseEnvelope(...).keyId`; it throws "metadata is invalid" on a foreign envelope).
- `S/content-reseal/` (new, 10 files with its barrel; tests in `tests/`):
  - `retiring-keys.ts` `ContentResealRetiringKeys.check` refuses a provider without `sealedKeyId`, an empty or
    malformed id list, and (by sealing a 1-byte probe) a host whose current key is retiring. All of this runs before
    the job opens any store, so nothing is written. Every later seal goes through `seal(..., what)`, which refuses a
    fresh seal that still names a retiring key. `standing()` classifies an envelope as retiring, other or unreadable.
  - `row-pass.ts` is the generic pass for kinds held in rows. It keysets over the sealed rows, opens each row under a
    retiring key, re-seals it, then writes the page in one transaction with compare-and-swap on the exact old sealed
    form, and requests a scrub in that transaction when anything changed. A row that does not open is recorded as
    unreadable (`kind:id`), never written, and skipped by later passes.
  - `chunk-pass.ts` (CAS on digest+stored+encryption; a keyed chunk is named by its digest, an unkeyed one as
    `row <rowid>`, never by its plain SHA-256), `manifest-pass.ts` (re-seals the exact JSON text in the
    `fluxiq-sealed:` form; CAS on trace_id+manifest_json+manifest_encryption), `address-key-pass.ts` (CAS on
    key_id+sealed+encryption; refuses a fresh seal that contains the raw key, as key creation does).
  - `object-pass.ts` pages objects by id. Each page is one batch, delegated to the content store.
  - `trace-tables.ts` checks for `client_gateway_trace_chunks.encryption` and
    `client_gateway_traces.manifest_encryption` with `pragma_table_info` before scanning. It runs on every pass, so
    tables a stale writer creates mid-run are seen.
  - `reseal.ts` is the job. Order: check, open the content store (its open drains, which removes orphans from a
    stopped run), then passes over objects, chunks, manifests and address keys. After the main pass it keeps passing
    until a whole pass reseals nothing and loses no CAS (always at least one verification pass, at most 10). It then
    runs a final drain and `scrubProjectDatabaseIfRequested`. Result: `retiringKeyIds`,
    `resealed {objects, chunks, manifests, addressKeys}`, `unreadable [{kind,id}]`, `passes`, `batches`,
    `filesNotRemoved`, `scrub`, `complete` (= settled and no released file left).
  - Test seams on the options (production passes none): `afterBatch`, `afterMainPass`, `beforeObjectCommit`.
- `S/content-store.ts`:
  - New `resealObjects(ids, resealer)` handles one batch. For each object it reads the verified file, opens it, seals
    it through the resealer and computes the new sha256 path (same extension). It then records the new paths as
    pending removals (one transaction), writes the staged files, runs seam `beforeResealCommit`, and calls
    `moveObjectsToResealedFiles`, then drains.
  - Unreadable classification: when reading or opening fails, it re-reads the row. If the row is unchanged the object
    is `unreadable`; if it moved on it is `changed`. Errors keep only the error code or class, never the message
    (which can name the file).
  - Readers: `readBytesByObjectId` and `readBytesBySha256` now go through `readCurrentObject`. On ENOENT it re-reads
    the row by object id once, and if the path changed it reads the new file. The raw ENOENT error is kept otherwise,
    because the trace store's `heldBytes` depends on `isMissingFile`.
  - Writer: `commitWrite` used to rewrite the file from the bytes in hand. When the held row's sha256 differs from the
    candidate's (moved by a re-seal) it no longer does that. It checks the moved row's file instead and throws an
    id-only error if that file is missing.
- `S/object-repository.ts`:
  - `releaseObjectFiles(files, now)` is the pre-registration transaction.
  - `moveObjectsToResealedFiles(moves, fileHeld, now)` runs one `begin immediate` transaction. Per move it checks that
    the new file is held at its size (under the write lock, so no drain can remove it before commit), then runs a CAS
    update of sha256, byte_count, relative_path, encryption and verified_at where object_id, sha256, relative_path and
    encryption still match the form read. On success it releases the old path with `releaseObjectFile`, and it
    requests a scrub if anything moved.
  - `insertOrGetObject` falls back to the sealed row under the input's object id when the select by sha256 finds
    nothing (that object was re-sealed in place). New type: `AutomationStudioProjectObjectResealMove`.
- `S/gateway-trace/index.ts`: also exports `GATEWAY_TRACE_SEALED_MANIFEST_PREFIX`. The audit's imports rule refused a
  direct `manifest-row.ts` import from the new directory.
- `S/index.ts`: `export * from "./content-reseal/index.ts"`. The barrel exports the job, its options, result and
  counts types, and `AutomationStudioProjectContentResealSeams/Item/Kind` (aliases of the internal names).
- `S/tests/content-protection.test.ts`: added a `sealedKeyId` case.
- `docs/architecture/automation-studio/persistence.md`: replaced "and can retire a key explicitly" (it implied that
  dropping a key was enough) with a pointer. Added a "Host key retirement (2026-10-20, t747)" passage after t745's
  "Keyed content addresses" covering the contract, what the job does and the result. Did not regenerate
  docs/reference.

## sha256-consumer audit

Command: `grep -rn "readBytesBySha256\|getBySha256\|object:\${" packages/fluxiq/src` (non-test), plus
`grep -rln "\.sha256"`. Re-sealing in place changes the sha256 only of sealed objects. Only two writers seal objects
(`grep -rn "\bprotect\b"`): gateway trace artifacts (`gateway-trace/store.ts`, `gateway-trace-rekey/artifacts.ts`)
and reusable LLM contexts (`reusable-llm-context-store.ts`).

- Gateway trace artifacts: rows keep `object_id` and read through `readBytesByObjectId` (`heldBytes`). The
  `client_gateway_trace_artifacts.sha256` column is the keyed artifact digest of the plaintext, not the object's
  sha256. Not affected.
- Reusable LLM contexts: `prompt_object_id` is read by object id. `prompt_reference_id` names a reference row keyed by
  object_id. Each record id is fresh per write, so a later dedupe write never upserts that reference's id. Not affected.
- Stores that keep an object's sha256 and read by it: adaptation-store `readArtifactJson` (sha by id, then by sha),
  `compiled-plan-store`, `event-chunk-store`, `graph-store`, and `runtime-stream-store`
  (`stateObjectId.replace(/^object:/, "")`). All write unsealed objects only, which the job never touches. Not
  affected. These sha-based reads are still fragile if any of them ever seals; I left them unchanged because they do
  not break today.
- `object-index-migration.ts` (unsealed legacy index), `storage/object-store.ts` and
  `runtime/service/{object-documents,recordings/*}.ts` (the separate legacy file object store) are outside the
  content store's sealed objects. Not affected.
- Inside the content store: the writer's dedupe path (`putBytes` -> `commitWrite` -> `holdObject` with the
  candidate's old sha256) would have broken. Fixed in this unit (the `insertOrGetObject` fallback and the
  `commitWrite` change), and covered by the race test.
- `defaultObjectReferenceId` embeds the sha256 at write time. After a re-seal, a dedupe write for the same
  (object, owner, purpose) upserts the reference's id to one built from the new sha256. No caller stores trace
  reference ids, and reusable contexts never repeat an owner, so nothing reads the old id.

## Deviations from design note (b)

- New object files are recorded as pending removal before they are written (an extra transaction per batch). Without
  this, a crash between writing the files and the move transaction leaves files nothing names. With it, the next
  drain removes them, and the in-transaction `fileHeld` check closes the race where a drain removes the new file
  before the move commits. Test: "drains the re-sealed files of a batch stopped before its rows moved to them".
- A stop is exercised with thrown seams (`afterBatch` after N batches, `beforeObjectCommit`) instead of a
  `maxBatches` budget: the brief asked for an injected failure.
- `complete` also requires `filesNotRemoved === 0`: an old object file left on disk still holds ciphertext under the
  retiring key. A busy or failed scrub does not block `complete`; it is reported, and the next protected open honours
  the still-recorded request.
- A batch counts only pages that held at least one retiring item; pages with none open no transaction.

## Commands run and observed results

All from `C:/Users/osrs_/FluxStuff/fxwork/t747/!FluxIQ/packages/fluxiq` unless noted.

- Failing first, against a stub job (checks only, no re-seal):
  `pnpm exec vitest run src/programs/automation-studio/storage/project/content-reseal`
  -> `Tests 7 failed | 2 passed (9)`. The two that passed are (4) "refuses to retire the host's current key"
  (implemented in the check) and (7) "refuses a provider" (same). Failures: (1) result counts mismatch; (3)
  `expected 1 to be greater than or equal to 2` (passes); (5) `expected [] to deeply equal [ { kind: 'chunk', ... } ]`;
  (6) `expected { status: 'not-requested' } to match object { status: 'done' }`; (2) both cases
  `promise resolved ... instead of rejecting`; race `expected 'k1' to be 'k2'`.
- Failing first with the key removed (throwaway test, deleted after the run): stub job, then `keys.delete("k1")`, then
  read. (1) -> `promise rejected "Error: Content address key cak.a6d9d4fd3f…" instead of resolving`; (3) with a late
  k1 write -> `promise rejected "Error: Content address key cak.30d6058fc9…"`. Result: `Tests 2 failed (2)`.
- Sanity of the new tests after implementing (throwaway changes, then restored):
  - With the `insertOrGetObject` fallback removed, the race test failed with
    `Automation Studio object object:af7b… was not persisted.`
  - A probe with no job run found `{ needles: 36, found: 36 }`. After the job, test (6) finds `[]`.
  - The file was restored (`grep -c` of the fallback line -> 1) and the throwaway test was deleted.
- `pnpm exec vitest run src/programs/automation-studio/storage/project/content-reseal` -> `Test Files 2 passed (2)`,
  `Tests 9 passed (9)`.
- `pnpm exec vitest run src/programs/automation-studio/storage/project` (final run, after the last edit) ->
  `Test Files 72 passed | 2 skipped (74)`, `Tests 498 passed | 4 skipped (502)`.
- `pnpm exec tsc --noEmit -p .` -> exit 0, no output.
- Core root `node scripts/structure-audit.mjs` -> `structure-audit: passed (434 warning(s), 1152 baselined).` and
  `1 baseline entries can be lowered` (this predates t747 per the lead). The first run failed with
  `[imports] ... content-reseal/manifest-pass.ts ... "../gateway-trace/manifest-row.ts"`; I fixed it through the
  gateway-trace barrel. New advisory warnings (431 -> 434):
  - `class-methods` content-store at 28 methods (warn at 25);
  - `exported-values` `content-reseal/tests/reseal-fixture.ts` at 10 (warn at 8);
  - `file-lines` `object-repository.ts` at 419 lines (warn at 400).
  content-store is at 596 lines (already past 400 before this unit).

## Not verified

- The reader re-read on a missing file (`readCurrentObject`) has no deterministic test: no seam sits between a
  reader's row read and its file read, and `S/tests/` is full. It is exercised only indirectly. The writer-side race
  is tested.
- A real process kill: stops are simulated with thrown seams, which roll back the open transaction the same way.
- The job running against a project while the trace store is open in another process. The writer race uses two
  pools (two connections). The scrub in that test is not asserted, because another connection may make the
  checkpoint busy.
- No wider suites (`runtime/gateway-trace`, `client-gateway/trace`, and so on) were run. The change only adds to the
  storage barrel and leaves existing signatures alone. docs/reference was not regenerated (the lead does it).

## Open questions or contradictions found

- The worker definition says to write this report file, and a harness note says not to write report `.md` files. I
  followed the brief and the worker protocol.
- Advisory: `AutomationStudioProjectContentStore` is at 28 methods and 596 lines. A follow-up could move the
  removal/drain group, or the reseal group, onto a collaborator before it nears 40 methods / 800 lines.
- The sha-based reads in adaptation, compiled-plan, event-chunk, graph and runtime-stream stores are safe only while
  those stores never seal. Switching them to object-id reads would remove the hazard (all under S, out of this
  unit's scope since nothing breaks today).
