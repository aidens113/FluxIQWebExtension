# t195-w22a: the instructed-act check judges every step that names the act

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t195/!FluxIQ`, branch `task/t195-live-control-flow`.
R = `packages/fluxiq/src/programs/automation-studio/runtime/`. Nothing committed.

## Outcome

Done. The completion check and the checklist now share one loop. For each act, the loop tries every step named for it and accepts the first that has no fault. A refusal names steps only by their positions. When every step named for an act only reads, the refusal says so in the brief's words. The ending no longer says "changed nothing" of a read, and no longer says "ran from its start without failing" while acts are still refused. All new cases were checked against the original source: they fail there and pass with the change.

## What changed and why

- **`R/flow-bootstrap/instructed-acts/standing.ts` (new): the shared loop, `automationStudioInstructedActsStanding`.**
  - For each act, then each choice, it builds the candidate steps in this order: kept steps first; among those, the draft's own `acts` before the result claims, each group in draft order; non-kept steps last.
  - It accepts the first candidate with no fault that no earlier act already used.
  - If none passes, it reports the first candidate that changes something, otherwise the first candidate. It also returns:
    - `after`, for `span_stops_short`;
    - `reads`, the positions of the candidates, when every candidate is a read (`effect !== "mutate"`).
  - The choice rule is unchanged: if an earlier act already used the step and the step's input does not set the choice, the reason is `choice_is_the_act_step` or `step_claimed_twice`.
  - The `claimed` predicate is now the set of kept candidate steps for every id.
- **`R/flow-bootstrap/instructed-acts/step-fault.ts` (new): the per-step rule.** `automationStudioInstructedActStepFault` and the private `whyNot` moved here unchanged from `check.ts`, so `standing.ts` can import them without an import cycle with `check.ts`.
- **`check.ts`:**
  - Uses the shared loop. The result claims are no longer dropped when a draft step already names the act; they are tried after the draft's claims.
  - `assign` now returns every claim for an id:
    - Every claim that gives the id exactly goes to that act or choice.
    - Word, verb and kind matching keeps one claim per act, as before.
    - A leftover claim goes to an act or choice only when its first matching tier names exactly one.
  - `missing[].step` is now the judged step's position (`"3"`). The model's own text is kept only for `no_such_step`.
  - `stepsThatChangedSomething` is now positions as numbers (it was ids).
  - The choice example in the instruction now uses `"step": "9"` instead of `"d9"`.
  - New sentence per act whose named steps all read: ` For a1, step 1 only reads: drop the act from it, or name it on the step that does the act.` (with several steps: "steps 9, 11 only read: ... drop the act from them").
  - Removed `automationStudioInstructedActDraftClaims`. Its only caller was the old check body; its two test assertions were rewritten.
- **`checklist.ts`:** now a view over the shared loop. New todo `step_only_reads` when every step named for the act only reads.
- **`contracts.ts`:** only the doc comment of `step_changed_nothing` changed.
- **`index.ts`:** the barrel now exports `standing.ts` and `step-fault.ts`.
- **`R/flow-bootstrap/unfinished-build/not-done.ts`:**
  - `step_only_reads` reads "the step I named for it only read the page, and did not do it".
  - `automationStudioFlowBootstrapTestSaid` for a clean replay:
    - nothing to do: "ran from its start without failing" (unchanged);
    - nothing done (`done === 0`): "ran from its start, but it does none of what you asked.";
    - some done, some to do: "ran from its start, but it does not yet do all you asked."
- **Tests:**
  - `instructed-acts/tests/check.test.ts`: 6 expectations changed from `"dN"` to `"N"`. New describe block for run 36 with 5 cases:
    1. The listing and the repeated Confirm both name a1: `ok`.
    2. A result claim is tried after the draft's own claim.
    3. Only the listing names a1: refused, with the reads sentence and position `"1"`.
    4. A read plus a press that acts once: the press is judged, with `act_needs_repeat "2"`.
    5. Ids that differ from positions (`d14`–`d16`): positions in `missing` and in `stepsThatChangedSomething`, and no id in the model-facing JSON or instruction.
  - `instructed-acts/tests/checklist.test.ts`:
    - The removed helper's assertions are rewritten. A read is now `step_only_reads`, and the check refuses the same steps by position. A taken step does not count as done.
    - New 14-draft agreement table: checklist `done` for everything iff check `ok`, and checklist not-done ids == check missing ids. A guard case requires at least 4 accepted and at least 4 refused drafts.
  - `unfinished-build/tests/not-done.test.ts` (new, 5 cases): the read wording, and the three test-said sentences.
  - `unfinished-build/tests/phases.test.ts:130`: its draft leaves 2 of 3 things undone. It now expects "ran from its start, but it does not yet do all you asked" and that "without failing" does not appear.

## Commands run and observed results

- Baseline before edits: `npx vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build` (in `packages/fluxiq`) -> `Test Files 8 passed (8)`, `Tests 194 passed (194)`.
- After the change, the same command -> `Test Files 9 passed (9)`, `Tests 219 passed (219)`.
- Revert check: I put back the HEAD versions of only my source files (check, checklist, contracts, index, not-done) and removed `standing.ts` and `step-fault.ts`, keeping the new tests. Same command -> `Test Files 4 failed | 5 passed (9)`, `Tests 21 failed | 198 passed (219)`.
  - Every new case failed: all 5 run-36 check cases, the reads checklist case, 4 agreement rows plus the guard, the read-wording case, both test-said cases, and the phases wording case.
  - The 6 position-expectation updates also failed.
  - I then restored my files; the same command -> `Tests 219 passed (219)`.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195-w22a tsc" npx tsc --noEmit -p tsconfig.json` -> exit 2, with exactly one error, in a file I do not own: `src/programs/automation-studio/runtime/flow-bootstrap/evidence-loop-steps.ts(181,7): error TS2739: ... missing the following properties ...: act_on_a_read, act_already_named`. That error comes from another worker's new amendment reasons in `R/flow-draft/amendment.ts`. Nothing in my paths was reported.
- `node scripts/structure-audit.mjs` (Core root) -> `structure-audit: passed (210 warning(s), 349 baselined)`.
  - The one warning in my paths is advisory: `instructed-acts/tests/check.test.ts: 491 lines is past the 400-line advisory threshold`. It was already 440 lines before this change.
  - "1 baseline entries can be lowered" refers to no path of mine; `.structure-baseline.json` has no entry under `instructed-acts` or `unfinished-build`.

## Not verified

- No Lab, browser or model calls, as the brief requires. Whether the model acts on the new sentence and on the positions in a live run is untested.
- I did not run tests outside my two folders. From reading the code, the consumers outside them should be unaffected:
  - `R/llm/harness-options/tests/bootstrap-completion.test.ts:499` expects `step_changed_nothing` for a read claimed as a1. I kept that reason code in `missingActs` for this reason.
  - `R/llm/harness-options/repeat-suggestion.ts:56` already matches `missing.step` by id or by position.
  - `R/llm/decision-context/tests/recorded-runs.ts:212` builds its own `stepsThatChangedSomething` fixture as strings and does not compare it with check output. A stricter consumer that expects strings there would need updating.
- A clean tsc of the whole package is blocked until the `evidence-loop-steps.ts` error above is fixed.

## Open questions or contradictions found

- **Two names for a read.** The check's `missingActs` reason for a read stays `step_changed_nothing` (`bootstrap-completion.test.ts`, not mine, asserts it); the refusal's sentence carries the "only reads" information. The checklist and the ending use the new todo `step_only_reads`. If the supervisor wants a single code, add `step_only_reads` to `AutomationStudioInstructedActMissingReason` and update that external test in the same commit.
- **Dropped steps now get a reason.** An act named only on a dropped or taken step is now refused `step_not_kept` (the step's position) instead of `no_step_named`. The check and the checklist now see the same candidates. No external test depends on the old answer.
- **Cause number.** The brief cites cause 12 for the ending wording. In the debug's table that wording is cause 13 (`not-done.ts:19,79`); cause 12 is the downstream `verify.ts` "verified" suspect. I implemented the `not-done.ts` part only. The build-ending list of lasting presses that cause 13 also asks for is in `generation-failure/build-ending.ts`, which I do not own.
- **Amendment wording.** The brief's sentence "drop the act from it" assumes an amendment that removes an act from a step. I did not check whether `amend_draft` offers one; `amendment.ts` is another worker's file (the tsc error suggests it now has `act_on_a_read` and `act_already_named`).
