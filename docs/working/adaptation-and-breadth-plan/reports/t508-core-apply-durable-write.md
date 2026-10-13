# t508 core-apply-durable-write: worker report

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t508/!FluxIQ`, branch `task/t508-core-apply-durable-write`. Nothing was
committed.

## Outcome

Done. An apply that cannot write its updated Flow now fails and names why, on both apply paths, and no adaptation is
left recorded as applied:

- On the typed path, the graph change is rolled back, the adaptation is left `reverted`, and an `apply_failed` audit
  event is written.
- On the file-backed path, the half-written Flow is restored.

A node written by an adaptation patch carries the adaptation id on both paths. The file-backed path now stores the
revision it actually produced.

Two edits went beyond the brief's file list, both inside the apply path:

- `patches.ts` and `durable.ts`. Explained under Gap 3b.
- `adaptation-store.ts`, which is where Gap 2 actually lives.

## What changed and why

### Gap 3: typed apply hid a failed Flow write (`runtime/service.ts`, +2 lines)

- Before: `synchronizeCanonicalFlowGraphProjection(...).catch(() => undefined)`.
- Now: the rejection is captured, and the apply throws the error from
  `store.withdrawUnwrittenApply({ adaptationId, actorId, cause })`.
- The new store method (`storage/project/adaptation-store.ts`):
  1. Calls the existing `rollbackAdaptation`. The graph patch is inverted, and the row becomes `failed` with canonical
     `reverted`.
  2. Appends an `apply_failed` audit event.
  3. Returns `Adaptation <id> was not applied: the updated Flow could not be written (<cause>). Its graph change was
     rolled back.`
- If the rollback fails as well, the error says so: "...the graph holds a change the Flow document does not". In that
  case the row stays `applied`, because the graph really does hold the change.
- `judged-promotion.ts` already turns a thrown apply into `applied: false, notAppliedReason: "apply_failed"` with the
  error text. So "the apply result says not applied, with a reason" holds for runtime promotions without touching that
  file.
- I did not change the revert path's identical `.catch(() => undefined)` at the next line. The brief scoped Gap 3 to the
  apply.

### Gap 3b: the file-backed apply left a half-written Flow (`patches.ts`, `durable.ts`)

The fail-first test for the file-backed path showed a defect the brief did not list:

- `saveFlowInternal` writes the cached copy (`repositories.flows.put`) and then the document (`writeProjectFlow`).
- If the document write throws, the applier never pushes its mutation, so the durable rollback does not undo it.
- The apply rejected and the adaptation stayed `validated`. But `getFlow` still showed `#new`: the unapplied change was
  in effect in this process, and would vanish on restart.
- The parent Flow's `recordAppliedAdaptationOnFlow` save had the same hole. The test observed the parent's
  `appliedAdaptationIds` still listing the failed adaptation.

The fix:

- A new public method, `AutomationStudioAdaptationPatches.saveFlowOrRestore({ projectId, before, after, validation? })`.
  It saves `after`. If that throws, it saves `before` back and rethrows. If the restore also throws, the error names
  both failures.
- `applyFlowNodeAdaptationPatch`, the reroute branch of `applyRouterAdaptationPatch`, and
  `durable.recordAppliedAdaptationOnFlow` now use it.
- Router, Subflow and created-Subflow saves are not Flow documents and are unchanged. See Not verified.

### Gap 1: the file-backed apply did not stamp the node (`graph-flow-patch.ts`)

- The `edit_expectation` / `edit_action_target` branch now sets
  `node.metadata = withAutomationStudioNodeAdaptationId(node.metadata, adaptation.adaptationId)`.
- The typed path already stamps (`set_node_metadata` in `graphPatchOperationsForAdaptation`). A test now covers it.
- A reroute stamps no node on either path, because its edge already carries `metadata.adaptationId`.
- The same function builds the judged run's unsaved candidate, so the candidate's node is stamped too. This is
  consistent with "the Flow a judged run ran and the Flow an apply later stores cannot disagree". The
  judged-promotion tests pass.

### Gap 2: the file-backed apply stored applied = base (`adaptation-store.ts` `putAdaptation`)

- Before: `positive(metadata.appliedRevision, baseRevision)`.
- Now: a new private `appliedRevisionFor` keeps a recorded `metadata.appliedRevision`. Otherwise it takes
  `max(revision_number)` from `graph_revisions` for the target graph, read after the applying save has run.
- A graph with no revision chain gets `null` instead of the base revision. Recording the base would read as "applied,
  nothing changed". This follows the "absent is not zero" rule in `runtime/flow-version/contracts.ts`.
- The probe below shows this chainless case is the ordinary one: a Subflow graph saved through `saveFlow` has no chain.
- On a chained graph, the file-backed save reconciles into a new revision, and that revision is now recorded. For
  example, base 1 and applied 2.

### Tests and docs

- `runtime/service/adaptations/tests/graph-flow-patch.test.ts` (new, 4 tests): stamping for an action target and an
  expectation (existing ids and metadata kept), no mutation of the input, and no node stamp for a reroute.
- `runtime/tests/service-adaptation/tests/durable-write.test.ts` (new, 6 tests):
  - typed apply with a throwing Flow write: rejects with the reason, graph back to `#old`, status `reverted`,
    `rollbackRevision: 3`, graph at revision 3;
  - typed apply success: stamped, base 1, applied 2;
  - file-backed apply with a throwing graph write: rejects, `#old`, still `validated`;
  - file-backed apply with a throwing parent write: rejects, node back to `#old`, parent does not list the id, still
    `validated`;
  - file-backed apply on a chainless graph: stamped, base 1, no applied revision;
  - file-backed apply on a chained graph (an `edit_action_target` plus an `edit_subflow`, so the transaction cannot
    carry it): graph revision 2, stamped, base 1, applied 2.
- `runtime/tests/service-adaptation/tests/subflow.test.ts`: removed the one line that stubbed
  `synchronizeCanonicalFlowGraphProjection` to reject. That test asserted the old swallow, an apply that reported
  `applied` while its projection failed. The rest of the test, write-through, routed run and revert, is unchanged and
  passes.
- `docs/architecture/automation-studio.md`: new paragraph after the apply paragraph ("An apply is durably saved, or it
  fails and says why"), covering both paths, the stamp, the restore, and the applied revision.

## Commands run and observed results

All Core commands ran in `packages/fluxiq` unless a different directory is named.

1. Probe, before any change. A temporary test, since deleted, applied an `edit_action_target` on a Subflow graph saved
   through `installPrimaryRouter`. Printed: `applied meta {"status":"applied","base":1,"appliedRev":1,"hasRecord":true}`,
   node meta `undefined`, and graph metadata without `graphRevision`. So this was the file-backed path on a chainless
   graph.
2. Fail-first. I copied the 5 changed sources to the scratchpad, restored them with `git show HEAD:<path>`, and kept the
   new tests.
   - Command: `npx vitest run .../durable-write.test.ts .../graph-flow-patch.test.ts`
   - Result: `Tests 7 failed | 3 passed (10)`.
   - The 7 failures:
     - typed "promise resolved ... instead of rejecting";
     - file write `#new` instead of `#old`;
     - parent write "expected ['adaptation.parent-unwritten'] to not include";
     - stamp failures: "expected undefined to deeply equal { adaptationIds }", in both unit tests and both file-backed
       service tests.
   - The 3 that passed check behaviour the original already had: typed success, input left unmutated, and no node stamp
     for a reroute.
3. Gap 2 alone. Only `graph-flow-patch.ts` was fixed.
   - Command: `-t "revision"`
   - Result: chainless "expected 1 to be undefined", chained "expected { ... } to match object { status: 'applied', ... }"
     (applied 1, not 2). 2 failed, 1 passed.
   - Afterwards I restored all fixes.
4. `pnpm check` (fluxiq typecheck):
   - First run: `TS2339: Property 'appliedRevision' does not exist on type 'AutomationStudioAdaptationSummary'` in my
     test. I fixed it with a typed cast.
   - Rerun: `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp; stored in the shared store ..."}`, with no
     errors.
5. `node scripts/structure-audit.mjs` (Core root): exit 0, `structure-audit: passed (340 warning(s), 1159 baselined).`
   - It also printed `3 baseline entries can be lowered`. I found them with a temporary `--update`, then restored the
     baseline file byte for byte; `git status` shows it clean.
     - `service.ts` file-lines: 4360 → 4359.
     - `service.ts` swallowed-failure: 6 → 5. This is the removed `.catch`.
     - `storage/project/runtime-stream-store.ts`: 19 → 17. This one was already lowerable and is not mine.
   - The supervisor may run `pnpm structure:baseline`. I did not edit the baseline.
   - `adaptation-store.ts` is now at exactly 800 lines, the file-lines limit (warn only).
   - Its class has 30 methods, past the 25 advisory and under 40.
6. `node scripts/structure-audit.mjs --rule docs-links`: `passed (0 warning(s), 0 baselined)`.
7. Command: `npx vitest run` over these directories:
   - `runtime/service/adaptations/tests`
   - `runtime/tests/service-adaptation/tests`
   - `storage/project/tests`
   - `runtime/recovery` (all of its test directories)
   - `runtime/live-patch/tests`
   - `runtime/adaptation-confidence/tests`
   - `runtime/flow-change/tests`
   - `runtime/service/adaptation-projections/tests`
   - `runtime/service/runtime-adaptation/tests`

   Result: exit 0, `Test Files 130 passed (130)`, `Tests 1318 passed (1318)`.

## Not verified

- No full suites, no Lab or live run, no provider calls, as the brief required. Whether a Lab-created Flow takes the
  typed or the file-backed path live is still untested. The probe suggests the file-backed path on a chainless graph,
  which records `appliedRevision: null`, not a number.
- The withdrawn typed apply keeps its history. It keeps `appliedRevision: 2` (summary and metadata) beside
  `rollbackRevision: 3`, as a normal revert does, and its status is `reverted`, not `applied`. A reader that looks at
  `appliedRevision` without the status would see a change. I chose not to rewrite the history columns.
- After a withdrawn typed apply, I do not re-run the projection for the rolled-back graph. If the projection's first
  steps had run (`repositories.flows.put`), the cached Flow's `updatedAt` may have moved. Nodes come from the graph
  store, so they read correctly.
- I did not test re-applying a withdrawn or reverted typed adaptation. The deterministic apply and rollback mutation
  ids (`adaptationGraphMutationId`) were already committed once, and `operationsForCommittedApply` may then treat a
  re-apply as an idempotent replay. This was already true for revert-then-reapply.
- Router, Subflow and created-Subflow saves in the file-backed path still have the partial-write hole Gap 3b fixed for
  Flows. They are not Flow documents and were out of scope.
- A unit repair (`unit-repair-change.ts`) does not stamp the nodes it inserts. Gap 1 covered the node patch kinds only.
- For an applied adaptation imported or re-saved without `metadata.appliedRevision` onto a chained graph,
  `putAdaptation` now records the chain's current newest revision. That may be later than the revision the apply
  produced. Before this change it recorded the base, which was also wrong.

## Open questions or contradictions found

- **t506's stated effect of Gap 3 is partly inaccurate.** It said that if the projection failed, `get-flow` would keep
  showing the document from before the repair. In fact `getFlow` materializes nodes from the graph store
  (`flows/store.ts` `materializeCanonicalGraphFlow`). The existing `subflow.test.ts` stubbed the projection to fail and
  asserted the repaired nodes were visible. So the typed graph change was durable, but the on-disk Flow document,
  source file and generated config were stale. The supervisor's brief chose to fail closed instead. I followed it, and
  removed the stub that asserted the old tolerance. If the stale-document risk is judged acceptable, the alternative is
  to keep the apply and surface a warning. That would be a product decision.
- **Gap 4** (`list-graph-revisions`, declared in `api/contracts/endpoints.ts:45` with no handler) was left alone, as the
  brief said.
- The brief listed `service.ts`, `graph-flow-patch.ts` and "the apply paths". I also edited `patches.ts` and
  `durable.ts` (Gap 3b) and `adaptation-store.ts` (Gap 2's location and the withdraw method). All three are apply-path
  files, so I treated them as owned. I created no new source file, only two test files.
