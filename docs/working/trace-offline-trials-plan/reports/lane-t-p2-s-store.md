# Report: lane-t-p2-s-store (t736, persisted client gateway trace store)

## Outcome
Done. `AutomationStudioProjectGatewayTraceStore implements ClientGatewayTraceStore` exists over the per-project
SQLite pool, with its own migration, a barrel, and tests. Its two named checks pass, vitest and tsc. The structure
audit fails on one violation. That violation is in another worker's file (`runtime/gateway-trace/episodes.ts`), and
the audit reports none in this lane's files.

## What changed and why
All paths are under Core `packages/fluxiq/src/programs/automation-studio/storage/project/`. That directory is at its
25-file budget, so everything new went into the subdirectory `gateway-trace/`.
- `gateway-trace/migration.ts`: `AUTOMATION_STUDIO_CLIENT_GATEWAY_TRACE_MIGRATION`, id **`0030_client_gateway_traces`**.
  The brief said 0027, but 0027, 0028 and 0029 are already taken (`0027_gateway_command_receipts_v1`,
  `0028_original_project_authority_guard_v1`, `0029_candidate_verification_receipts_v1`). It has three tables:
  - `client_gateway_traces`: trace_id PK, episode_id, activity, origin_kind, started_at, closed_at,
    claimed_completeness, manifest_json. Indexed on (episode_id, started_at, trace_id).
  - `client_gateway_trace_events`: PK (trace_id, sequence), plus event_id, stream, kind, message_type, command_id,
    recording_id and causation_event_id. The event JSON goes in event_json or event_object_id, and a check
    constraint requires exactly one of the two. Indexed on (trace, command_id, seq), (trace, recording_id, seq) and
    (trace, causation_event_id, seq).
  - `client_gateway_trace_artifacts`: PK (trace_id, artifact_id), plus object_id, sha256 and byte_length.
- `gateway-trace/store.ts`: the store. It opens with `{ pool, projectId }` and runs the administration migrations
  plus its own (the same pattern as command-ledger). It keeps one lease and one `AutomationStudioProjectContentStore`.
  - **appendEvents**: each event is deep-copied with `cloneClientGatewayTraceJson`, so non-JSON input is refused just
    as the memory store refuses it. Order is checked against the stored maximum sequence. An event whose JSON is at
    least 256 KiB (`AUTOMATION_STUDIO_OBJECT_THRESHOLD_BYTES`) goes to the content store with the owner reference
    `{client_gateway_trace, traceId, purpose "event"}`. Inside one transaction the order is checked again and the
    rows are inserted, so the append is all or nothing.
  - **writeArtifact**: the bytes go through `putBytes` with the owner reference
    `{client_gateway_trace, traceId, purpose "artifact"}`. An artifact id written again with a different digest is
    refused ("already stored with different contents"). The same bytes again are a no-op. The insert uses
    `on conflict do nothing` and the row is read back, so two racing writes cannot both succeed.
  - **writeManifest**: an upsert.
  - **Reads**: readManifest, listManifests({episodeId?}), readEventRange, readEventsByCorrelation, readArtifact and
    listArtifacts. Correlation keys reach the SQL only through a closed column map. Each decoded event is
    cross-checked against its row's trace id and sequence, and events come back deep-frozen.
  - **Reading a trace never written** (no manifest, event or artifact row) throws "trace X is not in this store" from
    readEventRange, readEventsByCorrelation, readArtifact, listArtifacts and deleteTrace. `readManifest` returns
    `undefined` instead, because that is what the reference memory store and the contract (`| undefined`) do.
  - **listArtifacts / readArtifact** count an artifact as held only while its content object is there. The digest
    listed is computed from the bytes read back. A missing object row, or a missing file (ENOENT), means "not held".
    Every other failure throws, a digest mismatch included. This is the explicit missing-file exception the
    failure-as-empty rule allows.
  - **deleteTrace**: deletes the trace's event, artifact and manifest rows and its `object_references` rows in one
    transaction. The next content sweep frees the bytes.
  - Trace ids are checked against the content store's owner-id rule (`[A-Za-z0-9._:-]{1,200}`) on every write,
    before anything is stored.
- `gateway-trace/index.ts`: the barrel. One line added to `storage/project/index.ts`:
  `export * from "./gateway-trace/index.ts";`.
- Tests in `gateway-trace/tests/`:
  - `sqlite-trace-fixture.ts`: a temporary directory, the pool, the store, reopen, and direct SQL for damaging rows.
  - `store-behaviour.test.ts`: the memory store's behaviour suite, plus frozen-copy and part-way-failure cases. It
    runs with `describe.each` against both `ClientGatewayTraceMemoryStore` and the persisted store.
  - `store-persistence.test.ts`: reads after reopen; a large event lands in the content store, pinned, and reads back
    identical; listManifests by episode; deleteTrace removes rows and references but leaves a second trace that
    shares the same content objects; an invalid trace id is refused; NaN and Infinity range bounds; the migration id
    sorts after the administration list.
  - `store-completeness.test.ts`: T11 (an artifact stays readable after its source file is deleted and the source
    buffer is zeroed; it is pinned against `sweepUnreferencedObjects`; with its content file or object row removed it
    is reported `missing_artifact`). T14 (truncated rows give `truncated` 3-5, a deleted row gives `sequence_gap` 2-2,
    a removed artifact row gives `missing_artifact`, and a manifest flushed but never closed gives `truncated`). The
    undamaged baseline is `complete`.
  - The tests reuse `client-gateway/trace/tests/trace-builders.ts` (`newRecorder({ store })`) rather than copying it.

## Commands run and observed results
- From `packages/fluxiq`: `pnpm exec vitest run src/programs/automation-studio/storage/project/gateway-trace src/client-gateway/trace`
  -> `Test Files  9 passed (9)` / `Tests  71 passed (71)`. Of these, 32 are new: 16 behaviour (8 per store), 7
  persistence and 9 completeness.
- Mutation check, reverted afterwards: I disabled `requireTrace` and made a missing file read as bytes. Three tests
  failed (`3 failed | 29 passed (32)`): the never-written read, the T11 removed object, and the read after delete. I
  then restored the file.
- From `packages/fluxiq`: `pnpm exec tsc --noEmit` -> no output, exit 0.
- From the Core root: `node scripts/structure-audit.mjs` -> `structure-audit: 1 violation(s) across 1 rule(s).`, exit
  1. The only FAIL is
  `[failure-as-empty] packages/fluxiq/src/programs/automation-studio/runtime/gateway-trace/episodes.ts ... at line 135`.
  That file belongs to lane-t-p2-r-episodes. A grep of the audit output for `storage/project/gateway-trace` and
  `storage/project/index` found nothing.
- I reran the audit a few minutes later and got the same single FAIL, still only in `episodes.ts:135`, exit 1. This
  lane's files had no violations and no warnings.

## Not verified
- I did not run the full Core suite or the other storage/project tests. `administration.test.ts` pins its own
  extension list and does not include this migration; my persistence test asserts the same ordering instead.
- I did not measure the cost of listArtifacts on large traces. It reads and hashes every artifact's bytes so that the
  digest reflects what is actually held: O(total artifact bytes) per call.
- I did not exercise concurrency across processes. Concurrency within a process is guarded by re-checking inside the
  transaction and by the artifact read-back.

## Open questions or contradictions found
- The migration id is 0030, not 0027 (see above).
- D5-D7 are not in `lane-t-p2.md`, where the decisions start at D8. I used D5 (per-trace sequences) and D7
  (credential redaction belongs to the gateway) as the D8 and D15 text cite them.
- Leaks with bounded lifetime:
  - An append that writes a large event to the content store and then fails validation inside the transaction (a
    concurrent append raced it) leaves that object pinned to the trace until `deleteTrace`.
  - `appendEvents(trace, [])` stores nothing, so the trace still reads as never written. The memory store would
    register the trace. The recorder never appends an empty batch.
- No caller wires this store yet. Choosing it per episode from `projectId` belongs to lane-t-p2-r-episodes.
