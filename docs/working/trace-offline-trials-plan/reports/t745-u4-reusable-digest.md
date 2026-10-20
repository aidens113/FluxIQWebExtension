# t745 u4: keyed reusable LLM context digest

## Outcome

Done. A protected store now writes `reusable_llm_contexts.content_digest` as a keyed address (still 64 lower hex) and records which key made it in `content_digest_key_id`. Reads check a row in its own form. Each protected open rekeys rows that hold a plain digest or a digest under a key that is no longer current. My unit's tests, tsc and my files' structure checks pass. The structure audit as a whole exits 1, but only on files other units own (see below).

## What changed and why

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t745/!FluxIQ`, P = `packages/fluxiq/src/programs/automation-studio/storage/project/`.

- `P/schema/reusable-llm-contexts.ts`: new `AUTOMATION_STUDIO_PROJECT_REUSABLE_LLM_CONTEXT_KEYED_DIGEST_MIGRATION`, id `0035_reusable_llm_context_keyed_digest`, which runs `alter table reusable_llm_contexts add column content_digest_key_id text`. Null means a plain SHA-256. The header comment is updated.
- `P/schema/index.ts`: that one constant is added to the existing reusable-contexts export line.
- `P/reusable-llm-context-digest/` (new subdirectory with a barrel, because the P root is at its 25-file budget):
  - `digest.ts`:
    - `keyedReusableLlmContextDigest(keyring, content)` returns `{digest, keyId}` under the current key, domain `"reusable-llm-context"`.
    - `reusableLlmContextDigestMatches({keyring, content, digest, keyId})`: when `keyId` is null it compares against SHA-256. Otherwise it uses `addressWith` under that key. It returns false when there is no keyring or the key is not held. The comparison is timing-safe.
  - `rekey.ts`: `rekeyReusableLlmContextDigests({database, content, keyring, options?: {batchSize? (1-500, default 100), maxBatches?}})` returns `{rekeyed, skipped, batches, complete}`.
    - It pages through rows by `record_id > cursor`, picking rows whose key id is null or not current. The cursor always moves past every row read, so a skipped row is not visited twice in one pass.
    - For each row it reads the projection through the content store, then checks the byte count and the old digest.
    - Each batch's writes go in one transaction. The update is guarded with `where record_id = ? and content_digest = ? and content_digest_key_id is ?`.
    - A row that is unreadable or fails its check is counted as skipped. It is never thrown. The read failure's cause is dropped so no provider message leaks into the result.
- `P/reusable-llm-context-store.ts`:
  - The store migrates `[...ADMINISTRATION, AUTOMATION_STUDIO_CONTENT_ADDRESS_MIGRATION (0033), 0035]`.
  - With a `contentProtection`, after the content store and object repository open, it opens the keyring and runs the rekey pass. If that fails, it closes the objects and content store, and the existing handler releases the lease.
  - New open option `digestRekey?: {batchSize?, maxBatches?}`, and a new readonly property `digestRekey` holding that open's result (undefined when the store has no protection).
  - `put` writes the keyed digest and key id. `createHash` is no longer imported here.
  - `record()` verifies through `reusableLlmContextDigestMatches` and throws the existing "Reusable LLM context content metadata mismatch." on a byte-count or digest mismatch. That covers an unheld key, and a keyed row read by an unprotected store.
  - Everything I added is written one statement per line.
- `P/tests/reusable-llm-context-store.test.ts`: a new describe block with seven cases:
  1. A fresh put stores a 64-hex keyed digest under the current key and reads it back.
  2. Equal projections share one digest within a project; the same projection in two projects under one shared host key gets different digests.
  3. Probe: neither the plain SHA-256 hex nor its raw 32 bytes appear in any file under `projects/<id>` (sqlite, WAL and object files).
  4. Rows rewritten to a plain digest with a null key id (as older code wrote them) are rekeyed on reopen, and reads verify.
  5. A rekey stopped by `{batchSize: 2, maxBatches: 1}` rekeys 2 of 5 rows and still reads all 5 in mixed forms; the next open rekeys the other 3.
  6. Tampered digests: a tampered keyed digest fails the read. A tampered plain digest is skipped by the rekey (`skipped: 1`), stays in its old form, and still fails the read.
  7. After `rotateAutomationStudioContentAddressKey`, reopen rekeys both rows under the new key id, and reads verify.

## Commands run and observed results

All run from `packages/fluxiq` unless noted:

- `pnpm exec vitest run src/programs/automation-studio/storage/project/tests/reusable-llm-context-store.test.ts` printed "Test Files 1 passed (1) / Tests 13 passed (13)".
- After the final edit, the store test plus `runtime/tests/reusable-llm-context-service.test.ts`, `runtime/tests/reusable-llm-context.test.ts` and `api/handlers/tests/caches.test.ts` printed "Test Files 4 passed (4) / Tests 23 passed (23)".
- Before the final edit, `runtime/llm/tests/harness.test.ts` (the context-packet consumer) was run with the same set: "33 tests" passed.
- `pnpm exec tsc --noEmit -p .` exited 0 with no output, both before and after the final edit.
- `node scripts/structure-audit.mjs`, from the worktree root, exits 1 with "13 violation(s) across 4 rule(s)". None is in a file I own:
  - failure-as-empty: `content-address/open-keyring.ts:65`
  - imports: `content-store.ts`, `object-repository.ts`
  - naming depth (10 segments): `gateway-trace/keyed-addresses/*`
  - statement-packing: `object-repository.ts`
- My first run flagged `reusable-llm-context-digest/rekey.ts` (failure-as-empty). I fixed it by returning an explicit `{ skipped: "unreadable" }` outcome. On a re-run, filtering the output for `reusable-llm-context` matched nothing in my files.
- The audit also prints "1 baseline entries can be lowered". This is probably the store's statement-packing count, since I split the packed digest-check line. I did not run `pnpm structure:baseline` because the baseline file is not in my owned paths.

## Not verified

- I did not confirm the new tests fail against the old code first. I wrote them after the implementation and did not stash, because that changes git state.
- The full fluxiq vitest suite was not run, in line with the narrow-check rule. Other callers of `AutomationStudioProjectReusableLlmContextStore.open` with a protection now open the keyring at open. A protection whose host key cannot open the current key row now fails the open, where it used to fail only on read. The four related test files pass.
- I have not checked how this interacts with u2's parallel changes to `content-store.ts` and `object-repository.ts` (which also touch 0033 and objects), beyond these files compiling together today.

## Open questions or contradictions found

- 0035 is run only by this store, as the brief specified. I did not check whether the project-wide migration list (`P/schema.ts` or the database owner) should also include 0033 and 0035. Two runners that apply different subsets in ascending order are allowed by the runner: ids it does not know are ignored.
- The rekey pass runs on every protected open. When nothing is stale it costs one query, which scans by primary key because no index can name the current key. That is fine for this table's sizes.
- `content-address/open-keyring.ts:65` (u1) is flagged failure-as-empty by the audit. That is u1's file, not mine.
