# t392 D1 - checkpoint and ready-state fact gate on state routing (Core) - worker report

## Outcome

Done. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, branch `task/t392-executor-integration`, not committed.
All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/executor/`.

## What changed and why

- `state-routing/checkpoint-facts.ts` (new): `automationStudioStateRouteFactGate({ flow, nodeIds, hostRuntime, context })`.
  - It returns `{ refused: Map<nodeId, { guard, truth? }>, calls: 0 | 1 }`.
  - It makes one `observeAutomationStudioFacts` call, imported from the `lifecycle-run` barrel. Each gated node is one
    group in that call. When no node has conditions to ask, no call is made.
  - **Checkpoints declared** (any node carries a `fluxiq.checkpoint` metadata key, read with `automationStudioSubflowContract`):
    - Every node that is not a readable checkpoint is refused `not_checkpoint`. That covers nodes with no checkpoint
      and nodes whose checkpoint has no id.
    - A checkpoint is refused `checkpoint_when_not_true` unless every condition in its `when` answers `true`.
    - A checkpoint whose declaration has a parse problem gets a condition that can never be sent. That condition always
      answers `unknown`, so the parser cannot loosen the checkpoint by dropping a malformed condition.
  - **No checkpoints declared:** a node is gated only when its `readyState` parses cleanly as fact conditions. This
    uses the same rule as the private `factReadyState` in `lifecycle-run/dispatch.ts`. Such a node is refused
    `ready_state_not_true` unless every condition answers `true`. A ready state in expectation form, or no ready state,
    is not gated.
  - `unknown` never passes: the all-true check is `automationStudioFactConditionsHold`. A host without a
    `factEvaluator` answers `unknown`.
- `state-routing/decision.ts`:
  - After the matches are ranked, the gate runs once over all ranked node ids. The fact context is the failing
    `nodeId` plus the run's `inputs` and `signal`.
  - In `firstAllowed`, a fact-gate refusal is checked first. Guards (a) and (b) follow, unchanged.
  - Refusals go into `record.refused` with `nodeId` set to the target itself, and a sentence goes into `reason`.
  - Refused candidates are skipped and the next ranked one is tried. If none is left, the decision is `none`.
  - Refusals happen before `guarded()`/`admit`, so the progress guard never counts one as a return.
  - The doc comment was updated.
- `state-routing/index.ts` exports the gate and its types.
- `defensive/continuation.ts` was not changed. It did not need to be.
- `state-routing/tests/checkpoint-facts.test.ts` (new, 11 tests). It covers:
  - with checkpoints declared, a non-checkpoint is refused and a checkpoint whose `when` holds is taken (with exactly
    one host call);
  - a checkpoint whose `when` answers `unknown` is refused (decision `none`), and so is one whose `when` answers `false`;
  - with no `factEvaluator`, nothing qualifies;
  - a malformed checkpoint `when` is refused;
  - two matched checkpoints are asked in one batched call of 3 conditions;
  - a ready-state fact gate refuses a closer match whose facts are `false`, and the next ranked match is taken in one
    call; when the facts hold, the match is taken;
  - an expectation-form ready state is routed as before, with 0 calls;
  - a Flow with neither checkpoints nor fact ready states makes 0 calls, both through the decision and through the gate
    directly.

## Commands run and observed results

From `packages/fluxiq` unless noted:

- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`
  - First run after the tests were added: 1 error, in my new test. The fake `factEvaluator` result lacked `capturedAt`.
    I fixed it.
  - Final run: no output, `tsc exit 0`.
- `npx vitest run $A/state-routing/tests $A/tests/state-routing-run.test.ts $A/tests/safe-state-routing-run.test.ts $A/defensive/tests`
  (with `A=src/programs/automation-studio/runtime/executor`): `Test Files 20 passed (20)`, `Tests 149 passed (149)`.
  No existing test changed.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` (Core root): `structure-audit: 1 violation(s) across 1 rule(s).`
  - The one violation is `[statement-packing] packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
    (45 lines against a baseline of 44). That file is not mine.
  - The audit reports nothing for `state-routing/` or `defensive/`.

## Not verified

- No live or browser run, and no web-host `factEvaluator` exercised.
- Not run through `runAutomationStudioGraph` with checkpoints. The graph-run integration tests that already exist pass
  unchanged.
- No full suites, as the brief required.

## Open questions or contradictions found

1. **Checkpoints still need a signature match.** A checkpoint is a candidate only when its recorded `before` signature
   matches the page, as for any other candidate. Its `when` facts are an extra requirement. A checkpoint with no
   recorded pre-state is therefore never a state-routing target. If checkpoints should qualify on their facts alone,
   the candidate list must change.
2. **An empty or absent checkpoint `when` holds.** `automationStudioFactConditionsHold` treats an empty list as true,
   so such a checkpoint qualifies on its signature alone, even when the host has no fact evaluation. Brief item 3
   ("nothing qualifies") holds only for checkpoints that declare `when` conditions.
3. **The `effect_holds` route is not gated.** That route goes along the failing step's own success edge, as if the step
   had run, so I did not apply the checkpoint or ready-state gate to it. In a checkpointed graph this lets the run
   continue to a non-checkpoint successor. Ask if it should be gated too.
4. **The `service.ts` statement-packing failure belongs to another worker** and needs fixing before the audit passes.
