# D3 words

## Outcome
Done.

## What changed and why
- llm/loop-budget.ts: wrap-up no longer says the undo is "to undo it before a trial"; trial_step_unwitnessed line now means "no place named where the change shows: end blocked naming the step and where its change would show". Header comment reworded to targeted undo / trial_starts_in_end_state.
- service/project-build-notes/told.ts: build note says the act is recorded as this build's act and stays on the site, the trial is judged by the change from what was there just before it; still points to project.amend_plan; never forbids a step. beside.ts holds no words, untouched.
- activity/candidate/trial-words.ts, run-refused.ts: labels for trial_starts_in_end_state, toggle_not_idempotent, trial_step_unwitnessed; retired codes kept for old records with wording that no longer claims a reset.
- llm/repeat-guard/outcomes.ts: trial_starts_in_end_state joins the precondition regex (lifted by any later call that ran), comment updated.
- ui/activity-status/steady/test-ending.ts: label for trial_starts_in_end_state; retired labels reworded.
- Tests: result.test.ts, loop-budget.test.ts, told.test.ts, reset-precondition.test.ts, new steady/tests/test-ending.test.ts; also ui/activity-status/tests/truthful-test-labels.test.ts line 106 (project.trial_reset_required fallback words, changed expectation only).

## Commands run
- vitest-groups parallel on touched dirs + src/ui + system-prompt + issue-feedback tests: first run 3 failures (my test assertions, fixed); rerun of loop-budget/activity/project-build-notes/ui: 1 failure (truthful-test-labels line 106, fixed); src/ui rerun: 35 files, 440 tests passed. Not re-run as one combined command after the final fix.
- pnpm check (packages/fluxiq): tsc reuse stamp (inputs matched), no errors printed.
- pnpm run structure:check (repo root; not a packages/fluxiq script): passed (448 warnings, 1152 baselined).

## Not verified
- Full combined acceptance command after last fix; system-prompt and issue-feedback tests were in the first run (passed).
- toggle_not_idempotent is refused at submission: submit tools take their words from submission-words.ts (not owned), so run-refused.ts's label covers non-submit tools only. The lead should check submission-words.ts for that code.

## Open questions
- Whether outcomes.ts precondition should also lift for trial_starts_in_end_state was my reading of the brief; confirm.
