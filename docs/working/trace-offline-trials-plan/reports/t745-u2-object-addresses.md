# t745 u2: keyed addresses on sealed content-store objects

Worker report. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t745/!FluxIQ`, branch `task/t745-keyed-content-addresses`.
P = `packages/fluxiq/src/programs/automation-studio/storage/project/`.

## Outcome

Done. Every item of the brief is implemented and tested. The named vitest set passes (7 files, 38 tests), `tsc --noEmit` exits 0, and the structure audit reports no violation in my files. The audit as a whole still exits 1, but only on files other units own (listed below).

## What changed and why

- **P/object-repository.ts**
  - Runs `[...AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS, AUTOMATION_STUDIO_CONTENT_ADDRESS_MIGRATION]`, imported through the `content-address/index.ts` barrel.
  - The record gains `contentAddress` and `contentAddressKeyId` (null when unset). There is a new exported type, `AutomationStudioProjectObjectContentAddress`.
  - `upsertObject` takes the pair as optional input and refuses a half-set pair. An object already stored under its sha256 comes back unchanged.
  - New methods:
    - `findSealedByContentAddress(address, keyId)` returns the oldest match, ordered by `created_at_ms, object_id`, sealed rows only.
    - `listSealedObjectsNeedingContentAddress({currentKeyId, afterObjectId, limit, includeOtherKeys})` pages by object id.
    - `hasRetiredContentAddressKey()`.
    - `updateContentAddresses(updates)` writes in one transaction. Each update is guarded with `content_address is ? and content_address_key_id is ?` against the values it expects to find, and the method returns how many rows changed.
    - `deleteObjectIfUnreferenced(id)` checks references and deletes the row in one transaction, then returns the deleted record.
  - New getter `database` (for the keyring) and static `normalizeMediaType` (the stored form of a media type).
- **P/content-store.ts**
  - **Open:** `open` takes an optional `contentAddressBackfill: {batchSize?, maxBatches?}`. With a protection, the store opens the project keyring and then runs the backfill.
    - If the keyring fails to open (for example, the host no longer resolves the key), the store still opens. Unsealed work goes on as before. A protected put, or a read of an addressed sealed object, then throws that keyring error, which names only a key id.
    - I chose this so that a store reopened with a wrong or missing host key behaves as it did before, failing only at the point of use. The gateway-trace store-protection test depends on this.
  - **`putBytes({protect:true})`:**
    - Computes the address of the plaintext under the current key, using the normalised media type as context.
    - Looks up the oldest sealed row with that address and reuses it only if its file verifies and opens to exactly the same bytes (constant-time compare). The result is `deduped: true`, with the owner reference added as today.
    - Otherwise it seals and writes as today and stores the address.
    - The check is stronger than "file verifies". With only that check, a swapped address would silently dedupe onto the wrong object. Here a bad candidate falls through to a fresh copy.
  - **Unsealed puts** are unchanged.
  - **`readObject`:** for a sealed object that has an address, the store recomputes it after opening. A mismatch or an unheld key throws `Automation Studio object <id> does not match its content address.` or `... content address key is not held.`, and the plaintext buffer is zeroed first. Sealed rows without an address still read.
  - **New public methods:** `backfillContentAddresses(options)` and `removeIfUnreferenced(objectId): Promise<boolean>`. The second deletes the row through the repository's transaction, then deletes the file.
- **New P/content-address/content-object-address.ts:** `automationStudioContentObjectAddress(keyring, keyId, plaintext, storedMediaType)`, the one function the put path, the read path and the backfill all use.
- **New P/content-address/object-address-backfill.ts:** `backfillAutomationStudioContentObjectAddresses(input, {batchSize?, maxBatches?})`.
  - Pages by object id. Rows under other keys are included only when a retired key exists; until then the pass reads only the partial index of unaddressed sealed rows.
  - For each row: read the file and verify its sha256 and byte count, then open it. If it has an old address under a held key, that address must recompute; otherwise the row is skipped. Rows under a key the keyring no longer holds are rekeyed without the old-address check, because the AES-GCM open already authenticated the plaintext.
  - Each batch's updates go through `updateContentAddresses`.
  - Returns `{addressed, skipped, skippedObjectIds, raced, batches, complete}`. Skipped rows are never thrown, never written, and never revisited within a pass. Duplicate legacy copies are not merged.
- **P/content-address/index.ts:** appended two `export *` lines.
- **New tests in P/content-address/tests/:**
  - `object-address-fixture.ts` (support only).
  - `object-addresses.test.ts`: 9 cases covering dedupe within a media type but not across, unsealed puts unchanged, 64-hex address under the current key that recomputes, the plain-SHA probe (hex, upper hex, raw and plaintext, while open and after close), two projects getting different addresses, a swapped address making reads throw and a new put not reusing the swapped row, an unaddressed sealed row still reading, a keyless protection, and `removeIfUnreferenced`.
  - `object-address-backfill.test.ts`: 4 cases covering a migrated store backfilled to the exact fresh-write addresses with reads verifying, an interrupted backfill resumed on the next open, corrupt ciphertext and a tampered seal both skipped and counted, and rotation (rekey, dedupe against the rekeyed row, and a row whose old address fails being left alone).
- **P/tests/content-store.test.ts:** not edited. No existing assertion needed to change.

## Commands run and observed results

All from `packages/fluxiq` unless noted.

- `pnpm exec vitest run src/programs/automation-studio/storage/project/content-address src/programs/automation-studio/storage/project/tests/content-store.test.ts src/programs/automation-studio/storage/project/tests/object-repository.test.ts src/programs/automation-studio/storage/project/tests/object-stream-edge-cases.test.ts src/programs/automation-studio/storage/project/tests/retention-store.test.ts`
  - Printed `Test Files 7 passed (7)` and `Tests 38 passed (38)`. I ran it again after the final edits with the same result.
- `pnpm exec tsc --noEmit -p .` printed no errors (`exit=0`, about 1m40s). I ran it again after the final edits: `tsc exit=0`.
- `node scripts/structure-audit.mjs`, from the worktree root, exited 1 with 10 violations, none in my files:
  - `[failure-as-empty] content-address/open-keyring.ts` line 65 (u1's retired-key catch).
  - Nine `[naming]` depth violations under `gateway-trace/keyed-addresses/` (u3a).
  - My files had three violations on the first run: deep imports past the `content-address` barrel in content-store.ts and object-repository.ts, and two packed one-line helpers that took object-repository.ts's statement-packing count to 12, over its baseline of 10. I fixed all three. A grep of the final audit output for my files is empty.
- Mutation checks, run and then reverted; I confirmed the file was restored:
  - Removing the read-time address check made 2 tests fail (the swap test and the rotation forged-address test).
  - Storing the plain SHA-256 as the address made 6 tests fail, the probe among them.
- Informational, not gating: `pnpm exec vitest run .../gateway-trace/tests/store-protection.test.ts .../tests/reusable-llm-context-store.test.ts` printed `Test Files 2 passed (2)`, `Tests 18 passed (18)`. Other units are editing those areas.

## Not verified

- Concurrency between two processes. Two simultaneous puts of equal content can both miss the lookup and write two copies with the same address; this is allowed, because the index is non-unique and lookups take the oldest. A backfill racing a writer is covered only by the guard logic (`raced` count), not by a test.
- The full package suites and the other consumers of the content store (graph, compiled plan, adaptation, event chunks). They open without a protection, so their path only gains the 0033 migration and two always-null record fields.
- Any downstream (extension) build.

## Open questions or contradictions found

1. **Keyring failure at open is deferred, not thrown.** u1's `openAutomationStudioContentAddressKeyring` fails when the current key does not open. If the content store let that propagate, every gateway-trace or reusable store reopened with a wrong or rotated host key would fail to open, breaking `store-protection.test.ts`'s wrong, retired and rotated reopen cases. So the store records the error and throws it only on protected writes and addressed sealed reads. The lead should confirm this is the intended contract, or tell me to make it fatal.
2. **Rows under a key id that is not in `content_address_keys`.** When no key has been retired, the backfill does not look for rows under some other key id (to keep the indexed fast path), so such a row stays as it is and fails when read with "key is not held". This only happens through tampering or a database copied in. After any rotation, each protected open scans sealed rows for the stale-key case, because there is no index on `content_address_key_id`, and 0033 is not mine to change. Recorded as a cost.
3. **Media type context.** The address context is the stored media type (the repository's `normalizeMediaType`: trimmed, lower case, or `application/octet-stream` when malformed). For valid media types this is exactly what the brief asks for. It also keeps put, read and backfill consistent for a malformed media type, which the AES provider refuses anyway.
4. **`removeIfUnreferenced` checks only `object_references`, as briefed.** Other tables point at objects through insert/update guard triggers only, and nothing guards a delete, so a caller must not use it on objects that another table references directly.
