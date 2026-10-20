# lane-t-p3-e-chunk-protection: report

Repository: FluxIQ Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t742/!FluxIQ` (branch `task/t742-trace-intake-parity`). Nothing committed.

## Outcome

Done in storage, with two follow-ups outside my scope (see Open questions).

When the gateway trace store is opened with the project's content protection, it now seals trace chunks with the same AES-256-GCM provider, key resolver and envelope format that protected content-store objects use. Reading a sealed chunk without the key, with the wrong key, or with a retired key throws; it never returns empty. Chunks written before this change still read, are marked unsealed (`encryption is null`), and get sealed when a protected store opens or reuses them.

The retention sweep now also frees chunks that no trace uses. Deleting a project removes its trace rows, chunk uses and chunks along with its content objects. This is tested through the real folder-layout deletion function.

## What changed and why

All paths below are under `packages/fluxiq/src/programs/automation-studio/storage/project/`.

**Protection (gateway-trace/)**

- `chunk-protection-migration.ts` (new): migration `0032_client_gateway_trace_chunk_protection`.
  - It adds `client_gateway_trace_chunks.encryption text`. This holds the provider's envelope, in the same form as `objects.encryption`; `null` means unsealed. A check rejects an empty string.
  - It adds a partial index on unsealed rows, so the check run on every open costs almost nothing once no unsealed rows are left.
  - Why 0032 and not an edit to 0031: 0031 is still uncommitted in this worktree, but any database that has already run it would fail the runner's checksum check. A separate migration is safe either way. If the supervisor prefers, 0032's column could be folded into 0031 before merging.
- `chunk-media-type.ts` (new): `application/vnd.fluxiq.client-gateway-trace-chunk`. The provider binds the media type and project id into the AES-GCM associated data, so a chunk cannot be opened as another kind of content, or in another project.
- `seal-chunk.ts` (new): calls `protection.seal` on the packed bytes. There is no second cipher; it reuses `content-protection.ts` through the `AutomationStudioProjectContentProtection` interface.
  - **Deflate first, seal after.** Ciphertext does not compress, so sealing first would store every chunk at its raw size and throw away lane A's compression. Compressing before encrypting can leak through length (CRIME/BREACH), but that attack needs someone who can inject chosen text next to a secret and watch the ciphertext length change over many tries. Data at rest offers neither.
- `open-chunk.ts` (new): reads a sealed row by calling `protection.open`, then inflates it and checks it against its digest (the existing `unpack-chunk.ts`).
  - A sealed row with no protection throws `... is protected and cannot be opened without the project's content protection`.
  - A failure inside the provider throws `gateway trace chunk <hex> could not be opened: <provider message>`.
  - Swapping one row's ciphertext for another's within a project passes AES-GCM but fails the digest check.
- `write-chunks.ts`: missing chunks are now packed and then sealed. If a held chunk is unsealed and the store has a protection, the write seals it in place, inside the append transaction. A protected write therefore never leaves page content it reuses in plaintext.
- `read-bodies.ts`: selects `encryption` and opens each distinct chunk once per call. This is now async; the behaviour is otherwise unchanged.
- `prepare-body.ts`: the signature is now `{ json, inlineAllowed }`. A protected store allows no inline bodies, so every event's JSON, including small events, goes to sealed chunks. Without this, events under 16 KiB would have stayed as plaintext in `event_json`.
- `protect-chunks.ts` (new): when a protected store opens, this seals every unsealed chunk, in batches of 200.
  - It seals the stored bytes as they are and keeps their encoding. A damaged chunk stays damaged and still fails when read.
  - It throws if the provider returns no seal, or if a batch changes nothing.
- **Decision on re-sealing legacy rows:** no migration re-seals them, because it cannot. Migrations are SQL run before any key is in reach, the key resolver belongs to the host, and a host without protection must still be able to open the database. Instead, legacy rows are sealed in two places:
  - on the first open of a store that has a protection;
  - whenever a protected write reuses one.
- `types.ts`: adds `GatewayTraceChunkSealing { projectId, protection }`.
- `store.ts`:
  - `open` takes an optional `protection`. It passes it to its content store and runs `protectGatewayTraceChunks` after migrating.
  - Artifacts are written with `protect: true` when a protection is set, so they are sealed in the content store exactly like other protected objects.
  - The header comment is updated. The file is 397 lines.
- `index.ts`: exports the 0032 migration and `sweepUnusedGatewayTraceChunks`.

**Lifecycle**

- `gateway-trace/sweep-unused-chunks.ts` (new): one transaction that does the following, in order.
  - If there is no chunk table, it returns `[]`. That is a true empty answer: such a project never held a trace.
  - It deletes chunk uses whose trace has no event rows left.
  - It deletes up to `limit` chunks that no use row names.
  - It returns their ids as `gateway-trace-chunk:<sha256 hex>`.
- `retention-store.ts` (the smallest edit in the owning module): `sweepUnreferencedObjects` runs the content sweep and then the chunk sweep, with the same `limit` (default 100). `deleted` lists the object ids, then the chunk ids. The return shape is unchanged, so the existing retention test passes unedited.
- Project deletion: no code change was needed for the folder layout. `removeAutomationStudioProjectFiles` (in `runtime/service/projects/files-removal.ts`, which I did not edit) closes the project's connection and removes `projects/<id>/`. That directory holds `project.sqlite` (all trace tables, chunks included) and `objects/`. The new test calls that real function.
- Trace deletion is unchanged. It still keeps chunks that another trace uses; the existing test in `store-chunks.test.ts` passes.

**Tests (gateway-trace/tests/)**

- `sqlite-trace-fixture.ts`: `create` and `reopen` take an optional `{ protection }`; `reopen` defaults to none. It adds `closeAll()` and `projectDirectory`, and guards against closing twice.
- `store-protection.test.ts` (new, real-sql, 5 tests):
  - Plaintext on disk: after writing a small event, a large event and an artifact, each with a marker, and closing everything, no file under the project directory contains any marker. That covers `project.sqlite`, any WAL left behind, and the object files. Every chunk row is sealed with the expected envelope, and no row's stored or inflated bytes contain a marker. No event is inline. Reads are byte-exact (JSON text equality), and the artifact reads back exactly. `measureTrace` and `measureTraceChunks` still answer.
  - Control: the same writes without protection show the markers. This proves the scan can see plaintext.
  - Fails closed:
    - with no protection, both events and the artifact throw;
    - with a wrong key under the same key id, `authentication failed`;
    - with a resolver that returns nothing, `key is unavailable`;
    - with a different key id, `key is unavailable`.
  - Legacy rows: unsealed rows read, then a protected reopen seals all of them with the same digests and encoding, and reads stay byte-exact. A bare reopen then fails closed.
  - Reuse: a protected write that shares chunks with an unsealed trace leaves none of its own chunks unsealed.
- `store-chunk-lifecycle.test.ts` (new, real-sql, 3 tests):
  - The retention sweep frees exactly the chunks used only by a trace whose rows were removed, keeps the chunks still in use, and the kept trace still reads exactly. A second sweep frees nothing.
  - The sweep respects its limit.
  - Project deletion through `removeAutomationStudioProjectFiles`: the reopened project has no trace, manifests, events, uses, chunks, artifacts, objects or `objects/` directory. A second project in the same pool root still reads exactly.
- I edited no existing tests. `store-persistence.test.ts` shows as modified, but lane A changed it before I started.
- Mutation check: I made `seal-chunk.ts` skip sealing, and 4 of the 5 protection tests failed (the plaintext control passed, as it should). I then restored the file and confirmed the restore.

## Commands run and observed results

All from `packages/fluxiq`, unless noted.

- `pnpm exec vitest run src/programs/automation-studio/storage`:
  `Test Files  80 passed | 2 skipped (82)` and `Tests  531 passed | 4 skipped (535)`. This was the final run.
- `pnpm exec vitest run src/programs/automation-studio/runtime/gateway-trace src/client-gateway/trace` (the store's consumers):
  `Test Files  18 passed (18)` and `Tests  124 passed (124)`.
- `pnpm exec tsc --noEmit`: `tsc exit 0`.
- `node scripts/structure-audit.mjs` (from the worktree root):
  - It printed `structure-audit: passed (428 warning(s), 1152 baselined).` and exited 0.
  - The only warning in my area is advisory: `gateway-trace/: 22 source files is past the 15-file advisory threshold`. Lane A's flat layout was already past the threshold.
  - It also printed "1 baseline entries can be lowered". Lane A's run printed the same; I did not touch the baseline.
- Individual runs: `store-protection.test.ts` passed 5 of 5, `store-chunk-lifecycle.test.ts` passed 3 of 3.

## Not verified

- **Nothing is sealed in production yet.** The runtime opens the store in `runtime/gateway-trace/wiring/project-store.ts` without a protection, and that file is outside my scope.
- Only the folder layout was tested for project deletion. The `storageRootDir` (object-store) layout was not run (see below).
- Performance with a real host key resolver. Each seal or open calls the resolver once per chunk, so a first 900 KB event makes about 200 calls and a full trace read makes about 2,700. The content store has the same per-object pattern. I took no timings.
- Concurrent writers across processes, and the 0032 migration on a real project database.
- No full package suites were run, per the twice-a-day rule.

## Open questions or contradictions found

1. **Wiring (supervisor decision).** `runtime/gateway-trace/wiring/project-store.ts:63` must pass the host's provider for any of this to take effect. The only host-provided provider today is `reusableLlmContext.contentProtection`, which `service.ts` holds as `reusableLlmContextContentProtection`. Content-store protection is also opt-in per object, so "exactly as content-store objects" means protected when a provider is configured. Should the trace store instead refuse to write without one?
2. **Project deletion gap in the object-store layout (found by reading code, not run).** In `service.ts` `deleteProject`, the `objectStore && indexStore` branch only removes JSON documents from the program-state SQLite (`transaction.deletePath`). It never closes the pool or removes `projects/<id>/` on disk. So `project.sqlite`, with every trace, chunk and content object, outlives the project. `removeAutomationStudioProjectFiles` has the same gap: its `objectStore` branch returns before `closeIdleProject` and `rm`. This affects content objects as much as chunks. The likely fix is in `files-removal.ts` and `service.ts`, which are outside storage and outside my scope.
3. **Plaintext digests.** Chunks are still addressed by the SHA-256 of their plaintext, because deduplication needs a deterministic key. That digest is stored unencrypted in `digest`, in `client_gateway_trace_chunk_uses`, and in event rows. Someone holding the database file can therefore tell which chunks are equal, and can confirm a guess of a chunk's exact roughly 4 KiB content. A keyed digest (an HMAC) would close this, but it would need key material that the `seal`/`open` interface does not expose. Changing that interface is a host-facing API change.
4. **Still plaintext.** Manifests (`manifest_json`), the indexed correlation columns (event id, kind, message type, command, recording and causation ids), artifact SHA-256 values, and inline events already written before a protected store opened all stay in plaintext. Legacy inline rows are not converted to chunks. Each AES-GCM envelope adds about 130 bytes of JSON per chunk; `measureTrace.storedChunkBytes` counts ciphertext only, not the envelope.
5. **Stale uses.** The sweep treats a use row whose trace has no event rows as stale and deletes it. Under the current write paths, uses and events are only ever written and deleted together, so this matters only after a partial removal outside `deleteTrace`.
