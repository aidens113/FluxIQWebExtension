# t753-c-endings: one plain ending for a failed or partial project build

## Outcome

Done, with one interpretation to confirm (open question 1). All the narrow checks the brief named pass. `tsc` is clean, and the structure audit passes with advisory warnings only.

## What changed and why

The build's ending row is now the one account of the ending. It says what happened (its title), the supervisor's reason, Core's record of the tests and what is left on the site. The build hands back a marker, `project.build_ending_told`, so the chat's commands stop repeating any of that: on a failure the marker is an issue code, and on a kept draft it is one of the trial's ending codes. The command's answer then says only what the Flow keeps and what the person can do next. The draft's card line is cut down to a short line with no verdict.

Core (`C:/Users/osrs_/FluxStuff/fxwork/t753/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`):

- `service/project-build-ending/ending-told.ts` (new) is the single writer of the row text. It says why, then the record, then what is left. Why is the supervisor's reason, screened, with its part-test claims checked and its opening restatement removed.
- `service/project-build-ending/reason-unrepeated.ts` (new) drops opening sentences that only say "I could not finish this" (the stutter).
- `service/project-build-ending/codes.ts` (new) holds the codes `told` = `project.build_ending_told` and `endedUnfinished` = `project.build_ended_unfinished`.
- `service/project-build-ending/record-told.ts` now takes `wholeRuns` (whole runs of every version). If earlier versions were test-run whole but the latest has no test of its own, it says "A version of the whole Flow was test-run from its start twice, and the last of those runs was judged …; the latest version was not tested from its start". It never says "never tested" in that case.
- `service/project-build-ending/index.ts`: the barrel, updated.
- `service/project-build/run.ts`:
  - The draft and failure paths both use the single writer, and the row always includes the reason. The old t741 B5 split put the reason in the chat's answer and the rest in the row; that split is gone.
  - Whole runs are counted from `draft.trialRecords`, once per run id.
  - A kept draft's trial carries `told`. A failure gets the `told` issue code (capped at 16 codes). The failure still carries `endedBecause`, now without the stutter, for the build's last status line.
  - A supervisor that ended unfinished on a yes now hands that yes back with `endedUnfinished`. Before, it handed back no trial, and the chat said "not tested".
  - The dead `endedSaid` is removed.
- `service/candidate-trial/promotion.ts`: a standing trial whose ending codes include `endedUnfinished` stays a draft under that code and never promotes.
- `activity/wording/act-words.ts`:
  - A trial step is named by its own label: "ran the step “…”".
  - A step with no label is named by its control ("ran a step on “…”"), never as "used".
  - Looped-step wording (`trial step 6, pass 3 of 3 …`) is now parsed.
  - Acts with no name are said as "pressed N controls with no label" or "took N steps without a label", never "acts it could not name".
  - The same nameless trial step is counted once across test runs.
  - Presses on links, and on controls that dismiss, close, decline something optional or go to another page, are marked `passing`.
  - New field `count`.
- `activity/wording/left-told.ts`:
  - "No change … knows of" is said only when no act is listed at all.
  - The first sentence names the build and later ones follow it.
  - Pronouns use `count`, and several steps read "ran the steps".
- `conversations/commands/build.ts`: `told` on the draft and failure results. A draft is told if its codes say so, or if it is a project-mode (create) draft with verdict `not_tested`, since every such draft is one the supervisor ended with a row. Kept-candidate words leave out the test runs when told, and there is a told draft line.
- `conversations/commands/progress.ts`: `failed(..., { told })` has no opening. It says what the Flow keeps, then the closing "You can ask me to build it again." Exported as `AUTOMATION_STUDIO_CONVERSATION_TOLD_NEXT`. `supervisorEndingWords` also removes the stutter.
- `conversations/commands/create-here.ts`, `explore.ts`, `improve.ts` pass `told` through. Create-here skips its time-limit prefix when told.
- `conversations/commands/command.ts` gains `candidateTold` on the outcome.
- `conversations/commands/execute.ts`: the card line for a told draft is "What I wrote so far is kept here."

Tests added or updated:

- `activity/wording/tests/act-words.test.ts`, `left-told.test.ts`
- `service/project-build-ending/tests/ending-told.test.ts` (new)
- `service/candidate-trial/tests/promotion.test.ts`
- `conversations/commands/tests/execute.test.ts` (new describe "a project build whose ending row told the ending"), `plain-failure.test.ts`
- `service/project-build/tests/project-build-facade.test.ts`, `project-build-reset.test.ts`, `project-build-time-limit.test.ts` (the told code, the row now carrying why, "ran the step")
- `service/tests/provider-unavailable-authoring-modes.test.ts` (one issue-code expectation)
- `project-agents/supervisor/tests/left-on-target.test.ts` (three expectations; see shared-file check)

### Before and after, the three round-5 shapes

**(a) Partial build whose earlier versions were test-run whole.** The latest version was assembled again after those runs and had no test of its own. Dismissals were pressed during the build.

Before, three messages:
- Row: "FluxIQ stopped with the Flow only partly built. — <why> … A whole Flow was assembled and never tested from its start. The build left no change on the site that it knows of. It also clicked “Decline optional cookies”, “Not now” and “Close chat”, which changed the page and might have left something behind…"
- Turn: "It was never test-run from the start, so nothing was put into the Flow. I kept what I wrote as a draft."
- Card: "Saved candidate draft. It was never test-run from the start; the Flow's steps are unchanged."

After:
- Row: "<why> <parts record> A version of the whole Flow was test-run from its start twice, and the last of those runs was judged not to do what was asked; the latest version was not tested from its start. The build left no change on the site that it knows of."
- Turn: "I kept what I wrote as a draft, and nothing was put into the Flow. You can ask me to build it again."
- Card: "What I wrote so far is kept here."

**(b) Failure with three saves made by two whole runs**, the supervisor's reason opening "I could not finish this."

Before:
- Row: "The build left no change on the site that it knows of. It made 6 acts it could not name, but no read ever showed a change from them…"
- Turn: "The build failed: FluxIQ could not finish the Flow: I could not finish this. Saving … left changes on the site that can no longer be checked or undone… The Flow "X" has no steps yet, but it keeps your instruction, so you can build it again."

After:
- Row "FluxIQ could not finish the Flow.": "Saving the board left changes on the site that can no longer be checked or undone. <record> The build took 3 steps without a label, but no read ever showed a change from them, so they may have changed nothing; check them if you need the site exactly as it was." Steps that have labels read "ran the steps “…”".
- Turn: "The Flow "Pin the note" has no steps yet, but it keeps your instruction, so you can ask me to build it again."
- Build's last status line (the existing call-cause reader): "FluxIQ could not finish the Flow: saving the board left changes on the site …"

**(c) Kept trial act.**

- Before: "The build used “Unlike”, but could not undo it, so it may still be on the site…"
- After: "The build ran the step “mark it”, but could not undo it, so it may still be on the site; check it if you need the site exactly as it was." (in the test; live, the step's own label, such as "like the post"). The control left showing is never named.

## Commands run and observed results

All runs were from `packages/fluxiq` unless noted.

Fail-first records, each run before its fix:
- `pnpm exec vitest run …/activity/wording/tests/act-words.test.ts …/left-told.test.ts` → "11 failed | 1 passed (12)". It received the round-5 texts, for example "The build left no change … It made 6 acts it could not name …", "… It also clicked “Decline optional cookies”, “Not now” and “Close chat” …" and "The build used “Add” …".
- `…/project-build-ending/tests/ending-told.test.ts` → "3 failed (3)". The writer did not exist yet, and the record matched "never tested".
- `…/candidate-trial/tests/promotion.test.ts` → "1 failed | 19 passed". The unfinished yes was proposed.
- `…/conversations/commands/tests/execute.test.ts -t "ending row told"` → "5 failed". It received "Its test run from the start was judge…", "The build reached its time limit befo…", "It was never test-run from the start,…" and "The build failed: FluxIQ could not finish the Flow: saving the board left changes … so you can build it again."

After the fixes:
- `pnpm exec vitest run …/conversations/commands/tests …/project-build-ending/tests …/candidate-trial/tests/promotion.test.ts …/activity/wording/tests` → "Test Files 32 passed (32); Tests 350 passed (350)".
- `pnpm exec vitest run …/service/project-build/tests …/flow-bootstrap/generation-failure/tests/ended-because.test.ts …/service/candidate-trial/tests` → "Test Files 47 passed (47); Tests 324 passed (324)". This covers project-build-time-limit, project-build-judged-trial, project-build-reset and project-build-facade.
- `pnpm exec vitest run …/service/tests/provider-unavailable-authoring-modes.test.ts` → "7 passed".
- `pnpm exec vitest run …/llm/deepseek/tests/system-prompt.test.ts …/project-agents/supervisor/tests …/project-agents/dispatch/tests …/activity/project/tests …/activity/tests src/ui/person-facing/tests src/ui/tests/person-facing-sweep.test.ts src/ui/activity-status/tests/supervisor-ending.test.ts` → "Test Files 71 passed (71); Tests 578 passed (578)". This includes left-on-target, after its update.
- `pnpm exec tsc --noEmit -p .` → exit 0, no errors. An earlier run showed 6 errors in `src/ui/activity-status/tests/pacer-steady.test.ts`, another worker's in-flight file; they were gone on the final run.
- From the repo root: `node scripts/structure-audit.mjs` → "structure-audit: passed (441 warning(s), 1152 baselined)". The warnings that touch my files are advisory and were already over the threshold: `run.ts` 461 lines (was 435), `execute.test.ts` 777 lines (was 722), `conversations/commands/` at 25 files.

## Not verified

- No live or Lab run, and no browser check of how the row and the turns sit together in the extension chat.
- An ended-unfinished-on-yes build is not covered end to end. I scripted it through the real service: a whole test judged yes, then `ended: partial`. The supervisor's completion rules (`completion.ts`: ended too soon, then the latest-pass rescue) turn that into a completed proposal on both the old and new `run.ts`. So the path is defensive, covered by the promotion unit test only, and I reverted that test. Round-5 shape (a) is most likely the latest version assembled again without a test, which the `wholeRuns` record and the project-mode `not_tested` rule now cover.
- Not every Core suite was run (full suites are not allowed by the brief).

## Open questions or contradictions found

1. **One message.** The chat still shows the row, then the command's result turn, then (for a draft) the card turn. No verdict, reason or leftover is said twice, and the closing line is in the turn. Merging them into one bubble would need the build's text carried on the result payload: `flow-bootstrap-commands/contracts.ts` and `flow-bootstrap/authoring-result/` (not in Owns), or a UI change. Please confirm this split (row = account; turn = what is kept + what next).
2. **The project-mode `not_tested` rule** in `build.ts` assumes every project-mode create draft with no trial verdict came from a supervisor ending that emitted a row. A rescued pass completing with no standing trial would break that. It is rare and I did not reproduce it. Extend builds are excluded, since they are candidate builds.
3. **A fourth surface.** The build's last status line (`activity/build.ts`, reading the call cause) and `ui/activity-status/supervisor-ending.ts` (reading `endedBecause`) still say "FluxIQ could not finish the Flow: <why>" after the row has said why. They are now free of the stutter, but they are another lane's files.
4. **Model-facing text.** `act-words.ts` also writes the done reason of the reset brief (`project-agents/dispatch/reset-done.ts`), which goes back to the supervisor model in its dispatch returns. The new wording ("ran the step “…”", "pressed N controls with no label") therefore reaches a model. I found no prompt-contract test for it beyond `llm/deepseek/tests/system-prompt.test.ts` (passes; system prompts unchanged) and the dispatch and supervisor tests (pass).
5. **Hedged leftovers.** In (b), the reason can still say "left changes … can no longer be checked" while the leftover sentence says the steps "may have changed nothing". Both are hedged and come from different sources (the model's claim, Core's reads); there is no flat "no change" any more.
6. **Heuristics.** The filter for dismissals and moves to another page is an English regex on control names, plus "link" as the control kind. A bare "Decline", "Reject" or "Accept" is deliberately not treated as a dismissal. Nameless trial steps are de-duplicated by their step wording, following the brief's diagnosis that "the same three saves were counted twice". Nameless exploration presses are still counted per press (t738).
7. **Shared-file check.**
   - `git -C C:/Users/osrs_/FluxStuff/fxwork/t751/!FluxIQ status --short` showed no changes under `project-agents/supervisor/` or `project-agents/dispatch/`.
   - I did not edit `left-on-target.ts` or `reset-done.ts`.
   - I edited only `project-agents/supervisor/tests/left-on-target.test.ts`, minimally, because my wording change moved its output:
     - "3 presses it could not name" became "pressed 3 controls with no label".
     - The screenshot case gained two "Add to shortlist" presses and now expects only that press to be listed.
     - "It clicked “Mark” …" became "The build clicked “Mark” …".
8. **Tests outside the listed Owns.** I edited `service/tests/provider-unavailable-authoring-modes.test.ts` (one issue-code list) because `run.ts` now adds the `told` code.
9. **Failing first.** The stutter test in `plain-failure.test.ts` was written after the `progress.ts` change, so I did not see it fail. The old assertion it replaces pinned the stutter itself: `"… could not finish the Flow: I could not finish this"`.
