# t498 accepted-script-stays-in-context: worker report

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t498/!FluxIQ`, branch `task/t498-accepted-script-stays-in-context`. Nothing committed.

## Outcome

**Done**, after the continuation brief.

- The first pass did goals 2, 3 and 4, plus the wording part of goal 1. It reported Partial because goal 1 needed `authoring-loop.ts`, `submission.ts`, `submission-refusal.ts` and `context-window.ts`, and the corpus test needed a case.
- The continuation granted those files, and goal 1 now lands with the replay test the brief asked for.

All paths below are under `packages/fluxiq/src/programs/automation-studio/runtime/` unless they start with `docs/`.

## What changed and why

### Goal 1. The latest accepted script stays in context, and a refused one is never taken for it

**An accepted submission carries its script** (`flow-bootstrap/candidate/authoring-loop.ts`).

- The accepted `core.submit_candidate` evidence now includes `script`: the whole text as sent. For a JSON plan submission it includes `plan` instead.
- It also includes `scriptIs`: "Revision N (digest …) is your current Flow, the latest you submitted that Core accepted, and script is its whole text. Make every change to the Flow by editing this script and submitting it whole; never write it again from memory, and never start from a refused script."
- The loop records which call each revision was accepted in (`acceptedIn`).

**A refused submission after an accepted one is labelled refused and superseded** (`refusedLabel` in `authoring-loop.ts`).

- Its evidence gains `current: { revision, digest, call }`. It reads these through the new `AutomationStudioFlowCandidateSubmissionController.lastAccepted()` (`submission.ts`), which returns the last accepted revision even after a refusal has cleared it as the one to test.
- It also gains `scriptIs`: "This submission was refused and is no revision: the script it sent (previous, under diagnostics, where given) is superseded by revision N, your current Flow, whose whole script is under call X. Submit again from revision N's script, making again the changes this call meant and correcting the listed issues in them; read previous only to find the lines the issues name."
- The refused text stays readable, because its issues name its lines.
- With nothing accepted before it, a refusal is unchanged: `previous` is the script to correct.

**One current script, with cache-safe supersession** (`llm/context-window.ts`, the private `candidateScripts` and `withoutScript`).

- In what a decision is shown, every submission older than the newest accepted one loses `script`, `plan`, `scriptIs`, `current` and `diagnostics.previous`, and gains `supersededBy`. That key names the nearest accepted submission after it, never the newest.
- So a stub, once written, never changes, and the submissions' entries change only when a new revision is accepted.
- The loop's own records are never changed.
- This is one file; no new decision-context module was needed.

**Wording.**

- `bootstrap-completion.ts` `FEEDBACK_INSTRUCTION`: "Where previous is given, it is the script this call sent, and it was refused: it is no revision … Once a later submission is accepted, that revision is your current Flow: edit its script, never this refused one." This was done in the first pass.
- `submission-refusal.ts` `GENERAL_NEXT`: "Correct every listed issue in your current Flow's script -- the latest accepted revision's, where one was accepted (current names it), or else previous, the script this call sent -- keep every other line…".
- No refusal text says "you sent" or "just sent" any longer.

### Goal 2. `writeMode: replace` inside a loop is refused

- **Where replace takes effect.** This is confirmed in `storage/project/run-dataset-store.ts`, `appendBatch`: every `replace` batch deletes the run's `run_dataset_rows` and `run_dataset_batches` for that dataset. The build test mirrors it in `result-verification/build-test/stores.ts`, `collect`.
- **Where writeMode is checked.** Its shape is checked in `flow-bootstrap/plan/record-output-contract.ts`, which is unchanged.
- **New check: `flow-bootstrap/script-statements/record-replace-in-repeat.ts`.**
  - It reads the plan graph. Any node on a cycle through `builtin.control.repeat` or `builtin.control.for-each` whose record output says `writeMode: "replace"` is refused as `record_output.replace_in_repeat`, at `…parameters.<id>.writeMode`.
  - The sentence says each pass would overwrite the rows the passes before it saved, and to use `writeMode: append`.
  - A recovery cycle is left alone, and so is the read that feeds a For Each.
- **Where it runs.** It runs in `bootstrap-completion.ts` after registry validation, for a script, a JSON plan or a draft. Its sentence travels through `withCoreSentence`, formerly `withRoutingSentence`, which now has a `PLAN_CHECK_CODES` set.
- **Where it does not run.** It is deliberately not in `plan/validation.ts`, so flows a person saves are not refused.
- **Corpus.** The case "a read that replaces its rows inside a repeat" is added to `refusal-locator-corpus.test.ts`.

### Goal 3. The `only_after_misplaced` refusal

The `repeatsWhile` branch of `guarded-steps.ts` `memberRefusal` now says: "…Fix it one of two ways: delete the `only after: <label>` line at line <N> -- an optional step goes on to the next step whether or not it acted, so this step then runs on every pass; or move this step so the span ends at a step that always runs, and keep `only after:` only on a step that must be skipped when "<label>" did not act."

### Goal 4. Trial feedback says how paging ended

`service/candidate-trial/feedback.ts`:

- Each read that paged, or was written to page, carries `pagesRead`, its `stop` word and `paging`. `paging` is the judges' own sentence, from `automationStudioResultSummaryWithPagingWords`.
- The feedback carries a `pagingNote` once when any read has paging.
- A split verdict's `readings` gains a sentence saying this record stands against a reading about pages.
- The judges' copy is unchanged.

### Goal 5

There are no scenario words in model-facing text. The fixtures use a recipe archive, plus the existing neutral fixtures.

### Docs

`docs/architecture/automation-studio.md` gains three bullets after "A reworded resubmission costs no trial":

- the model always sees its latest accepted script;
- replace inside a loop is refused;
- trial reads say how paging ended.

## Tests added or changed

- **`flow-bootstrap/candidate/tests/accepted-script-context.test.ts` (new).** It replays the run's sequence through the real `runAutomationStudioFlowCandidateAuthoringLoop`, reading what each decision was shown. Five cases:
  1. Accepted 1 and 2, refused 3, then a decision:
     - revision 2 is whole, with `script` and `scriptIs` naming "Revision 2 (digest …) is your current Flow";
     - revision 1 is `supersededBy: submit.2`;
     - revision 3 is refused, with `current: {revision: 2, digest, call: "submit.2"}` and `scriptIs` "superseded by revision 2, your current Flow";
     - revision 3 never matches /script you (just )?sent/;
     - exactly one entry carries a `script`.
  2. Then accepted 4:
     - revision 2 and refused revision 3 are both `supersededBy: submit.4`;
     - revision 3 has no `scriptIs`, `current` or `diagnostics.previous`;
     - the refused text is nowhere in the decision;
     - revision 4 is whole.
  3. The submissions' entries are identical between two decisions with no new acceptance (cache).
  4. A refusal with nothing accepted before it keeps `previous` and has no `current`.
  5. A refusal made before any acceptance is superseded once a revision is accepted.
- **`llm/tests/context-window.test.ts`.** A new describe block with three unit cases:
  - stubbing by the nearest newer accepted submission, labelled refusals after it kept, another tool's `script` key untouched, and input records not mutated;
  - a JSON plan stubbed the same way;
  - no change when nothing was accepted.

  I first wrote these as a separate file, but `llm/tests/` would then hold 26 files against the audit's 25-file limit, so they live here.
- **`flow-bootstrap/candidate/tests/submission-refusal.test.ts`.** The `GENERAL_NEXT` assertion is updated, and also asserts that "script you sent" is absent.
- **`flow-bootstrap/candidate/tests/refusal-locator-corpus.test.ts`.** The new corpus case.
- **From the first pass:**
  - `script-statements/tests/guarded-steps.test.ts`;
  - `script-statements/tests/record-replace-in-repeat.test.ts`;
  - `harness-options/tests/record-replace-in-repeat-feedback.test.ts`;
  - `harness-options/tests/bootstrap-completion.test.ts`;
  - `candidate-trial/tests/paging-feedback.test.ts`.

## Commands run and observed results

All were run from `packages/fluxiq` unless noted.

### Fail-first checks

- **Goal 1:** `npx vitest run …/candidate/tests/accepted-script-context.test.ts` before any goal 1 code: 3 failed, 1 passed.
  - The two replay cases failed, because the accepted evidence had no `script`.
  - The cache case also failed, but because of a defect in the test itself: it compared the history and budget entries that sit beside the evidence. I fixed the test before implementing, and did not re-run it fail-first afterwards.
  - The nothing-accepted case passed, as it should: that is existing behaviour.
- **Goal 2:**
  - `npx vitest run …/harness-options/tests/record-replace-in-repeat-feedback.test.ts` before the check: 1 failed (the replace case was accepted), 2 passed.
  - `refusal-locator-corpus.test.ts` failed with `uncovered = ['record_output.replace_in_repeat']` until the case was added.
- **Goal 3:** `guarded-steps.test.ts` against the HEAD source: 1 failed, 9 passed.
- **Goal 4:** `npx vitest run …/candidate-trial/tests/paging-feedback.test.ts` before the change: 4 failed of 4.

### After all changes

- `npx vitest run $R/flow-bootstrap/candidate/ $R/flow-bootstrap/script-statements/ $R/llm/harness-options/ $R/service/candidate-trial/ $R/llm/tests/ $R/llm/deepseek/`: Test Files 96 passed (96), Tests 1142 passed (1142).
- An extra run before the tests were merged into `context-window.test.ts` (`context-window.ts` has not changed since): `npx vitest run $R/llm/decision-context/ $R/llm/evidence-loop/ $R/llm/repeat-guard/ $R/flow-bootstrap/tests/ $R/activity/ $R/service/flow-bootstrap-commands/ $R/llm/candidate-receipt/`: Test Files 117 passed (117), Tests 1015 passed (1015).
- `pnpm run check` (the fluxiq tsc typecheck): `TC_EXIT=0`.
- `pnpm structure:check` from the repository root: "structure-audit: passed (340 warning(s), 1159 baselined)".
  - An earlier run failed `[directory-files] … runtime/llm/tests/: 26 source files exceeds the 25-file limit`. Merging my new test file into `context-window.test.ts` fixed it.
  - The audit still says "2 baseline entries can be lowered". I did not run `pnpm structure:baseline`, because `.structure-baseline.json` is not mine.
- `llm/deepseek/tests/system-prompt-pins.json`: unchanged. No pinned prompt contains the changed text, and `llm/deepseek` passes.

## Not verified

- **No Lab, live or provider run.** Whether the model now edits the accepted script instead of resending a refused one is shown only by the replayed evidence, not by a model.
- **Full suites** were not run, as briefed.
- **Downstream** was not checked.
- **Request size and cache hit rate:** the accepted script now rides in each later request (about 1-3 kB per revision kept whole). I did not measure the effect on the request or the cache. Stubs replace the older scripts, so only the newest accepted script and any refused script after it stay whole.
- **The `next` text of an older accepted result** ("Test next with … exactly {revision, digest}") is still shown after a newer revision supersedes it. That was existing behaviour, and only the script, label and current fields are stubbed.

## Open questions or contradictions found

- **Revision 3 "superseded" with no revision 4.**
  - When a refused revision 3 follows an accepted revision 2, its script is kept readable and labelled refused and superseded by revision 2. The label sits in `scriptIs` and `current`; the script is not stubbed, because the issues name its lines.
  - The script is stubbed only once a later revision is accepted.
  - If you want it stubbed even when no later revision exists, the change is one condition in `candidateScripts`.
- **The repeat guard's note** (`llm/repeat-guard/candidate-feedback.ts`, debug fix 5) still does not say that a resent script predates a later accepted revision. It is out of this brief. With the script now in context it matters less.
