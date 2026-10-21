# t747-c trace layout: report

## Outcome

Done. `storage/project/gateway-trace/` went from 25 source files to 6. Its schema, chunk encoding and chunk rows now live in three new sibling directories, each with a barrel. This is a pure move done with `git mv`: no behaviour change, and the names exported from `storage/project/index.ts` and `automation-studio/index.ts` are identical before and after. Nothing was committed.

S = `packages/fluxiq/src/programs/automation-studio/storage/project/` (Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t747/!FluxIQ`).

## What changed and why

### Decision

The work splits by responsibility into three sibling directories, following the `S/gateway-trace-rekey/` precedent. Each new file sits at `S/<dir>/x.ts`, which is 9 path segments, inside the limit.

- `S/gateway-trace/` (6 files) holds the store facade, its manifest row and its measure surface: `store.ts`, `manifest-row.ts`, `measure.ts`, `chunk-set-measure.ts`, `measure-rows.ts` and `index.ts`.
- `S/gateway-trace-schema/` (5 files) holds the four schema migrations and a barrel. It is a leaf: it imports only `schema-migrations.ts` types.
- `S/gateway-trace-chunk-codec/` (11 files) holds the pure byte transforms with no SQL: content-defined splitting, chunk bounds, media type, keyed digests, pack/unpack, seal/open and prepare-body. It also holds `types.ts`, plus a barrel. Its only test, `split-content-defined.test.ts`, moved into its `tests/`.
- `S/gateway-trace-chunk-rows/` (6 files) holds SQL over the chunk tables: write chunks, read chunked bodies, protect (re-seal) chunks, delete a trace's chunk uses, and sweep unused chunks, plus a barrel.

The dependency direction is `gateway-trace` -> `{schema, chunk-rows, chunk-codec}` and `chunk-rows` -> `chunk-codec`. `gateway-trace-rekey` now reaches `chunk-codec` and `chunk-rows` through their barrels. Before, it made five deep imports into `gateway-trace/` that were tolerated only because that barrel leads back to rekey through `store.ts`. Rekey keeps one deep import, `../gateway-trace/manifest-row.ts` (a value import). That import is still exempt for the same reason, and the audit reports nothing for it.

### Where I departed from the brief's expected shape, and why

1. **`types.ts` moved to `chunk-codec`; it did not stay with the store.**
   - Every type in it describes chunks or bodies: `GatewayTraceChunk`, `StoredChunk`, `ChunkEncoding`, `ChunkSealing`, `EventBody` and `ChunkedBodyRef`. Every codec and rows module uses it.
   - If it had stayed in `gateway-trace/`, the codec and rows directories would import types from the store's directory. That is a backwards directory edge.
   - Doing it through the barrel would have needed `export type * from "./types.ts"` in `gateway-trace/index.ts`. `S/index.ts` does `export * from "./gateway-trace/index.ts"`, so six new names would have leaked into `S/index.ts`, breaking the "same names" constraint. Importing the file directly would have added six deep type imports, which are counted, with no cycle exemption for types.
   - `store.ts` and `manifest-row.ts` now `import type` from the codec barrel.
2. **The read path (`read-bodies.ts`, `open-chunk.ts`) moved out of `gateway-trace`.**
   - `read-bodies` is SQL over the chunk tables, the mirror of `write-chunks`, so it went to `chunk-rows`. `open-chunk` is the inverse of `seal-chunk`/`unpack`, so it went to `chunk-codec`.
   - Keeping them in `gateway-trace` would have split the chunk tables' read and write SQL across two directories. It would also have left rekey's `event-bodies.ts` deep-importing the store directory.
   - The coming re-seal job will want open, seal, read and protect together, and they are now in the two chunk directories.
3. **`measure-rows.ts` stays with the store.** It is the store's `measure()` implementation and reads trace rows as well as chunk rows.

### Alternatives rejected

- **One `gateway-trace-chunks/` directory.** It would have 16 files, past the 15-file warning, with no headroom for the re-seal job.
- **Moving the migrations into the existing `S/schema/`.** That directory is at 25 files (the hard limit) and holds table definitions for other features.
- **Kind grouping such as `migrations/` inside `gateway-trace/`.** The depth limit forbids it.
- **Keeping the old names re-exported from `gateway-trace/index.ts`.** This would have avoided touching callers. I rejected it because a barrel should export its own directory's surface, and the brief asked for callers to be switched.

### Move map (old -> new; prefix S/)

| old | new |
| --- | --- |
| gateway-trace/migration.ts | gateway-trace-schema/migration.ts |
| gateway-trace/chunk-migration.ts | gateway-trace-schema/chunk-migration.ts |
| gateway-trace/chunk-protection-migration.ts | gateway-trace-schema/chunk-protection-migration.ts |
| gateway-trace/keyed-address-migration.ts | gateway-trace-schema/keyed-address-migration.ts |
| gateway-trace/types.ts | gateway-trace-chunk-codec/types.ts |
| gateway-trace/chunk-bounds.ts | gateway-trace-chunk-codec/chunk-bounds.ts |
| gateway-trace/chunk-media-type.ts | gateway-trace-chunk-codec/chunk-media-type.ts |
| gateway-trace/split-content-defined.ts | gateway-trace-chunk-codec/split-content-defined.ts |
| gateway-trace/keyed-digests.ts | gateway-trace-chunk-codec/keyed-digests.ts |
| gateway-trace/pack-chunk.ts | gateway-trace-chunk-codec/pack-chunk.ts |
| gateway-trace/unpack-chunk.ts | gateway-trace-chunk-codec/unpack-chunk.ts |
| gateway-trace/seal-chunk.ts | gateway-trace-chunk-codec/seal-chunk.ts |
| gateway-trace/open-chunk.ts | gateway-trace-chunk-codec/open-chunk.ts |
| gateway-trace/prepare-body.ts | gateway-trace-chunk-codec/prepare-body.ts |
| gateway-trace/tests/split-content-defined.test.ts | gateway-trace-chunk-codec/tests/split-content-defined.test.ts |
| gateway-trace/write-chunks.ts | gateway-trace-chunk-rows/write-chunks.ts |
| gateway-trace/read-bodies.ts | gateway-trace-chunk-rows/read-bodies.ts |
| gateway-trace/protect-chunks.ts | gateway-trace-chunk-rows/protect-chunks.ts |
| gateway-trace/sweep-unused-chunks.ts | gateway-trace-chunk-rows/sweep-unused-chunks.ts |
| gateway-trace/delete-chunk-uses.ts | gateway-trace-chunk-rows/delete-chunk-uses.ts |
| (new) | gateway-trace-schema/index.ts, gateway-trace-chunk-codec/index.ts, gateway-trace-chunk-rows/index.ts |

`gateway-trace/tests/sqlite-trace-fixture.ts` and `keyed-trace-support.ts` stay where they were.

### Callers switched (imports only, plus comments)

- `gateway-trace/store.ts`: imports now come from the three new barrels. The file-path mentions in its header comment are qualified with the new directory. It is still 416 lines.
- `gateway-trace/manifest-row.ts`: imports its type from the codec barrel.
- `gateway-trace/index.ts`: now exports only `GATEWAY_TRACE_MANIFEST_MEDIA_TYPE`, the two measure types and `store.ts`.
- `gateway-trace-chunk-rows/{protect-chunks,read-bodies,write-chunks}.ts`: import from the codec barrel.
- `gateway-trace-rekey/{artifacts,event-bodies,events,rekey}.ts`: import from the codec and rows barrels. `gateway-trace-rekey/tests/migrated-project.ts` gets the migration from the schema barrel.
- `gateway-trace/tests/{store-keyed-chunks,store-keyed-forms,store-keyed-probe}.test.ts`: import from the codec barrel. `store-legacy-rows.test.ts` and `store-persistence.test.ts` get the migrations from the schema barrel.
- `retention-store.ts`: imports `sweepUnusedGatewayTraceChunks` from the rows barrel.
- `S/index.ts`: added `export * from "./gateway-trace-schema/index.ts";` and `export { sweepUnusedGatewayTraceChunks } from "./gateway-trace-chunk-rows/index.ts";`.
- Comments in `chunk-rows/write-chunks.ts`, `schema/chunk-migration.ts` and `schema/chunk-protection-migration.ts` that name files in other directories now include the directory.

I did not touch anything under `runtime/gateway-trace/**`, `client-gateway/**` or `runtime/environment/**`, nor the content-store, object-repository or content-address files. `runtime/gateway-trace/wiring/project-store.ts` still imports the store from `storage/project/gateway-trace/index.ts`, which still exports it.

### File counts (source files the directory-files rule counts)

| directory | before | after |
| --- | --- | --- |
| S/ (root) | 25 | 25 (no file added) |
| S/gateway-trace/ | 25 | 6 |
| S/gateway-trace/tests/ | 16 | 15 |
| S/gateway-trace-schema/ | - | 5 |
| S/gateway-trace-chunk-codec/ | - | 11 |
| S/gateway-trace-chunk-codec/tests/ | - | 1 |
| S/gateway-trace-chunk-rows/ | - | 6 |

### Barrel export diff (TypeScript checker, `getExportsOfModule`)

- `S/index.ts`: 323 names before and 323 after. The lists are identical; `diff` printed nothing for that section.
- `automation-studio/index.ts`: 3422 names before and 3422 after, identical.
- `S/gateway-trace/index.ts`: 9 names before, 4 after.
  - Removed: `AUTOMATION_STUDIO_CLIENT_GATEWAY_TRACE_{,CHUNK_,CHUNK_PROTECTION_,KEYED_ADDRESS_}MIGRATION` (now in the schema barrel) and `sweepUnusedGatewayTraceChunks` (now in the rows barrel). `S/index.ts` re-exports all five, so the layer surface is unchanged.
  - Kept: `AutomationStudioProjectGatewayTraceStore`, `GATEWAY_TRACE_MANIFEST_MEDIA_TYPE`, `AutomationStudioGatewayTraceMeasure` and `AutomationStudioGatewayTraceChunkSetMeasure`.
- New barrels:
  - schema (4 names): the four migrations.
  - codec (17 names): `GATEWAY_TRACE_CHUNK_BOUNDS`, `GATEWAY_TRACE_CHUNK_MEDIA_TYPE`, the six types, `gatewayTraceArtifactRowDigest`, `gatewayTraceChunkDigest`, `gatewayTraceKeyedGearTable`, `open`/`pack`/`seal`/`unpack` `GatewayTraceChunk`, `prepareGatewayTraceEventBody` and `splitGatewayTraceContentDefined`.
  - rows (5 names): `deleteGatewayTraceChunkUses`, `protectGatewayTraceChunks`, `readGatewayTraceChunkedBodies`, `sweepUnusedGatewayTraceChunks` and `writeGatewayTraceChunks`.

## Commands run and observed results

All commands ran in the Core worktree.

- `pnpm exec tsc --noEmit -p .` (from `packages/fluxiq`).
  - First run: exit 2 with `store-persistence.test.ts(11,3): error TS2305: Module '"../index.ts"' has no exported member 'AUTOMATION_STUDIO_CLIENT_GATEWAY_TRACE_CHUNK_MIGRATION'`, and the same for `..._TRACE_MIGRATION`. I had missed that caller (a multi-line import), so I switched it to the schema barrel.
  - Rerun: `tsc exit=0`, no output.
- `pnpm exec vitest run src/programs/automation-studio/storage/project/gateway-trace src/.../gateway-trace-rekey src/.../gateway-trace-chunk-codec src/.../gateway-trace-chunk-rows src/.../gateway-trace-schema src/programs/automation-studio/runtime/gateway-trace src/programs/automation-studio/runtime/service/tests/object-documents-trace.test.ts`.
  - Result: `Test Files 27 passed (27)`, `Tests 156 passed (156)`, exit 0.
  - The run included `gateway-trace-chunk-codec/tests/split-content-defined.test.ts (5 tests)`, all 13 `gateway-trace/tests` store tests and all 4 rekey test files.
  - The rows and schema directories have no tests; vitest accepted the filters.
- `node scripts/structure-audit.mjs` (Core root).
  - Before my change: `passed (433 warning(s), 1152 baselined)`, plus `1 baseline entries can be lowered`.
  - After: `passed (431 warning(s), 1152 baselined)`, plus the same `1 baseline entries can be lowered`.
  - Finding diff, before to after: the warnings for `gateway-trace/: 25 source files` and `gateway-trace/tests/: 16 source files` are gone. The `content-store.ts` line count moved from 409 to 420 lines; that is the other worker's file. No new finding, and no import or cycle finding.
  - The lowerable baseline entry was there before I started, so I did not run `pnpm structure:baseline`.
- Export-name diff: scratch script `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/t747c-exports.cjs`, with output in `t747c-exports-before.txt` and `t747c-exports-after.txt` in that folder. The only differences are the `gateway-trace/index.ts` lines listed above.

## Not verified

- I did not run the full Core suites or `pnpm check`. Per the brief, I did not regenerate `docs/reference` (it still names the old paths, and the lead regenerates it).
- I did not do a downstream web-extension build. The extension does not import these storage modules: none is a browser-bundle entry, and the browser-imports rule reported nothing.

## Open questions or contradictions found

- The brief expected `types.ts` and the read path to stay in `gateway-trace/`. I moved them, for the reasons under Decision; the main one is that keeping them would leak six type names into `S/index.ts` or add deep imports. If the lead prefers the brief's shape, `types.ts` can return to `gateway-trace/`, but only if `S/index.ts` stops doing `export *` of that barrel.
- Index state:
  - `git mv` staged the renames.
  - The three new `index.ts` barrels are marked intent-to-add (`git add -N`), so they appear in `git diff`.
  - Import edits are unstaged.
  - Nothing was committed.
- The worktree's files mix CRLF and LF endings, and `core.autocrlf=true`, so git normalises them. I kept CRLF on every file I edited, and `git diff --stat` shows only the import and comment lines.
