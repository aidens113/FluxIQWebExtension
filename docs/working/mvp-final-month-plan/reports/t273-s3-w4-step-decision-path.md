# t273-s3-w4-step-decision-path: P5 `$step` on the decision path

Worker report for brief "t273-s3-w4-step-decision-path" (`t273-creation-wiring.md`, S3). Core tree `fxwork/t273/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime`. No commits, no Lab, browser or provider calls.

## Outcome

Done for the owned files. A model's `{"$step": n, "output": ..., "path"?: ...}` in a written `core.run_node` call, and in a rerun of a written step, is now translated against the draft and accepted end to end: it is stored as the earlier step's own id and resolves in the build's test. Targeted tests, `R/llm` and `R/tests/earlier-output` all pass.

`fluxiq:check` and the structure audit each fail, but only in w6's files. Details are under "Commands run".

## What changed and why

Items 1-4, 7 (the `unusable-decision.ts` text) and 8 of t270's "Specified for t264-owned files".

- `R/llm/evidence-loop-decision.ts`:
  - `automationStudioLlmEvidenceParseDecision(value, binding?)` and `automationStudioLlmEvidenceDecisionIssueCodes(value, binding?)` take an optional `AutomationStudioFlowDraftBindingContext`.
  - They pass it to `readNodeCall`, which hands it to `automationStudioFlowDraftTranslateBindings`.
  - Without a context, behaviour is unchanged: `$step` is still `step_binding_not_yet`.
- `R/llm/evidence-loop.ts`:
  - The parse and the refusal both receive `drafting ? { steps: draftSteps, nodeOf: input.nodeOf } : undefined`, with no `at`.
  - The file stays at 798 lines because I joined `unreadable.readable(); unanswered.answered();` onto one line to make room for the `binding` constant.
- `R/llm/evidence-loop/decision-refusal.ts`: `automationStudioLlmEvidenceDecisionRefusal` takes a fourth optional `binding` and passes it to the issue codes, so the parse and the refusal can never disagree.
- `R/llm/evidence-loop/rerun-request.ts`:
  - `writtenInput(merged, steps, step)` translates with `{ steps, at: step.position }`.
  - A `step_*` refusal stays `bind_malformed`, as the lead decided. I updated the header comment to match.
- `R/llm/unusable-decision.ts`: `run_node.binding_refused` now uses t270's exact sentence in place of "`{"$step": ...}` is not available yet."
- `R/llm/node-tools/run-node.ts`:
  - `PARAMETERS_DESCRIPTION` now contains t270's `$step` sentence.
  - I attached it to the `$row` sentence as "..., or {"$step": ...} ... (add "path": ...)." because t270's text begins with "or" and would otherwise start a sentence.
- Tests:
  - `R/llm/evidence-loop/tests/authored-draft.test.ts`:
    - The no-draft `step_binding_not_yet` case is kept and commented.
    - New: a draft-given parse translates `$step` 1 to `$step.d4.records.name`.
    - New: a draft-given refusal gives `step_missing`, `step_not_usable` (dropped) and `step_output_unknown`, each with its path.
  - `R/llm/evidence-loop/tests/rerun-request.test.ts`:
    - New: a written step's rerun translates `$step` 1 to `$step.d1.records`.
    - New: a rerun reading itself (3) or a later step (4) is refused `bind_malformed`, unrun.
    - The existing recorded-step case (`rerun_holds_binding`) is still correct and unchanged.
  - `R/llm/node-tools/tests/run-node.test.ts`: asserts the `$step` sentence in the parameters description.
  - New `R/tests/earlier-output/tests/loop.test.ts`, the end-to-end test through `runAutomationStudioLlmEvidenceLoop` with `nodeOf`:
    - (1) The model runs and adds a read, then writes a type step with `{"$step": 1, "output": "first", "path": "label"}`.
      - The host receives `$state` `$step.<read id>.first.label`, never the model's form.
      - The step is stored (kept, written) holding that binding.
      - `replayAutomationStudioFlowDraft` sends "Fresh", the value the read answered in the test, rather than "Explored".
    - (2) After two reads and a `drop` of step 2, written calls reading step 3 (itself) and step 4 (later) are refused `step_missing`. Step 2 (withdrawn) is refused `step_not_usable`, and an undeclared port is refused `step_output_unknown`.
      - Each refusal carries `:parameters.text`, and none of these calls is sent.
      - The `core.decision_check` instruction shows the `$step` form and no longer says "not available yet".
  - The directory had 2 files and now has 3. It uses a local constant for `run_node.binding_refused`, because the llm barrel does not export it and the audit refuses a deep import.

## Commands run and observed results

All commands were run from `packages/fluxiq` unless noted.

- **Fail-first**, before any source edit: `npx vitest run` on loop.test, authored-draft.test, rerun-request.test and run-node.test.
  - Result: `Tests 6 failed | 98 passed (104)`.
  - The parse and the rerun returned undefined or `bind_malformed`.
  - Loop test (1): the written call was never sent (`host.calls[1]` undefined).
  - Loop test (2) received `run_node.binding_refused.step_binding_not_yet:parameters.text` where `step_missing` was expected.
  - The run-node description lacked `$step`.
  - The dispositions mismatch in that first run was a test defect: the second read was an exact repeat. I fixed it by giving that read distinct parameters.
- **After the source edits**, the same 4 files: `Test Files 4 passed (4)`, `Tests 104 passed (104)`.
- `npx vitest run <R>/llm <R>/tests/earlier-output`: `Test Files 159 passed (159)`, `Tests 1553 passed (1553)`.
- `node scripts/build-cache/cli.mjs fluxiq:check` (Core root): failed with tsc exit code 2. Both errors are in w6's files and come from w6's new required `paired`:
  - `conversations/commands/tests/execute.test.ts(61,3)` TS2375: `paired` is optional in the type passed but required in `AutomationStudioConversationCommandContext`.
  - `conversations/commands/tests/extension-chat.test.ts(354,69)` TS2345: `paired` is missing.
  - My files have no type errors.
- `node scripts/structure-audit.mjs` (Core root):
  - The first run flagged my deep import in loop.test.ts, which I then fixed.
  - The second run shows 1 violation, which is not mine: `conversations/commands/: 26 source files exceeds the 25-file limit` (w6's new `run-learned.ts`).
- Line endings: all 10 touched files report CRLF (`file`). `evidence-loop.ts` is 798 lines.

## Not verified

- No live run, Lab, browser or provider call took place.
- `fluxiq:check` did not exit 0 because of the w6 errors above. I did not re-run it after w6 finishes.
- I did not exercise a rerun put-back or a part run that reads a `$step` source. t270 already notes these send nothing and fail `core.replay.unresolved_binding`.
- I did not exercise assembly of a draft built through the loop. `stored-flow.test.ts` covers assembly from a hand-built draft.

## Open questions or contradictions found

- **No `at` on a written call (per the brief).** A written call that reads itself or a later step is therefore refused `step_missing` ("No step has that number"), not `step_not_earlier`.
  - Passing `at: draftSteps.length + 1` would give the more telling `step_not_earlier`, but appended positions are not always `length + 1` once reruns replace steps, so I followed the spec.
- **A run step that was not added can still be read.** A "taken" step (run in authoring mode but not added) is not refused by `binding-forms.ts`, which treats only `dropped` and `exploratory` as withdrawn.
  - So a written call can read a step that is not in the Flow. Assembly would then refuse it (`step_binding_source_missing`), presumably. I did not verify this.
  - This rule belongs to `R/flow-draft/**`, which is not mine.
- The `unusable-decision.ts` sentence is t270's text verbatim. It follows "and nothing else in that object;" without an "or", which reads slightly abruptly.
