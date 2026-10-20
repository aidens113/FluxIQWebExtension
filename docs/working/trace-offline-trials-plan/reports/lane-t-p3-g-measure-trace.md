# lane-t-p3-g-measure-trace report

## Outcome

Done. Core's trace store now answers what it keeps for a trace by name, and the downstream read-back uses that answer. No raw SQL against Core's trace tables remains in `packages/test-runner/src`.

## What changed and why

Core (`C:/Users/osrs_/FluxStuff/fxwork/t742/!FluxIQ/packages/fluxiq/src/programs/automation-studio/storage/project/gateway-trace/`):

- `measure.ts` (new): the type `AutomationStudioGatewayTraceMeasure`. Its fields are traceId, events, logicalEventBytes, inlineEvents, inlineBytes, chunkedEvents, chunkedLogicalBytes, digestListBytes, objectEvents, objectBytes, chunks, chunkRawBytes, storedChunkBytes, sharedChunks, sharedStoredChunkBytes, artifacts and artifactBytes.
- `chunk-set-measure.ts` (new): the type `AutomationStudioGatewayTraceChunkSetMeasure`, with the fields traces, chunks and storedChunkBytes.
- `measure-rows.ts` (new): the aggregate-only SELECTs behind both measures. They return lengths and counts, never a body or digest.
- `store.ts`:
  - `measureTrace(traceId)` calls `requireTrace` first, so a trace the store never held throws "trace X is not in this store".
  - `logicalEventBytes` = inline + chunked byte_length + object bytes.
  - Artifacts are counted through `listArtifacts`, so "held" means the same thing it means everywhere else.
  - `measureTraceChunks(traceIds)` (addition, see Open questions) counts distinct chunks over a set of traces. Every trace it names must be held.
- `index.ts`: adds `export type *` for both measure types. They reach `fluxiq/automation-studio` through `storage/project/index.ts`.
- Tests:
  - `tests/store-measure.test.ts` (new, real-sql) covers the inline trace with artifacts, a repeated large view, the shared-chunk case across two traces (including the pair's distinct count and how the measure changes after one trace is deleted), an empty set, and the throw for a trace never held.
  - `tests/store-legacy-rows.test.ts` gains a check that a 0030 object event is measured.

Downstream (`packages/test-runner/src/trace-inspection/`):

- `stored-event-bytes.ts`: now `readTraceStoredBytes(store, traceId)` over `store.measureTrace`. All the SQL is deleted, and the `TraceStoredBytes` output fields are unchanged. The exclusive figures are computed as chunks − shared.
- `storage-dedupe.ts`: now `readTraceStorageDedupe(store, traces)` over `store.measureTraceChunks`. The SQL is deleted, and the `TraceStorageDedupe` fields are unchanged.
- `inspect-project-traces.ts`: no longer takes a second pool lease or an `AutomationStudioSqlExecutor`. It passes the store, and the logical-bytes map is removed.
- `tests/stored-event-bytes.test.ts`: unchanged, and it passes as it stands.

## Commands run and observed results

- `pnpm exec vitest run src/programs/automation-studio/storage/project/gateway-trace` (Core packages/fluxiq) -> "Test Files 8 passed (8) / Tests 53 passed (53)". The new file on its own: "store-measure.test.ts (5 tests)", all passing.
- `pnpm exec tsc --noEmit` (Core packages/fluxiq) -> exit 0.
- `node scripts/structure-audit.mjs` (Core) -> "structure-audit: passed (428 warning(s), 1152 baselined)". One new advisory warning: "gateway-trace/: 16 source files is past the 15-file advisory threshold."
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` -> exit 0. fluxiq rebuilt (133795 ms); contracts and websocket were reused from the cache.
- `node scripts/check/core-build.mjs` (downstream) -> "FluxIQ Core's build at ...\fxwork\t742\!FluxIQ is current with its source."
- `node scripts/domain-dist.mjs` and then `pnpm exec tsc -p tsconfig.json` (packages/test-runner) -> tsc exit 0.
- `node --test` over dist trace-inspection, trace-parity, saved-flow-replay and saved-flow-replay/provider tests -> "# tests 70 / # pass 70 / # fail 0". This includes the 3 stored-event-bytes tests: "ok 1 - small events are stored inline ...", "ok 2 - a repeated large view is chunked once ...", "ok 3 - chunks two traces share count once ...".
- `grep -rn "client_gateway_trace" packages/test-runner/src` -> no output (exit 1).
- `node scripts/structure-audit.mjs` (downstream) -> "structure-audit: passed (215 warning(s), 618 baselined)".

## Not verified

- I wrote the tests alongside the implementation rather than strictly first; I did not watch them fail before the code existed.
- I ran no full suites, as AGENTS.md says. No live Lab run either.
- For an encrypted legacy object event, `objectBytes` and `logicalEventBytes` use `objects.byte_count`, which is the size on disk. That can differ from the JSON length, and it is untested because no fixture exercises encryption.

## Open questions or contradictions found

- The brief named only `measureTrace(traceId)`, but the downstream `storage-dedupe.ts` also ran raw SQL to count the distinct chunks across several traces. That count cannot be derived from per-trace measures once three or more traces overlap partially. I therefore added `measureTraceChunks(traceIds)` to the store, inside the owned directory. The supervisor may prefer a different name or shape.
- The gateway-trace directory now has 16 source files, which is past the 15-file advisory threshold. This is a warning, not a failure. A later split could move the measure files into a `measure/` subdirectory.
