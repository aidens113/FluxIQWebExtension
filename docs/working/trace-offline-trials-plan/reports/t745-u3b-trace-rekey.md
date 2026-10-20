# Report: t745-u3b-trace-rekey

Worker: u3b (worker). Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t745/!FluxIQ`, branch `task/t745-keyed-content-addresses`. Nothing committed.
P = `packages/fluxiq/src/programs/automation-studio/storage/project/`, G = `P/gateway-trace/`, R = `P/gateway-trace-rekey/`.

## Outcome

Partial. The rekey pass is built, wired into a protected open, and covered by 9 new tests that pass: the end state, the probe, interruption and resume, a damaged chunk, rotation, isolation between projects, and idempotence. tsc and the structure audit pass. Both mutation checks failed tests and are reverted.

The definition-of-done vitest command does **not** fully pass: 3 existing G tests fail. Each of them asserts the behaviour from before u3b, that a protected open leaves old-form rows as they are. The brief says I must not touch those files, so the lead has to update them. The proposed edits are under "Open questions".

## What changed and why

New directory R, one exported value per file, with a barrel. G/store.ts imports R. R imports neither G/store.ts nor G/index.ts, and G/index.ts does not re-export R.

- `R/budget.ts`: the `GatewayTraceRekeyBudget` class, holding `batchSize` (default 50, max 500) and `maxBatches`, which is shared by every pass. Once the limit is reached the run is `stopped` and every later pass does nothing.
- `R/context.ts`: types only. `GatewayTraceRekeyContext` holds the database, the sealing (protection and keyring both present), the content port (`readBytesByObjectId`, `putBytes`, `removeIfUnreferenced`), the budget and `retiredKeys`. `GatewayTraceRekeySkip` names a skipped row by kind, place and reason only: never content, never an old plain digest.
- `R/old-forms.ts`: the SQL filters per phase. First come the `<col> is null` rows, which the 0034 partial indexes serve. Then, only when `content_address_keys` holds a key other than the current one, the `<col> is not null and <col> <> current` rows. The column names are the rekey's own constants.
- `R/event-bodies.ts`: reads old-form bodies.
  - A chunked body goes through G's `readGatewayTraceChunkedBodies` in the row's form. A batch's bodies are read together; if that fails, each row is read alone, so one damaged chunk holds back only its own event.
  - An inline body is used as it is.
  - A 0030 object body is read through the content store.
  - Every body must parse as JSON and name this row's trace and sequence. Skip reasons are fixed strings, because a JSON error can quote the body and a reader error can name an old digest.
- `R/events.ts`: pass 1.
  - Pages are keyset by `(trace_id, sequence)`.
  - Each body is re-cut with `prepareGatewayTraceEventBody({ inlineAllowed: false, keyring })`.
  - Each batch is one transaction. It runs a guarded update (the old `event_json`, `event_object_id`, digests, key id and byte length must all be unchanged, compared with `is`), then `writeGatewayTraceChunks` per trace for the rows that changed, then deletes the trace's `purpose='event'` reference to a converted object once no event row of the trace names it.
  - After commit it calls `removeIfUnreferenced`.
- `R/chunk-cleanup.ts`: pass 2, in one transaction. It reads every event still in an old chunked form inside that transaction. It deletes old-form chunk rows (no key, or a retired key) that none of those events names, together with their uses. For a chunk that is still named, it keeps only the uses of the traces whose old-form events name it.
- `R/artifacts.ts`: pass 3.
  - Pages are keyset by `(trace_id, artifact_id)`.
  - It reads the bytes through the content store, checks the byte length and the old digest in its own form (a form the keyring cannot verify counts as a mismatch, and the row is skipped), and computes the keyed digest under the current key.
  - If the object is unsealed, it calls `putBytes` with `protect: true`, owner `{ client_gateway_trace, traceId, "artifact" }` and media type `application/octet-stream`, the same media type `writeArtifact` uses, so a resumed put dedupes onto the same object.
  - A guarded update repoints the row and writes the digest. In the same transaction it drops the trace's artifact reference to the old object (or to the new copy, if the guard failed) once no artifact row of the trace names it. After commit it calls `removeIfUnreferenced`.
- `R/manifests.ts`: pass 4, over rows with `manifest_encryption is null`.
  - Each row is validated with G's `readGatewayTraceManifestRow`: it must parse and name this trace.
  - The row's own JSON text is sealed under `GATEWAY_TRACE_MANIFEST_MEDIA_TYPE` as `GATEWAY_TRACE_SEALED_MANIFEST_PREFIX` plus base64.
  - The sealed form is opened back through `readGatewayTraceManifestRow` before anything is written.
  - The update is guarded on `manifest_json` being unchanged.
  - I did not call `writeGatewayTraceManifestRow`: it is an unguarded upsert that also rewrites the indexed columns from the parsed manifest.
- `R/release-object.ts`: the after-commit `removeIfUnreferenced`. A failure is recorded in `skipped` (kind `object`, by error code only, never by path or id) and is not thrown. The content sweep frees the object later.
- `R/rekey.ts`: `rekeyGatewayTraceStore`, the options and result types, and the orchestration.
  - Order: events, then cleanup, artifacts and manifests (all three skipped once the budget has stopped), then **VACUUM**, then `checkpoint("truncate")`.
  - The last two run only when some pass changed rows. A VACUUM or checkpoint that fails is reported in the result, never thrown.
  - The result carries the per-pass counts, `skipped`, `batches`, `complete`, `vacuum` and `checkpoint`.
- `R/index.ts`: the barrel.
- `G/store.ts`:
  - The content store now opens before the rekey, because the rekey reads objects through it.
  - In a protected store the rekey runs after the keyring and before `protectGatewayTraceChunks`, which is still the last step and seals leftovers.
  - New option `open({ rekey?: GatewayTraceRekeyOptions })` and new public property `store.rekey`, which is `undefined` for a store without protection.
  - Header comment updated.
- Tests in `R/tests/`, each starting with `// @fluxiq-test-group real-sql`:
  - `migrated-project.ts` (support). Trace `trace-legacy` is written in 0030's layout: an inline event, a 300 KB event in an unsealed object, and a plaintext manifest. Trace `trace-plain` is written by a store without protection: an inline event, a large chunked event, two unsealed artifacts and a manifest. Every body carries a marker. The project records every read before migration, plus the old chunk digests.
  - `keyed-end-state.ts` (support): the end-state checks, a file scan, and a snapshot of the form rows.
  - `migration.test.ts`: 3 tests (full migration plus the probe while open and after close; second open is a no-op; a store without protection leaves the rows alone).
  - `interruption.test.ts`: 4 tests (`maxBatches`; a protection whose seal fails part way; a crash between an artifact's sealed put and its row update; a damaged chunk, opened twice to show it does not loop).
  - `rotation.test.ts`: 2 tests (rotation then reopen; two projects with identical content under the same host key).

### Why VACUUM (a decision for the lead)

The probe failed with only `secure_delete = ON` and a truncate checkpoint. One old chunk's raw SHA-256 was left in `project.sqlite` both while open and after close: page 338, a table-leaf page (type 13), at in-page offset 456. That offset lies in the page's unallocated gap: 3 cells, pointer array ending near byte 14, cell content starting at 684. `secure_delete` zeroes cells when they are deleted, but a page rebuilt by B-tree balancing keeps stale cell bytes in its free gap. The same can happen to a store without protection before any rekey runs.

Only rebuilding pages removes those bytes, so the rekey runs `VACUUM` before the truncate checkpoint. After that, the probe found nothing while open and nothing after close.

The cost: VACUUM rewrites the whole `project.sqlite`, every other store's tables included, and needs about the file's size again in temporary space. It runs once per protected open that converted something. It never runs on an open with nothing to convert: the idempotence test asserts `vacuum: { status: "not-needed" }`. If the lead prefers not to VACUUM, the probe as specified cannot pass.

## Commands run and observed results

All runs are from `packages/fluxiq` unless noted.

- `pnpm exec vitest run src/programs/automation-studio/storage/project/gateway-trace-rekey`: `Test Files 3 passed (3)`, `Tests 8 passed (8)`. This was before the crash test was added; with it the rekey files run 9 tests, all passing inside the full run below.
- Full definition-of-done set: `pnpm exec vitest run src/programs/automation-studio/storage/project/gateway-trace-rekey src/programs/automation-studio/storage/project/gateway-trace src/programs/automation-studio/runtime/gateway-trace src/client-gateway/trace`
  - Result: `Test Files 2 failed | 35 passed (37)`, `Tests 3 failed | 219 passed (222)`.
  - Failure 1: `store-keyed-forms.test.ts` > "writes rows unchanged without protection, and a protected store reads them as they are". `expected false to be true` at line 61.
  - Failure 2: `store-keyed-forms.test.ts` > "refuses to rewrite an artifact id with other bytes in both forms, and a keyed row without the keyring". The rows `toEqual` at line 86.
  - Failure 3: `store-protection.test.ts` > "reads chunks written unsealed, marked as such, and seals them when a protected store opens". `expected [ …(64) ] to deeply equal [ …(71) ]` at line 191.
- `pnpm exec tsc --noEmit -p .`: exit 0. Run twice, the last time after the final type edits.
- From the worktree root, `node scripts/structure-audit.mjs`: `structure-audit: passed (432 warning(s), 1152 baselined).`, exit 0.
  - The first run failed with 4 `[imports]` findings for type-only imports reaching into G files. I fixed them by deriving those types from the G functions R already imports, or by defining them structurally.
  - It also prints "1 baseline entries can be lowered". That entry is not mine and I did not touch the baseline.
- Mutation 1 (skip the cleanup: `budget.stopped || true`): 6 of 9 rekey tests failed, for example `expected +0 to be 99` (chunksDeleted) and `expected 109 to be +0` (old-form chunk rows left). Reverted; `grep -c "|| true"` gives 0.
- Mutation 2 (cleanup ignores the chunks old-form events still name): the damaged-chunk test failed with `expected [] to deeply equal [ …(106) ]`. Reverted; grep gives 0.
- Debug probe (a temporary test, now deleted): before VACUUM it showed `old chunk 97 (raw) project.sqlite offset 1380808 page 338 type 13 inpage 456 cellContentStart 684 ncells 3`; after VACUUM, no hits.

## Not verified

- No test covers the VACUUM or checkpoint `failed` and `busy` paths. In every test the checkpoint reported `done` with busy 0.
- Rows under a retired key that no longer opens (`keyring.unavailableKeyIds`) are not tested. By the code path, their chunk reads throw, so the rows are skipped and counted.
- No test covers a concurrent writer racing a guarded update (the "another writer changed it" paths in all three passes).
- Performance on a large project is not measured: the VACUUM time, and the full-table scans the retired-key phases make after a rotation, because no index exists on the non-null key-id columns.
- The downstream extension, and the Lab's trace inspection, were not run.

## Open questions or contradictions found

1. **The 3 G tests contradict the brief.** They encode "a protected open leaves old rows alone", the state before u3b. Line 60 of store-keyed-forms.test.ts says outright: "No rekey here: the rows keep their old form". The brief forbids me to edit them and also asks that they keep passing. Proposed edits for the lead:
   - `G/tests/store-keyed-forms.test.ts` test 1, lines 60-62: assert instead that the protected reopen converted the rows. That means `store.rekey.events.converted === 3`, every `trace-old` row and every chunk row under `keyring.currentKeyId`, and the reads at lines 56-59 still exact (they already pass). Move the `keyring` lookup above it.
   - `G/tests/store-keyed-forms.test.ts` test 2: after the protected reopen, `artifact-old` is keyed. At line 86 expect `{ artifactId: "artifact-old", sha256: keyring.addressWith(current, "gateway-trace-artifact", first).toString("hex"), keyId: current }`. Line 97 (`bare.writeArtifact("trace-art", "artifact-old", first)`) now rejects with the same "cannot be compared without the project's content address keyring" error as `artifact-keyed`. The old-form comparison by a bare store is already exercised at lines 72-74.
   - `G/tests/store-protection.test.ts`, "reads chunks written unsealed..." lines 189-193: the old chunks are no longer sealed in place but re-cut under the address key. Keep `unsealedCount === 0` and the exact sealed read. Replace the equal-digest and equal-encoding checks with: no digest from `before` remains, and every chunk row has a non-null `address_key_id`. Check line 196's `/is protected/`: by the run above it still passes, since the test failed at line 191 first and line 196 never ran. So this is unconfirmed.
2. **VACUUM** (see "Why VACUUM" above) is a cost decision for the lead.
3. Keyset paging per phase (unkeyed, then retired) means the retired-key phase has no index. After a rotation, every later protected open scans the events, chunks and artifacts tables once each. A follow-up migration adding partial indexes `where <key col> is not null` would fix this; that would be in G, which I may not touch.
4. A crash between a batch's commit and `removeIfUnreferenced` leaves an unreferenced legacy or unsealed object, file included. The rekey never revisits it, so it holds plaintext on disk until `sweepUnreferencedObjects` runs. The probe tests do not hit this window.
