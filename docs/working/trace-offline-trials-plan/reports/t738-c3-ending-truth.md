# t738-c3-ending-truth: report

## Outcome

Done, with one handoff. The left-on-target change still needs the site-reset ledger to expose `changeSeen`; until it does, live endings never use the new "may not have changed anything" wording (see Open questions).

## What changed and why

All paths are under `C:/Users/osrs_/FluxStuff/fxwork/t738/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`.

1. **Nameless acts are counted (job run-mvgf4pk5-55343613).**
   - New `activity/wording/act-words.ts` (`automationStudioActivityActsSaid`). It holds the act-to-words parsing that used to be private in `left-told.ts`. It also reads a nameless act such as `click span` by its verb, so an unnamed act is counted rather than dropped. A named act is said once by verb and name. Nameless acts are counted, with presses kept apart from other acts ("3 presses it could not name"). Acts with different notes are never counted together.
   - The `activity/wording/index.ts` barrel exports it.
2. **An act with no change seen is not called a change still on the site.**
   - `activity/wording/left-told.ts`: `AutomationStudioActivityLeftAct` gains the optional field `seen?: boolean`.
   - Acts with `seen: false` get their own sentence: "It made 3 presses it could not name, but no change from them was ever seen, so they may not have changed anything."
   - Unnamed in-place acts are now counted instead of all becoming "one more change".
3. **The supervisor's ending is held to Core's record (office run-mvgf04kw-310fc169).** New directory `service/project-build-ending/`, which `service/project-build/run.ts` uses. It is a sibling because `project-build/` already holds 25 files, the limit, and a subfolder would break the 9-segment depth rule.
   - `reason-checked.ts`: removes every sentence or clause in the model's reason that claims how a part's test went. Such a piece names a part, stage, step or section, together with a test, trial, pass, fail or work word. If the text before a colon makes no such claim, it is kept, so "... could not be made to work." survives.
   - `record-told.ts`: states Core's own facts.
     - How many parts were tested on their own, and how many passed. This counts every part tried under any plan, so the passing checkout part from brief-3 still counts after the plan was amended.
     - For each part that did not pass: how often it was tried and what its last test answered.
     - For the judged whole run: how many of its steps ran and how many rows it stored (read from `feedback.steps` and `feedback.stored`), and its verdict.
     - It uses counts and verdicts only. It never says part names, page text or the judge's own words.
   - `run.ts`, path with no candidate (`toldEnding`): when Core has a record to state, the reason is checked first. The row then reads: reason, then record, then what is left. A new private helper, `endedSaid`, builds that text. `endedBecause` uses the checked reason too.
   - `run.ts`, path where the supervisor ended with a draft (status `ended`, partial or blocked, not timed out): this path used to say nothing about why the build ended. It now shows the same ending row, with the judged run from `outcome.trial ?? outcome.sameFlowTrial`.
4. **The draft-saved line (`conversations/commands/execute.ts`).**
   - The fixed sentence "Saved candidate draft. Verification pending; ..." is replaced by a private `draftSavedLine`.
   - It says "pending" only when the draft carries no trial at all. Otherwise it says what the test came to, for example: "Saved candidate draft. Its test run from the start was judged not to do what you asked; the Flow's steps are unchanged."
   - The function lives in `execute.ts` because `conversations/commands/` already holds 25 files.
5. **Reset message (`project-agents/dispatch/reset-done.ts`).**
   - Acts are named in words through `automationStudioActivityActsSaid`, never by `act-N`.
   - Acts settled `unchanged` are listed separately: "N acts of this build showed no change on the site, so they may not have changed anything: ...". They never make the site "not as the build found it".
   - When only unchanged acts remain, it opens with "Every act of this build that showed a change is undone."

Test files changed:
- New: `activity/wording/tests/act-words.test.ts` and `service/project-build-ending/tests/ending-truth.test.ts`.
- Updated:
  - `activity/wording/tests/left-told.test.ts`: two new cases.
  - `project-agents/dispatch/tests/reset-done.test.ts`: wording updated, plus no-`act-N` assertions.
  - `conversations/commands/tests/execute.test.ts`: every verdict draft must not contain "Verification pending".
  - `service/project-build/tests/project-build-facade.test.ts`: the judged-no draft now shows the record row.
  - `service/project-build/tests/project-build-reset.test.ts`: the reset words are now in words, and the recipe ending row now has record facts between the reason and what is left.

## Commands run and observed results

- `cd .../!FluxIQ/packages/fluxiq && npx vitest run <8 files> --pool=forks --poolOptions.forks.singleFork`
  - Files: left-told, act-words, reset-done, execute, ending-truth, project-build-facade, project-build-reset, project-build-time-limit.
  - Result: `Test Files 8 passed (8)`, `Tests 78 passed (78)`.
  - After the final facade edit, facade and ending-truth were re-run: `2 passed`, `15 passed`.
- Wording-dependent tests run separately:
  - `project-agents/dispatch/tests/brief-ending.test.ts` and `project-agents/supervisor/tests/whole-trial.test.ts`: 20 passed.
  - `service/tests/provider-unavailable-authoring-modes.test.ts` and `conversations/commands/tests/plain-failure.test.ts`: passed.
- `cd .../!FluxIQ && node scripts/structure-audit.mjs` printed `structure-audit: passed (424 warning(s), 1152 baselined).`
  - Advisory warnings on my paths: `run.ts` is 427 lines, past the 400-line advisory mark (it was 389); `activity/wording/` and `conversations/commands/` each hold 25 files.

## Not verified

- No typecheck, by brief; the lead typechecks.
- No live or Lab run, so the new chat rows were not seen in a real panel.
- The facade fixture's one-part judged-no draft now emits the partial ending row. Its text is pinned in the test. Whether the panel's order and repetition read well next to create-here's "Its test run ... was judged not to do what you asked" was not reviewed live.

## Open questions or contradictions found

- **`changeSeen` never reaches the ending.**
  - `left-told.ts` now accepts `seen: false`, but its caller, `project-agents/supervisor/left-on-target.ts` (not mine), cannot pass it yet.
  - The reason: `AutomationStudioSiteResetLedger` keeps `changeSeen` private (`flow-bootstrap/site-reset/ledger.ts:273`). It is not in the project snapshot, and `standing()` returns `in_place` for an open act whatever its `changeSeen`.
  - Needed: site-reset exposes it (for example `changeSeen(actId)`, or a `standing` value that tells "open, nothing seen" apart), and `left-on-target.ts` passes `seen`.
  - Until then, the job run's three presses read "These changes the build made are still on the site: 3 presses it could not name." That is the right count but still in the "still on the site" sentence.
- **`left-on-target.ts` mislabels acts that had no effect.** It marks every `!act.undoable` act `stays: "irreversible"` ("FluxIQ cannot undo this"). Yet `standing()` calls a non-undoable act without an irreversible consequence `unchanged`; `noEffect` makes such acts. The fix belongs in that file.
- **Office evidence does not match the brief.** In the office run, "never passed its own test" appears only in the model's decision (`steps/0250-decide`). `snapshots/flow-lane.json` and screenshot 38 show no such final chat message. That run kept a draft, and the draft path printed no reason at all.
  - The no-candidate path (`toldEnding`) is the one that printed the reason, as the job run's "FluxIQ could not finish the Flow" row shows.
  - Both paths now check the reason against the record.
- **Not mine, unchanged.**
  - The "Checking whether the Flow is finished" card shows the model's own `summary` unchecked; in the office run it said "The checkout subflow could not be built after repeated attempts". That card comes from `activity/wording/decision.ts` plus the evidence-loop observer.
  - In the job run, the ending sentence appears twice: the row, then "The build failed: <endedBecause>".
