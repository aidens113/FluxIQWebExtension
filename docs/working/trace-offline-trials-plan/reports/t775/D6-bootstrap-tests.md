# t775 D6: flow-bootstrap tests rewritten to the minimal-reset flow

Tree `fxwork/t775/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime`. Only `R/flow-bootstrap/tests/` was edited, in three files. No source file was touched. Nothing was deleted: each failing test had a live subject (targeted undo, admission, exploration door), so each was rewritten.

## Outcome: Done

19 failures before. After: `Test Files 17 passed (17)`, `Tests 183 passed (183)`. No real source defect surfaced; every failure was a retired expectation.

## Per test

### site-reset-irreversible.test.ts (3, rewritten)

1. **Confirms still on their own page.**
   - Old: first test refused `candidate.trial_reset_required` with `actsToUndo`; ran only once `cannotUndo` was named.
   - New: the first test runs (`trial.1`) with `startedWith.acts` = act-1..3 (act-1 keeps its `stillThere` lines) and no `code`.
     - The instruction says "nothing was undone first".
     - A click on the words undoes nothing, so `trial.2` still starts with all three.
     - `trial.3` with `cannotUndo` moves them to `startedWith.cannotUndo`.
     - The judge lines ("already done by this build (act-n)") are asserted on the third request.
   - Not weaker: the same acts, `stillThere` lines, instruction text and judge lines are asserted, and the click-on-words-is-not-an-undo behaviour is kept. Only the gate flipped.
2. **Runs with the acts the model says no control undoes.**
   - Old: refused `trial_reset_required`, then ran with `cannotUndo`.
   - New: the first trial runs with `acts` [act-1, act-2]; the second, after `cannotUndo`, lists them under `cannotUndo`. `asked` is 2.
3. **Click on the words is not an undo.**
   - Old: `trial_reset_required` with act-1 in `actsToUndo`.
   - New: the trial runs with `acts` [act-1], then `cannotUndo` [act-1].
   - Kept: the repeated undo is refused `candidate.undo_act_kept`, and `ledger.inPlace()` is `[]`.

### site-reset-build.test.ts (10, rewritten; describe retitled)

Every first test that used to be refused now runs as `trial.1`. Later trials renumber to `trial.2`, and `asked` and the site's `trial-N` lines shift to match.

- **First test while the explored add is in place.** Old: refused, `asked` 0. New: runs with `startedWith.acts` [act-1 with its `did`, `call` and `stillThere` ["line added-1"]], no `code`; `asked` 1; lines `["before","added-1","trial-1"]`.
- **Removes the line the act created by naming it.**
  - Old: lines `["before"]` and no `startedWith` on the trial.
  - New: `trial.1` starts with act-1; after the undo the lines are `["before","trial-1"]`.
  - `trial.2` starts only with act-2 (the first trial's own step), and `act-1` is asserted absent from `startedWith`.
  - Kept: `undoes` is stripped before the domain, the delete is not asked about, and the undo record is checked.
- **Never removes the line from before the build.**
  - Old: the act is kept and `trial.1` runs with `cannotUndo`.
  - New: `trial.1` runs with `acts` [act-1]; `undo_wrong_target` is unchanged; `trial.2` has `cannotUndo` [act-1].
  - Lines are `["before","added-1","trial-1","trial-2"]`; the `demo.remove` not-acted assertion is kept.
- **Removes the added line unasked once.** Only the line expectations changed (`["before","trial-1"]`). `undo_already_done` and `permission_required` are kept.
- **A trial's own act cannot be tied to a line.**
  - Old: the second test was refused `trial_reset_required` with act-2 in `actsToUndo`.
  - New: `trial.2` starts with act-2; `undo_wrong_target` for act-2 is kept; `trial.3` lists act-2 under `cannotUndo`.
  - The script lost one `test` call, because a fourth trial of the same revision hits the real `candidate.trial_retest_limit`. That is a kept limit, not a retired one.
- **Lane D: two confirms.**
  - Old: refused with `actsToUndo` [act-1, act-2].
  - New: `trial.1` runs with `acts` [act-1, act-2].
  - Both wrong-row undos are still `undo_wrong_target`, and the site's requests are unchanged.
  - `trial.2` has `cannotUndo` [act-1, act-2]; `asked` is 2.
- **Lane D: undo on the act's own row.** `trial.1` runs with act-1. `undo_refused` and the permission request are unchanged. `trial.2` has `cannotUndo` [act-1]; `asked` 2.
- **B shape, one-line cart (both consequence sets).** `trial.1` with `acts` [act-1]; `undo_wrong_target`, no `demo.remove` and no undo records kept; `trial.2` has `cannotUndo`; lines `["before","trial-1","trial-2"]`.
- **B shape, two lines.** Same: `undo_wrong_target`, then `trial.2` has `cannotUndo`; lines `["before","added-1","trial-1","trial-2"]`.
- **Two-line cart with row tokens.** The undo removes only the added line (`["before","trial-1"]`). `trial.2` starts with `acts` [act-2] and `act-1` is absent.

Unchanged and still passing:

- The two hook tests: the start hook runs and no undo is asked of the model.
- The edit-in-no-item and cross-check tests.
- The negative assertion that `candidate.trial_reset_required` never appears in the hook-first test. It is trivially true now but still guards against it coming back.

### action-permissions.test.ts (6, rewritten)

- **Project control original (core.run_node and custom.press).**
  - Old: `reset_witness_required` refusal and 0 effects before an original was read.
  - New: the press runs at the exploration door (effects 1, no `reset_witness_required`).
  - Kept: an unidentified control is still refused `reset_target_unidentified` with no effect (admission rule 3).
  - Then, once the original counts are read, the same control runs again (effects 2).
  - Dropped: only the `ledger.inPlace()` assertions. This test never goes through the placed-call recorder, so they could say nothing.
- **Captures, records and settles a custom effect.**
  - Old: `beforeTrial` with the act in place gave `refuse`.
  - New: it gives `admit` with `startedWith.acts` [act-1].
  - Kept: the undo executes, the standing is `restored`, then `admit`, and the raw args hold no `consequences` or `undoes`.
- **Identified exploratory creation with no destination observed.** Old: refused `create_baseline_required`, executed 0. New: runs (executed 1, `effectApplied` true) with no `create_baseline_required` in the result; the signal and the request are untouched.
- **Recovers through observed original authority and an issued ref.**
  - New: the first "missing" creation runs (creates 1) and is recorded as act-1; the ref creation is act-2.
  - A trial with the document still on the site admits, with `startedWith.acts` containing the `create` call.
  - The targeted undo (`undoes: "act-2"`) still runs, and `resetDestination` is still stripped before the domain.
  - Final: admit with `startedWith.acts` exactly [act-1 "missing"], and act-2 absent. That shows the undo settled act-2 and left only the witnessless one.
  - The old final assertion was a bare `{ kind: "admit" }`; the new one is stricter about what is listed.
- **Unwitnessed press before and after the first lasting act (t751).**
  - Old: both refused `reset_witness_required` as the seal.
  - New: both run, and nothing is sealed (`told` is `[undefined, ref, undefined]`).
  - A trial is admitted with `startedWith.acts` containing both unwitnessed calls.
  - The repeat press still runs and shares the witnessed act's witness.

## Commands run

- `node ../../scripts/vitest-groups.mjs --groups=parallel src/programs/automation-studio/runtime/flow-bootstrap/tests` from `packages/fluxiq`, before the edits: `Tests 19 failed | 164 passed (183)`.
- Same command after the edits: `Test Files 17 passed (17)`, `Tests 183 passed (183)`, `all groups passed: parallel`.
- `pnpm check` in `packages/fluxiq`: the build-cache `fluxiq:check` ran tsc and printed no TypeScript errors, so nothing foreign appeared. The warnings it printed were the file-lines advisories.
- `pnpm structure:check` at the Core root: `structure-audit: passed (448 warning(s), 1152 baselined)`.

## Not verified

- Nothing outside `flow-bootstrap/tests` (the project-agents and service/project-build tests belong to another worker).
- `trial_step_unwitnessed` and `trial_starts_in_end_state` are not asserted here. They live in other test directories (reset-admission, site-reset).
- The step-door refusals for missing witnesses are not asserted here either; `reset-admission/tests` presumably covers them.

## Open questions

None.
