# t373 report: the chat shows the candidate tools as steps

## Outcome

Done. Code is in the t373 Core worktree only; nothing is committed.

A candidate build's two tools now pass through the activity observer:

- `core.submit_candidate` reads "Saving the Flow's steps".
- `core.test_candidate` reads "Testing the whole Flow from the start".

Each call now sends a started row and a closing row, so each one gets a card in the chat. Each closing row ends with Core's own account in plain words.

The test row opens before the trial's first "Running step" row and closes after its last one. Its record still begins `Result: candidate.trial_<verdict>`, which is what the extension's `candidate-trial.ts` already reads. So t363's verdict lines ("The test passed: ...", "The test failed: a step didn't work. Next: ...") now fire with no extension change.

How the cards read (taken from the tests):

| Situation | Card |
| --- | --- |
| Steps accepted | Change the Flow · Done: the steps were accepted |
| Steps refused | Change the Flow · Not done: some steps point at things that weren't seen on the page; 2 things to fix |
| Test passed | Test run · Done: the test passed and the Flow did what you asked: 2 steps done |
| Run stopped | Test run · Didn't work: step 2, "No thanks", didn't work and was passed over: the step's control was not found on the page; step 4, "Add to cart", didn't work: the step ran and did not work; 1 step done, 1 skipped |
| Judge said no | Test run · Didn't work: the Flow ran, but it didn't do what you asked: 2 steps done |
| Judge unsure or not judged | Test run · Didn't work: the Flow ran, but whether it did what you asked couldn't be confirmed: 2 steps done |
| Gate refused (stale revision) | Test run · Not done: only the latest saved steps can be tested |
| Same failure in two tests | ...; it stopped there in two tests, so that step has to change |

No card, title or status sentence names a tool id, a revision, a digest, a run id, a node id, a code or a handle. The tests check this.

## What changed and why

**Wiring.**

- **`runtime/flow-bootstrap/candidate/authoring-loop.ts`** takes a new option, `observe?: (loop) => loop`. It is applied to the loop input the authoring loop builds itself, which already contains the submit and test handlers.
  - Before, the caller wrapped the inner `input.loop`, so neither candidate tool ever reached the observer (t366's root cause).
  - `checkCompletion` is deliberately kept outside the observer. Completion is allowed only after a passed test, which that test's card already says. The observer's completion note is the legacy round's wording ("...it still has to run cleanly"), which is wrong here.
  - The observer is injected rather than imported, so `flow-bootstrap/candidate` does not import `activity`.
- **`runtime/service/flow-bootstrap-commands/candidate-generation.ts`** passes `observe: observeAutomationStudioEvidenceLoop` and no longer wraps `loop` itself. Each decision is still observed exactly once.

**Wording** (new directory `runtime/activity/candidate/`, with a barrel):

- `result.ts`: `automationStudioActivityCandidateResult(toolId, result)`. For the two tools it returns the closing row's status, which record part to use (`Said` or `Declined`), the words, and the status-sentence ending ("done", "not done", "passed", "didn't pass"). For anything else it returns nothing.
- `submission-words.ts`:
  - Accepted, or declined with what to fix.
  - Uses the completion check's own reasons. A refused submission comes from the same check that refuses a legacy completion.
  - Two refusals are candidate-only: a loop or binding refusal, and a superseded submission.
  - Adds "N things to fix" when there is more than one issue.
- `trial-words.ts`:
  - Gives the verdict plus each step's outcome, read from t365/t368 feedback: how many steps were done and skipped.
  - Names up to two steps that did not work, by run number and the control's words, falling back to the label with handle tokens such as `t478` removed. Each one says why.
  - For a failed check, it says what the step waited for and whether that text was hidden or absent.
  - It also covers: a run that stopped between steps, a run that never reached a step, gate refusals, and the same failure twice.
  - The judge's own text (`observed`, `advice`) is never shown, because it is the model's reading of the page.

**`runtime/activity/observer.ts`.** On a candidate tool's closing row, the observer now:

- uses the status from the candidate wording, so a non-yes verdict reads `failed` rather than "done" (`candidate.trial_no` has no failing word in it);
- appends `Said: <words>` or `Declined: <words>` as the last part of the record;
- ends the label with the candidate wording's ending.

Nothing changes for any other tool.

**`runtime/activity/wording/completion-refusal.ts`.** The refusal-reason table is now also exported as `automationStudioActivityCheckRefusalReasons`, so the submission card and the completion note share one table. `automationStudioActivityCompletionRefusal` behaves exactly as before.

**Shared card reader, Core `ui/activity-action/`.** This is outside the literal "Owns" list; see Open questions.

- `record.ts` reads two new words parts, `Said:` and `Declined:`. Like `Changed:`, each comes last on the record and is never read as codes.
- `refusal.ts`: a `Declined` record is a refusal of the whole call ("Not done: ...").
- `action-of.ts`:
  - `core.submit_candidate` is classed as `draft` ("Change the Flow") and `core.test_candidate` as `test` ("Test run").
  - `Said` becomes the card's `result` when the card is done, and its `why` when it failed.

Without this, a card can only say "Action · Done". The extension reads cards through this function, so it gets the words with no extension change.

**Tests.** Two of the new test files are fail-first: all 7 of their tests failed against HEAD with "no candidate tool rows".

- New `runtime/service/flow-bootstrap-commands/tests/candidate-tool-cards.test.ts`. It runs a real service candidate build: one refused submission, one accepted, a judged trial, completion. It checks:
  - started and closing rows for each submission and the test;
  - plain card words, with no internal ids or digests;
  - that the test's card brackets every trial step row;
  - that the record starts `Result: candidate.trial_yes` (the extension's regex).
- New `runtime/flow-bootstrap/candidate/tests/authoring-loop-cards.test.ts`. It drives the authoring loop with the real observer and a fake trial port. Cases:
  - `execution_failed` with an optional step passed over, a skipped step and a handle in a label;
  - no, unsure and not_judged;
  - a stale-revision gate refusal;
  - the same failure in two tests.
- New `runtime/activity/candidate/tests/result.test.ts`: unit cases for every wording branch.
- Added cases to `ui/activity-action/tests/record.test.ts` and `action-of.test.ts`.

## Commands run and observed results

All commands ran in `C:\Users\osrs_\FluxStuff\fxwork\t373\!FluxIQ`. Package commands ran in `packages/fluxiq`.

- **Fail-first.** I temporarily replaced the 10 modified files with their HEAD copies, then ran `npx vitest run .../candidate-tool-cards.test.ts .../authoring-loop-cards.test.ts`. Result: `Tests 7 failed (7)`. For example: `expected [] to deeply equal [ Array(4) ]`, and `expected [] to have a length of 1 but got +0`. I then restored my versions.
- **Typecheck.** `npx tsc --noEmit -p tsconfig.json` gave `tsc exit 0` (after the final restructure).
- **Owning tests.** `npx vitest run src/ui src/programs/automation-studio/runtime/activity src/programs/automation-studio/runtime/flow-bootstrap/candidate src/programs/automation-studio/runtime/service/flow-bootstrap-commands` gave `Test Files 61 passed (61)` and `Tests 629 passed (629)` (final state). Before my change the same directories gave 58 files and 605 tests, all passing.
- **Core audit.** `node scripts/structure-audit.mjs` printed `structure-audit: passed (289 warning(s), 710 baselined).` That is the same warning count t366 reported. It also printed "1 baseline entries can be lowered", which was already there before this change.
  - My first layout added a `directory-files` advisory: `activity/wording/` reached 19 files.
  - A `wording/candidate/` subdirectory then hit the hard `naming` depth limit (10 path segments).
  - The final layout is `activity/candidate/`, with no new warnings. The audit's import-cycle and `as never` rules both pass, and the change adds no `as never`.
- **docs-links.** `node scripts/structure-audit.mjs --rule docs-links` printed `passed (0 warning(s), 0 baselined)`.
- **Framework reference.** `node scripts/docs-reference.mjs --check` fails with "docs/reference/framework-reference.md is stale".
  - I regenerated it to see the diff. It is three rows, line numbers only: `activityActionOf` `action-of.ts:407` -> `:414`, `automationStudioActivityCompletionRefusal` `:35` -> `:52`, and `observeAutomationStudioEvidenceLoop` `observer.ts:251` -> `:259`.
  - I then put both generated files back to HEAD with `git checkout --`, because t372 owns them.

## Not verified

- **`pnpm docs:check` does not pass in this tree.** The only cause is the line-number drift above, which is exactly t372's defect. The fix is either to merge t372 first, or to run `pnpm docs:reference` in Core after merging.
- **No extension test run and no live browser or Lab run.** I did not rebuild Core libraries or run the extension's tests against this Core. "The overlay still detects the trial" is checked on Core's side only:
  - the test row is `kind: "tool"` with `ref: "core.test_candidate"`;
  - its `started` row comes before every trial step row;
  - its closing row comes after them, with a record matching `^Result:\s*candidate\.trial_<verdict>`.

  That is the contract `candidate-trial.ts` reads. One more effect: the pacer now also sees the submit tool rows. The extension's `backToTheBuild` treats any tool row as closing an open test. Submissions happen outside a trial, so I expect no effect, but I did not observe it.
- **Full suites not run**, per the validation rules.
- **Legacy builds** go through no changed path: the candidate wording returns nothing for other tools. I covered this by test only.

## Open questions or contradictions found

- **Files outside the literal "Owns" list.** These are Core `ui/activity-action/{record,refusal,action-of}.ts` (with tests) and `service/flow-bootstrap-commands/candidate-generation.ts`.
  - `candidate-generation.ts` is the observer wiring: it is where the observer was applied to the wrong level.
  - The `ui` reader is the only place a card's name and its "Done: / Didn't work: / Not done:" words are decided. Without it, the brief's "card ... in plain words" cannot be met.
  - Neither file is on the "Must not touch" list. The `ui` changes are additive: two refs in the kind map, two new record parts, and a `Declined` refusal.
  - Please confirm, or re-scope.
- **Architecture docs not updated.** The activity record now carries `Said:` and `Declined:` parts. I did not edit Core `docs/architecture/automation-studio/llm-flow-bootstrap.md` because it is not mine. Suggested text for the supervisor: "A candidate build's `core.submit_candidate` and `core.test_candidate` calls are observed like any build tool; their closing rows end with `Said:` (how a call that ran went) or `Declined:` (why Core ran none of it) in plain words, which the shared card reader shows as the card's result, reason or refusal."
- **Candidate builds still show no completion-check note.** This is deliberate (see the wiring section). If the chat should also show a "completion sent back" note in candidate mode (for example `candidate.trial_required`), it needs candidate wording of its own. The legacy note's fallback, "It needs changes before it can be used", would be wrong there.
- **Phases left as they were.** Both candidate tools keep phase `exploring`, as `tool-call.ts` gives Core's own tools. Moving the test to `verifying` would better match the card's "Test run" name, but it would change what the extension pacer sees, so I left it alone.
