# Report: t745-keyed-content-addresses

Lead: t745 (lead-xhigh). Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t745/!FluxIQ` and downstream
`C:/Users/osrs_/FluxStuff/fxwork/t745/!FluxIQWebExtension`, both on `task/t745-keyed-content-addresses`.
Nothing committed. Paths below are under Core `packages/fluxiq/src/programs/automation-studio/storage/project/`
unless stated.

## Design note

### What the audit found (2026-10-20)

- **Trace chunks are the real leak.** `client_gateway_trace_chunks.digest`, `client_gateway_trace_chunk_uses.digest`
  and `client_gateway_trace_events.event_chunk_digests` hold the SHA-256 of each chunk's plaintext beside its sealed
  bytes. A holder of `project.sqlite` can see which chunks are equal and confirm a guessed chunk. The chunk
  boundaries come from a public gear table, so even with keyed digests the per-event sequence of chunk lengths
  would still confirm a guessed event body: the chunker has to be keyed too (as borg keys its chunker seed).
- **Content-store object ids do not leak for sealed objects.** `content-store.ts` hashes the *stored* bytes, so a
  sealed object's id is the SHA-256 of random-IV ciphertext: it never repeats for equal content and cannot confirm a
  guess. The P3 note that objects are "addressed the same way" is true only of unsealed objects, whose bytes sit in
  the clear beside the address. The cost of the current scheme is the opposite one: sealed content never dedupes.
- **Plaintext digests of sealed content sit beside it in four other places:**
  - `client_gateway_trace_artifacts.sha256`, the plain SHA-256 of a sealed artifact;
  - `client_gateway_traces.manifest_json`, plaintext JSON whose `artifacts[].sha256` and `resourceKey` are the plain
    SHA-256 of sealed artifacts;
  - `reusable_llm_contexts.content_digest`, the plain SHA-256 of a sealed prompt projection;
  - legacy inline trace events (`event_json`) and 0030 object events, plaintext bodies in a protected project
    (P3-E open question 4).
- **Key material.** The only protection is the host's `AutomationStudioProjectContentProtection` (seal/open), bound
  through `framework/index.ts` `bindAutomationStudioReusableLlmContext`. Its one implementation is AES-256-GCM with a
  host-owned key resolver. Raw key bytes never leave the provider. Core has no re-seal or key-retirement code.
  Default hosts bind no protection, so most projects today have no key material at all.

### D1. Key source: a per-project address key wrapped by the existing protection

- On the first open of a store that has a protection, Core generates a random 256-bit **address key**, seals it with
  that protection (same provider, same host key resolver, media type
  `application/vnd.fluxiq.content-address-key`; the AES-GCM AAD binds project id, media type and host key id) and
  stores the sealed form in a new table `content_address_keys`. Every later open unwraps it with `open`.
- This is not a second secret store: the only root secret stays the host's resolver, and the wrapped key is useless
  without it. It is the usual data-key-under-key-encryption-key pattern.
- Why not derive from the host key: the interface exposes only seal/open (deriving would be a host-facing API change
  that custom providers may not be able to honour); a derived key would change on every host key rotation and churn
  every address; and a host that uses one key for all projects would give every project the same address key.
- Addresses are HMAC-SHA256(address key, length-prefixed `fluxiq.content-address.v1`, domain, project id, context,
  content). Domains are a closed set (object, trace chunk, trace gear, trace artifact, reusable context). Project id
  in the input plus a random key per project means an address never crosses projects; a key row copied into
  another project's database does not open (AAD binds the project).
- A project with no protection has no key material, so its addresses stay SHA-256. Its content is stored in the clear
  beside each address, so the address reveals nothing the content does not. It becomes keyed on its first protected
  open (D5).

### D2. What is keyed, per consumer

| Consumer | Today at rest | After |
| --- | --- | --- |
| Trace chunks (`client_gateway_trace_chunks`, `_chunk_uses`, events' `event_chunk_digests`) | SHA-256 of plaintext, public gear | HMAC (same 32-byte width), keyed gear; row marks its key id |
| Trace artifacts (`client_gateway_trace_artifacts.sha256`) | SHA-256 of plaintext | keyed hex (64 hex); row marks its key id |
| Trace manifests (`manifest_json`) | plaintext JSON with artifact SHA-256 | sealed in a protected store (the wire values stay plain inside it) |
| Legacy trace event bodies (inline JSON, 0030 objects) in a protected store | plaintext | re-cut into keyed sealed chunks by the rekey pass |
| Content-store sealed objects (trace artifacts, reusable contexts) | id = SHA-256 of ciphertext, no dedupe | id unchanged; new keyed `content_address` used to dedupe within the project and verified after open |
| Reusable LLM context `content_digest` | SHA-256 of plaintext | keyed hex (same 64-hex shape; "equal within the project" kept) |

Not changed, and why:
- Client-gateway wire digests (trace-artifact `PUT .../<sha256>`, `metadata.trace.artifacts[].sha256`, manifest and
  presence `sha256`, `referencedDigests`, replay re-upload): the extension computes them, so they stay plain SHA-256.
  They live in flight and in memory; at rest they now exist only inside the sealed manifest and sealed chunks.
  `listArtifacts` still recomputes the plain digest from the bytes it reads back.
- Legacy object store (state assets, screenshots, `$fluxiqObject`, `automation-object://`, the state-asset route,
  legacy backup export): filesystem, never sealed; the extension computes the wire SHA-256. No protection exists to
  key from.
- Recording and runtime event chunks, state bodies, graphs, compiled plans, adaptations: their stores open the content
  store without a protection, so their objects are unsealed and their content sits in the clear.
- The Lab's trace inspection reads only through the store API; digest width stays 32 bytes, so its
  `digestListBytes % 32` assertion holds.

### D3. Rotation

- **Host key rotation:** the address key stays the same (it is sealed under the old host key id and opens while the
  host still resolves that id). Core has no re-seal job for any sealed content; retiring a host key needs one for
  objects and chunks anyway, and the key row is one more sealed item for it. Pre-existing gap, recorded.
- **Address key rotation:** `rotate` adds a new current key and retires the old one in one transaction. The open-time
  rekey pass treats rows under a retired key exactly as unkeyed rows. Retired keys are kept (32 bytes, sealed): a
  process that opened before the rotation may still write under one, and deleting it would strand those rows.

### D4. Migration order

1. SQL, which runs before any key is in reach, is additive and nullable only:
   - `0033_content_addresses`: `content_address_keys`; `objects.content_address`, `objects.content_address_key_id`
     and their indexes. In the object repository's list and in every store that opens a keyring.
   - `0034_client_gateway_trace_keyed_addresses`: key-id columns on chunks, events and artifacts;
     `manifest_encryption` on traces. Trace store list only.
   - `0035_reusable_llm_context_keyed_digest`: `content_digest_key_id`. Reusable store list only.
2. A protected open loads the keyring, creating the key if absent; concurrent creators converge on one row.
3. Each store then rekeys its stale rows (unkeyed, or under a retired key) in batch transactions, verifying each
   row's old form before writing its new one. Trace order: events (chunked, inline, object) to keyed sealed chunks;
   then old-form chunks and uses that no old-form event still names are deleted, rechecked inside the deleting
   transaction; then artifact digests; then manifests sealed; then any leftover unsealed chunk sealed (P3-E's pass).
4. From the first protected open, every new write is keyed. Reads accept both forms at all times: each row records
   its own form.

### D5. Crash, interruption and rollback

- Each batch is one SQLite transaction; a crash rolls the batch back. The next protected open resumes from the rows
  still stale. Mixed forms read correctly in between. Nothing is deleted before its replacement has committed and no
  old-form reference to it remains.
- A row that fails its old-form check (a damaged chunk or object) is left in its old form and counted; it still fails
  when read, exactly as before. The pass never writes damage into a valid-looking keyed address.
- Rollback: the schema change is additive. A binary rolled back to pre-t745 code fails closed on keyed rows (a keyed
  chunk fails its SHA-256 check, a sealed manifest fails to parse, a keyed artifact digest refuses a rewrite, a keyed
  reusable digest reports a mismatch); it never returns wrong or partial data. Rows it writes in the old form are
  rekeyed on the next open of new code. Full readability under old code means restoring the pre-upgrade
  `project.sqlite`. There is no down-migration, because re-creating unkeyed digests would undo the fix.

- Amended during the work (see the u3b and u5 log entries): physical removal needs more than deleting rows.
  Project connections run `secure_delete`; every batch that replaces or deletes an old form records a scrub request
  in its own transaction, and every protected open honours it (VACUUM, then a truncate checkpoint), clearing it only
  on success; a released object's row is deleted together with a pending-removal row, and every content-store open
  removes pending files. The seal-in-place of leftover chunks runs as the rekey's last pass, before the scrub.
  A current address key that does not open fails every protected store's open.

### D6. Logging

No key bytes and no content in any error, log or report. Errors name key ids, keyed digests, trace ids and
sequences. The keyring holds key bytes privately and redacts itself from `JSON.stringify` and `util.inspect`.

### Units

1. u1 keyring: new `content-address/` directory (0033 migration, key media type, keyring, open-or-create, rotate,
   barrel, tests).
2. u2 content-store objects: `content-store.ts`, `object-repository.ts`, object address backfill in `content-address/`.
3. u3a trace keyed write/read path: 0034, keyed digests and gear, artifact digests, sealed manifests.
4. u4 reusable LLM context: 0035, keyed digest, rekey at open.
5. u3b trace rekey pass: events, cleanup, artifacts, manifests, legacy conversion (after u2 and u3a).
6. Integration: the probes and isolation across stores, downstream readers' tests, Core docs.

## Progress log

### 2026-10-20 - discovery
- Two read-only maps (Core consumers; downstream readers) gave the findings in the design note. Downstream wire
  digests (extension trace-artifact PUT, state-asset PUT, `metadata.trace.artifacts`) are client-computed plain
  SHA-256 and stay so; the Lab's trace inspection reads only through the store API and assumes 32-byte digests.
- Budgets: `storage/project/` root, `storage/project/tests/` and `storage/project/schema/` are each at 25 files, so new
  modules go in subdirectories and new cases into existing test files; `gateway-trace/` holds 22 files.

### 2026-10-20 - u1 keyring (worker-high; report `t745-u1-keyring.md`)
- New `storage/project/content-address/`: `migration.ts` (0033: `content_address_keys` with at most one current row
  enforced by a partial unique index; `objects.content_address` 64-hex and `content_address_key_id`, set or null
  together by a check; two indexes), `key-media-type.ts`, `keyring.ts` (HMAC-SHA256 over length-prefixed
  version/domain/project/context/content; key bytes private, redacted from JSON and inspect), `keyring-input.ts`,
  `new-key-row.ts` (random key sealed then zeroed; refuses a provider that returns it unsealed), `open-keyring.ts`
  (create-if-absent in a transaction, every opener reloads the stored row), `rotate-key.ts`, `index.ts`;
  `storage/project/index.ts` one re-export line. Tests `content-address/tests/keyring.test.ts` + fixture.
- Lead change after review: a retired key that no longer opens is left out of the keyring instead of failing the
  whole open (otherwise a host key retirement would make every store unopenable); only rows under it fail. The
  current key must still open. Test added ("opens without a retired key that no longer opens...").
- Lead's checks: `pnpm exec vitest run src/programs/automation-studio/storage/project/content-address` ->
  `Tests 12 passed (12)`; `pnpm exec tsc --noEmit -p .` -> exit 0 (53 s).
UNIT READY: packages/fluxiq/src/programs/automation-studio/storage/project/content-address/** , storage/project/index.ts

### 2026-10-20 - u2 objects, u3a trace keyed path, u4 reusable digest (parallel; reports `t745-u2-object-addresses.md`, `t745-u3a-trace-keyed-path.md`, `t745-u4-reusable-digest.md`)
- u2 (worker-high): `object-repository.ts` runs [ADMIN, 0033], records carry `contentAddress`/`contentAddressKeyId`,
  oldest-sealed-by-address lookup, guarded address updates, `deleteObjectIfUnreferenced`; `content-store.ts` opens the
  keyring when protected, dedupes sealed puts by `HMAC("content-object", plaintext, media type)` only when the
  candidate opens to exactly the same bytes, verifies the address after every sealed read, backfills legacy sealed
  rows at open (`content-address/object-address-backfill.ts`, keyset paged, damaged rows skipped and counted, bounded
  for tests), and `removeIfUnreferenced`. Object ids, paths, sha256 and reference ids unchanged. Mutation checks
  reported: removing the read check failed 2 tests, storing plain SHA-256 as the address failed 6.
- u3a (worker-high): 0034 (`gateway-trace/keyed-address-migration.ts`: key-id columns on chunks, events, artifacts;
  `manifest_encryption`; four partial indexes over old-form rows); `keyed-digests.ts` (keyed gear table cached per
  keyring and key, chunk digest and artifact row digest in a row's own form); `manifest-row.ts` (sealed manifest as
  `fluxiq-sealed:` + base64 with the envelope, so older code fails JSON.parse closed); `store.ts`, `prepare-body.ts`,
  `split-content-defined.ts`, `write-chunks.ts`, `read-bodies.ts`, `unpack-chunk.ts`, `open-chunk.ts`, `types.ts`.
  `gateway-trace/` is now at 25 files and any subdirectory breaks the path-depth limit, so u3b's modules go in a
  sibling directory. `store-protection.test.ts`: a wrong or keyless host key now fails the open; a protected write
  shares no chunk with a plain store's chunks (keyed digests differ).
- u4 (worker): 0035 as a fourth const in `schema/reusable-llm-contexts.ts`; store runs [ADMIN, 0033, 0035], keyed
  `content_digest` with `content_digest_key_id`, verified in the row's own form; rekey at protected open in new
  `reusable-llm-context-digest/{digest,rekey,index}.ts` (guarded update, skipped rows counted, bounded for tests).
- Lead decisions and edits after review:
  - One policy for all protected stores: a current address key that does not open fails the store's open (trace and
    reusable stores already did; the content store was lenient). `content-store.ts` edited; u2's keyless test now
    expects the refused open; its fixture closes the pool after a refused open.
  - `content-address/open-keyring.ts`: the skipped retired key is named (`{ status: "unavailable" }`, and
    `keyring.unavailableKeyIds`) instead of returning undefined, which the audit's failure-as-empty rule refused;
    `addressWith` on such a key says it is unavailable.
  - `gateway-trace/manifest-row.ts`: the seal binds project and media type but not the trace, so a manifest naming
    another trace now throws; test "refuses a sealed manifest copied onto another trace's row".
  - `database.ts`: `pragma secure_delete = ON` on every project connection. Without it, rows deleted or rewritten in
    place (old plaintext digests, legacy inline JSON, P3-E's seal-in-place) stay readable in free pages. Test
    "zeroes deleted rows..." in `tests/database.test.ts`; with the pragma set OFF and the pragma assertion removed,
    the file scan found the marker (test failed), so the test checks the zeroing itself.
- Lead's checks: `pnpm exec vitest run $A/storage/project $A/runtime/gateway-trace src/client-gateway/trace
  $A/runtime/tests/reusable-llm-context-service.test.ts $A/api/handlers/tests/caches.test.ts
  $A/runtime/service/tests/object-documents-trace.test.ts` -> `Test Files 88 passed | 2 skipped (90)`,
  `Tests 619 passed | 4 skipped (623)` (before the database.ts edit); after it, `tests/database.test.ts` ->
  `Tests 18 passed (18)`, `store-keyed-forms.test.ts` -> 4 passed, `content-address` -> 25 passed;
  `node scripts/structure-audit.mjs` -> `passed (431 warning(s), 1152 baselined)`; `tsc --noEmit -p .` -> exit 0.
UNIT READY: storage/project/{content-store.ts,object-repository.ts,database.ts,reusable-llm-context-store.ts}, content-address/**, reusable-llm-context-digest/**, schema/{index.ts,reusable-llm-contexts.ts}, gateway-trace/** (except the rekey), tests/{database.test.ts,reusable-llm-context-store.test.ts}

### 2026-10-20 - u3b trace rekey (worker-high; report `t745-u3b-trace-rekey.md`)
- New sibling `storage/project/gateway-trace-rekey/` (gateway-trace/ is at its 25-file limit and a subdirectory breaks
  the path-depth limit): at a protected open, in keyset-paged guarded batch transactions, old-form event bodies
  (old-form chunks, inline JSON, 0030 objects) are re-cut into keyed sealed chunks; old-form chunks and uses no
  old-form event names are deleted in one transaction; artifact digests keyed and unsealed artifact objects stored
  sealed and repointed; plaintext manifests sealed; damaged rows skipped and counted. `store.ts` opens the content
  store before the rekey and exposes `store.rekey`. Tests `gateway-trace-rekey/tests/{migration,interruption,
  rotation}.test.ts`. Mutations reported: skipping cleanup failed 6 of 9; deleting named chunks failed the
  damaged-chunk test.
- VACUUM: with secure_delete and a truncate checkpoint alone, the probe still found one old chunk digest in the free
  gap of a page that B-tree balancing had rebuilt, which secure_delete never zeroes. Kept: a full VACUUM after a
  converting open (cost: one rewrite of `project.sqlite` per migration or rotation).
- Lead updated the three G tests that asserted the pre-rekey behaviour (`store-keyed-forms.test.ts` x2: rows and
  `artifact-old` are now rekeyed at the protected open, and a bare store refuses to compare the keyed `artifact-old`;
  `store-protection.test.ts`: old chunks re-cut under the key instead of sealed in place). Lead's check:
  `pnpm exec vitest run $P/gateway-trace $P/gateway-trace-rekey` -> `Test Files 16 passed (16)`, `Tests 80 passed (80)`.

### 2026-10-20 - u5 durable scrub and removals (worker-high; report `t745-u5-durable-removal.md`)
- Closed two windows in u3b: a VACUUM that failed or never ran (crash) was never retried, and a crash between a batch's
  commit and the object removal left an unreferenced plaintext object. 0033 adds `content_address_scrub_requests`
  and `object_pending_removals` and an index on `objects(content_address_key_id)`; `content-address/scrub-request.ts`
  (request inside the caller's transaction) and `scrub-database.ts` (VACUUM, truncate checkpoint, clear only on
  success, status reported, never thrown); the object repository releases an object (row deleted, pending row
  written) inside the caller's transaction; every content store open drains pending files; every converting rekey
  batch (trace and reusable) requests a scrub and every protected open honours it. Retired-key scans use partial
  indexes and `(col < ? or col > ?)` (0034, 0035, object backfill). Mutations reported: event-batch scrub request
  off -> crash test failed; drain at open off -> 2 pending-removal tests failed.
- Lead fixes after review:
  - `protectGatewayTraceChunks` (seal in place) ran after the scrub and requested none: it now requests a scrub in
    its own transaction and runs as the rekey's last pass, before the scrub (`gateway-trace/protect-chunks.ts`,
    `gateway-trace-rekey/rekey.ts` with `leftoverChunksSealed`, `gateway-trace/store.ts` no longer calls it
    separately). The damaged-chunk test now checks `leftoverChunksSealed`, the scrub status and that the intact
    chunks' old stored bytes appear in no file. Honest note: with the order reverted (sealing after the scrub,
    requests cleared) that probe still passed; secure_delete zeroed those rows in this case, so the test does not
    prove the order. The order guards the page-rebuild case u3b observed.
  - `object-repository.ts` `finishPendingRemoval` requests a scrub in the transaction that deletes the pending row
    (its path names an unsealed object by its plain SHA-256).
  - Both new imports go through the `content-address/` barrel (the audit refused direct file imports).

### 2026-10-20 - integration, downstream readers, docs
- Lead's checks (Core, from `packages/fluxiq`, A = src/programs/automation-studio):
  - `pnpm exec vitest run $A/storage/project $A/runtime/gateway-trace src/client-gateway/trace
    src/client-gateway/tests/trace-tap.test.ts $A/runtime/tests/reusable-llm-context-service.test.ts
    $A/api/handlers/tests/caches.test.ts $A/runtime/service/tests/object-documents-trace.test.ts
    $A/runtime/service/projects` -> `Test Files 99 passed | 2 skipped (101)`, `Tests 662 passed | 4 skipped (666)`.
  - After the barrel-import fix: `$P/gateway-trace $P/content-address tests/content-store tests/object-repository
    tests/retention-store tests/reusable-llm-context-store` -> `Test Files 25 passed (25)`, `Tests 134 passed (134)`.
  - `pnpm exec tsc --noEmit -p .` -> exit 0. `node scripts/structure-audit.mjs` -> `passed (433 warning(s), 1152
    baselined)` ("1 baseline entries can be lowered" was printed before t745 too; baseline untouched).
  - No test outside `storage/project` reads object records (grep), so the two new record fields reach no other test.
- Downstream readers (Core library rebuilt with `pnpm --filter fluxiq build`; the downstream build cache reported
  "inputs changed: core:packages/fluxiq/dist, core:packages/fluxiq/src", so they ran against t745):
  - Core web: `pnpm --filter @fluxiq/web exec vitest run src/app/api/client-gateway/trace-artifacts
    src/app/api/programs/automation-studio/state-assets` -> `Test Files 3 passed (3)`, `Tests 17 passed (17)`.
  - Extension: `node scripts/test-extension.mjs background/trace-capture/tests background/connection/tests/core-api`
    (apps/extension) -> `# tests 50`, `# pass 50`, `# fail 0`.
  - Lab: test-runner build, then `node --test "dist/trace-inspection/tests/*.test.js"
    "dist/trace-parity/tests/*.test.js"` -> `# tests 28`, `# pass 28`, `# fail 0`.
  - No downstream code change was needed: wire digests stay plain SHA-256 and chunk digests stay 32 bytes.
- Docs: Core `docs/architecture/automation-studio/persistence.md`, a "Keyed content addresses" passage under content
  protection (key custody, what is keyed, migration, removal, rollback), replacing "does not automatically
  re-encrypt old objects". `pnpm docs:check` failed first because `docs/reference/framework-reference.md` was stale;
  the regenerated file also carries exports from earlier tasks (offline-trial vocabulary, activity wording), so it was
  already stale on dev. Regenerated with `pnpm docs:reference` (both tracked copies); `pnpm docs:check` -> passed,
  "Deterministic framework reference is current".
UNIT READY: Core packages/fluxiq/src/programs/automation-studio/storage/project/{gateway-trace-rekey/**,gateway-trace/{store.ts,protect-chunks.ts,keyed-address-migration.ts,tests/store-keyed-forms.test.ts,tests/store-protection.test.ts},content-address/**,object-repository.ts,content-store.ts,reusable-llm-context-store.ts,reusable-llm-context-digest/**,schema/reusable-llm-contexts.ts,tests/reusable-llm-context-store.test.ts}, docs/architecture/automation-studio/persistence.md, docs/reference/framework-reference.md, packages/fluxiq/docs/reference/framework-reference.md

## Not verified

- Full suites (`pnpm check`, `pnpm test`, whole Core vitest): left to the twice-daily sweep.
- No live or paid run; no browser. A protected project exists only where a host binds a content protection; default
  hosts and the Lab bind none, so in practice this changes nothing for them until a host does.
- Real two-process races (concurrent creators of the key, concurrent rekeys, a busy VACUUM under a second
  connection): tested across connections in one process and by injection only.
- VACUUM cost on a large project (one rewrite per migration or rotation).
- The rekey of a row under a retired address key that no longer opens: reusable digests and artifact rows are
  skipped (left unreadable); object addresses are recomputed from the authenticated plaintext.

## Open questions or contradictions found

1. Brief premise, corrected: content-store object ids were already safe for sealed objects (SHA-256 of random-IV
   ciphertext). The leaks were trace chunk digests, trace artifact digests, plaintext manifests, reusable context
   digests and legacy plaintext event bodies. All are closed. Sealed objects also dedupe now, which they never did.
2. Migration numbering: 0033 (content addresses, object repository and every keyring store), 0034 (trace), 0035
   (reusable context, as a fourth const in `schema/reusable-llm-contexts.ts`). If t746 or t743 adds a migration with
   the same number in the same list, the lists must stay ascending.
3. Residual race, pre-existing in `sweepUnreferencedObjects` and the old removal: an unprotected write of the same
   unsealed bytes landing between a drain's check and its file removal loses its file. Only an unprotected writer
   racing a protected rekey can hit it. `sweepUnreferencedObjects` still removes the file before the row.
4. Core has no re-seal job for any sealed content (objects, chunks, the wrapped address key). A host that retires a
   key without one loses that content. This gap predates t745; recorded.
5. `gateway-trace/` is at its 25-file hard limit and cannot gain a subdirectory (path-depth limit), which is why
   the rekey is a sibling directory. The next trace-storage change needs a structural decision there.
