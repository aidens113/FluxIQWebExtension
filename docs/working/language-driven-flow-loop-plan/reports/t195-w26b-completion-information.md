# t195-w26b: the completion stops refusing on instructed acts, except the permission rule

Worker t195-w26b, 2026-10-01. Core `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch `task/t195-live-control-flow`,
on top of w24b's uncommitted round-4 edits. `R` = `packages/fluxiq/src/programs/automation-studio/runtime/`.
Implements design section 4.3 (W2) of `t195-w25-completion-judge-design.md`, plus the brief's two additions.

## Outcome

Done. A completion is no longer refused for any instructed-act reason except `act_consequence_undeclared`. The
checklist stays as information and now carries the repeat suggestion. Every test in the brief's list is in place, and
each new case was checked to fail with the change reverted.

## What changed and why

- `R/flow-bootstrap/instructed-acts/step-fault.ts`: extracted and exported
  `automationStudioInstructedActConsequenceUndeclared(act, step, steps): boolean`, which covers the step plus its
  repeat span. `automationStudioInstructedActStepFault` now calls it, so its behaviour is unchanged.
- `R/flow-bootstrap/instructed-acts/check.ts`: no behaviour change. The following are now exported:
  - `automationStudioInstructedActClaims({ acts, choices, result })` (the old `readClaims` + `assign`);
  - `automationStudioInstructedActClaimedStep(steps, named)` (the old `findStep`, which the permission rule needs to
    resolve a claim to a step);
  - `AUTOMATION_STUDIO_INSTRUCTED_ACTS_INSTRUCTION` and `AUTOMATION_STUDIO_INSTRUCTED_ACT_CONSEQUENCE_INSTRUCTION` (the
    old `INSTRUCTION` and `CONSEQUENCE_INSTRUCTION`).

  The header now says the verdict is information and refuses nothing.
- `R/flow-bootstrap/instructed-acts/permission.ts` (new): `checkAutomationStudioInstructedActPermissions({
  instructionText, result, draftSteps })`. For each act that has a `consequence`, it takes every step named for it (the
  step's own `acts`, plus result claims) and keeps those that are kept, `effect: "mutate"` and proposable. It refuses
  when any of them, together with its repeat span, declares no step of that class, whatever other fault the step has
  (optional included). An act named on no step is left alone.
  - It returns `{ ok: false, issue: { code: "bootstrap.instructed_act_missing", path: "acts", ... }, missingActs: {
    acts: [{ id, kind, verb, quote, consequence, reason: "act_consequence_undeclared", step }] }, instruction }`.
  - `instruction` = the two reused instruction constants.
  - It also exports the type `AutomationStudioInstructedActPermissionVerdict`.
- `R/flow-bootstrap/instructed-acts/index.ts`: exports `permission.ts`, with a note in the header.
- `R/flow-bootstrap/instructed-acts/checklist.ts`:
  - **Addition 2:** the "One loop, not two" paragraph, which promised "never shows done what a completion then
    refuses", is rewritten as "Information, not a gate (t195)".
  - The todo detail gains `after` (from `standing.after`, for `span_stops_short`).
  - The act item gains optional `repeatWith: JsonObject` and `repeatSaid: string`.
  - `automationStudioInstructedActsChecklistValue` copies `repeatWith`.
- `R/flow-bootstrap/instructed-acts/standing.ts`: rewrote the header's matching "never shows done what a completion
  refuses" sentence (comment only).
- `R/llm/harness-options/bootstrap-completion.ts`: the instructed-acts failure at the old `:294-301` is replaced by the
  permission check. It keeps the same code `flow_bootstrap.evidence_completion_cannot_answer` and the detail key
  `missingActs`. The `repeat-suggestion` import and call are removed. The header paragraph about "Does this Flow do what
  it was told to do?" is rewritten, along with the two summary sentences that listed the acts check.
- `R/llm/harness-options/draft-acts.ts` (**addition 1**): `automationStudioFlowBootstrapDraftActs` takes optional
  `registry` and `resolution`. When both are given, an act whose todo is `act_needs_repeat` or `span_stops_short` gets
  `repeatWith` (the amendment) and `repeatSaid` (the suggestion's sentence), from `automationStudioRepeatSuggestion`.
  - The suggestion is fed a one-act `missingActs`: `{ id, reason, step, after }`.
  - `repeat-suggestion.ts` keeps its logic and gains one header paragraph naming its new caller.
- Tests:
  - `R/llm/harness-options/tests/bootstrap-completion.test.ts`: the two act describes are rewritten.
    - These are now acceptances: no steps named; the read claimed as the add; run 36 (a1 on the listing alone, with
      the Confirm repeated over it, and a1 on both); lane B (`a1.size` on the Add, where the checklist says
      `choice_is_the_act_step`); run 40 (a2 named on the towels' Add, where the checklist says
      `step_acts_on_another_object`).
    - The old "still names the two acts left undone" case was folded away, since it is the same acceptance.
    - The arrival describe's refusal case went the same way. Its acceptance case is kept, now inside the first
      describe's set.
    - New describe for the permission rule: a withdraw press declaring `modify_existing` is refused
      `act_consequence_undeclared`, with `missingActs` asserted exactly; the same press marked optional is still
      refused; declaring `delete` is accepted, optional or not. These cases pass a binding that answers `unchanged` and
      a permitting `permissionFor`. Without them, a press declaring `delete` is refused
      `bootstrap.step_permission_required` by parameter resolution, because there is no domain to ask.
  - `R/llm/harness-options/tests/draft-acts.test.ts` (new):
    - `repeatWith` is shown for `act_needs_repeat` (`{step:3, over:2, through:3}`) and for `span_stops_short`
      (`{step:2, over:1, through:3}`, `after: 3`);
    - nothing is shown without a registry, or once the act is done.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts src/programs/automation-studio/runtime/llm/harness-options`
  (in `packages/fluxiq`): **Test Files 15 passed (15), Tests 335 passed (335).**
- Revert check: I temporarily overwrote `bootstrap-completion.ts` and `draft-acts.ts` with `git show HEAD:` (neither
  file had uncommitted edits before mine), then restored my versions from scratch copies.
  - Running `bootstrap-completion.test.ts` and `draft-acts.test.ts` gave **9 failed | 23 passed**. The failures were
    both draft-acts repeat cases, no-steps-named, read-as-add, lane B, run 40 and all three permission cases.
  - The first run 36 version (a1 on both steps) passed with the revert, because w24b's standing loop already accepts
    it. I added the read-only shape, re-ran with the revert, and saw **1 failed** (`expected false to be true`). Then I
    restored the file.
  - `git diff --stat` confirmed both files were restored.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w26b tsc" npx tsc --noEmit -p tsconfig.json`: exit 2.
  There are only two errors, both in files I do not own (W4's):
  - `result-verification/build-test/tests/judge.test.ts(13,8)`: TS2307, cannot find `./build-test-drafts.ts`;
  - `result-verification/build-test/tests/summary.test.ts(12,8)`: the same.

  There are no errors in my files.
- `node scripts/structure-audit.mjs` (Core root): **passed (213 warnings, 349 baselined)**. There is one new advisory
  warning: `instructed-acts/check.ts` is now 423 lines, past the 400-line advisory.

## Not verified

- No full suites, as the brief forbids. Tests outside my scope that might assume the old act refusal were not run:
  - `unfinished-build/tests/phases.test.ts`;
  - the `generation-failure`, `incomplete-draft`, `decision-context`, `evidence-progress` and `harness` tests that
    mention `missingActs`.

  Most of them appear to use recorded feedback rather than calling the completion check.
- Live behaviour: no Lab, browser or model call was made.
- `repeatWith` reaches the model only once `service.ts:1583` passes `registry` and `resolution` to
  `automationStudioFlowBootstrapDraftActs`. Both are in scope there. That is a lead integration edit in `service.ts`,
  which I do not own.

## Open questions or contradictions found

1. **Lead integration:** at `service.ts:1583`, change `automationStudioFlowBootstrapDraftActs({ instructionText:
   bootstrapInstructionText, startLocation })` to add `registry, resolution`. Until then the checklist shows no
   `repeatWith`.
2. As the design says, the permission refusal reuses `AUTOMATION_STUDIO_INSTRUCTED_ACTS_INSTRUCTION`. Its first sentence
   says the acts are things "no step in your Flow is named as doing", which is slightly off for a step that is named
   but undeclared. `CONSEQUENCE_INSTRUCTION` follows it and states the real fix. A dedicated lead sentence would be
   clearer, if the lead wants one.
3. Design 3.2 calls run 36's draft "refused"; with w24b's loop, a1 named on both the listing and the repeated Confirm is
   already accepted. The test therefore covers the shape the old check still refused (a1 on the read alone) as well as
   the both-named shape.
4. The completion's `startLocation` is no longer used by any act check. It is still used by the start-step restore and
   reachability, so the input is unchanged.
5. `check.ts` crossed the 400-line advisory. If the lead wants it below, the claim reading (`automationStudioInstructedActClaims`
   and its helpers) could move to its own file.
