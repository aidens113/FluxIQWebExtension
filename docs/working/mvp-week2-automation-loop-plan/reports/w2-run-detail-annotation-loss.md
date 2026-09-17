# w2-run-detail-annotation-loss — worker report

Repository: FluxIQ Core (`F:\!FluxIQ`). `AS/` = `packages/fluxiq/src/programs/automation-studio/`.
Nothing committed or pushed. No live provider calls were made.

## Outcome

Done. The root cause is found and reproduced in a test that fails on the unmodified
code and passes after the fix. Every save of a run detail now merges onto what is
already stored, so a detail rebuilt from the bare session can no longer replace an
annotated one. An unreadable run index is now an error, never "empty". Two
further existing defects on the same save path were found and fixed, both proved
by tests that fail on HEAD.

## Root cause, in plain terms

A run listing that matched no stored run re-wrote every run in the project from
its raw session, dropping everything the recovery annotation had added.

- `AutomationStudioSummaryStore.ensureFlowRunSummaryIndex` (`AS/runtime/service/summaries/store.ts`)
  read the legacy JSON run index (`indexes/runs.json`) with `.catch(emptyFlowRunIndex)`.
  When the index was empty (or unreadable), it called
  `saveFlowRunDetail(runtimeSessionToFlowRunDetail(session))` for **every** session in the project.
- With the typed runtime store in use (every Core with a data directory), `saveFlowRunDetail`
  writes only to the typed store and never writes `runs.json`. So that index is **always empty**,
  and the rebuild ran every time anything reached it.
- Two callers reach it:
  - `listFlowRunSummaries`, whenever the typed store answers with `total: 0`. That covers any
    filter matching nothing: a `flowId` with no runs yet, a status with no runs, or a search miss.
    It also covers any typed-store error, because `tryWithRuntimeStreamStore` swallows every error
    and returns `null`.
  - `service.ts` `listFlowRunActions` (line ~3556), when the typed store returns `total: 0` with
    `offset > 0`, or fails.
- The test runner calls `list-flow-runs` with a `flowId`:
  - `packages/test-runner/src/existing-fluxiq-control.ts:377`, used by `demo-workspace/creation-lanes.ts:139`,
  - `demo-workspace/adaptation-lane.ts:229`,
  - `demo-llm-adaptation-readiness.ts:133`.

  Listing a Flow that has no runs yet therefore rebuilt every run in the project.
- What the rebuild did to each run:
  - Each rebuilt save appended a new `run_summary` envelope event (the latest envelope wins on
    read) and replaced `runtime_runs.summary_json`.
  - Metadata became the projection keys plus `adaptiveMetrics` plus `eventStream`, exactly the
    shape observed live.
  - The summary lost `tokenUsage`, `interventionSummaries`, `interventionCount` and
    `adaptationCount`.
  - The envelope lost `adaptationIds`, `changeProposalIds`, `evidence`, `llmGate`,
    `runtimeAdaptationContext`, `trainingMode` and `runtimePatchAttempts`.
  - Action and intervention events survived, because the stream only appends new ids.

### Which trigger the reproduction needs (coordinator's question)

Only the empty listing; no restart is required. Temporary probes, since removed, established this:

- **No loss:** the annotation survived apply, two replays, one restart, two restarts, listings
  that returned rows (`flowId` with runs, unfiltered, adaptations, runtime sessions), and
  `createFlow`.
- **Loss:** it was gone right after `listFlowRunSummaries({ flowId: <flow with no runs> })`.

This fits `bc1f0545` keeping its record: nothing between its repair and revert listed an empty
Flow. **The link to restarts is not confirmed.** Two plausible explanations, neither reproduced:

1. After a restart the Lab prepares or lists a Flow before it has runs.
2. Any error opening or reading the typed store right after a restart (for example, while the old
   process still holds the database) makes `tryWithRuntimeStreamStore` return `null`, and the
   listing falls through to the same rebuild.

The reproduction test still includes an apply, two zero-LLM replays and three restarts.

## What changed and why

All paths below are under `AS/`.

- `runtime/service/summaries/run-detail-merge.ts` (new): `runDetailPreservingStored(stored, incoming)`.
  - The incoming detail wins for every key it carries, including a key set to `undefined`.
  - A stored key the incoming detail lacks is kept, except two groups:
    - keys the session projection owns (`terminalFailureReason`, `message`, etc.), so a stale
      failure reason is not carried;
    - keys that stores recompute or reads decorate (`adaptiveMetrics`, `eventStream`,
      `collectionsPaged`, `lastEventSequence`, `errorCount`).
  - Collections merge by record id: stored order first, the incoming version replaces a stored
    one. `adaptationIds` and `changeProposalIds` are unioned.
  - Summary `flowVersion` and `tokenUsage` are carried. Counts and token usage are then
    recomputed from the merged collections.
- `runtime/service/summaries/run-detail-writer.ts` (new): `AutomationStudioRunDetailWriter`.
  This moves run-detail saving out of the summary store and adds:
  - per-run serialized read-merge-write;
  - strict saves for a run the typed store already holds: a refusal now throws instead of
    writing a JSON copy that reads never consult;
  - for a refused run the store never held: keep its summary row (so listings still show it),
    then fall back to the legacy JSON detail as before;
  - when the typed store has no detail, the legacy JSON detail counts as "stored", so moving a run
    into the typed store drops nothing;
  - `hasStored`, which answers whether any readable detail exists in either store.
- `runtime/service/summaries/run-detail-lock.ts` (new): a keyed promise chain per `(projectId, runId)`.
  The project database lease is shared, not exclusive.
- `runtime/service/summaries/store.ts`:
  - `saveFlowRunDetail` delegates to the writer.
  - `ensureFlowRunSummaryIndex`:
    - no longer catches read errors (an unreadable index throws `ProgramStateReadError`);
    - no longer swallows `listRuntimeSessions` errors;
    - rebuilds only sessions with **no** stored detail.
  - `ensureFlowAdaptationSummaryIndex`, `ensureFlowInstructionSummaryIndex`,
    `ensureFlowSubflowSummaryIndex` and `ensureRuntimeSummaryIndex` no longer turn a read error
    into an empty index.
  - `listFlowRunSummaries` treats the typed store as authoritative once it holds any run, so an
    empty filtered result is an answer, not a fallback.
  - `tryPersistRuntimeRunDetail` was removed; the writer replaces it.
  - Size: 30 methods and 670 lines at HEAD, now 29 methods and 660 lines.
- `runtime/service/summaries/index.ts`: the barrel exports the three new modules. This barrel is
  internal; `runtime/index.ts` exports `service.ts`, not `service/`.
- `storage/project/runtime-stream-store.ts`:
  - `putRunDetail` validates every action row before it writes the summary row or any event.
  - `appendRuntimeEvents` builds and validates the rows before writing the chunk
    (`projectActionSummaries` is split into `runtimeActionSummaryRows` and `writeActionSummaries`).
  - The action definition id now accepts any stored value of up to 1000 characters with no
    control characters. Call Flow nodes are `composite.flow.<encoded id>@<version>`, which the key
    pattern rejected.
  - Existing defects, both proved on HEAD by the new store tests:
    1. The typed store rejected every Call Flow action. The service swallowed the error and wrote
       a JSON detail that reads never consult, so a Call Flow run read back its stale earlier
       envelope.
    2. A rejected batch left its chunk written with `last_event_sequence` unchanged, so the run's
       next save failed with `SQLITE_CONSTRAINT: UNIQUE constraint`.
- Tests:
  - `runtime/service/summaries/tests/run-detail-preservation.test.ts` (new, 3 cases):
    - repair, then approve and apply of an `edit_action_target` adaptation, two replays on a
      provider-less restarted Core, empty listings, an action page past the end, a bare-projection
      re-save and restarts; the snapshot of the annotation must be unchanged at every read;
    - an unreadable `runs.json` makes the listing reject, and the annotation survives;
    - a refused save over a held run throws, while a never-held run stays listed, reads from the
      legacy detail, and moves over intact.
  - `runtime/service/summaries/tests/run-detail-merge.test.ts` (new, 5 cases).
  - `runtime/service/summaries/tests/run-detail-lock.test.ts` (new, 2 cases).
  - `storage/project/tests/runtime-stream-store.test.ts`: two new cases (a Call Flow definition id,
    and a refusal that writes nothing and keeps the stream consistent).
  - Per the coordinator's second message, the preservation test no longer depends on the model
    being suppressed. It snapshots whatever the annotation holds right after the repair, creates its
    own `edit_action_target` adaptation to approve and apply, and runs the replays on a Core with no
    provider configured.

## Commands run and observed results

- Reproduction on unmodified code. I swapped HEAD `store.ts` and HEAD `runtime-stream-store.ts`
  back in and ran `npx vitest run …/summaries/tests/run-detail-preservation.test.ts --root packages/fluxiq`.
  Result: `Tests 3 failed (3)`.
  - Line 176, the annotation check right after the empty listings: `expected undefined to match object` / snapshot mismatch.
  - Line 203: `promise resolved "{ actions: [], total: +0 … }" instead of rejecting` (unreadable index treated as empty).
  - Line 228: `promise resolved … instead of rejecting` (refused save silently written to JSON).
- New store tests on the HEAD store:
  - `Error: Invalid action definition ID.`
  - `expected … 'Invalid action definition ID.' but got 'SQLITE_CONSTRAINT: UNIQUE constraint …'`
- Negative probes. Each disabled one piece, ran the test, then restored the file (restoration
  checked with `diff -q`):
  1. merge off: fails at the bare-projection re-save.
  2. index catch restored: the unreadable-index case fails.
  3. merge on, skip-stored off, typed-authority off: passes (the merge alone protects).
  4. merge off, skip off, authority on: fails at the check after the action-page rebuild (line 142 at the time).
  5. merge off, skip on, authority off: fails only at the re-save.
  6. all three off: fails at the check right after the empty listings.
  7. lenient writer (JSON fallback over a held run): the refused-save case fails, "resolved instead of rejecting".
  8. legacy detail not treated as stored: fails at the move-over check (line 239).
- Final state:
  - `npx vitest run src/programs/automation-studio/runtime/service/summaries src/programs/automation-studio/storage/project/tests/runtime-stream-store.test.ts --root packages/fluxiq`
    gave `Test Files 5 passed (5)`, `Tests 24 passed (24)`.
  - Core `pnpm check` (final, after all changes): exit 0.
    - `# pass 105 / # fail 0`.
    - `structure-audit: passed (148 warning(s), 254 baselined)`.
    - `packages/contracts`, `client-gateway-websocket`, `packages/fluxiq` and `apps/web` all printed `check: Done`.

    Earlier runs in between failed only on other workers' in-progress files:
    `runtime/recovery/stages.ts` TS2304, and `runtime/tests/live-patch.test.ts` at 876 lines.
  - `npx tsc --noEmit` in `packages/fluxiq` (final): exit 0.
  - `npx vitest run src/programs/automation-studio/runtime --root packages/fluxiq` (final):
    `Test Files 2 failed | 125 passed (127)`, `Tests 4 failed | 1316 passed (1320)`. None of the failures are mine:
    - three in `runtime/flow-bootstrap/plan/tests/catalog.test.ts`, which another worker has
      modified (`catalog.ts`, `catalog.test.ts` and a new fixture are uncommitted in the tree);
    - `instruction-readiness.test.ts` at the 15 s timeout under load. Alone it passes in 4.7 s and
      6.8 s with my `store.ts`, and 5.0 s with HEAD `store.ts`.
  - Earlier full runs also showed load timeouts, EBUSY and one `SQLITE_CORRUPT` (`generation.test.ts`).
    Each passed when rerun alone (`generation.test.ts` 8/8, `scale-pages` 3/3, `durable-patches` 3/3,
    `canonical-persistence` 9/9).
- Cost of the extra read before each save: `durable-patches` + `runs.test.ts` took 6.6 to 9.7 s
  with the merge read and 7.0 to 8.5 s without it. That is within noise.

## Not verified

- No live run. The live trigger is identified from the code path and the test runner's call sites,
  not from live logs.
- The restart correlation (see above).
- Whether the two damaged live runs (`8cd04d2b`, `3cc4bd79`) still hold their earlier annotated
  `run_summary` envelopes in `runtime_event_chunks`. They should, because the stream only appends,
  but I did not look. The read uses the **latest** envelope, and this fix does not restore them. A
  one-off repair would need to re-save the last envelope that carries `llmGate`. Not done.
- `apps/**` and the web extension were not exercised against the change.

## Open questions and other paths that can lose persisted run data

Paths in `service.ts`, which I must not touch. Exact changes are recommended; none were made.

1. `getFlowRunDetail` (line ~3539) swallows typed-store read errors through
   `tryWithRuntimeStreamStore`, then rebuilds from the session with
   `metadata: {...session.metadata, partialWriteRecovery}`.
   - It no longer loses data, because the save merges, and the writer's own read is strict.
   - Recommended: call the typed store through a variant that returns `null` only when the store is
     not configured, and rebuild only when neither store holds the run.
2. `writeRuntimeSession` (line ~4900) saves the bare projection on every session write. This is now
   safe because every save merges.
3. `listFlowRunActions` (line ~3556) falls back to `ensureFlowRunSummaryIndex` when the typed store
   returns `total: 0` with `offset > 0`. Now safe: the rebuild skips stored runs, and an unreadable
   index throws.
4. Line 2823: `resolveRuntimeAdaptationContext` does `listFlowRunSummaries(...).catch(() => [])`.
   A listing failure, which the fail-closed index can now produce, silently becomes "no prior runs"
   for the stability metrics. Recommended: let it propagate.
5. Line 4779 reads the subflow index with `.catch(() => emptyFlowSubflowIndex())`, the same
   "unreadable reads as empty" pattern.

Other paths, not fixed:

6. `tryWithRuntimeStreamStore` and `tryWithAdaptationStore` (summary store) swallow every error. If
   the typed store cannot be opened, a listing now falls back to the legacy path and writes JSON
   copies of runs that have no readable detail. It never overwrites typed details, but the error is
   still hidden.
7. `runtime-stream-store.ts` reads at most 5000 events in both `getRunDetail` and `putRunDetail`.
   For a run with more events, the envelope read can be a stale one, and a save merges onto it.
8. `putRunDetail` appends non-summary events only for **new** ids. A record whose id already exists
   but whose content changed (for example, an action attempt's status) is never re-written, and the
   typed read returns the first version. So "incoming version wins" holds only for the envelope and
   the JSON path.
9. Projects that hit the old half-write (Call Flow runs) may hold chunks beyond
   `last_event_sequence`. The next save of such a run now fails loudly with a UNIQUE constraint
   instead of silently. They are not repaired.
10. `storage/project/compiled-plan-store.ts:204-209` writes `runtime_runs` rows (status and counts)
    directly. It does not touch the envelope or `summary_json`, so it causes no annotation loss.

The coordinator's point about defect D-2 is addressed: the test asserts only that the annotation
survives, and the replays cannot reach a model because their Core has no provider.
