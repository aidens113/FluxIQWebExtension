# t193-1003-w5-amendment-answers: worker report

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQ`. In this report, R means
`packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

**Partial.** Causes 5 and 6 are fixed and reach the model through the existing answer path. For cause 8, the move is
now detected, returned and worded in my files. The model will still not see it until a file I do not own passes it
on. See "Not verified" and "Open questions".

## What changed and why

- **Cause 5 (bind of a press's `target`): `R/flow-draft/amendment.ts`.** `bindStep` now passes what the draft
  shows (the parameters of `step.input`) to `collectBindLeaves`, alongside what the step ran with (`ranWith`).
  - The check itself is unchanged and still runs against `ranWith ?? input`.
  - When a key is missing from `ranWith` but present in the shown input, the refusal keeps code `bind_new_key` and
    gains `control: true`. That is the control the step acted on, as with a press's `target` run as a selector.
  - The new optional field on `AutomationStudioFlowDraftAmendmentRefusal` is documented.
  - `flow-bootstrap/evidence-loop-steps.ts` strips unknown fields from step records, and the activity wording is
    keyed by code alone. Neither needed a change.
- **Cause 5 wording: `R/llm/draft-amendment-feedback.ts`.**
  - The `bind_new_key` reason no longer says "as the draft shows it". It now says a bind lifts a value the step typed
    or chose. When the key names the control a step acted on, it says a press has no value to vary, its control is
    found by its words each run, and the step is left as it is.
  - A refusal carrying `control` gets this `next`: "On step N, <param> names the control the step acted on, not a
    value it typed or chose: a press has no value to vary, and its control is found by its words each run, so it is
    never bound. Bind only a value a step typed or chose. Leave step N as it is." It then gives the checklist's acts
    still to do. With no checklist it ends "... and go on with what the Flow still lacks."
- **Cause 6 (every refusal names the acts still to do): `R/llm/draft-amendment-feedback.ts`.**
  - A new `stillToDo` builds the `next` for any refusal that has none from `nextStep` or `actDone`.
  - It reads the same `actsNotDone` source as `act_already_named`, through a shared `checklistLeft` sentence: "Still
    not done on the checklist: a2, a2.quantity, a3, a3.size. Go on with those.", or "Nothing on the checklist is still
    to do: complete ...".
  - `already_in_flow` is led by "Step N is in the Flow already: leave it."
  - `already_out` is led by "Step N is out of the Flow already: leave it out."
  - One exception is deliberate, and an existing test pins it: `act_already_named` for an act the checklist still
    shows not done gets no checklist `next`. Its todo is the fault, and naming the checklist would send the model
    back to the same act.
  - With no checklist (`actsNotDone` undefined), nothing is added except the `control` press `next`.
- **Cause 8 (an act moves to another step).**
  - `R/flow-draft/act-claim.ts`: `automationStudioFlowDraftClaimAct` now returns the steps the act was taken off. The
    return type changed from `void` to `AutomationStudioFlowDraftStep[]`, and the existing caller in
    `llm/evidence-loop.ts` that ignores the return still compiles.
  - `R/flow-draft/amendment.ts`: `applyAutomationStudioFlowDraftAmendments` collects those claims and, once every
    amendment of the decision has applied, returns `moved?: {act, from, to}[]`.
    - A move is listed only when the step left is still in the Flow (`StepIsProposed`), has no act left, and the
      receiving step still holds the act.
    - Positions are the final ones after any reorder in the same decision. A step the same decision dropped, or a
      swap that leaves each step with one act, gives nothing.
    - The field is present only when non-empty, so existing `toEqual({applied, refused})` assertions hold.
    - It is never a refusal and never a drop: the step left keeps its disposition.
  - `R/llm/draft-amendment-feedback.ts`: a new `moved` input renders as `moved: [{step, act, to, note}]`. The note
    reads: "Step 16 no longer does a3: step 24 does it now. Step 16 now does no act, yet it is still in the Flow, so
    it is pressed in every run unless you drop it: send {"step": 16, "change": "drop"} unless the Flow needs it for
    something else."
    - A `MOVED_INSTRUCTION` sentence is added.
    - An answer that only reports moves is `ok: true` with code `llm_evidence_loop.draft_act_moved`, and does not
      carry the "changed nothing" instruction.
    - Beside refusals, it keeps the refusal code and adds `moved`.
- **Tests, written first.** All eight new tests failed before the change: 3 in act-claim, 1 in amendment and 4 in
  feedback.
  - `R/flow-draft/tests/amendment.test.ts`: a bind of `target` on a dom-click whose `ranWith` holds a
    selector/element gives `control: true`, in both the form and the nested shapes. A truly new key does not.
  - `R/flow-draft/tests/act-claim.test.ts`: the claim returns the steps it left. A move reports `moved` and the step
    left stays kept. There is no `moved` for another act kept, a same-decision drop, or a swap. The numbers are the
    final ones after a reorder.
  - `R/llm/tests/draft-amendment-feedback.test.ts`: the press answer and its `next`, with and without a checklist.
    All-refused `already_in_flow`, `already_out`, `bind_new_key` and `bind_not_a_binding` each carry the acts still
    to do. The moved answer names the step it left.
- No system-prompt pin changed. The amendment schema and the system prompt are untouched.

## Commands run and observed results

- `npx vitest run` on the three test files before the change printed `Tests 8 failed | 49 passed (57)`. The 8 failures
  were exactly the new tests.
- The same command after the change printed `Test Files 3 passed (3)` and `Tests 57 passed (57)`.
- The brief's command, run from `packages/fluxiq`, printed `Test Files 53 passed (53)`, `Tests 660 passed (660)` and
  `Duration 32.07s`:
  `npx vitest run src/programs/automation-studio/runtime/flow-draft src/programs/automation-studio/runtime/llm/tests src/programs/automation-studio/runtime/llm/deepseek/tests`
- The brief's typecheck printed `[heavy] t193 w5 tsc holds b2` with no diagnostics, `exit=0`:
  `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t193 w5 tsc" npx tsc --noEmit -p tsconfig.json`
- Not in the brief, run because they consume the feedback:
  `npx vitest run src/programs/automation-studio/runtime/llm/evidence-loop src/programs/automation-studio/runtime/llm/decision-handlers`
  printed `Test Files 28 passed (28)` and `Tests 229 passed (229)`.
- `node scripts/structure-audit.mjs` from the Core root printed
  `structure-audit: passed (242 warning(s), 349 baselined).` with exit 0.

## Not verified

- **No live run.** Whether the model now leaves a press's target unbound, and goes on with the acts, has not been
  seen live.
- **Cause 8 does not reach the model yet.**
  - `R/llm/decision-handlers/amendment.ts` calls the feedback (`tell`, l.134 and l.173-178) only when something was
    refused or undone, and does not pass `amended.moved`. An applied-only move is therefore not told.
  - The live run's actual move (round 2, 0144) happened on a `core.run_node` write with `act a3`, through
    `R/llm/evidence-loop.ts` l.213. That caller ignores the claim's new return value.
  - Neither file is in my ownership.
- `git diff --stat` also shows `R/flow-draft/verify-only.ts` changed. I did not touch it; it is other in-flight work in
  this tree.

## Open questions or contradictions found

- **Wiring still needed for cause 8, outside my files.**
  - In `R/llm/decision-handlers/amendment.ts`, pass `moved: amended.moved` into
    `automationStudioLlmEvidenceDraftAmendmentFeedback`. Call `tell` also when `amended.moved?.length`, at l.134 and
    in its signature.
  - In `R/llm/evidence-loop.ts` l.213 (a call with `add` or `write` and `act`), use the claim's returned steps. Tell
    the same note, for example by building `{act, from, to}` for steps left in the Flow with no act and adding it to
    that call's evidence. This is the path the live failure took.
- The debug's cause 5 suggested a distinct refusal code. The brief said to keep `bind_new_key`, which I did, and
  added the optional `control` field instead. If the chat wording should differ for a control bind, the
  `R/activity/wording/` owner can read `control`. They currently key on the code alone.
