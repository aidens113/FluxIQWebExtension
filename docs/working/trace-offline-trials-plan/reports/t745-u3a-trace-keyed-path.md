# t745 u3a: keyed write and read path for gateway traces (worker report)

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t745/!FluxIQ`, branch `task/t745-keyed-content-addresses`.
G = `packages/fluxiq/src/programs/automation-studio/storage/project/gateway-trace/`. Nothing was committed.

## Outcome

Done, with one change from the brief: there is no subdirectory (see the first open question). All five
behaviours are built and tested. The brief's vitest scope passes and tsc exits 0. The structure audit's
only remaining failure is in `content-address/open-keyring.ts`, which belongs to u1 and is read-only for
this unit.

## What changed and why

New files in G (G goes from 22 to 25 files, which is exactly the hard limit):
- `keyed-address-migration.ts`: migration `0034_client_gateway_trace_keyed_addresses`. It adds
  `client_gateway_trace_chunks.address_key_id`, `client_gateway_trace_events.event_chunk_address_key_id`
  (a check allows it only when the row has `event_chunk_digests`), `client_gateway_trace_artifacts.digest_key_id`
  and `client_gateway_traces.manifest_encryption`. All are nullable, and null means the old form. It also adds
  four partial indexes over old-form rows: `..._chunks_unkeyed_idx`, `..._events_unkeyed_idx`,
  `..._artifacts_unkeyed_idx` and `client_gateway_traces_unsealed_manifest_idx`.
- `keyed-digests.ts`:
  - `gatewayTraceKeyedGearTable(keyring, keyId)`: word v = `addressWith(keyId, "gateway-trace-gear", [v]).readInt32BE(0)`,
    cached in a WeakMap per keyring and key id.
  - `gatewayTraceChunkDigest`: SHA-256 when the key id is null, else `addressWith(keyId, "gateway-trace-chunk", piece)`.
    It throws when there is no keyring or the key is not held.
  - `gatewayTraceArtifactRowDigest`: plain hex SHA-256, or hex of `addressWith(keyId, "gateway-trace-artifact", bytes)`.
    It throws the same way.
- `manifest-row.ts`:
  - `GATEWAY_TRACE_MANIFEST_MEDIA_TYPE` and `GATEWAY_TRACE_SEALED_MANIFEST_PREFIX` (`"fluxiq-sealed:"`).
  - `writeGatewayTraceManifestRow`: with a protection it seals the JSON and stores the prefix + base64 with
    `manifest_encryption` = envelope. Without one it stores plaintext and clears the envelope.
  - `readGatewayTraceManifestRow`: reads either form. It throws on a sealed row with no protection, an envelope
    over unsealed text, or sealed text with no envelope.

Changed files in G:
- `store.ts` (398 lines):
  - The migration list is now `[...ADMIN, 0030, 0031, 0032, 0033, 0034]`.
  - A protected open calls `openAutomationStudioContentAddressKeyring` after migrating. A keyring that cannot
    open fails the open, and the lease is released by the existing catch.
  - The keyring travels on `GatewayTraceChunkSealing`.
  - Appends pass the keyring to `prepareGatewayTraceEventBody`, and event rows record `event_chunk_address_key_id`.
  - Artifacts write the keyed digest and `digest_key_id`. Refusing a rewrite compares in the stored row's own form
    (`refuseDifferentArtifact` is now a private method).
  - Manifests go through `manifest-row.ts`. `listArtifacts` is unchanged: it still recomputes plain SHA-256
    from the bytes read back.
- `types.ts`:
  - `GatewayTraceChunk.addressKeyId`, `GatewayTraceChunkSealing.keyring`, and `addressKeyId` on the chunked body
    and on `GatewayTraceChunkedBodyRef`.
- `split-content-defined.ts`:
  - An optional `gear` parameter, defaulting to the public table. Public cuts are unchanged.
- `prepare-body.ts`:
  - With a keyring it cuts with the current key's gear table and uses keyed digests. Without one it behaves as before.
- `unpack-chunk.ts` and `open-chunk.ts`:
  - The digest is verified in the row's own form through `gatewayTraceChunkDigest`.
  - Opening still comes before verifying, so a bare store still reports a sealed chunk as "is protected".
- `read-bodies.ts`:
  - It selects `address_key_id`.
  - It throws `event <trace>#<seq> is keyed under <a> but its chunk <hex> under <b>` when the chunk row's key id
    differs from the event's. This check runs for every reference, before the per-call cache.
- `write-chunks.ts`:
  - It inserts `address_key_id`.
  - It throws if a held row with the same digest is in a different form, because the event would not read back.
- `index.ts`:
  - It also exports `./keyed-address-migration.ts` and `GATEWAY_TRACE_MANIFEST_MEDIA_TYPE`. Existing exports are unchanged.

Tests (G/tests):
- New `keyed-trace-support.ts`: protection setup, a recorder helper, the file scan, and keyring access.
- New `store-keyed-chunks.test.ts`:
  - Key ids are set on every chunk and event row, and the round trip is byte-exact.
  - Dedupe works within a trace and across traces, checked through `measureTrace` and `measureTraceChunks`.
  - The same trace in two projects with one host key shares no digest, and the two projects have different key ids.
  - Tampering makes the read throw: the chunk key id set to null or to another id, the event and chunk ids set to
    an unheld key, a downgrade to null (fails the SHA-256 check), or a forged digest (reported missing). The read
    works again once the row is restored.
  - Unit check: verifying a keyed chunk with no keyring throws.
- New `store-keyed-probe.test.ts`:
  - The scan covers a 480 KB event and a 40 KB artifact. The artifact is recorded so that the manifest and
    `resourceKey` carry its plain SHA-256.
  - No plain SHA-256 (raw bytes or hex) of the whole event, of any public piece, of any keyed piece, or of the
    artifact appears in any file under the project directory.
  - The keyed length sequence differs from the public one.
  - The stored digest list equals the keyring's addresses of the keyed pieces.
  - Counterpart: the same scan over a plain store does find a public piece digest and the artifact hex.
- New `store-keyed-forms.test.ts`:
  - An unprotected store's rows are unchanged: null key ids, public-gear SHA-256 digests, plain artifact sha256,
    plaintext manifest. A protected store then reads its events, manifest, manifest list and artifacts, and does
    not rekey them.
  - Artifact rewrite refusal works in both forms. A bare store refuses a rewrite of a keyed row, while a rewrite
    of an old-form row still works.
  - A sealed manifest round-trips and is not parseable JSON. Without the protection, `readManifest` and
    `listManifests` throw, and a row with no envelope throws. An unprotected rewrite stores plaintext and clears
    the envelope.
- `sqlite-trace-fixture.ts`: `reopen` marks the fixture closed before it opens, so a refused open can be followed
  by a reopen or dispose.

Existing assertions changed (both in `store-protection.test.ts`, both required by the new behaviour):
1. "refuses to read ... with the wrong key, or after the key is retired":
   - What changed: the wrong-key, keyless and rotated host-key cases now expect the reopen itself to reject with
     `/^Content address key cak\.[0-9a-f]{16} could not be opened\.$/`, instead of a later read failing. The test
     then reopens with the right key and reads.
   - Why: brief item 2, "a keyring that cannot open fails the open".
2. "seals an unsealed chunk a protected write reuses" is now "keys its own sealed chunks beside unsealed old-form
   ones a plain store wrote":
   - What changed: the chunks shared between the plain trace and the protected trace go from `> 10` to `0`.
   - Why: a protected write now cuts and digests under the address key, so it can no longer hit a SHA-256 chunk.
     Every chunk the protected trace uses is still sealed, and the plain trace still reads.

## Commands run and observed results

All from `packages/fluxiq` unless stated otherwise.
- `pnpm exec vitest run src/programs/automation-studio/storage/project/gateway-trace src/programs/automation-studio/runtime/gateway-trace src/client-gateway/trace`
  - Before the test changes: 2 failed, 201 passed. These were exactly the two assertions listed above.
  - Final run, after the restructure: `Test Files  34 passed (34)`, `Tests  212 passed (212)`, exit 0.
- Mutation check, to compensate for tests written after the code. I made the store pass no keyring and skipped
  manifest sealing, then ran the keyed tests: `Tests  6 failed | 3 passed (9)`. The 3 that passed are the
  plain-store scan, the artifact test and the keyring-less unit check, which don't exercise that path. The
  source was restored afterwards, and the restore was confirmed with grep.
- `pnpm exec tsc --noEmit -p .`: no output, `tsc exit: 0`.
- From the worktree root, `node scripts/structure-audit.mjs`: exit 1 with `1 violation(s) across 1 rule(s)`.
  - The violation: `FAIL [failure-as-empty] .../content-address/open-keyring.ts ... at line 65`. It is u1's
    file, read-only here, and was already present before my edits.
  - G-related warnings only, no failures: G has 25 source files and G/tests has 16, both past the 15-file
    advisory threshold, and `keyed-trace-support.ts` has 10 exported values, past the advisory 8.
  - An earlier run with the brief's subdirectory failed with 9 `[naming]` errors (see the open question below).

## Not verified

- No live or browser run, and no Lab run.
- Only the vitest scope the brief named was run; the full Core suite was not.
- The tests ran against whatever u2 and u4 had on disk at the time (`content-store.ts`, `object-repository.ts`
  and the reusable store were modified by them). If those change, the probe could be affected: it assumes the
  content store keeps no plaintext SHA-256 of a sealed artifact, and it passed.
- How 0033 interacts in a project where the object repository's list (u2) and the trace list both include it.
  The runner applies only pending ids, so the order should not matter; I did not test it separately.

## Open questions or contradictions found

1. **Brief item 6 contradicts the structure audit.** Any file in a subdirectory of G has 10 path segments, and
   `maxPathSegments` is 9 (a hard fail that does not ratchet). The audit's 9 `[naming]` failures for
   `gateway-trace/keyed-addresses/*` confirmed it. I folded the new code into exactly three G files, which brings
   G to the 25-file hard limit. As a result, G cannot take another file without a split at the P level (for
   example a sibling `P/gateway-trace-keyed/`), which is outside this unit's ownership.
2. A protected store no longer reuses old-form chunks. Until u3b's rekey pass runs, a project holds old-form and
   keyed copies of the same view side by side.
3. With a wrong or retired host key, the trace store now refuses to open at all, where before it opened and then
   failed per read. Any caller that relied on opening and reading only old-form rows under a wrong host key
   would now fail at open. This follows the brief, but downstream readers (the Lab, runtime wiring) may want to
   know.
