# w2-c5-graph-store-provenance

Brief: C-5 (design `w2-back-half-design.md` sections 2.6 and 2.7, and row C-5 in section 8). Repository: FluxIQ Core.
`AS/` = `packages/fluxiq/src/programs/automation-studio/`. Nothing was committed.

## Outcome

Done. Four pieces are in:

- the `set_node_metadata` graph operation, with an inverse;
- migration `0020_adaptation_matching_columns`;
- mapping of the new columns in the adaptation store, with list filters and a backfill of older rows;
- stamping `adaptationIds` onto every node an applied change writes. Rolling the change back removes the stamp.

Every item was tested failing first. `pnpm check` exits 2, but the only errors are type errors in another worker's in-progress files (see Commands). None are in storage files.

## What changed and why

### Files

- `AS/storage/project/graph-store.ts` (owned)
- `AS/storage/project/schema/adaptation-matching.ts` (new, owned)
- `AS/storage/project/schema/index.ts` (owned)
- `AS/storage/project/adaptation-store.ts` (owned)
- `AS/storage/project/administration.ts`. Not in the brief; the supervisor granted it mid-task for one change: registering the migration.
- Tests:
  - `AS/storage/project/tests/graph-store.test.ts`
  - `AS/storage/project/tests/adaptation-store.test.ts`
  - `AS/storage/project/tests/administration.test.ts` (the test the supervisor asked for)
  - `AS/storage/project/schema/tests/adaptation-matching.test.ts` (new; placed as `a/b.ts` → `a/tests/b.test.ts`)

### The migration's exact schema change (`0020_adaptation_matching_columns`)

```sql
alter table adaptations add column failure_signature text check (failure_signature is null or length(failure_signature) between 1 and 512)
alter table adaptations add column confidence_tier text check (confidence_tier is null or confidence_tier in ('unverified', 'provisional', 'established'))
alter table adaptations add column origin_entry_point text check (origin_entry_point is null or origin_entry_point in ('instruction', 'run_failure', 'edge_case'))
create index adaptations_flow_failure_signature_idx on adaptations (flow_id, failure_signature, updated_at_ms desc, adaptation_id desc)
create index adaptations_unmapped_matching_idx on adaptations (adaptation_id) where confidence_tier is null
```

**Why it is safe on an existing database.** All three columns are nullable and have no default. The statements only add columns and indexes; no row is rewritten. The runner applies all five statements in one transaction, and a test proves a failure rolls all of them back. Registration is one import and one list entry in `AUTOMATION_STUDIO_PROJECT_ADMINISTRATION_MIGRATIONS`, after `0019_run_datasets`.

**Import path.** `administration.ts` imports from `./schema.ts`, which re-exports `./schema/index.ts`. My message to the supervisor said `./schema/index.ts`. I added the name to the existing `./schema.ts` import instead: the effect is the same and the diff is smaller.

**Why the second (partial) index exists.** Every store write sets a tier, so a null tier means "written before 0020". The store fills those rows when it opens. The partial index lists only unmapped rows, so once they are filled, each open costs one probe of an empty index.

### Graph store

- **The operation.** `set_node_metadata { nodeId, metadata: JsonObject }` replaces a node's whole metadata object and leaves every other field as it was.
  - Its inverse is `set_node_metadata` with the node's previous metadata.
  - Its operation record kind is `set_node_metadata`.
  - It throws `Unknown node` for a missing node, as the other node operations do.
  - A rollback artifact is read back from JSON, so a value that is not a JSON object is refused ("Node metadata must be a JSON object.") and nothing is written.
- **Why whole-object replacement.** It matches `set_node_parameters`. Suppose adaptation B changed a node after adaptation A, and A is then rolled back. The parameter inverse already undoes B's parameters on that node; restoring the whole metadata undoes B's stamp too. The node then lists neither change, which is consistent. Removing only A's id would leave B's stamp claiming a change that is gone.
- **New export: `automationStudioGraphPatchRequestDigest(input)`.** `applyPatch` now builds its request through the same private function, so the two cannot drift. The adaptation store uses it for the retry case below.

### Adaptation store

**Column mapping.** The three values are derived from the saved record on every write, so they cannot drift from it. This happens in `putAdaptation` (insert and upsert), `supersedeAdaptation`, `rebaseAdaptation`, `rollbackAdaptation`, `setAdaptationStatus`, and the apply status update.

- **`failure_signature`:**
  - `metadata.failureSignature` first. `live-patch.ts` writes it there, and C-2's gate (`adaptive-orchestrator.ts:236`) matches on it.
  - Otherwise the origin's `failureSignature`.
  - A value outside 1-512 characters is left out rather than failing the write.
- **`confidence_tier`:** `decideAutomationStudioChangeConfidence({ validationResults, riskLevel })`, using the record's canonical risk (including `destructive`). It is never copied from a stored tier. The stored decision's `replaysRequired` already includes the risk adjustment, so feeding it back in would add it twice.
- **`origin_entry_point`:** read only through `parseAutomationStudioFlowChangeOrigin(metadata.origin)`.

**Other store changes.**

- The summary record gains `failureSignature`, `confidenceTier` and `originEntryPoint` (each can be null).
- `listAdaptationsPage` gains `failureSignature` and `confidenceTier` filters. An unknown tier throws `Unknown confidence tier`.
- **Backfill on open.** `open()` fills rows that have no tier, in batches of 200, only where the tier is still null. A row whose `status_detail_json` no longer parses gets no signature, no entry point, and `unverified`.

**Stamping.** `graphPatchOperationsForAdaptation` appends one `set_node_metadata` per node that an `edit_action_target` or `edit_expectation` patch writes.

- The value is `withAutomationStudioNodeAdaptationId(previous metadata, adaptationId)`, from `flow-change`.
- Each node is stamped once, after all of that node's parameter writes. Two patches on one node give one stamp.
- The inverse is restored whole, so the rollback artifact removes the stamp. A test covers apply, then rollback.
- **Route-only changes stamp no node.** An `edit_router` change only adds an edge, and that edge already carries `metadata.adaptationId`. Design 2.6 says "every node a change writes or creates", and this change writes none. Stamping the edge's source node would make every later run of that node claim the new route was exercised, even runs that never took it.

**`appliedTo` is deduplicated.** A stamped node would otherwise appear twice, and two patches on one node already produced duplicates.

**Retrying an apply that committed before stamping existed.** An existing test ("keeps parent API scope while applying and revision-checking an owned Subflow graph") simulates this. The graph patch committed, but the adaptation's status was not updated. Once stamping was added, the retry's request no longer matched the committed digest, and the retry was refused ("already used with a different request digest").

- **The fix.** When the mutation is already committed, `operationsForCommittedApply` compares digests. If the stamped request does not match but the same request without its stamp operations does, the store replays the unstamped request.
- **The result.** That pre-upgrade apply finishes, and the node honestly carries no stamp.
- **A stamped apply that is retried** replays the stamped request. This is tested: the Flow revision stays at 3.

## Commands run and observed results

All commands ran in `F:\!FluxIQ` or `F:\!FluxIQ\packages\fluxiq`.

1. **Failing first**, before any source change:

   `npx vitest run <graph-store, adaptation-store, administration, schema/tests/adaptation-matching>`

   Result: `Test Files 4 failed (4)`, `Tests 6 failed | 22 passed (28)`. The reasons:
   - the migration constant was undefined (`reading 'id'`) and the new test file failed to import;
   - `set_node_metadata` fell through to the edge branch (`reading 'trim'`);
   - `SQLITE_ERROR: no such column: failure_signature`;
   - the column assertions failed.

   The route-only test passed, as expected: it pins a decision rather than a new behaviour.
2. **After implementation**, the same command:
   - First run: 4 failures. Two were my fixture mistakes: `patch_object_id` has a foreign-key guard to `objects`, and the EBUSY error followed from it. The other two were the stale-digest retry described above.
   - After fixing both: `Test Files 4 passed (4)`, `Tests 32 passed (32)`.
   - Rerun after the final whitespace fix: 32 passed.
3. **Package type check**, `npx tsc --noEmit` (`packages/fluxiq`): exit 2 with one error, `runtime/service/run-detail-read/tests/configured-runtime-stream-store.test.ts(18,14): Property 'close' does not exist on type 'AutomationStudioProjectDatabasePool'`. That directory is untracked and belongs to another worker.
4. **Structure audit**, `node scripts/structure-audit.mjs`: exit 0, `passed (150 warning(s), 254 baselined)`.
   - My files only add to line-count advisories they already had: `adaptation-store.ts` 580 lines (was 487) and `graph-store.ts` 440 (was 413), against a 400-line advisory and an 800-line limit.
   - The one entry that could be lowered (`--json`) is `runtime/service.ts` file-lines (6415 against 6422 recorded). It is not mine, and I did not run `structure:baseline`.
5. **Storage suite**, `npx vitest run src/programs/automation-studio/storage`: `Test Files 37 passed (37)`, `Tests 181 passed (181)`.
6. **Adaptation-related suites**, `npx vitest run runtime/tests/service-adaptation runtime/tests/service-flows/tests/execution-digest.test.ts runtime/service/tests api`: `Test Files 26 passed (26)`, `Tests 106 passed | 2 skipped`.
7. **Full runtime suite**, `npx vitest run src/programs/automation-studio/runtime`: 25 failures.
   - 24 are in `runtime/tests/training-modes.test.ts` and `runtime/recovery/tests/adaptation-promotion.test.ts`. The promotion-gates worker (C-8) has these modified or untracked. The errors are missing exports (`adaptationConfidence is not a function`, `decideAutomationStudioBootstrapApplyGate is not a function`). None involves storage.
   - 1 is `runtime/tests/service-flows/tests/instruction-readiness.test.ts`, which timed out at 15000 ms. Run alone, it also timed out (15005 ms). With `--testTimeout 200000` it passed in 16488 ms. See Not verified.
8. **Core `pnpm check`**: exit 2.
   - `structure:test`: 105 passed, 0 failed.
   - `structure-audit`: passed.
   - `packages/contracts` and `packages/client-gateway-websocket`: Done.
   - `packages/fluxiq` `tsc`: 8 errors, all in `adaptation-promotion.test.ts` and `training-modes.test.ts` (another worker's in-progress work). 0 are in `storage/`.
   - The recursive run stopped there, so I ran the web app's check separately: `apps/web`, `npx tsc --noEmit`, exit 0.
9. **Framework reference**, `node scripts/docs-reference.mjs --check`: exit 1, "framework-reference.md is stale".
   - It was already stale before this change: the committed file lists 1619 declarations, and a fresh generation lists 1874.
   - I generated a copy into my scratchpad only; `docs/` is untouched. My two new exports appear in it, at lines 155 and 492 (`AUTOMATION_STUDIO_PROJECT_ADAPTATION_MATCHING_MIGRATION`, `automationStudioGraphPatchRequestDigest`).
   - `pnpm check` does not run this step.
   - While preparing that copy I briefly wrote a temporary file under Core's `scripts/` and moved it to my scratchpad in the next command. `git status --short scripts docs` is clean.
10. `npx biome lint <my files>`: biome's configuration ignores these paths, so it checked nothing.

## Not verified

- **The instruction-readiness timeout.** I could not show it is unrelated by an A/B run: two other workers were running full runtime vitest suites at the same time (seen in the process list), so timing is noisy. By reading the code:
  - `saveFlowInstruction` never opens the adaptation store;
  - my only change on its path is one more migration checksum per database open, which costs microseconds.

  That supports load, not my change, as the cause, but it rests on analysis plus one loaded observation.
- **The full `pnpm check` exit 0** was not observed, because of the other worker's type errors. I saw no error in any storage file.
- **No live or browser runs.** The brief says no live calls.
- **Not exercised end to end:**
  - the executor (C-4) reading the new stamps into attempts;
  - the known-adaptation gate (C-2) querying the new column;
  - backfill batching past 200 rows (only single-batch cases are tested);
  - concurrent opens racing on the backfill. By reading: each update is guarded by `confidence_tier is null` and is idempotent.
- **The design's `records` and replay pieces are not part of this brief.**

## Open questions or contradictions found

1. **The brief left out `administration.ts`**, the only file where migrations are registered. The supervisor granted it mid-task. The design's C-5 row has the same gap.
2. **Two places can hold a failure signature**: `metadata.failureSignature` (written by live patches and read by C-2) and `metadata.origin.failureSignature` (design 2.1).
   - The column uses the metadata value first, so it agrees with the gate C-2 actually implements.
   - If C-6 writes both, they should match. Otherwise the column and the gate follow the metadata value, and the origin's signature is ignored.
3. **Route-only changes stamp no node** (reasoning above). The replay recorder (C-10) will therefore never see a router change as exercised through node provenance. It would need route evidence, such as the edge's `metadata.adaptationId` on the route that was taken.
4. **The tier column assumes the default replay requirement** (2, plus 1 for high or destructive risk). If C-8 or C-12 introduce a per-change `replaysRequired`, `adaptationMatchingColumns` must learn it, or the column will disagree with `metadata.confidence`.
5. **Existing behaviour, not changed.** When two patches in one adaptation target the same node, each `set_node_parameters` is built from the node as stored in the database, not from the previous patch's values. The second write therefore replaces the first (visible in the stamp test: the final target is `#submit-1`). This is out of scope for this brief. The C-11 operation builders should build each node's values once.
6. **`docs/reference/framework-reference.md`** is stale across the repository and needs `pnpm docs:reference` from whoever owns `docs/` (C-13 or the supervisor).
