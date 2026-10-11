# t444: a requested act is never silently skipped, and a done word counts as done (Core)

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t444/!FluxIQ`, branch `task/t444-requested-acts-never-silently-skipped`.
Nothing is committed. All paths below are relative to `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done, with one design limit the supervisor should accept or redirect. At runtime the run has no instruction, so it
cannot tell which acts were *requested*. It reads the skipped node's own words against Core's lasting-act vocabulary
instead. See "Open questions".

## What changed and why

### F3: claim doubt reads saved identity, and done words are not doubt

- `runtime/flow-bootstrap/instructed-acts/claim-doubt.ts`:
  - It reads the control's words in this order: the saved identity first
    (`automationStudioModelFacingControlWords(step.ranWith)`), then `words.target`, then `control`.
  - The doubt is withheld when any of those words names the act (its verb or a kind word), or reads the act done (a
    kind done word, such as "Collected" or "Claimed").
  - New export `automationStudioInstructedActControlShowsDone(act, step)` tells the caller the act is present.
- `kind-words.ts` gains:
  - `automationStudioInstructedActWordsNameAct`;
  - `automationStudioInstructedActWordsShowDone`;
  - `AUTOMATION_STUDIO_INSTRUCTED_ACT_LASTING_KINDS` (save, add_to, claim, submit, move);
  - `automationStudioInstructedActWordsDecline`: a leading close, dismiss, no thanks, not now, skip, cancel and
    similar, a lone close glyph, or any mention of cookie, consent, privacy or tracking;
  - `automationStudioInstructedActWordsNameLastingAct`.
- `kind-words.ts` also adds `"reserve"` to the submit kind words. The act parser already treats "reserve" as a submit
  verb, and "reserved" was already a done word.

### F4 at authoring: the candidate path refuses an optional step that does a requested act

- New file `runtime/flow-bootstrap/instructed-acts/optional-act-steps.ts`, exported from the barrel:
  `automationStudioInstructedActOptionalScriptIssues({ instructionText, script, plan, locator })`.
  - It reads the instruction's lasting acts (`automationStudioInstructedActs`) and every `optional: yes` step of the
    script (`automationStudioFlowScriptStepSaysOptional`).
  - It reads each step's words: the resolved node's control words, found through the locator as `way-out-steps.ts`
    does. When the identity has no words, it reads the step's label and description instead.
  - It refuses the step when the words name the act or read it done, unless they decline.
  - The issue uses the draft path's code, `bootstrap.instructed_act_only_optional`, at `flow.line.<optional line>`.
- `step-fault.ts` gains `automationStudioInstructedActOptionalSaid(id, where, only = true)`.
  - The draft path's `check.ts` `optionalSaid` now calls it. The draft wording is unchanged: "aN is done only by step
    N, which is marked optional: …".
  - The candidate refusal uses the same sentence, with "the step at line N" and without "only". It then adds the
    person's quote and "Take the `optional:` line off…".
- `runtime/flow-bootstrap/candidate/submission.ts` calls the rule next to the way-out check. A refusal carries
  `candidate.optional_act_refused` when it is the only kind of issue. `submission-refusal.ts` is not touched.

### F4 at runtime: a skipped step that does an act says "not done"

- New file `runtime/executor/step-skip/act-not-done.ts`, `automationStudioSkippedStepDoesAct(node)`.
  - It reads the saved control words, else `node.label`.
  - It answers yes when those words name a lasting act and do not decline.
- `runtime/executor/state-routing/decision.ts`:
  - A declared skip of such a node is checked first. When the node recorded its own effect (route signatures), the page
    is observed once, and an effect already shown routes as `effect_holds`, as it did before this change.
  - Otherwise the decision is `{ kind: "declared", edge, notDone: true }`.
  - Dismissals keep the old shape and are not observed.
- `routed-attempt.ts`: the skipped record becomes `{ reason: "target_absent", code, notDone: true }`.
- `announcement.ts`: the chat says "Skipped “Claim voucher”: it was not shown, so it was not done". The activity reason
  stays `optional_absent`, so the contracts package is unchanged.
- `service/candidate-trial/feedback.ts`: the trial feedback says "…so the step was skipped and what it does was not
  done. If the instruction asks for it, the step must not be optional."
- Outside the brief's list, needed to carry the result:
  - `runtime/executor/contracts.ts` and `model/flow-adaptation.ts`: an optional `notDone?: true` on the `target_absent`
    skip;
  - `runtime/service/summaries/skipped.ts`: the run detail keeps `notDone` (only a literal `true`).
- `absent-step.ts` and `step-skip/index.ts`: header and barrel only.
- Docs: `docs/architecture/automation-studio.md` gains one paragraph on the not-done skip and the authoring refusal.

### Tests (generic lending-library site)

- New test files:
  - `instructed-acts/tests/optional-act-steps.test.ts` (5);
  - `executor/step-skip/tests/act-not-done.test.ts` (15).
- New rows in:
  - `claim-doubt.test.ts`: done words, another kind's done word, saved identity precedence;
  - `decision.test.ts`: declared and not done, `effect_holds`, a dismissal unchanged;
  - `routed-attempt.test.ts`;
  - `announcement.test.ts`;
  - `absent-step.test.ts`: a full graph run, checking the attempt and the chat title;
  - `candidate-trial/tests/feedback.test.ts`;
  - `summaries/tests/skipped.test.ts`.

## Commands run and observed results

- `npx tsc --noEmit -p tsconfig.json` (in `packages/fluxiq`), final run: no output, `tsc=0`.
- `node scripts/structure-audit.mjs`, first run: 5 violations.
  - Three were `[imports]` that reached into files instead of barrels.
  - Two were `[as-never]` casts in my new test rows.
  - After fixing them: `exit=0`, "structure-audit: passed (328 warning(s), 1159 baselined)."
- `node scripts/structure-audit.mjs --rule docs-links`: "structure-audit: passed (0 warning(s), 0 baselined)."
- vitest over the changed directories and their neighbours:
  - Directories: `flow-bootstrap/instructed-acts`, `flow-bootstrap/candidate`, `executor/step-skip`,
    `executor/state-routing`, `service/candidate-trial`, `service/summaries`, `activity/candidate`,
    `llm/harness-options/tests/bootstrap-completion.test.ts`, `result-verification/build-test`.
  - Result: "Test Files 74 passed (74) / Tests 902 passed (902)".
- vitest over `llm/node-tools/tests/step-place-done-again.test.ts`, `flow-draft` and `action-permissions`:
  "Test Files 40 passed (40) / Tests 475 passed (475)".

## Not verified

- No Lab run, provider run or browser run (as the brief says).
- Full suites (`pnpm check`, the whole of vitest) were not run.
- Not tested: a real R4a-shaped submission through `AutomationStudioFlowCandidateSubmissionController.submit`. The rule
  is tested directly against an accepted script; `submission.ts` is covered only by typecheck and its existing tests.
- I did not check that `ranWith` on a web draft step carries `element` or `target.fingerprint` words in the form
  `control-words.ts` reads. If the extension stores the identity elsewhere in `ranWith`, F3 falls back to
  `words.target` and `control`, which is today's behaviour, now with the done-word rule added.
- Not changed: the recovery-ladder path. An optional step that failed some other way, then "Go on past the optional
  step", still says nothing about a lasting act. Only the `target_not_found` declared skip is covered.

## Open questions or contradictions found

1. **Runtime "requested" is inferred, not known.** A run carries no instruction, and plan or Flow nodes carry no act
   claims. Storing acts on the node would mean changing `plan/contracts.ts`, `plan/parsing.ts` (it rejects unknown node
   metadata, and `verification/detached-execution.ts` re-validates the plan) and `adaptation.ts`, none of which this
   brief gives me.
   - So the run says "not done" for any skipped node whose words name a lasting act. Closes, declines and cookie or
     privacy answers are excluded.
   - The run states a fact, not a failure. The run status stays `succeeded`, and the judge, which has the instruction,
     decides.
   - If the supervisor wants "requested" exactly, a follow-up should write the matched act ids onto plan nodes, under
     a key the parser accepts, and have `act-not-done.ts` prefer them.
2. **False positives of the vocabulary.** An optional "View cart" or "Confirm my choices" that is not shown is reported
   "not done". That is true but noisy. At authoring, an optional "View basket" is refused when the instruction asks to
   add to a basket.
3. **Dependency direction.** `executor/step-skip/act-not-done.ts` now value-imports the `flow-bootstrap/instructed-acts`
   and `llm/model-facing` barrels. No audit rule forbids it, and every executor test passed, so no evaluation-order
   problem showed. Before this, `executor` imported neither directory, so the supervisor may prefer the vocabulary to
   move into a neutral module.
4. **The candidate refusal quotes the person's own act quote**, bounded to 120 characters. It is the instruction, not
   page text. The `bindingRefusal` header says its sentences quote only node keys, labels and the like, so that header
   is now slightly understated.
