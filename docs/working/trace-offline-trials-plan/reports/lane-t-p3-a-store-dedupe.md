# lane-t-p3-a-store-dedupe — report

Repository: FluxIQ Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t742/!FluxIQ` (branch `task/t742-trace-intake-parity`). Not committed.

## Outcome

Done. The persisted gateway trace store now writes any event whose JSON is 16 KiB or more as content-defined chunks. Each chunk is addressed by SHA-256, stored once per project, and deflated when that makes it smaller. Measured on a 220-event trace shaped like P2's, the store keeps **4.5% of the bytes the 0030 layout kept** (76,626,447 B down to 3,445,010 B, ratio 0.045).

## What changed and why

All changes are under `packages/fluxiq/src/programs/automation-studio/storage/project/gateway-trace/`. The new files sit in that directory and not in a subdirectory, because a subdirectory pushes paths to 10 segments and the audit's limit is 9.

- `chunk-migration.ts` (new): migration `0031_client_gateway_trace_event_chunks`. 0031 was the next free id; 0030 was the latest in Core. 0030's check constraint only allowed an inline or an object row, so 0031 rebuilds `client_gateway_trace_events`:
  - It adds `event_chunk_digests blob` (the ordered 32-byte digests, concatenated) and `event_byte_length`.
  - The new check allows exactly one of the three forms. A chunk list must also be a whole number of 32-byte digests.
  - Every existing row is copied as it was, then the three indexes are recreated.
  - It adds `client_gateway_trace_chunks (digest blob pk, encoding raw|deflate, byte_length, stored blob)`.
  - It adds `client_gateway_trace_chunk_uses (trace_id, digest)` (WITHOUT ROWID, plus an index on digest).
  - `migration.ts` (0030) is unchanged.
- Why a chunk table and not the content store: a 900 KB event is about 200 chunks of 4 KiB. In the content store each chunk would cost a file, an object row and a reference row, which is thousands per trace. Small blobs are SQLite's strong case. The uses table lets `deleteTrace` free exactly the chunks no other trace uses, inside the same transaction, with no sweep. This reasoning is also recorded in the migration's header comment.
- `chunk-bounds.ts`: the chunking settings.
  - Events under 16 KiB stay inline.
  - Chunks are 1 KiB minimum, aimed at 4 KiB, 64 KiB maximum.
  - The cut test uses a gear hash with FastCDC normalization: the top 14 bits must be clear before the 4 KiB aim and the top 10 after it. High bits are tested because a gear hash's low bits depend only on the last few bytes.
- `split-content-defined.ts`: the chunker. Its gear table is derived from SHA-256 of a fixed seed, so cut points never move between releases.
- `prepare-body.ts`: inline or chunked, with digests computed before the transaction opens.
- `pack-chunk.ts` / `unpack-chunk.ts`: deflate-raw when smaller. Unpacking checks the byte length and the SHA-256 against the digest, and throws on a mismatch.
- `write-chunks.ts`: runs inside the append transaction. It checks which chunks already exist, compresses and inserts only the missing ones, and records uses in multi-row inserts of at most 400 rows.
- `read-bodies.ts`: fetches and verifies each distinct chunk once per read call, then reassembles each body in order. A missing chunk throws `event <trace>#<seq> is not held: its chunk <hex> is missing`. A length mismatch or damaged digest list throws `not held whole` or `damaged chunk list`. A body is never returned shortened.
- `delete-chunk-uses.ts`: frees the chunks only this trace used, then removes the trace's uses.
- `types.ts`: the chunk and body types.
- `store.ts`:
  - Opens with migrations 0030 and 0031.
  - `appendEvents` prepares bodies, then writes chunks and rows in one transaction. The old content-object path for writing events is gone.
  - Reads select the new columns. `decodeAll` reassembles every chunked row of a read together, and still reads 0030 inline rows and 0030 object rows.
  - `deleteTrace` also deletes chunk uses.
  - The header comment is updated. The store is now 365 lines.
- `index.ts`: also exports `chunk-migration.ts`.
- Tests (all in `gateway-trace/tests/`):
  - `split-content-defined.test.ts` (new): concatenation, bounds, determinism, and that an insertion mid-way changes at most 3 chunks.
  - `store-chunks.test.ts` (new, real-sql):
    - Byte-exact round trip across a reopen, covering: every UTF-16 code unit including lone surrogates; emoji cut across chunk boundaries; `1.0`, `1E3`, `-0` and a 20-digit number spelled exactly; key order; `null`; inline, chunked and json payloads.
    - Dedupe across events and across traces.
    - Delete keeps shared chunks and empties the table when the last trace goes.
    - A removed chunk is reported by range and by correlation read.
    - A damaged chunk and a cut-short digest list are both refused.
  - `store-legacy-rows.test.ts` (new, real-sql):
    - Builds a database migrated only to 0030 and writes an inline row and an object row exactly as the 0030 store did.
    - Opening the store migrates it to 0031, and both rows read back byte-identical.
    - A chunked event appends after them, and delete removes the object references, the uses and the chunks.
  - `store-chunk-measure.test.ts` (new, real-sql) with `synthetic-views.ts` (support): the measurement.
  - `store-persistence.test.ts`: the "above 256 KiB goes to the content store" test now asserts the chunked layout (uses rows, no event object reference). The migration-order test now covers 0031.
  - `store-behaviour.test.ts` (the memory-store behaviour suite) is unchanged and passes against this store.

## Commands run and observed results

From `packages/fluxiq`:

- `pnpm exec vitest run src/programs/automation-studio/storage/project/gateway-trace src/client-gateway/trace` printed `Test Files  13 passed (13)` and `Tests  92 passed (92)`. This was the final run, after the files moved out of the subdirectory.
- `pnpm exec tsc --noEmit` exited 0 on the final run. An earlier run exited 2, with 2 errors in `src/client-gateway/service/trace-tap/tap.ts` and, before that, errors in `src/client-gateway/service/commands.ts`. Both are other workers' in-progress files; none of the errors were in gateway-trace. A rerun a few minutes later exited 0.
- `node scripts/structure-audit.mjs` (from the worktree root) exited 0 and printed `structure-audit: passed (427 warning(s), 1152 baselined).` It also said "1 baseline entries can be lowered"; I did not touch the baseline, and I don't know which entry it means. An earlier run failed with 10 path-depth findings for the `event-chunks/` subdirectory. Moving the files into `gateway-trace/` fixed them.
- Measurement: `FLUXIQ_TRACE_CHUNK_MEASURE=1 pnpm exec vitest run src/programs/automation-studio/storage/project/gateway-trace/tests/store-chunk-measure.test.ts`, run on its own. The 220 events are views of six screens of 50-900 KB each. Each event changes about 0.5% of a screen's counts and sometimes adds or removes an entry; each has its own command id, revision and time. It printed:
  `{"events":220,"beforeBytes":76626447,"afterBytes":3445010,"ratio":0.045,"perEventDeflateBytes":10759304,"distinctChunks":2770,"meanRawChunkBytes":5203,"storedChunkBytes":2950482,"digestListBytes":494528,"inlineBytes":0,"projectDirectoryBytes":6144080,"writeMsPerEvent":18.31,"readAllMsPerEvent":3.24,"readOneMsPerEvent":23.77}`
  - "before" is the 0030 layout, which kept each event's JSON verbatim. "after" is stored chunk bytes plus digest lists plus inline JSON.
  - Deflating each event on its own, with no dedupe, would keep 10.76 MB (ratio 0.14). Chunking and dedupe together are about 3x better than compression alone.
  - `projectDirectoryBytes` (6.1 MB) is the SQLite file plus its WAL on disk, before any checkpoint.
  - Timing per event: about 18 ms to write (record plus flush, which includes chunking, SHA-256, deflate of new chunks and SQL), about 3.2 ms to read when the whole trace is read at once, and 11-24 ms for a single-event read. The single-event figure varied between runs (11.49 then 23.77); each such read reassembles about 150 verified chunks and parses and deep-clones up to 900 KB.
- Chunk-size comparison on the same trace: an 8 KiB aim (2 KiB minimum, 15/11-bit masks) gave ratio 0.0614, writes of 16.65 ms and single reads of 4.41 ms. The 4 KiB aim gave 0.045, and I adopted it. Both figures are recorded in `chunk-bounds.ts`.
- The short always-on measurement (24 events) printed ratio 0.0839, and the test checks the ratio is under 0.25.

## Not verified

- Real P2 traces. The 0.045 ratio comes from a synthetic trace. Real views that change more widely between commands (ids or timestamps on every entry) would dedupe less.
- Running the 0031 migration on a real project database that already holds 0030 traces. It was only exercised on the test database built in `store-legacy-rows.test.ts`.
- Concurrent writers and deleters on one project. The existence check runs inside the transaction, but no concurrent test was run.
- No full package suites were run, per the project's twice-a-day rule.

## Open questions or contradictions found

- The brief offered "content store with owner reference, or a chunk table". I chose the table (reasons above). As a result, chunk bytes are not visible to the content sweep or to content protection. If chunks ever need encryption, that would have to be added to this table.
- Two traces share every chunk except the few around the event envelope's start (trace and event ids) and end (episode id). The tests allow up to 4 differing chunks.
- The changed chunk bounds affect only new writes. If the bounds change again, chunks already stored will stop being shared with new writes. They will still read back correctly.
