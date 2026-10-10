# t392 E2b: the run session supplies in-run repair; durable applier for the unit repair kinds; architecture doc

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`, nothing committed.
AS = `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Partial. Everything in the brief is built and tested, and the service path was checked end to end against E2a's executor.
Two things outside my ownership stay red:

- `tsc` fails on one file I may not edit. `AS/runtime/conversations/commands/run-flow.ts:105` has
  `Record<AutomationStudioChangeProposalKind, string>`, and that record now needs the two new kinds. It is a 2-line fix,
  given under Open questions.
- Two cases in `AS/runtime/tests/service-flows/tests/representation.test.ts` fail. They test the old detached rerun on an
  adapting run. Now that E2a's executor calls `repairIncident`, an adapting run repairs in place instead. This is the
  intended change of behaviour, but the test needs rewriting.

## What changed and why

**Supplier, session side.** `AS/runtime/service/runtime-session/`:

- `in-run-repair.ts` exports `bindAutomationStudioInRunRepair`. On an adapting run it sets `graphOptions.repairIncident`
  and returns the context with the run's ledger on it (`inRunRepairs`). Every other run gets no callback and its
  context back unchanged.
  - "Adapting" means the context's `behavior.invokeLlm` and `createAdaptations` are both on, and it is not a dry run.
  - It is also never supplied to the `diagnosis_only` or `diagnose_and_adapt` lanes, because their fix must never run.
- `in-run-repair-ledger.ts` has `AutomationStudioInRunRepairLedger`. It records which incidents were asked about, one
  receipt per fix and one per incident that got none, and any part graph a fix replaced.
- For each incident, the callback does the following:
  1. Asks once per incident. A second call answers `none`.
  2. Marks the run adapting.
  3. Builds the unit contract and the run-so-far detail. The detail is the executor's attempts, put through
     `runtimeSessionToFlowRunDetail`.
  4. Makes the one model request (below).
  5. Takes each patch in order. A patch must be a kind the plan allowed, and a `replace_unit` must name the failing unit.
     A patch that acts asks the run's permission gate (`answerable: false`), and one with no `consequences` is refused.
     Then it goes through `prepareAutomationStudioInRunRepair`: the detached path's preflight with the domain target
     check, then `overlayAutomationStudioRuntimePatch`.
  6. Refuses the whole answer if its patches change more than one unit.
  7. Saves the change proposal and the adaptation, and runs the promotion gate. The gate holds any unattended apply for
     the judged end.
  8. Returns `{ kind: "overlay", repairId, unit, graph, partGraph?, reason }`.

  Any refusal is `{ kind: "none", reason }` and also leaves a receipt with a closed `code`.
- A replaced part is filed under the part's own Subflow id.
- `tests/in-run-repair-fixture.ts` is the reusable scripted-model fixture (see below).

**The model request.** New `AS/runtime/recovery/in-run-repair/`:

- `request.ts` exports `requestAutomationStudioInRunRepair`. It makes one `runtime_patch` call at stage
  `implement`, after `plan`. There is no separate diagnosis call and no exploration (see Open questions).
- The diagnosis comes from Core: the incident plus `buildAutomationStudioRuntimeDeterministicDiagnosis`.
  `manual_intervention` failures answer `none` (`person_must_act`).
- The patch kinds come from the new `automationStudioInRunRepairPatchKinds` in `recovery/plan.ts`. It is the plan's
  candidate-kind map with `add_handler` and `replace_unit` added, narrowed by the policy.
- The provider is resolved as the detached path resolves it: the caller's key first, then the unattended authority.
- The cost ceiling is one purse per run (`AutomationStudioInRunRepairPurse`). It is built with
  `resolveAutomationStudioRecoveryRunBudget` and one `AutomationStudioLlmRunBudgetLedger`. Once the purse is spent, the
  request answers `none` with "The run's cost ceiling of $X is spent, so no model was asked." It also answers that way if
  the harness refuses with `llm_budget.run_cost_limit`.
- Live page evidence is captured with `captureSanitizedFailureEvidence`, as today.
- The request carries `recoveryContext`, `runDetail` (which gives the recent actions), `failureEvidence`, instructions,
  conversation, policy and `actionPermissions`. It also carries `metadata.allowedPatchKinds` and
  `metadata.inRunRepair = { unit, incident, failedAttempt, recoveriesTried, actsCompleted }`.
- The request also emits the "Fixing a step" activity thought.
- `unit-contract.ts` builds what the model is told about the unit:
  - a node: definition, label, parameters through `automationStudioScreenedNodeParameters`, and routes;
  - a handler: its registration as `automationStudioGraphHandlerRegistrations` reads it, plus its body;
  - a part: its interface, `fluxiq.successCheck`, entries and checkpoints.

  Everything goes through `automationStudioWithoutLocators`.
- `history.ts` builds the incident, the recoveries tried and the acts completed:
  - recoveries tried are the retries, handlers, state routes, ladder picks, earlier repairs and counted failure classes;
  - acts completed are the succeeded attempts.

  It uses ids and codes only.

**Wiring in `AS/runtime/service.ts`** (4366 lines before, 4360 now):

- `AutomationStudioService` is at its class-method ratchet (222), so no method could be added.
  `maybeAnnotateRunDetailWithRuntimeLlm` was replaced by `recoveryPorts(context)`, which binds the ports once for both
  paths. Its call sites now call `annotateAutomationStudioRunDetailWithRuntimeLlm({ ports: this.recoveryPorts(...) })`.
  Its one other statement, `automationStudioMarkRunAdapting`, moved to the top of `annotate.ts`.
- There is a new port, `subflowGraphForRecovery`, and one binding line after the recovery budget line.
- The statement-packing rule passes.

**Detail and the detached path:**

- `runtime-adaptation/contracts.ts`: the context gains `inRunRepairs?: AutomationStudioInRunRepairLedgerView`, with
  `receipts()` and `attempted()`.
- `runtime-adaptation/context.ts`: `runtimeRunDetailWithAdaptationContext` adds the receipts as
  `metadata.inRunRepairs` and their adaptation ids to `adaptationIds`. No service.ts line was needed, because both
  detail sites already call it.
- `recovery/annotation/annotate.ts` makes no model call when the failed attempt carries `repair`, or when the ledger
  says the incident was already asked about. It records `llmGate.code: "llm.gate.repaired_in_run"`. A refuted result,
  which has a `resultSummary`, is exempt.
- `adaptive-retry.ts`: the header now says it is only for a run that could not hold.

**Judged promotion.** `runtime-adaptation/judged-promotion.ts`:

- The settle's set of patches the run ran now includes `automationStudioRunInRunRepairAdaptationIds`. These are the
  receipts whose `repairId` is in `session.trace.repairs`, so a dropped fix settles as `not_rerun`.
- `automationStudioRunAdaptationIds` and the settle's receipt mirroring also read `inRunRepairs`.
- The rerun candidate skips an automation-scoped handler.

**Durable applier:**

- `model/flow-adaptation.ts`: two new change kinds, `add_handler` and `replace_unit`, documented in place. Also a new
  type, `AutomationStudioUnitRepairChangeKind`.
- `gates.ts`: both kinds are `GATED`, meaning a linked review record is required.
- `live-patch.ts` maps both runtime patches to these kinds; they no longer map to `edit_recovery`.
  - The repair spec goes in `after`, without `kind`, `reason`, `metadata` or `consequences`.
  - A `replace_unit` records `before.unitDigest`, from the new `automationStudioRepairUnitDigest` in
    `live-patch/unit-digest.ts`.
  - New in `live-patch.ts`: `prepareAutomationStudioInRunRepair`, which runs preflight, overlay, adaptation and proposal.
  - The adaptation's verification is `unverifiable`, with reason `in_run_trial` (new) and `awaitsJudgedRun`.
- `service/adaptations/unit-repair-change.ts` has `automationStudioGraphWithUnitRepair`, used by both the rerun
  candidate (through `graph-flow-patch.ts`) and the apply. It writes the repair through the same overlay, and refuses:
  - a changed unit digest;
  - a `replace_unit` whose `targetId` and unit disagree;
  - any change to a second unit (the overlay's guard).

  An automation-scope handler is built at Subflow scope and then given `{ kind: "automation" }`.
- `service/adaptations/unit-repair-apply.ts` has `applyAutomationStudioUnitRepairPatch`.
  - It refuses an adaptation that carries a unit repair plus anything else.
  - It resolves the target graph:
    - a node or handler goes to the adaptation's Subflow graph;
    - a part goes to the part's graph;
    - an automation scope goes to the `recovery` Subflow, created on demand, with a `delete_created_subflow` rollback.
  - It validates the result with the Subflow role, saves it, and returns mutation records.
- `durable.ts`: the loop calls the new `applyFlowAdaptationPatchMutations`, which may return two mutations. The graph
  transaction never claims these kinds, so review falls through to the file-backed durable apply.

**Tests (new or changed):**

- `runtime-session/tests/in-run-repair.test.ts` (6 tests):
  - one request carrying the unit, contract, incident, history and page evidence, returning an overlay, with a pending
    adaptation and proposal;
  - asked once per incident, and `none` past the cost ceiling;
  - not supplied for a non-adapting run or for the diagnosis-only and propose-only lanes;
  - `none` on a decline or a different unit;
  - `none` on undeclared consequences;
  - the detached path is skipped for an incident already repaired.
- `adaptations/tests/unit-repair-apply.test.ts` (6 tests):
  - `add_handler` and `replace_unit` written exactly as the run overlaid them;
  - a stale digest is refused;
  - a second unit and a mismatched target are refused;
  - an automation scope goes to the recovery Subflow, created on demand;
  - the judged settle applies only a kept fix that was judged `answers`;
  - the candidate skips an automation-scope handler.
- `recovery/in-run-repair/tests/unit-contract.test.ts` (3 tests).
- `live-patch/tests/in-run-kinds.test.ts`: E1's test that pinned the `edit_recovery` mapping was updated. Two
  `prepareAutomationStudioInRunRepair` cases were added.

**Fixture for the later end-to-end unit:** `AS/runtime/service/runtime-session/tests/in-run-repair-fixture.ts`.

- It exports `inRunRepairWorld({ scripts, behavior, policy })`, `inRunRepairRequest()`, `inRunRepairGraph()`,
  `inRunRepairHandlerPatch()` and its constants.
- A world has a scripted provider: each script is patches with an optional `costUsd`, a `decline`, or a `fail`.
- It also has the ports, an adapting context, `graphOptions`, the requests made, and the saved adaptations and
  proposals.

**Docs:**

- `docs/architecture/automation-studio.md`:
  - The "a model is only ever called after the run" sentence is rewritten: in the run, at the failing step, only on a
    true failure, never for retries or planned fails, and the fix is saved only after a judged whole run.
  - Unit B's "Recovery traces" section is extended, not repeated: `lifecycle.selection`, `failureClass` (stamped only
    with a Handler in scope; counts come from incidents), `effectCheck`, `repair`, Call Subflow attempts
    (`subflowTarget`, `childTrace`, `checkpointRoute`, `flowVersions`), and the root trace's `handlerExecutions`,
    `lifecycleNotes`, `incidents` with `ending`, `repairs`, `successCheck` and frame `failure`. Also `failureCounts`,
    and the `interrupted` status.
  - A new section, "Repairing a true failure in the run".
  - Notes in the shipped-app lanes and the judged-promotion step 5.
- `docs/architecture/automation-studio/persistence.md`:
  - The orphaned run now ends `interrupted`. The doc still said `failed` and that "no reader knows an `interrupted`
    status yet", but the code already ends it `interrupted`.
  - A new paragraph documents `metadata.inRunRepairs`.

## Commands run and observed results

All were run in `packages/fluxiq` unless noted.

- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`, final run: one
  error, `runtime/conversations/commands/run-flow.ts(105,7): error TS2739 ... missing the following properties from
  type 'Record<AutomationStudioChangeProposalKind, string>': add_handler, replace_unit`. That file is outside my
  ownership. No other errors.
- `npx vitest run AS/runtime/live-patch AS/runtime/tests/live-patch.test.ts AS/runtime/tests/live-patch-target-override.test.ts
  AS/runtime/tests/service-flows AS/runtime/recovery AS/runtime/service/adaptations AS/runtime/service/runtime-adaptation
  AS/runtime/service/runtime-session`, final run: `Test Files 1 failed | 95 passed (96)`, `Tests 2 failed | 996 passed (998)`.
  The two failures are `representation.test.ts` "seeds a rerun from the failed attempt ... (routed)" and
  "(legacy single graph)": `expected [] / undefined to deeply equal [ObjectContaining{ kind: "temporary_wait_retry" ... }]`.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` at the Core root: `structure-audit: passed (314 warning(s), 1160 baselined).`
  - The first run found 4 failures in my new code: `failure-as-empty` in request.ts, in-run-repair.ts and service.ts
    (17 > 16), and `imports` in request.ts. All four were fixed.
  - Advisory warnings remain: `live-patch.ts` is 719 lines and `annotate.ts` 766, against an 800 limit.
- `node scripts/structure-audit.mjs --rule docs-links`: `structure-audit: passed (0 warning(s), 0 baselined).`
- `node scripts/structure-audit.mjs --rule statement-packing`: passed.
- End-to-end probe through the real `AutomationStudioService` and E2a's executor. I wrote it as a temporary test in
  `runtime-session/tests` and deleted it afterwards.
  - Fix that does not hold (a wait-retry): 1 model request; the attempts read `repair.outcome` `held` and then
    `dropped`; the run is `failed`; `llmGate.code` is `llm.gate.repaired_in_run`; the receipt settles `not_rerun`.
  - Fix that holds (a `replace_unit` with a constant step): 1 request; `gate` failed (`held`), then `gate` succeeded,
    then `end`; the run is `succeeded`; `trace.repairs` holds the repair id; the receipt settles `not_judged`. That
    probe service has no result checker; `not_judged` rather than `not_rerun` shows the settle saw the fix as run.

## Not verified

- No live run and no real provider. Everything above used a scripted provider.
- A judged-`answers` end-to-end apply through the real service. Only the settle with fakes is tested, plus the probe
  above, which ended `not_judged`.
- Part repairs (`replace_unit` of a part) through the real executor. Only the overlay and durable paths are tested; the
  contract has a unit test.
- The prompt-side effect of `metadata.inRunRepair`. The model sees it inside `context.metadata`, which the DeepSeek
  body sends whole, but no stage instruction explains it.
- The full suites (`pnpm check`, `pnpm test`), per the twice-daily rule.

## Open questions or contradictions found

1. **`run-flow.ts` needs two entries** (outside my ownership). In `BY_KIND`, add:
   - `add_handler: "it learned a way past an interruption it met"`
   - `replace_unit: "it re-wrote a step that stopped working"`

   Until then, `tsc` fails for everyone in this tree.
2. **`representation.test.ts` "seeds a rerun ..." (2 cases)** asserts the detached rerun on an adapting run. Now that
   E2a's executor holds the run and calls the callback, this run makes one in-run request and skips the detached path.
   Its wait-retry on the disconnected `divide` node cannot fix `gate`, so the fix is dropped and
   `runtimePatchAttempts` stays empty. The test owner needs to either:
   - assert the in-run receipt instead; or
   - make the run one that cannot hold, for example `adaptiveMode` without in-run repair (no such opt-out exists today),
     or a lane that is not supplied.
3. **"One model request" read as one `runtime_patch` call.** I made no separate diagnosis call and no exploration.
   `planAutomationStudioRuntimeRecovery` needs a model diagnosis result to request a patch. So the in-run plan's kinds
   come from the deterministic classification (`automationStudioInRunRepairPatchKinds`), and the incident stands as the
   diagnosis. If the supervisor wants today's two calls (diagnosis, then patch) in the run, `request.ts` is the one
   place to change.
4. **Harness change to name (RC lane).** Make `inRunRepair` a typed packet slot with a stage instruction, along the
   lines of "fix only this unit; do not repeat completed acts". Today it rides in `metadata`, unexplained to the model.
5. **Housekeeping.** I deleted `packages/fluxiq/src/node_modules/.cache/fluxiq-build/check.tsbuildinfo`. My first `tsc`
   ran from `src/` by mistake and wrote to it, but the directory dates from 19:07, so another worker's run created it
   first. It is a cache only; the next incremental run rebuilds it.
