# First-row toggle polarity discovery

## Observed facts

- In `domain/src/runtime/llm-evidence/node-run/press-effect/toggle-signature.ts`, the domain derives the signature solely from one control's before/after reading. `webToggleSignatureOf` reports the state the press actually left (`domain/src/actions/toggle-signature/derive.ts`); it receives no task intent or loop-row context. It cannot decide whether that direction fulfills the requested action.
- In Core, `AutomationStudioExploredToggles.trial()` records each succeeded, unskipped attempt's signature and the step's written parameters (`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/explored-toggles.ts`). The record has no row/control identity for the individual loop pass. Repeated records are deduplicated by trial node, signature and step parameters.
- `automationStudioExploredToggleTie()` returns the first tied record (`packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/script-statements/toggle-tie.ts`). `automationStudioFlowPlanToggleSteps()` applies that signature as `ensureState` (`.../script-statements/toggle-idempotent.ts`). Thus, if a loop's first row was already in the requested state and the trial pressed it anyway, its opposite-direction signature wins over later rows' direction. The change is then carried to every row by the loop node.
- Existing tests make that policy explicit: `.../script-statements/tests/toggle-idempotent-trial-pass.test.ts` asserts that the first trial pass signature is carried to the loop body. It covers mixed pass signatures as a reversal case on the same control, not contradictory states across distinct rows.
- The t799 report confirms learned trial toggles and loop-level `ensureState` behavior passed owning tests. The mvswfjbq debug is a related but different defect: repeated presses on one control while exploring were ordered newest-first; t792 fixed that by using the earliest tied press. That fix does not distinguish row-specific outcomes in a loop.

## Cause and ownership

The immediate cause is Core treating the first successful loop-pass toggle as the loop's polarity. Domain output is accurate for the individual click; inferring desired polarity from action wording or a control's initial polarity would exceed what that output proves. The smallest primary ownership is Core's trial-toggle learning/selection seam (`explored-toggles.ts`, `script-statements/toggle-tie.ts`, and their owning tests). No downstream production change is justified by the inspected evidence.

Inference: a robust generic learner needs evidence that associates each observed signature with a distinct resolved loop target, then must avoid letting one already-satisfied row override the direction repeated by other rows. If the passes do not expose stable, non-sensitive target identity in Core's attempt trace, the missing contract should be added at the existing domain-to-Core toggle output boundary; do not infer it from row position, action text, or a majority that cannot be tied to distinct controls. The trace/output shape should be inspected by the implementation owner before choosing the precise field.

## Recommended fail-first acceptance

Add a Core regression under `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/script-statements/tests/` (and update the relevant `explored-toggles` test if the record shape changes): a loop's first pass is a control already in the requested end state and reports the opposite transition after an erroneous press; two later, distinct rows report the same transition that fulfills the request. The next revision must not receive the first row's opposite signature as `ensureState`. A one-row/conflicting-evidence case must remain unresolved or require new evidence, never pass by assuming the action's intent determines polarity. Preserve the current same-control reversal test: earliest press remains authoritative for two presses of one control.

Native fixture proof should use an existing realistic scenario with multiple independently identifiable rows and toggle controls (photo-social is the current t799 browser fixture), arrange the first matching row already in the requested state and later matching rows in the other state, then exercise the ordinary build/trial path with a scripted provider and zero paid calls. Assert the trial's per-row toggle observations and the next revision's `ensureState`, and verify already-satisfied rows are not flipped on the subsequent pass. Do not change task wording/oracle or encode scenario names in model guidance. This is a proposed acceptance setup, not a claim that the fixture currently has the needed initial row state.

## Return contract

Outcome: Done
Changed: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-discovery.md`
Validation: not run (read-only discovery; no checks requested)
Not verified: the full attempt-trace payload's availability of resolved row identity; whether the current photo-social fixture can be arranged to start with exactly one matching row already liked without changing its oracle; no implementation or browser run
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/first-row-toggle-discovery.md`
Notes: Core owns current first-pass selection. Keep the same-control reversal rule distinct from row-to-row polarity learning.
