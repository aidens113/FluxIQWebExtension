# t741 b5-endings report

## Outcome

Done. Both parts of B5 are fixed in Core with tests. All 338 tests in the 32 test files I ran pass.

## What changed and why

R = `packages/fluxiq/src/programs/automation-studio/runtime` in the Core tree `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ`.

### (1) A kept act no longer said to be "(the site offers no way to undo it)"

How the ledger tells the two kinds apart (`flow-bootstrap/site-reset/ledger.ts`, read only):
- A **kept** act has `undoable: true` and `kept = true`, and its `standing()` is `"kept"`. It gets there in one of three ways: the model named it under `cannotUndo` after the reset asked for it (line 519); the reset asked for it too many times (line 544); or its undo was refused as `candidate.undo_wrong_target` (`undo-admission.ts:103`). Its class is reversible, so the only thing known is that the build could not undo it.
- An **irreversible** act has `undoable: false`, meaning a class such as `move_money` or `send_or_publish`, and its standing is `"irreversible"`. Only these acts are recorded as not undoable through the site.

Changes:
- R `activity/wording/left-told.ts`: the person-facing words. Kept acts are no longer in the "These changes the build made are still on the site: ..." list. They get their own hedged sentence: "The build used “Mark”, but could not undo it, so it may still be on the site; check it if you need the site exactly as it was." Nameless kept acts are counted ("made 2 presses it could not name, but could not undo them ..."). When kept acts are the only thing left, the opening "left no change" sentence is dropped. The `STAYS` map is replaced by a single `IRREVERSIBLE` note, and irreversible acts still read "(FluxIQ cannot undo this)". The header explains why.
- R `project-agents/supervisor/left-on-target.ts`: the ledger note for the record and the model. A kept act's line is now `<did> (the build could not undo it; it may still be there)`. Irreversible acts keep `(cannot be undone by FluxIQ)`.
- R `project-agents/dispatch/reset-done.ts`: the reset's `done` words, which the model reads. Only `irreversible` acts make "N lasting acts ... stay on the site, so the site is not as the build found it". Kept acts get their own sentence: "N act(s) of this build could not be undone, so it/they may still be on the site: ...". If kept acts are all there is, it opens with "This reset undid every act of this build it could."

### (2) The ending sentence said once, "I" kept, no mid-word cut

- **Where the mid-word cut came from.** Office's recorded reason was the model's words followed by Core's note, limited to 2000 characters. `left-on-target.ts` `reason()` cut the model's words with `said.slice(0, room)`. `endedSaid` (`run.ts`) then removed the note, so `own` was "I could not finish this. The part that takes t". I confirmed that `automationStudioActivityEndedReason` on the full, uncut text gives "I could not finish this." (a scratch probe, since deleted). Fix: a new `saidWithin` in `left-on-target.ts` keeps the model's words up to the last sentence end that fits, judged against the whole text, so "3.5" is not a sentence end. If no sentence end fits, it cuts at the end of a word and adds "…". A new `noteWithin` makes an over-long note end on a whole entry followed by "; and more.", instead of a mid-word slice.
- **"i"**: R `conversations/commands/progress.ts` `lowerFirst` now leaves the pronoun "I" alone, including "I'm" and "I've". Words with a capital inside ("FluxIQ", "URL") were already left alone.
- **Said twice**: since t649 the failure carries `endedBecause`, and the chat's final line ("The build failed: FluxIQ could not finish the Flow: <why>") says it. The row before it (`run.ts` `toldEnding`) said the same why again. Now, when the failure carries `endedBecause` (it has a why and a supervisor-ending code), the row's text is only Core's record of its tests plus what is left (`endedSaid` returns a new `rest`). The final line, the toast and the stored thread summary keep why, so t649's behaviour is unchanged. `endedBecause` is now cut with `automationStudioActivityEndedReason` (whole sentences) instead of `slice`, although both limits are 240 today. A header paragraph in `run.ts` records this.

### Tests

- `activity/wording/tests/left-told.test.ts`: updated the existing mixed case. Added "says a reversible act the build could not undo may still be there, never that the site offers no way to undo it", which covers a kept act alone and an irreversible act alongside counted kept acts.
- `project-agents/supervisor/tests/left-on-target.test.ts`: added a real-ledger case with a wrong-target-refused kept act plus a `move_money` act (note and told). Added a reason case that checks the model's words end at a sentence end, or at a word end with "…", and stay within 2000 characters.
- `project-agents/dispatch/tests/reset-done.test.ts`: updated the existing case. Added a case where the only thing left is a kept act.
- `conversations/commands/tests/plain-failure.test.ts`: added "never lower-cases the pronoun I or a word in capitals" (I, I've, URL, and "It" still lower-cased).
- `project-agents/supervisor/tests/whole-trial.test.ts` (one assertion), `service/project-build/tests/project-build-facade.test.ts` (row text without why) and `project-build-reset.test.ts`: the row no longer says why, `endedBecause` is asserted, and the cart reset's kept act is said as "could not be undone ... may still be on the site". That cart case is itself an instance of the bug: the line was actually removed, yet the old words said it stayed.

## Commands run and observed results

From `C:/Users/osrs_/FluxStuff/fxwork/t741/!FluxIQ/packages/fluxiq`:
- `pnpm exec vitest run <R>/activity/wording/tests <R>/project-agents/dispatch/tests/reset-done.test.ts <R>/project-agents/supervisor/tests/left-on-target.test.ts <R>/project-agents/supervisor/tests/whole-trial.test.ts <R>/conversations/commands/tests <R>/service/project-build/tests/project-build-facade.test.ts <R>/service/project-build/tests/project-build-reset.test.ts <R>/service/project-build/tests/project-build-time-limit.test.ts` printed `Test Files 32 passed (32)` and `Tests 338 passed (338)`.
- Before the expectations were updated, the project-build run failed exactly the 3 assertions that check the old words (facade row text, reset row text, cart reset words). Every other test passed.
- Earlier runs one at a time: left-told 7/7, left-on-target 8/8, reset-done 5/5, plain-failure 11/11.

## Not verified

- No typecheck (forbidden by the shared rules). The lead's typecheck should cover `run.ts` (the new `rest` field and the `ended` union) and `left-on-target.ts`.
- No live run or extension chat check. I did not see the actual chat render the new row text or final line.
- `endedSaid` removes `left.note` from the recorded reason only when the reason ends with the full note. If the note was ever longer than 1998 characters, `noteWithin` shortens it and that removal does not happen. This behaved the same way before the change.

## Open questions or contradictions found

- Core `src/ui/activity-status/supervisor-ending.ts` has its own `lowerFirst`, which also lower-cases "I". It is applied to row text that starts with "FluxIQ ...", so it is harmless today. It is outside my Owns list, so I left it alone.
- With the row no longer saying why, the extension's status `SupervisorEnding` will treat the row's text (record plus what is left) as the remembered reason and add it to the status line. That reads as extra detail, not a repeat. It has not been checked in a browser.
- Irreversible acts still read "(FluxIQ cannot undo this/it)". The brief allows "the site offers no way to undo it" only for such acts but does not require it, so the phrase now appears nowhere.
- The model-facing `flow-bootstrap/site-reset/words.ts` `startedWith` still says a `cannotUndo` act stays because "the site offers no control that undoes it, or nothing it could change showed a change". That file is not mine (`site-reset/` is must-not-touch).
- I edited `service/project-build/tests/project-build-reset.test.ts`, which a wave-1 brief (a-receipts) listed. It shows no uncommitted changes from anyone else, and my edit is limited to two assertions about these words.
