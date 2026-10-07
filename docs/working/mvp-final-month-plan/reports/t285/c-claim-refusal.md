# t285-c-claim-refusal (worker-high)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t285/!FluxIQ` (branch task/t285-fix-act-claims).
R = `packages/fluxiq/src/programs/automation-studio/runtime`. No commits, no Lab, browser or provider calls.

## Outcome

Done. If the act judge would reject a claim, the claim is now refused at the moment it is made. This works both for an `amend_draft` that names `act` and for a call run with `add` and `act`. The refusal is reported as `act_not_done_there` and carries `act`, the judge's sentence (`said`, which is the checklist's `todoSaid`) and `instead`. The stall note now repeats the checklist's `todoSaid`, and the build's ending has words for the three new reasons.

## What changed and why

1. **Refusing a claim as it is made**
   - `R/flow-draft/amendment/types.ts`:
     - Adds the reason `act_not_done_there`.
     - Adds the refusal fields `said?` and `instead?`; `act?` is now documented for this reason too.
     - Adds two new types. `AutomationStudioFlowDraftClaimRefusal` is `{ act, said, instead? }`. `AutomationStudioFlowDraftClaimRefused` is the callback `(steps, step, act) => refusal | undefined`.
   - `R/flow-draft/amendment/apply.ts`:
     - `applyAutomationStudioFlowDraftAmendments(steps, amendments, options = {})` now takes `options.claimRefused`.
     - The callback is asked where the claimed act is worked out. That happens before the "nothing changes" check, not literally just before `automationStudioFlowDraftClaimAct`.
     - When the claim is refused, the act is not claimed and the refusal is pushed. `instead` is translated into the numbers the model was shown, through `shown.number`. The rest of the amendment still applies, as `act_on_a_read` does.
     - The reason for asking earlier: if a `keep` on a step already in the Flow carries only the act, the decision has to count as no change (`applied: 0`). It must not get a second refusal such as `already_in_flow`. Asking at the claim call itself would have counted it as applied.
   - `R/llm/loop-configuration.ts`: draft options gain `claimRefused?: AutomationStudioFlowDraftClaimRefused`.
   - `R/llm/harness-options/draft-acts.ts`: returns `claimRefused`, built on `automationStudioInstructedActClaimVerdict` with the build's instruction, start location and arrival. `service.ts` is unchanged; it already spreads the result into the draft options.
   - `R/llm/decision-handlers/amendment.ts`:
     - Passes `context.input.draft?.claimRefused` into the apply call.
     - `automationStudioLlmEvidenceClaimWrittenAct` asks the callback first. If the claim is refused, the step stays kept without the act. The model is told `act_not_done_there` under `core.amendment_check`, using the existing `tell`, with `applied: 1`.
2. **Wording**
   - `R/llm/draft-amendment-feedback.ts`:
     - A header paragraph.
     - `REFUSAL_REASONS.act_not_done_there`.
     - The told entry carries `act`, `said` and `instead`, only for this reason and only when present.
     - A new `notDoneThere` gives `next` as `<said> So aN was not recorded on step N: do not name it there again.`
     - A `fallback` entry for when no sentence is given: by number, naming `{"step": instead, "change": "add", "act": ...}`, or the press to run.
   - `R/flow-bootstrap/evidence-loop-steps.ts`: the reason is allowed.
   - `src/ui/activity-action/refusal-words.ts`: chat words "that step did something else, such as choosing one of the options, and did not do the action itself".
3. **Stall note** (`R/llm/evidence-progress/stall-redirect.ts`): `namedStep` also reads `todoSaid` when it is a string. The note then says `Step N names aN, and the checklist says it is not done (<todo>): <todoSaid>` in place of the generic "correct step N ... Do not run another step". The `step_only_opens_its_choices` special case stays as a fallback for when no `todoSaid` is present. The header now notes that this sentence is the one exception to "codes only": it is Core's own sentence, quoting only control words the draft entry already shows.
4. **Ending words** (`R/flow-bootstrap/unfinished-build/not-done.ts`): a local `Todo` type adds `AutomationStudioInstructedActEvidenceTodo`, and `TODO_WORDS` gains `step_only_chooses`, `step_only_clears_the_way` and `another_step_shows_it` with the brief's wording. `another_step_shows_it` had already landed in the union (`checklist.ts:132`), and the type check passes.

### Tests
- New: `R/llm/decision-handlers/tests/claim-refused.test.ts`, a replay of mux74k5q through the real loop with `automationStudioFlowBootstrapDraftActs({ instructionText: HUB })`:
  - The call `add` + `act a1` on the "Spain" press is kept without a1, and told `act_not_done_there` with `said` containing `Step 2 chose "Spain", one of a1's options (a1.origin)`.
  - `amend_draft keep 2 act a1` is refused, with `applied 0`, `stepsWithoutProgress > 0` and row `llm_evidence_loop.draft_unchanged`; the step's acts are unchanged.
  - `add` + `act a1` on "Add to cart" is applied.
  - With no judge given, the claim is made as before.
- New: `R/flow-draft/amendment/tests/claim-refused.test.ts`, which tests `apply` with the callback:
  - `add` still applies when the claim is refused.
  - A `keep` whose only news is the claim gives `applied: 0` and exactly one refusal.
  - A holder's act is not taken off it.
  - `instead` is given in shown numbers after a reorder in the same decision.
  - The judge is never asked for a read or an act the step already names.
- Extended:
  - `stall-redirect.test.ts`: quotes `todoSaid`; a `todoSaid` that is not a string is ignored.
  - `not-done.test.ts`: the three new words.
  - `refusal-way-out.test.ts`: the exhaustive map, plus a case for the sentence and for the number-only answers.
  - `llm/tests/draft-amendment-feedback.test.ts`: the exhaustive reason map.
  - `src/ui/activity-action/tests/refusal.test.ts`: the chat words.

## Commands run and observed results

All commands were run from `packages/fluxiq` unless noted.

- **Fail-first**, before any implementation: `npx vitest run` on the 7 changed or new test files gave `Test Files 7 failed (7)`, `Tests 13 failed | 114 passed (127)`.
  - The loop test failed with `Cannot read properties of undefined (reading 'refused')`, because nothing was told.
  - The apply tests failed with `expected [] to deeply equal [ { step: 2, …(4) } ]` and `expected { applied: 1, refused: [] }`.
  - not-done failed with `expected '"two packs": nothing I tried did it'`.
  - stall failed with "expected ... to contain 'Step 5 chose "Spain"...'".
- **After the change**, the same 7 files twice: `Test Files 7 passed (7)`, `Tests 127 passed (127)`, both runs.
- **The six directories once**: `npx vitest run R/llm/decision-handlers/tests R/flow-draft/amendment/tests R/llm/evidence-progress/tests R/flow-bootstrap/unfinished-build/tests R/llm/tests src/ui/activity-action/tests` gave `Test Files 84 passed (84)`, `Tests 1014 passed (1014)`.
- **Core root**: `node scripts/build-cache/cli.mjs fluxiq:check` printed `{"build-cache":"build","step":"fluxiq:check",...}` with no errors and exited 0.
- **Core root**: `node scripts/build-cache/cli.mjs structure-audit:check` printed `structure-audit: passed (273 warning(s), 349 baselined)` and exited 0. It came from a reused stamp, so I also ran `node scripts/structure-audit.mjs` directly, which printed the same `passed`. Its advisory warnings on my files:
  - `decision-handlers/amendment.ts` is 420 lines. It was about 406, already past the 400-line advisory.
  - `draft-amendment-feedback.ts` is 758 lines (725 before).
  - `not-done.ts` has 12 exported values. The export count is unchanged.

## Not verified

- No live run, and no Lab or browser.
- Amendments held for a rerun are applied in `R/llm/evidence-loop/held-amendments.ts:89` without the judge. An example is `rerun 5` alongside `keep 5 act a1`. Their claims are not judged, and that folder was on my must-not-touch list.
- Inside one decision, the `said` sentence names steps by their current positions. If an earlier amendment in the same decision moved a step, that sentence's numbers may differ from the numbers the model was shown, even though `instead` is translated. The sentence is built in `instructed-acts/claim-verdict.ts`, which I must not touch.
- A refusal on the call path is told but is not recorded on the call's trace row (no `amendmentsRefused`), the same as `second_copy` on the call path.

## Open questions or contradictions found

- The brief says to ask "just before `automationStudioFlowDraftClaimAct`". I asked earlier, where the act is worked out, so that a `keep` carrying only a refused claim counts as no change and no progress, as the brief's own test requires. In effect it is the same gate.
- I wrote some files LF and then restored them to CRLF, to match the checkout (`core.autocrlf=true`). The two new test files are LF, like the lead's `claim-verdict.ts`.
