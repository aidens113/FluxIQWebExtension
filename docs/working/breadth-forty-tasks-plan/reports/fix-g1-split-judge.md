# Fix G1: split judge re-ask and split-unsure gate wording

Worker report for brief G1. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t725/!FluxIQ`, branch `task/t725-judge-time-honesty`. Nothing was committed, and no Lab or browser run was made.

## Outcome

Done. Both parts are in place:

1. When the two judge calls split (one yes, one no), the no is now asked one more time to name its defect.
2. Both trial gates now describe an unsure that came from a split as a split.

All the named checks pass.

## What changed and why

### 1. Re-asking a split's no (`runtime/result-verification/`)

**New file `agreement/split-no-words.ts`.** It exports `AUTOMATION_STUDIO_RESULT_SPLIT_NO_RECHECK`, the generic words sent with the re-ask. They tell the call:
- Answer no only for a defect it names in this result: a row kept that the request does not ask for, a row the request asks for that was left out, or a wrong column or value.
- For each one, name the row, column or value and quote the words of the request it fails.
- A row it finds rightly left out is not a defect. Neither is a concern about rows the evidence does not show, or about what another run might meet.
- If it can name no such defect, answer yes and give the concern as advice.

**New file `agreement/reask-split-no.ts`.** It exports `automationStudioResultVerificationReaskSplitNo`. The re-ask happens only when all of these hold:
- the settled outcome is `model_disagreed`;
- it has exactly two verdicts, so no call has been asked again yet;
- one call is a model yes, and the other is a model no with its own reading. A yes that Core refused, which carries no reading, is not re-asked.

What happens next:
- The no's call is asked once, through the verification's own `ask`.
- Its answer takes that call's place under the agreement's rule.
- If the answer is yes, the outcome is two yeses. The first no's concern (its advice, or failing that its observation) rides on the outcome as `answeredReading.advice`. It is never a repair.
- If the answer is a no that names a defect, the split stands, carrying the new reading.
- If the re-ask did not come back usable, the split is kept, with `calls: 3`.
- It is never asked twice.

**`agreement/index.ts`.** Exports for the two new files, plus a t725 header paragraph.

**`verify.ts`.** Wired in last, after `automationStudioResultReaskNarrowingNo`. That keeps the more targeted rechecks (t503, t515, t607, t666) first. The split-no re-ask runs only when none of them asked. It uses the same `ask`, so:
- the call goes through `askCheck` with `request.runBudget` and the current build purse;
- its intervention is marked `verificationReask`;
- it counts in `trail.reasks`, so `firstAskConfirmed` stays false.

I also added a t725 header note.

**Placement departs from the brief's wording.** The brief named `reask-contradicted.ts` as the place to wire it in. I wired it in `verify.ts` instead, after the narrowing re-ask. If it ran inside `reaskContradicted`, it would always use up the split's one re-ask before the t666 narrowing recheck could run, and the narrowing words are more pointed for that case.

### 2. Gate wording for a split unsure

Two files, each changed in wording only:
- `flow-bootstrap/candidate/trial-gate.ts`
- `flow-bootstrap/subflow-candidate/subflow-trial-gate.ts`

Each now has a new `UNSURE_SPLIT` constant and a one-line branch. The branch runs after the retest-advised and part-contradicted cases, and only when `feedback.answeredReading` is an object. Per `service/candidate-trial/feedback.ts`, that field is set only on a split.

The new words say:
- the two calls read the same trial and disagreed;
- the yes's reading is in `answeredReading`, and the no's reading and advice are in `unconfirmedReading`;
- the same evidence drew both answers and nothing in Core's record settles which is right (`retestAdvised` is false), so neither answer is the verdict;
- change the Flow (or subflow) only for a wrongly kept row, a wrongly left-out row, or a wrong column or value that the no names and the trial's own evidence shows;
- a concern about rows the trial did not show is not a defect;
- a retest stays allowed where the evidence shows no such defect.

The "likely to be judged the same way" sentence is no longer said for a split. An unsure that is not a split still gets the old words. Each file also has a short t725 header note. No other gate logic changed.

### Tests

**New:**
- `agreement/tests/recipe-split-fixture.ts`: a made-up recipe archive.
- `agreement/tests/reask-split-no.test.ts`, 8 cases:
  - the words, and that the re-ask is sent as call 1;
  - a split with a no that names no defect becomes a yes, with the concern carried as advice and no repair;
  - with the yes first, call 2 is the one asked;
  - a no that names a real defect stays disagreed;
  - a re-ask that did not come back usable keeps the split;
  - readings that agree (yes/yes and no/no) are unchanged and nothing is asked;
  - nothing is asked twice;
  - a yes Core refused is not asked.
- `tests/reask-route/tests/split-no-route.test.ts`, 3 cases through `verifyAutomationStudioRunResult`:
  - under an `AutomationStudioLlmBuildPurse`: `spentCalls()` is 3, 3 charges settle, the third request carries the words, and its intervention is `verificationReask`;
  - a no that names a defect stays a split, with 3 calls;
  - two nos ask nothing more.
- Gate tests, `candidate/tests/trial-gate-unsure.test.ts` and `subflow-candidate/tests/subflow-trial-unsure.test.ts`:
  - the split case now asserts the split wording and that "likely to be judged the same way" is absent;
  - a new case checks that a no without a yes beside it keeps the old "Nothing in Core's record contradicts..." words.

**Existing tests updated.** The extra call is now made on every split, so seven existing tests that assumed a split ends at two calls were changed. In each, the scripted third reply repeats the no, which keeps the test's original meaning:
- `result-verification/tests/run-outcome.test.ts`: the runtime check, now 3 calls.
- `result-verification/build-test/tests/judge.test.ts`: "yes, then no", now `spent.calls` 3.
- `result-verification/refuted-no/tests/split-partly-refuted-route.test.ts`: "yes came first", now 3 calls.
- `result-verification/tests/reask-route/tests/narrowing-no-route.test.ts`: "not asked again where the option is not the request's words". It now gets 3 calls, and the third carries the split-no words, not the narrowing words.
- `flow-bootstrap/candidate/tests/kept-condition/tests/kept-condition-after-split.test.ts`: the judge is scripted `(YES, NO, NO)`.
- `service/candidate-trial/tests/run.test.ts`: the "a yes then no" row is now `["yes","no","no"]`, 3 calls.
- `service/flow-bootstrap-commands/tests/candidate-trial-facade.test.ts`: a "no" second reply means 3 judge requests.

## Commands run and observed results

All of these were run from `packages/fluxiq` (or the worktree root for the last two):

- New agreement and route tests, after the change: 2 files, 11 tests passed. The run order was not strictly tests-first, because I wrote the tests and the code in the same pass.
- The two gate unsure tests: 2 files, 10 tests passed.
- `npx vitest run src/programs/automation-studio/runtime/result-verification`:
  - before the existing tests were updated: 4 failed, 1109 passed. All four failures were extra-call expectations.
  - after: 133 files, 1113 tests passed.
- `npx vitest run .../runtime/flow-bootstrap .../runtime/service/candidate-trial`:
  - first run: 2 failed, 2595 passed, 2 skipped. Both failures were the same extra-call kind.
  - after fixing them, those two files plus the kept-condition folder: 4 files, 31 tests passed.
  - I did not re-run the whole flow-bootstrap folder after that fix; only the two fixed files and their folders were re-run.
- Other judge-scripting tests: `conversations/commands/tests/extension-chat`, `llm/deepseek/tests/verdict-before-cut`, `llm/harness/tests`, `llm/tests/diagnosis-channel`, `project-agents/single-subflow/tests/kept-every-row-build`, `recovery/refuted-result/tests`, `service/flow-bootstrap-commands/tests`, `service/project-build/tests/project-build-subflow-entry`, `tests/deepseek-bootstrap`, `tests/in-run-repair`, `tests/refuted-result`, `tests/service-adaptation`.
  - result: 1 failed (`candidate-trial-facade`, extra call), 625 passed.
  - after the fix, that file alone: 8 tests passed.
- The prompt contract tests and the remaining judge-scripting folders together: `llm/deepseek/tests` (including `system-prompt.test.ts`), `llm/step-log`, `result-check-authorization`, `service/flow-settings`, `service/project-build`, `service/runtime-adaptation`, `tests/service-authoring`, `tests/service-bootstrap`, `flow-bootstrap/plan/tests/extraction-vocabulary.test.ts`, `flow-bootstrap/plan/tests/issue-feedback.test.ts`. Result: 93 files, 701 tests passed.
- `pnpm --filter ./packages/fluxiq check`:
  - the first run failed on 2 type errors in my new test file (`exactOptionalPropertyTypes`);
  - after fixing them it passed with no errors (`"stored in the shared store"`);
  - the agreement folder re-run then gave 6 files, 34 tests passed.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (407 warning(s), 1152 baselined)`.

The other worker's uncommitted project-build, activity, conversation and supervisor edits were in the tree during all of these runs. They type-checked and their tests passed in the folders above.

## Not verified

- No live judge, Lab or browser run, as the brief required. I have not checked whether DeepSeek, given these words, really does answer yes over a no like the one at 0084, or keeps a no that names a real defect.
- The full package suite was not run. Nor was `pnpm test` at the repository level, or the downstream repository.
- The whole flow-bootstrap folder was not re-run after the last two test fixes. Only those files and their folders were.
- The purse is charged for the third call, and the route test checks that. But I did not change the build-test judge's affordability gate. The trial gate's "cannot pay the two judge calls" check still reserves for two calls. If a build has only enough money for two calls, the third is refused by the purse and the split stays unsure. This is the same as for the existing re-asks.
- Outside a purse, `judge.ts` caps each call at `maxCostUsd / 2`, on the basis that verify asks twice. A split now makes three calls, so the judgement can spend up to 1.5 times `maxCostUsd`. The existing re-asks already exceed this (up to 4 calls), so it is not new, but it is unchanged.

## Open questions or contradictions found

- **Placement.** The brief said to wire the re-ask into `reask-contradicted.ts`. I wired it into `verify.ts` after the t666 narrowing re-ask, so the narrowing recheck keeps its precedence on splits. The function itself lives in `agreement/` beside the other re-asks. If the supervisor prefers it inside `reaskContradicted`, the t666 narrowing re-ask would never run on a split.
- **"Counts as yes" is decided by the model, not by Core.** If the re-asked no names no defect, the words tell it to answer yes. Core does not itself turn a re-asked no into a yes when that no fails to quote the request. The agreement header promises that "Core never turns a no into a yes", and a mechanical check of whether a no names a defect would be fragile. If the supervisor wants a mechanical rule instead, that is a further decision.
- **Contract comment.** The contract comment in `contracts/verification.ts` for `answeredReading.advice` still describes it only on a held yes that advised a change. It now also carries a re-asked split no's concern on a taken yes. I left the contract file alone because the brief did not list it. The build-test judge drops a yes's advice (`{ verdict: "yes", spent, firstAskConfirmed }`), so this advice reaches only the verification outcome and the run record. It does not reach the build's finishing verdict.
- **Changed premises in existing tests.** Seven existing tests had premises that a split is not re-asked, including the t666 narrowing route's "is not asked again" and the t652 partly refuted split. They were updated as listed above. The supervisor should confirm this change in behaviour is intended: every split now costs a third judge call.
