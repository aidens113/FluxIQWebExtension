# w2-core-silent-reads — worker report

Repository: FluxIQ Core (`F:\!FluxIQ`). `AS/` = `packages/fluxiq/src/programs/automation-studio/`.
Nothing was committed or pushed, and no live provider calls were made.

## Outcome

Done. All five items are fixed. Each has a test that fails on the unchanged
code for the intended reason and passes with the change. `service.ts` went from
6422 to **6415** lines. Core `pnpm check` exits 0, and the whole runtime suite
passed (134 files, 1383 tests passed, 1 skipped).

While fixing item 4, a sixth problem turned up in the same owned file and was
fixed with its own failing-first test. `bootstrap-adaptations.ts` read any
failure to list a directory as "no records".

## What changed and why

### Item 1: `getFlowRunDetail` no longer swallows typed-store errors

- New directory `AS/runtime/service/run-detail-read/`:
  - `configured-runtime-stream-store.ts`: `withConfiguredRuntimeStreamStore(access, projectId, operation)`.
    - It returns `null` **only** when the service has no typed store (no database pool, or no storage root).
    - A store that cannot be opened is an error, and so is an operation that fails. The store is always closed.
    - The summary store's `tryWithRuntimeStreamStore` returns `null` for all three cases, so a reader could not tell them apart.
  - `flow-run-detail-reader.ts`: `readAutomationStudioFlowRunDetail(ports, projectId, runId, options)`.
    It holds the old body of `getFlowRunDetail`, with the typed read made strict:
    1. the typed store;
    2. then the legacy JSON detail;
    3. then a rebuild from the session, saved with `partialWriteRecovery`.

    The rebuild still happens only when neither store holds the run. `getRuntimeSession` and
    `saveFlowRunDetail` are passed as closures over the service's public methods, so an override
    on those methods is still honoured. `facade-ports.ts` was off limits, so they could not be
    added there.
  - `index.ts`: the barrel.
- `service.ts` `getFlowRunDetail` now calls `findProject`, then delegates to the reader: 17 lines became 6.

Files changed or added (all under `AS/runtime/`):

- modified: `service.ts`, `service/bootstrap-adaptations.ts`, `executor/graph-run.ts`, `executor/tests/graph-run.test.ts`;
- new: `service/run-detail-read/{index,configured-runtime-stream-store,flow-run-detail-reader}.ts`,
  `service/run-detail-read/tests/{flow-run-detail-reader,configured-runtime-stream-store}.test.ts`,
  `service/tests/bootstrap-adaptations.test.ts`,
  `tests/service-adaptation/tests/context-history-reads.test.ts`,
  `tests/service-bootstrap/tests/older-record-apply.test.ts`,
  `tests/service-flows/tests/subflow-index-read.test.ts`.

No other path was touched. No fixture outside these files was needed.

### Item 2: `resolveRuntimeAdaptationContext`, `service.ts` ~2823. Decision: propagate, for all three reads

| Read | Before | Now |
| --- | --- | --- |
| `listFlowRunSummaries` (recent runs) | `.catch(() => [])` | **Propagates** |
| `listFlowAdaptationSummaries` (recent adaptations) | `.catch(() => [])` | **Propagates** |
| `getFlowAdaptation` per listed summary (known adaptations) | `.catch(() => null)` | **Propagates** a read error. An absent record (`null`) is still skipped. |

Why propagate rather than fail closed:

- The recent runs feed the training budget (`runtimeTrainingBudgetStateFromSummaries`), the
  stability score and `runsCompleted`. An empty list means "budget unused, no history", which
  fails **open**. There is no "closed" budget state the caller could use without inventing one.
- The adaptation summaries and records feed the stability score and the known-adaptation gate.
  With an empty list, a failure matching a known adaptation looks new.
- A fail-closed context would have to change the run's behaviour silently (for example, deny the
  model) while hiding a storage fault.

The consequence: the run's **start** fails with the storage error. See Open questions 1, which
covers the session left behind.

### Item 3: subflow index, `service.ts` ~4779 (now ~4772)

`withCanonicalFlowHierarchySubflows` reads the index without a catch. `ProgramJsonStore.read`
already returns empty for a **missing** file and throws `ProgramStateReadError` for a malformed
one. The now-unused `emptyFlowSubflowIndex` import was removed.

### Item 4: `AS/runtime/service/bootstrap-adaptations.ts`

- A new private function, `storedBootstrapAdaptation(stored)`, asserts that the record carries no
  recording provenance, as before, and returns `upgradeAutomationStudioBootstrapAdaptation(...)`.
- All four stored-record reads use it: `getFlowBootstrapAdaptation`, the project listing, and both
  branches of the Flow listing.
- The memory cache now holds the upgraded copy.
- **Extra fix (same file):** the three `readdir(...).catch(() => [])` calls became
  `directoryEntries(dir)`, which returns `[]` only for `ENOENT` and rethrows everything else
  (for example `ENOTDIR`, `EACCES`).

### Item 5: `AS/runtime/executor/graph-run.ts` ~228

The region-timeout fallback attempt is now built through `nodeAttemptWithAdaptationIds(currentNode!, {...})`,
imported from `./attempt-trace.ts`. The cancelled variant in `executeWithRegionTimeout`
(`{ ...timeoutAttempt(), status: "cancelled" }`) is covered by the same wrap.

### Tests (all new except the `graph-run.test.ts` block)

- `AS/runtime/executor/tests/graph-run.test.ts`: new describe "an attempt a region timeout ends", 3 cases:
  - a timeout on an adapted node names its ids;
  - a cancellation while the region waits names them;
  - an unadapted node gets no field.
- `AS/runtime/service/tests/bootstrap-adaptations.test.ts`: 8 cases, run under two layouts: plain
  JSON files, and SQLite program state (a `config.json` with `layoutVersion: 2`).
  - Every layout: a read by id upgrades the record (twice, so the cached copy is checked); both
    listings upgrade it.
  - Plain files only: an `adaptations` path that is a file makes both listings reject with `ENOTDIR`,
    while a missing directory still lists `[]`. This case is skipped under SQLite, which does not
    list adaptations from disk.
- `AS/runtime/tests/service-bootstrap/tests/older-record-apply.test.ts`: generate and approve a
  bootstrap, rewrite the stored record to the older shape (no `mode`, no `origin`, and the two node
  `adaptationIds` removed), restart, apply, then revert.
- `AS/runtime/service/run-detail-read/tests/flow-run-detail-reader.test.ts`, 4 cases:
  - `getRunDetail` rejects: the read rejects and nothing is written over the run;
  - the store's `open` rejects: the same;
  - a session with no detail in either store is still rebuilt and kept;
  - an unknown run reads `null`.
- `AS/runtime/service/run-detail-read/tests/configured-runtime-stream-store.test.ts`, 5 cases:
  - `null` with no pool, and `null` with no root, without calling the operation;
  - the operation's own `null` and value are passed through, and the store is closed;
  - a failed open throws;
  - a failed operation throws and still closes the store.
- `AS/runtime/tests/service-adaptation/tests/context-history-reads.test.ts`, 5 cases:
  - a malformed `indexes/runs.json` on a Flow with no runs makes the context reject;
  - an `adaptations` path that is a file makes it reject with `ENOTDIR`;
  - `getFlowAdaptation` rejecting makes it reject;
  - `getFlowAdaptation` returning `null` is skipped;
  - `runRuntimeSession` rejects when `listFlowRunSummaries` rejects.
- `AS/runtime/tests/service-flows/tests/subflow-index-read.test.ts`, 2 cases:
  - a malformed `indexes/subflows.json` makes `listAutomationFlowSummaries` reject (it listed one
    Subflow before the file was corrupted);
  - a project with no subflow index yet still lists its Flow.

## Commands run and observed results

All vitest commands were run from `F:\!FluxIQ\packages\fluxiq` with `npx vitest run <path>`.
"HEAD file" means the owned file was temporarily replaced by `git show HEAD:<file>`, then restored
from a scratch copy, and the restore was confirmed with `cmp`.

- **Item 5, `executor/tests/graph-run.test.ts`, before the fix:** `Tests 2 failed | 20 passed (22)`.
  Both adapted cases were missing `adaptationIds`.
  - After the fix: `npx vitest run src/programs/automation-studio/runtime/executor` gave
    `Test Files 9 passed (9)`, `Tests 160 passed (160)`.
- **Item 4, `service/tests/bootstrap-adaptations.test.ts`:**
  - Before the fix: `Tests 6 failed | 2 skipped (8)`. Every failure was
    `expected undefined to be 'create'`, except the `ENOTDIR` case: `promise resolved "[]" instead of rejecting`.
  - With the fix (final version, project-wide case in both layouts): `Tests 7 passed | 1 skipped (8)`.
- **Item 4, `older-record-apply.test.ts`:**
  - HEAD file: `Error: Flow Bootstrap topology is not the Core-owned normalization of its validated plan.`
    This is the error the C-1/C-3 report predicted.
  - With the fix: `Tests 1 passed (1)`.
- **Items 1-3, HEAD `service.ts`** (the new test files present), running `context-history-reads`,
  `subflow-index-read` and `flow-run-detail-reader`: `Tests 7 failed | 4 passed (11)`.
  - Every failure was `promise resolved … instead of rejecting`.
  - The 4 that passed are the guard cases: rebuild, unknown run, absent record skipped, and no index yet.
- **Items 1-3 with the fix:**
  - `context-history-reads` + `subflow-index-read`: `Tests 7 passed (7)`.
  - `run-detail-read` (both files): `Tests 9 passed (9)`.
- **`npx tsc --noEmit` (packages/fluxiq):**
  - First run: exit 2. The 8 errors were all in another worker's in-progress files
    (`runtime/recovery/tests/adaptation-promotion.test.ts`, `runtime/tests/training-modes.test.ts`).
  - Rerun minutes later: exit 0, 0 errors.
- **Core `pnpm check` (F:\!FluxIQ): exit 0.**
  - `# pass 105`, `# fail 0`.
  - `structure-audit: passed (150 warning(s), 254 baselined)`.
  - `packages/contracts`, `client-gateway-websocket`, `packages/fluxiq` and `apps/web` all printed `check: Done`.
  - Among my files, the only warning is advisory: `executor/tests/graph-run.test.ts: 558 lines`
    (it was 514 lines, already past the 400-line advisory threshold).
  - The audit also printed `1 baseline entries can be lowered`. `node scripts/structure-audit.mjs --json`
    names it: `file-lines runtime/service.ts value 6415, recorded 6422`. I did not run
    `pnpm structure:baseline`, because `.structure-baseline.json` is not in my brief.
- **`wc -l runtime/service.ts`: 6415.**
- **Runtime suite: exit 0.** `npx vitest run src/programs/automation-studio/runtime` gave
  `Test Files 134 passed (134)`, `Tests 1383 passed | 1 skipped (1384)`, `Duration 129.74s`.
  - It ran once, with other workers' uncommitted changes in the tree (`recovery/adaptation-promotion.ts`,
    `training-modes.ts`, `storage/project/**`). No failures, so there was nothing to separate out and no rerun.
- **After that run,** the variable in `getFlowRunDetail` was renamed from `store` to `access` (no
  behaviour change). Then:
  - `npx tsc --noEmit`: exit 0;
  - `run-detail-read` + `context-history-reads`: `Test Files 3 passed (3)`, `Tests 14 passed (14)`;
  - Core `pnpm check` again: exit 0, the same audit summary, all four packages printed `check: Done`.
- **Probe: project-wide listing under the SQLite layout** (a temporary test file, since deleted).
  In a real service on a `layoutVersion: 2` data directory, `flows/<flowId>/` **does** exist on disk.
  After `createFlowBootstrapAdaptation`, both the per-Flow and the project-wide
  `listFlowAdaptationSummaries` listed the adaptation. See Open questions 3.

## Not verified

- No live run, and no browser or `apps/**` exercise.
- The older-record fix was tested on a record rewritten in a temporary directory, not on a real
  pre-`aab40c1` project database.
- An `EACCES` or `EIO` listing failure was not reproduced. Only `ENOTDIR` was, as a stand-in for
  "the directory exists but cannot be listed".
- In the SQLite layout, the `ENOTDIR` case does not apply: adaptations are listed from projected
  documents there, not from disk.

## Open questions or contradictions found

1. **A failed history read now leaves the run's session stranded.**
   - `runRuntimeSession` writes the session as `queued` (`startRuntimeSession`) before it resolves
     the adaptation context, and resolves it before its `try`/`finally`.
   - So a history read failure now leaves that session `queued`.
   - For an adaptive run, the next adaptive run in the project is refused ("Only one adaptive
     runtime run can be active per project") until that session is cancelled.
   - For an explicit LLM run, the grant is not revoked.
   - Neither is new: the existing "Code-owned Flow compilation is stale" refusal, and any throw in
     `materializeRecordingDerivedFlow`, already leave the session in that state.
   - Recommended follow-up (service.ts, not done because it widens the change past the brief): wrap
     the window from context resolution to the `try` so that a throw marks the session failed and
     revokes the grant, then rethrows.
2. **Other swallowed reads in `service.ts`, not in this brief.** Current line numbers:
   - 1566 `readFlowIndex(...).catch(() => emptyFlowSummaryIndex())`. This is the same function as
     item 3: a malformed flow index lists no Flows at all.
   - 1582 `readRuntimeIndex(...).catch(...)`.
   - 1194 `readPipelineIndex(...).catch(...)`.
   - 3091 idempotency `listRuntimeSessions(...).catch(() => [])`: a failed read can start a duplicate run for the same key.
   - 3113 adaptive admission `listRuntimeSessions(...).catch(() => [])`: a failed read admits a second adaptive run.
   - 3144 `getFlow(...).catch(() => undefined)` for the canonical Flow: a failed read skips the
     code-owned compilation check and runs with no adaptation context.
   - 2964/2967 `listFlowAdaptationSummaries` and `getFlowAdaptation` catches.
   - `tryWithRuntimeStreamStore` still swallows at 879, 3552, 3578, 4872 and 4887 (reads), and at 4844-4856 (writes).
     - 3552 and 3578 now reach the strict `getFlowRunDetail` on their fallback.
     - 4872 and 4887 do not.
   - `summaries/run-detail-writer.ts` `hasStored` (off limits) also uses the swallowing accessor, so
     a typed-store error there counts as "not stored" during the index rebuild. It could switch to
     `withConfiguredRuntimeStreamStore`.
3. **Latent: the project-wide bootstrap listing enumerates Flow directories on disk even under the
   SQLite layout.**
   - `listProjectFlowBootstrapAdaptations` calls `readdir(flows)`.
   - A real service creates those directories, as the probe showed, so this is not live today.
   - It depends on another writer creating them, though. A store-only test with no directory lists nothing.
   - A proper fix needs a deeper `ProgramJsonStore.listDirectoryDocuments` (`_shared/storage.ts`),
     or another source of Flow ids.
4. **`api/handlers/runtime-execution.ts:41`** does `getFlowRunDetail(...).catch(() => null)`. A
   failed read reports `durableBehaviorChanged: false` and no `runSummary` in the run API response.
   That file is outside my brief.
5. **Barrel:** `service/index.ts` (off limits) does not re-export the new `run-detail-read/` barrel.
   `service.ts` imports the directory's `index.ts` directly, which the imports rule allows. Add
   `export * from "./run-detail-read/index.ts";` to `service/index.ts` if the directory should be
   part of that surface.
6. **`upgradeAutomationStudioBootstrapAdaptation`** (flow-bootstrap, off limits) throws a bare
   `TypeError` when a stored record lacks `sourceInstructionIds` or `topology.subflows`. Listings
   now surface that instead of returning the malformed record. A named error would read better.
7. **Baseline:** run `pnpm structure:baseline` at commit time to record `service.ts` at 6415
   (it may also pick up other workers' changes).
8. **Docs:** no `docs/**` change was made. `pnpm docs:reference` may need a rerun for the new
   exports: `withConfiguredRuntimeStreamStore`, `readAutomationStudioFlowRunDetail` and their types.
