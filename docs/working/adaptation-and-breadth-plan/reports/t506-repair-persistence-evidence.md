# t506 — Repair persistence evidence (adaptation plan G1)

Worker report. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t506-repair-persistence-evidence`, branch
`task/t506-repair-persistence-evidence`. Nothing committed.

## Outcome

Done. The repair lane now:

- records the saved Flow before and after apply;
- fails an applied repair whose Flow did not change;
- treats missing replay accounting as unknown, which fails the run;
- writes `snapshots/adaptation.json`, so `adaptationPersistence` and `adaptationReuse` are filled in.

A `temporary_target_override` **is** kept in the Flow when it is applied. Core saves it as an `edit_action_target`
patch, and both of Core's apply paths write the new target onto the node. Core has gaps in the evidence around that
apply (listed below), but none of them stops the override from being kept.

## What changed and why

**`flow-lane/repair/apply-repair.ts`**

- `applyLiveRepair` reads the saved Flow before the first review and again after the last review. It reads the parent
  Flow and every Subflow graph from `list-flow-subflows`, because Core writes a node patch onto the Subflow's graph Flow,
  not onto the parent.
- `RepairApplication.flow` holds `{ before, after, change }`. Each Flow state has:
  - `contentHash`: every graph document, whole;
  - `stepsHash`: only each graph's nodes and edges;
  - `graphs[]`: each graph's `flowId`, `contentHash` and `updatedAt`. The parent's `contentHash` uses the same sha256 of
    key-sorted JSON as `getExactFlow`, so it matches `lab replay`'s `flowContentHash` (P6).
- The fail decision uses `stepsHash`. Core's legacy apply always moves the parent's `updatedAt` and its
  `metadata.appliedAdaptationIds` stamp, so `contentHash` changes even when the repair changed nothing that runs.
- Each adaptation now also records:
  - `baseRevision` and `appliedRevision`, from `metadata.phase9`, falling back to `metadata`;
  - `changeRecorded`. It is `revision` when the applied revision is past the base. It is `mutation` when the legacy
    `applicationRecord.mutations` holds a graph whose steps differ before and after (the `promote_adaptation` Flow stamp
    is ignored). Otherwise it is `null`.
- `change` takes one of four values:
  - `changed`: the lane applied the repair and the steps moved;
  - `unchanged`: the lane applied it and the steps did not move;
  - `changed_in_run`: Core had already applied every adaptation during the run, and Core's own record shows the change;
  - `unseen_in_run`: an adaptation applied during the run that nothing the lane can read shows changing.
- An in-run apply cannot be judged from the lane's hashes. The lane's first read comes after Core's change, so its
  before and after hashes are equal by construction. This is R4b's and the gate's normal case.
- New `assertRepairPersisted(application)`. For an `applied` outcome it fails on `unchanged`, on `unseen_in_run`, and
  when `flow` is missing. All failures are `runtime.behavior`, with closed-word details.
- Every adaptation id is validated before any Core call, so a refusal task still makes no calls.
- `no_proposal` still reads nothing and has no `flow`.

**`flow-lane/repair/replay-repair.ts`**

- `RepairReplay.providerCalls` is now `number | null`. It comes from `llmAccounting.calls`, then `providerCallCount`,
  then `null`. This is the same rule `lab replay` uses in `provider/free-accounting.ts`. Itemized call lines are no
  longer treated as a count.
- `modelCalled` also counts itemized or omitted call lines.
- An unreachable replay now records `providerCalls: null`, not 0.
- New `assertReplaysAccounted(replays)`. It fails when a replay that ran has `providerCalls: null`. Unreachable replays
  are still judged by `assertLiveRepairProof`.

**`flow-lane/repair/run-repair-lane.ts`**

- `lane.run` may now carry `runId`. `run-scenario.ts` already passes the full `PersistedFlowRunOutcome` at lines 446
  and 546, so it arrives at runtime without any caller change.
- After `repair-lane.json`, the lane writes `snapshots/adaptation.json` through the existing
  `writeFlowLaneAdaptationSnapshot`. That writer was exported but never called before this change. The write is best
  effort: a read that fails writes nothing.
- The new `measureRepairLane` function:
  - reads the facts of the run that made the repair, after the apply;
  - reads any repair adaptation that run did not list as created;
  - reads the facts of the first replay that ran.
- `publish` now carries `flowChange`.
- The checks run in this order:
  1. `assertRepairPersisted`, first, because a repair that was not kept explains whatever its replays did;
  2. `assertLiveRepairProof`;
  3. `assertReplaysAccounted`.

**`run-evaluation/adaptation/measure.ts`**

- New `measureRepairedRunAdaptations({ lane, replay, repairAdaptationIds })`:
  - Persistence, validation and cost come from the lane run, with every repair adaptation graded.
  - Reuse comes from the replay. It uses Core's stamp rule, plus any repair adaptation Core holds `applied` whose
    stored `appliedTo` names a node the replay attempted. That second rule is needed because Core's legacy apply does
    not stamp the node (Core gap 1).
- `measureRunAdaptations` was split into small private helpers. Its behaviour is unchanged, and its existing tests pass
  as they were.
- `snapshot.ts` needed no change. Its validators accept the new measurements, and a round-trip test pins that.

**Tests**

- `apply-repair.test.ts`: 15 tests. The fake Core holds a parent Flow and a Subflow graph, and its apply re-points a
  node and stamps the parent.
- `replay-repair.test.ts`: 3 new tests. The default fake now states `providerCallCount: 0`, as Core does
  (`result-verification/zero-provider-run.ts`).
- `run-repair-lane.test.ts`: 4 new tests. The fake now serves a real Flow document, revisions, `appliedTo`, and lane
  and replay run details.
- `measure.test.ts`: 6 new tests.
- `snapshot.test.ts`: 1 round-trip test.

**Why R4b's measurements were null.** No production code ever wrote `snapshots/adaptation.json`.
`readRunAdaptationMeasurements` and `writeFlowLaneAdaptationSnapshot` had no callers. t179's handoff item 1 in commit
c16fb5bd was never wired. The repair lane now writes the file. Runs without `--replays` still write nothing; see the
open questions.

## Is `temporary_target_override` kept in the Flow?

Yes. Core was read only, at fbd06c77.

1. During the run, the override is saved as a durable patch. `runtime/live-patch.ts`, `changePatchFromRuntimePatch`
   (about line 601), maps it to `{ kind: "edit_action_target", targetId: patch.targetNodeId, after: patch.target }`.
2. On `review-flow-adaptation` with `action: apply` (`runtime/service.ts`, `reviewFlowAdaptation`, line 3317), one of
   two paths runs:
   - **Typed path.** `reviewTypedFlowAdaptation` calls `storage/project/adaptation-store.ts` `applyApprovedAdaptation`
     and `graphPatchOperationsForAdaptation` (line 437). That emits `set_node_parameters` with
     `actionTargetParameterValues`, which writes the target into `parameterValues.target`, or into
     `parameters.target` for a policy action. It also emits `set_node_metadata` to stamp the adaptation id. Together
     they make a new graph revision, recorded as `appliedRevision`.
   - **Legacy path.** `service/adaptations/durable.ts` `applyFlowAdaptationDurably` calls `patches.ts`
     `applyFlowNodeAdaptationPatch` (line 34). That calls `graph-flow-patch.ts`
     `automationStudioGraphFlowWithAdaptationPatch` (line 24), which saves the graph Flow with the new target. It then
     calls `recordAppliedAdaptationOnFlow`, which stamps the parent.
3. "temporary" is only the name of the runtime patch kind. The applied form is permanent and can be reverted.

## Core gaps found (no Core edits)

1. **The legacy apply does not stamp the node.**
   - Where: `runtime/service/adaptations/graph-flow-patch.ts`, `automationStudioGraphFlowWithAdaptationPatch`, in the
     `edit_expectation` / `edit_action_target` branch.
   - Today it writes `parameterValues` only. The typed store also stamps (`adaptation-store.ts:482`).
   - Effect: Core's own replay and confidence rule, and the Lab's stamp rule, cannot see that a legacy-applied
     override was reused.
   - Change needed: also set `node.metadata = withAutomationStudioNodeAdaptationId(node.metadata, adaptation.adaptationId)`.
     The rollback already restores the whole graph from `before`.
   - The Lab works around this by matching `appliedTo`.
2. **The legacy apply stores `appliedRevision` equal to `baseRevision`.**
   - Where: `storage/project/adaptation-store.ts` `putAdaptation`, line 90:
     `status === "applied" ? positive(metadata.appliedRevision, baseRevision)`.
   - Effect: the revision does not show the change, so the Lab falls back to `applicationRecord.mutations`.
   - Change needed: record the revision the legacy save produced, or advance it.
3. **The typed apply hides a failed projection.**
   - Where: `runtime/service.ts:4036`, `synchronizeCanonicalFlowGraphProjection(...).catch(() => undefined)`.
   - If the projection fails, `get-flow` keeps showing the document from before the repair while the graph store holds
     the repair. The Lab would then report `unchanged` and fail the run. That is visible, not a false pass, but the
     cause would be a Core defect.
4. **No API exposes the Flow's graph revision.**
   - `list-graph-revisions` is declared in `api/contracts/endpoints.ts:45` but has no handler.
   - So the "version" recorded here is each document's `updatedAt` plus each adaptation's `baseRevision` and
     `appliedRevision`.

## Commands run and observed results

- Fail-first check, before the implementation:
  - Command: `npx tsc -p tsconfig.json --noEmit` in `packages/test-runner`.
  - Result: errors for the missing `assertRepairPersisted`, `assertReplaysAccounted`, `measureRepairedRunAdaptations`,
    `flow`, `changeRecorded` and `lane.run.runId`.
- Behavioural fail-first check:
  - Method: I put the 4 original source files back from `HEAD`, kept the new tests, ran `npx tsc -p tsconfig.json`
    (it emits even with errors), then ran
    `node --test dist/flow-lane/repair/tests/*.test.js dist/run-evaluation/adaptation/tests/*.test.js`.
  - Result: `# tests 47 # pass 38 # fail 9`.
    - The apply, replay, measure and snapshot test files failed to load.
    - Five lane tests failed, including the unknown-accounting test, which shows the old code counted missing
      accounting as 0.
  - My sources were restored afterwards.
- Typecheck after the change: `npx tsc -p tsconfig.json --noEmit` returned exit 0 with no output.
- Build: `pnpm --filter @fluxiq-web-extension/test-runner build` printed
  `core-build: ... current`, `test-runner:build ... 27422 ms`.
- Tests: `node --test dist/flow-lane/repair/tests/*.test.js dist/run-evaluation/adaptation/tests/*.test.js` returned
  `# tests 88 # pass 88 # fail 0`.
- Structure audit: `node scripts/structure-audit.mjs` printed
  `structure-audit: passed (193 warning(s), 646 baselined)`.
  - The first run failed on statement packing in two test files I had edited. I fixed those lines.
  - One advisory warning remains: `run-repair-lane.test.ts: 427 lines is past the 400-line advisory threshold`.
- Recovery matrix: not run. No row reaches the changed code. `grep` finds no use of the repair lane, the replay code or
  the adaptation readers under `recovery-matrix/`, and rows 1-11 and 13 use handlers and routing, not the repair lane.
- No paid runs. No commits.

## Not verified

- I did not run anything against a live Core. In particular:
  - which apply path Core takes for a Lab-created Flow;
  - whether the gate's override arrives already applied in the run. If it does, it passes only when Core's record shows
    an `appliedRevision` past its base, or a mutation record with changed steps.
  - That a real `get-flow` after apply shows the re-pointed node.
- The `appliedTo` reuse rule assumes node ids are unique across a Flow's graphs, as Core's attempt `nodeId`s are.
- I did not run the full `pnpm check` or `pnpm test` suites, following the narrow-check rule.

## Open questions or contradictions

- **Runs without `--replays` still write no adaptation measurements.** Wiring `writeFlowLaneAdaptationSnapshot` into
  `run-scenario.ts` (around lines 382 and 482, per t179) is outside this brief.
- **Docs are out of date.** `docs/architecture/testing-facility.md` (about lines 1714-1730, and 2623) describes the
  repair lane and the adaptation snapshot without the Flow hashes, the persistence failure, the unknown-accounting rule,
  or the repair-lane writer. I could not update it: that file is not in my brief.
- **The plan's G1 brief says "fail when the hashes are equal".** I fail on the steps hash, which is stricter. Core's
  stamp alone always changes the whole-document hash. For an in-run apply the lane's hashes are equal by construction,
  so Core's revision or mutation record decides instead.
