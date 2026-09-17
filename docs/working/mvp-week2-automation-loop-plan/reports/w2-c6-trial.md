# w2-c6-trial: one trial for every Flow change, used by live patching

Core `F:\!FluxIQ`, at `c0b04be` plus the working tree. `AS/` means
`packages/fluxiq/src/programs/automation-studio/`. Nothing was committed.

## Outcome

Done. Core `pnpm check` exits 0. The runtime and storage suites pass, except
one Flow-creation deadline test that fails only under full-suite load and
passes alone (details under "Commands run", runs 3 and 8).

- `trialAutomationStudioFlowChange` is in the new `AS/runtime/flow-change/trial.ts`.
  - It runs a candidate Flow on a throwaway copy.
  - Its verdict comes only from `decideAutomationStudioChangeVerdict`.
  - It returns the verdict, the saved trace, and the executed trace (in memory
    only), plus the origin and the failure's observed and expected state.
- `AS/runtime/live-patch.ts` now runs every executed patch through the trial.
  - **D-5 fixed:** a correct repair followed by an unrelated later failure is
    `validated`, not `rejected`.
  - **D-6 fixed:** the fixed 50-step cap is gone. The trial is bounded by the
    run's remaining steps when the caller gives them, and otherwise by the
    run's own step limit.
  - The domain gate from `f09d18a` still runs first on every path.
- **Brief extension done** (own heading below). A target repair on a recorded
  step (`builtin.policy.action`) is now written into `parameters.target`:
  - in the trial;
  - in the file-based applier;
  - in the typed store, which now uses the same moved helper.

## What changed and why

### New `AS/runtime/flow-change/trial.ts` (about 270 lines)

**New exports:**
- `trialAutomationStudioFlowChange(request)`.
- `AutomationStudioFlowChangeTrialRequest`. This is the contract's
  `AutomationStudioChangeTrialInput` plus four optional fields:
  - `origin`;
  - `failedAttempt`;
  - `expectedComparison` (defaults to the failed attempt's own comparison);
  - `verifiesState(node)`.
- `AutomationStudioFlowChangeTrialReport`. This is the contract's
  `AutomationStudioChangeTrialResult` plus `origin`, `observedState` and
  `expectedState`.
- `automationStudioFlowChangeFailureState(failedAttempt, comparison?)`.

I extended the contract types here rather than in `contracts.ts`, because the
brief allows only imports from the other `flow-change/` files.

**How the trial runs:**
- It runs the candidate with `request.options`, with `inputs` set to
  `seedValues`.
- It starts at `startNodeId`. When that is absent, it removes any
  `options.startNodeId`, so the run starts at the graph's start.
- It adds no step cap of its own, so `options.maxSteps` is the only bound.
- It captures the executed trace through the `onExecutedTrace` hook of
  `runAutomationStudioGraph`.

**How each executed attempt is projected into a verdict attempt.** The
projection reads observed facts and declarations only, and decides nothing.
- `expectedRoute`:
  - read only on a succeeded attempt;
  - the attempt's own declared route first;
  - otherwise the failed comparison's route, but only for the same node, and
    never the executor's default `failed`.
- `failureRoute`: the failed attempt's route, or `failed` when it has none.
- `expectedOutputIds`:
  - the node's own declared outputs;
  - otherwise the failed node's outputs, when this attempt is the failed node;
  - for a *different* changed node, the failed node's outputs, but only when
    that node actually produced all of them. They can prove the change and
    never contradict it. The reason is that output ids are keys in the run's
    shared `values` map, whichever node writes them.
  - Routes never carry across nodes.
- `expectedState`:
  - taken from the host's actual answer for that attempt id;
  - `unknown` when the node declares a state and no host answered;
  - `unknown` when the host threw (the error is passed on unchanged);
  - `unknown` when the same attempt id was asked twice.
- How the host's answers are observed: the host runtime is wrapped in a
  `Proxy`.
  - The proxy's own target is an empty object, so a frozen host cannot break
    the proxy's rules.
  - `get` and `has` are passed to the real host, with its methods bound to
    it, so a class-based host with private fields still works (tested).
- `records`: set only for an attempt with a `records.write` effect, or a
  `policy.output.dispatch` effect whose `recordOutput` is present. The count
  captured is `outputs.records.length`.
- `verifiesState`: true when the node definition's `metadata.verifiesState`
  is `true` (no definition has that field yet, see Open questions 2), or when
  `request.verifiesState(node)` returns true.

**What is returned:**
- `origin`, only when `parseAutomationStudioFlowChangeOrigin` accepts it.
- `observedState`: status, route, failure category and code, and
  `comparisonStatus`, each only when it is shaped like an identifier; plus
  output, effect, missing and unexpected counts, `routeMatched` and
  `statusMatched`.
- `expectedState`: declared status and route (identifier-shaped only), and
  output, effect and state-check counts.
- No values, messages, payloads or conditions are copied. A test puts a
  secret in the failed attempt and checks it does not appear.

### New `AS/runtime/flow-change/action-target-parameters.ts`

- `actionTargetParameterValues` was moved here from `adaptation-store.ts`.
  - The body and doc comment are unchanged.
  - The node parameter type is now the named structural type
    `AutomationStudioActionTargetNode` (`{ nodeId, definitionId, parameterValues }`).
    It has the same shape as the store's
    `Pick<AutomationStudioGraphNodeRecord, …>`, so that runtime does not
    import a storage type.
- There is no copy left in the store.

### `AS/runtime/flow-change/index.ts`

Two export lines were added: `./action-target-parameters.ts` and `./trial.ts`.

### `AS/runtime/live-patch.ts` (640 -> 744 lines)

**`executeAutomationStudioRuntimePatch`:**
- The order is: preflight (the domain gate), then apply the patch to a copy,
  then `trialOptions`, then the trial.
- The changed node is also the start node. It is `targetNodeId` for a
  wait/retry or a target override (already re-aimed at the failed node), and
  `toNodeId` for a reroute.
- It passes `failedAttempt`, `expectedComparison`, the run-failure `origin`
  and `verifiesState` to the trial.
- It returns two new fields: `verdict`, and `executedTrace` (documented as in
  memory only).

**New input fields:**
- `remainingSteps`. Absent means the trial is bounded by `options.maxSteps`,
  or the executor's default when that is unset too. A value below 1, or not
  finite, gives `not_executed` / `no_step_budget_left`, and nothing runs.
- `verifiesState(node)`.

**`AutomationStudioRuntimePatchVerification` is now only a label for the
verdict:**
- `verified`: `basis` is the verdict's first basis. It may now be any evidence
  kind.
- `contradicted`: `reason` is the failed checks' codes, joined with commas.
  - The old reasons were `rerun_failed`, `expected_route_not_observed` and
    `expected_outputs_not_observed:<ids>`.
  - The new reasons are codes such as `changed_node_failed`,
    `expected_outputs_missing`, `expected_route_not_taken`,
    `downstream_assertion_failed` and `continuation_route_unwired`.
- `unverifiable` reasons:
  - `changed_node_incomplete` (new);
  - `evidence_unevaluated` (new);
  - `expectation_empty`: a comparison exists but declared nothing;
  - `no_expectation_declared`: there is no comparison.
  - The last two keep their old meanings. `representation.test.ts` still
    expects `no_expectation_declared`, and it passes.
- `not_executed` reasons:
  - `changed_nodes_not_reached`, `trial_not_run` and `no_step_budget_left`
    (all new);
  - `action_target_unwritable:<nodeId>` (new);
  - the existing `preflight_failed`, `proposal_only` and
    `unapplied_patch_kind:*`.
- Nothing in `F:\!FluxIQWebExtension` source matches the old reason strings
  (grep).

**`adaptationFromRuntimePatch(input, trace, verification, trial?)`:**
- With a trial:
  - `validationResults` is what `automationStudioChangeValidationResult`
    returns: kind `trial`, the basis, and the verdict's reason as `detail`.
  - `metadata.verdict` is a copy of the verdict.
- `metadata.origin` is always set when it parses.
- Top-level `observedState` and `expectedState` are filled.
- Without a trial, only `verified` or `contradicted` records a result (kind
  `trial`). Before, `not_executed` recorded a `failed` result.
- The status mapping changed: only `contradicted` gives `rejected`.
  `unverifiable` and `not_executed` give `testing`. Before, `not_executed`
  gave `rejected`.

**Proposal path:** `targetOverrideProposalAdaptation` also records
`metadata.origin`, `observedState` and `expectedState`. It still has no
validation result.

**Removed:**
- `verifyRuntimePatchOutcome`, the whole-run rule behind D-5.
- The fixed `Math.min(…, 50)` cap, the cause of D-6.
- `startNodeForPatch` was renamed `changedNodeForPatch`.

### `AS/runtime/tests/live-patch.test.ts` (417 -> 551 lines)

- **Replaced:** the "failed later node is rejected" case. It now covers a
  repaired node that fails again, which is still `rejected`.
- **New D-5 cases:**
  - a verified repair followed by a later failure is `validated`, with
    `resumeFrom` set to `end`;
  - with no evidence, it is `testing`, not `rejected`.
- **New D-6 cases:**
  - a 62-step continuation succeeds;
  - `remainingSteps: 5` stops at 5 attempts, even though `options.maxSteps`
    is 500;
  - `options.maxSteps: 9` stops at 9;
  - `remainingSteps: 0` runs nothing.
- **New field test:** covers the verdict, origin, observed and expected state,
  and that the executed trace stays in memory while the saved trace and the
  adaptation do not contain the seeded note.

### `AS/runtime/tests/live-patch-target-override.test.ts` (531 -> 577 lines)

Two new cases, described under the brief extension.

### `AS/runtime/flow-change/tests/trial.test.ts` (new, about 320 lines)

It has 22 tests:
- the per-node verdict and D-5;
- contradiction, unverifiable, and not executed;
- start-node handling;
- a `completed` resume point;
- the step budget (D-6);
- expected state: the host passed, rejected, absent or threw, and a
  class-based host with private fields;
- downstream assertions through `verifiesState`;
- records: rows saved, and none saved;
- how the failed comparison is used: a declared route, missing outputs, a
  route that repeats the failure, and a `failed` route that is only the
  executor's default;
- the cross-node output rule;
- origin parsing;
- the failure summary, which carries no values;
- the executed trace next to the saved trace.

## Brief extension: the trial of a recorded step's repair

- **`AS/runtime/flow-change/action-target-parameters.ts`:** the moved helper,
  described above.
- **`AS/storage/project/adaptation-store.ts` (657 -> 633 lines):**
  - The private helper, its `POLICY_ACTION_DEFINITION_ID` constant and the
    now-unused imports were deleted: `isAutomationNodeParameterStateBinding`,
    and `type AutomationStudioGraphNodeRecord`.
  - `actionTargetParameterValues` is now imported from
    `../../runtime/flow-change/index.ts`.
  - The call site is unchanged.
- **`AS/runtime/live-patch.ts`:**
  - `applyRuntimePatchToFlow`, for `temporary_target_override`, now writes
    through `actionTargetParameterValues`.
  - A payload the helper refuses (not a plain object, or a state binding)
    gives `not_executed` / `action_target_unwritable:<nodeId>`. No adaptation
    is saved, and nothing runs.
- **`AS/runtime/service/adaptations/patches.ts`:**
  - Line 57 was replaced exactly as `w2-typed-apply-gates` suggested:
    `...actionTargetParameterValues({ nodeId: node.id, definitionId: node.definitionId, parameterValues }, structuredClone(patch.after), adaptation.adaptationId)`.
  - The import from `../../flow-change/index.ts` was added.
- **`AS/runtime/tests/service-adaptation/tests/durable-patches.test.ts`:**
  - The `builtin.policy.action` fixture now holds `parameters.target` (`#old`).
  - The apply and revert assertions now expect `parameters.target` to be
    `#new`, then `#old`.
  - Under the old applier this test failed, because `target` was written at
    the top level.
- **New live-patch tests** (in `live-patch-target-override.test.ts`, since
  `runtime/tests/` is at its file limit):
  - `dispatches the repaired target from a recorded step's payload in its trial`:
    - the effect dispatcher receives `parameters: { selector: "#save", target: <domain resolution> }`;
    - the executed node has no top-level `target`;
    - the durable patch is still `edit_action_target` with the resolution.
    - Before the fix, the dispatched payload had no `target`.
  - `is not tried on a recorded step whose payload cannot take a target`: a
    state-bound payload gives `action_target_unwritable:press`, and the host
    saw no node.
- **Limits kept:** no new file in `runtime/tests/` (still 25 files), and
  `service.ts` is untouched at 6405 lines.

## Commands run and observed results

Runs used `npx vitest run <paths>` from `packages/fluxiq`, unless noted.

**1. Failing-first,** before any source change (tests only):
- **Files run:** `live-patch.test.ts`, `live-patch-target-override.test.ts`,
  `flow-change/tests/trial.test.ts` and `durable-patches.test.ts`.
- **Result:** `Failed Tests 30`.
- `trial.test.ts`: all 20 tests of the draft at the time failed, because
  `trialAutomationStudioFlowChange` did not exist yet.
- **D-5:**
  - `does not contradict a repair its own evidence verified` failed with
    `expected { status: 'contradicted' … } to deeply equal { status: 'verified' … }`;
  - `leaves a repair nothing proved in testing` failed with `contradicted`
    against `unverifiable`.
- **D-6:**
  - `lets a continuation run past 50 steps` failed with
    `expected 'failed' to be 'succeeded'`;
  - `is the run's remaining steps …` failed with
    `expected [ … ] to have a length of 5 but got 50`;
  - `runs nothing when the run has no steps left` failed with `contradicted`
    against `not_executed`.
- **Recorded step:** `dispatches the repaired target …` failed. The
  dispatched payload had no `target`.
- **Durable apply:** `applies and reverts durable action target …` failed,
  because `target` was written at the top level.

**2. After the implementation:**
- `npx tsc --noEmit`: `tsc exit 0`.
- **Same four files, plus `flow-change/tests/`:**
  - First run: `Tests 3 failed | 141 passed`. All three were wrong
    expectations in my tests (`resumeFrom` is the End node, which is itself
    an attempt, not `{ completed: true }`). The assertions were fixed, and a
    real `completed` case was added.
  - Second run: `Test Files 7 passed (7)`, `Tests 145 passed (145)`.

**3. First full run** of `src/programs/automation-studio/runtime`,
`src/programs/automation-studio/storage` and
`src/programs/automation-studio/tests/opaque-target-execution.test.ts`:
- **Result:** `Test Files 4 failed | 175 passed (179)`,
  `Tests 4 failed | 1635 passed | 1 skipped (1640)`.
- **`adaptive-loop.test.ts > auto-applies validated low-risk runtime adaptations`:**
  caused by my change. That test repairs `constant` while `divide` failed, and
  its evidence is `divide`'s declared output. Fixed by the cross-node output
  rule above. The test file was not touched.
- **`subflow.test.ts > applies and reverts a parent-scoped adaptation …`:**
  `Test timed out in 15000ms`, plus `ENOTEMPTY` during cleanup.
- **`run-detail-preservation.test.ts > keeps a repaired run's recovery annotation …`:**
  `Test timed out in 15000ms`.
- **`deepseek-bootstrap-exploration.test.ts > asks again after a decision that runs past its deadline`:**
  `flow_bootstrap.provider_transport_unknown` with `timeoutMs: 3_000`. This is
  the Flow-creation path, which this brief does not touch.
- **The last three, rerun alone after the fix:**
  - `subflow.test.ts`: `Tests 4 passed (4)`;
  - `run-detail-preservation.test.ts`: `Tests 3 passed (3)`;
  - `deepseek-bootstrap-exploration.test.ts`: `Tests 8 passed (8)`.
  - All three were load timing on this machine.

**4. After the output and route fix:**
- `tsc exit 0`.
- The live-patch, trial and `durable-patches` files plus
  `adaptive-loop.test.ts`: `Test Files 8 passed (8)`, `Tests 148 passed (148)`.

**5. Mutations** (`scratchpad/w2c6/mutate.py`). Each mutation was applied to
`trial.ts`, `trial.test.ts` was run, and the file was restored. A `cmp`
against the backup afterwards showed the file identical.

| Mutation | Result |
| --- | --- |
| M1: an unevaluated expected state counts as passed | `Tests 1 failed \| 21 passed` |
| M2: the failure route is not passed to the verdict | `1 failed` |
| M3: another node's outputs may contradict | `1 failed` |
| M4: the executor's default `failed` route is read as declared | `1 failed` |
| M5: the verification-node hook is ignored | `2 failed` |

**6. `node scripts/structure-audit.mjs`** (Core root): exit 0,
`structure-audit: passed (153 warning(s), 355 baselined).`
- Advisory warnings on my files only:
  - `live-patch.ts` at 744 lines;
  - the two live-patch test files at 551 and 577 lines;
  - `adaptation-store.ts` at 633 lines;
  - `runtime/tests/` at 25 files, which is unchanged.

**7. `node scripts/docs-reference.mjs --check`:** `framework-reference.md is stale`.
- This was already stale at HEAD. The reference lists
  `adaptationFromRuntimePatch` at `live-patch.ts:202`, while HEAD has it at
  line 371.
- It is not part of `pnpm check`.

**8. Second full run** (same paths as run 3, after the fix):
- `Test Files 1 failed | 178 passed (179)`,
  `Tests 1 failed | 1651 passed | 1 skipped (1653)`.
- The one failure was again
  `deepseek-bootstrap-exploration.test.ts > asks again after a decision that runs past its deadline`.
- Rerun alone afterwards: `Test Files 1 passed (1)`, `Tests 8 passed (8)`.
- This is load timing on a 3-second deadline in the Flow-creation path, which
  this brief does not touch. It has now been observed twice under full-suite
  load and passed twice alone.

**9. `pnpm check`** (Core root, run alone after the suite): `exit 0`.
- `structure:test`: `# pass 162`, `# fail 0`.
- `structure-audit: passed (154 warning(s), 355 baselined).`
- `packages/contracts`, `packages/client-gateway-websocket`,
  `packages/fluxiq` and `apps/web` checks: all `Done`.

## Not verified

- **No live runs.** Nothing was run in a browser or against DeepSeek, as the
  brief required.
- **Nothing in production supplies `remainingSteps` yet.** Today the trial
  therefore has the run's whole step limit (`graphOptions.maxSteps`, or the
  executor's default of 250), not what is left of it. See Open questions 1.
- **Nothing in production supplies `verifiesState`, and no node definition
  declares `metadata.verifiesState`.**
  - `AutomationNodeDefinition` has no `metadata` field.
  - So `downstream_assertion` cannot pass in production yet. Web repairs are
    verified only by an expected state the host evaluates, or by declared
    routes and outputs.
- **The web domain reading `parameters.target` ahead of the recorded
  selector:** the coordinator checked this; I did not.
- **Recording-definition nodes** (item 4 of `w2-typed-apply-gates`) may still
  drop an edited `parameters.target` when they are materialized. Not
  addressed.
- **Other workers' changes in the same tree.** The second full run includes
  in-progress changes by another worker to `recovery/annotation/*` and
  `llm/*`. Their `patches.ts` diff uses none of the fields I changed (grep).

## Open questions or contradictions found

1. **`remainingSteps` wiring (for C-9, `service.ts`, and the patch receipts in
   `recovery/annotation/patches.ts`).**
   - The caller should pass the steps left at the failed attempt.
   - The executor raises its own limit on every For Each pass
     (`withIterationAllowance` in `AS/runtime/executor/graph-run.ts`, not
     exported), so the caller cannot compute this exactly from outside.
   - Suggestion: have the executor expose it, either as a field on the
     executed trace (for example `stepBudget: { limit, taken }`) or as an
     exported helper.
   - Until then, R-1 is somewhat larger. On a no-grant adaptive run, the
     trial can now run up to the run's whole limit before the retry runs the
     Flow again from the top. It used to stop at 50 steps.
2. **`verifiesState` wiring.**
   - `AutomationNodeDefinition` (`AS/nodes/contracts.ts`) needs a `metadata`
     field, and `builtin.policy.expectation` (`AS/nodes/policy/expectation.ts`)
     needs `metadata: { verifiesState: true }`. `trial.ts` already reads
     `definition.metadata` when it exists.
   - For recorded steps, `recovery/annotation/patches.ts` should pass
     `verifiesState` into `executeAutomationStudioRuntimePatch`, built from the
     domain's output metadata for `parameterValues.outputId`. The web domain
     marks `web.dom.assert`, `web.dom.wait_for_text` and
     `web.dom.wait_for_selector`.
3. **`live-patch.ts` is at 744 of 800 lines.**
   - C-11 adds two patch kinds here, so it should split the file first.
   - A natural cut is the target-override check and its refusal vocabulary
     (about 230 lines).
   - `runtime/` holds 23 of 25 files, so the split should turn `live-patch.ts`
     into a `runtime/live-patch/` directory, which keeps the file count the
     same.
4. **Public surface for C-13 docs and the reference regeneration.**
   - New exports: `trialAutomationStudioFlowChange`,
     `automationStudioFlowChangeFailureState`, `actionTargetParameterValues`,
     `AutomationStudioFlowChangeTrialRequest`,
     `AutomationStudioFlowChangeTrialReport` and
     `AutomationStudioActionTargetNode`.
   - Changed:
     - `AutomationStudioRuntimePatchVerification`: wider basis, and new
       reason codes;
     - `AutomationStudioRuntimePatchExecutionResult`: `verdict` and
       `executedTrace`;
     - `AutomationStudioRuntimePatchExecutionInput`: `remainingSteps` and
       `verifiesState`;
     - `adaptationFromRuntimePatch`: an optional fourth argument.
5. **`executedTrace` is on a public result type.**
   - `patches.ts` copies named fields only, so it is not persisted today.
   - Any new caller must not store the result as a whole.
6. **Judgement call: the cross-node output rule.**
   - It keeps `adaptive-loop.test.ts` green, and it matches that test's stated
     contract ("the failed node declares what it was expected to produce").
   - If the coordinator prefers a strictly per-node reading, remove
     `declaredOutputIds`' third branch. Then that test must declare
     `expectedOutputs` on `constant` instead, and its assertion on
     `constant`'s `parameterValues` must include that field.
7. **Where the extended trial types live.** `AutomationStudioChangeTrialResult`
   in `contracts.ts` has no `origin` or state fields, so I extended it in
   `trial.ts`. It may be worth folding them into `contracts.ts` later.
