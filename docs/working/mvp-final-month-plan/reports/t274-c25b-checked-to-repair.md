# t274-c25b: Core's checked rows reach the repair that acts on the refutation

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQ`. RT = `packages/fluxiq/src/programs/automation-studio/runtime`. Nothing was committed.

## Outcome

Done. All four tasks are implemented. Each has a test built from live run `run-muw60j7c-bb7c9a62`; every one of those tests failed before the change and passes after it. The named suites pass (120 files, 1247 tests), and `pnpm run check` exits 0.

**Two files outside the brief's Owns list were edited. Please review both:**

- `RT/llm/evidence-loop/resume.ts`. The brief names `RT/flow-bootstrap/unfinished-build/resume.ts`, but that file does not exist. The file that turns the judgement into words for the model is `llm/evidence-loop/resume.ts`; `judgement.ts` points to it as `../../llm/evidence-loop/resume.ts`. It was not modified in the tree before I started.
- `RT/flow-bootstrap/unfinished-build/contracts.ts`. I added two optional fields, `fix?: string[]` and `checked?: string[]`. They go on the `no` variant of `AutomationStudioFlowBootstrapTestVerdict` and on `AutomationStudioFlowBootstrapJudgedWrong`. `judgedWrong` cannot carry these fields with types unless the types declare them; the only other route was casts. I took the brief's forbidden `contracts.ts` to mean `result-verification/contracts.ts`, because it is listed beside `verdict.ts` and `summary.ts`. I did not touch that file. No type in it needed to change.

## What changed and why

1. **Re-author brief** (`recovery/refuted-result/brief.ts`). Two changes, nothing else in the file:
   - `refutationLines` now adds one line per `entry.directive.checked` line, in the form `- Core checked the rows the check names: <line>`. These lines come after Core's fix lines and before the check's expected, observed and advice, which they qualify. A short comment above the loop cites the run.
   - READ_STEPS step 3 keeps every existing sentence, including the t194-w78 sentence and "A condition that rejected rows the request wanted is the one to correct.", which `brief.test.ts` pins. It then adds: "Where Core checked the rows the check names, the same holds: advice resting on a row Core lists as in the result although the check calls it left out is not followed -- that row was never left out -- while a condition Core lists as really leaving out a row the request wants is the one to correct."
   - `history.ts` needed no change, because the entry carries the whole directive, `checked` included.
2. **Build repair path.** The path runs `build-test/judge.ts`, then `service/flow-bootstrap-commands/build-judge.ts` (which spreads the verdict whole), then `phases.ts` and `reserve-judging.ts`, then `judgement.ts` (`judgedWrong`, then `judgeValue`), then `llm/evidence-loop/resume.ts`.
   - `judge.ts`: the `no` verdict gains `fix?: string[]`, filled by `rowFix`. It takes the leading fix lines, one per `result.left_out_naming_the_item` finding; `repair-directive.ts` puts those first, in finding order. The other fix lines are not passed on, for the same reason their findings are not: for a test they are wrong. A test always gets `result.no_record_set`, whose fix line "Add or fix the step that stores…" would mislead a build.
   - `judgement.ts`: `judgedWrong` copies `fix` and `checked`. `judgeValue` sends both to the model under their own keys. The header has a new paragraph that cites the run.
   - `resume.ts`: a new `CORE_ON_ROWS` sentence explains what `judgement.judge.fix` and `judgement.judge.checked` are. It also says that advice resting on a row Core lists as in the result is not followed, and that a condition Core lists as really leaving out a wanted row is the one to correct. The sentence is added after the judged instruction, or after the explore-again instruction when the Flow is empty, and only when either field is present. I also amended the header comment "nothing here is page content", because these lines carry row labels that the test's reads already screened.
3. **Stored count** (`judge.ts`). A `no` now reports `records.stored` as the sum of `summary.buildTest.stores[].rows` when `stores` is present, and falls back to `totalRecordCount` otherwise. The existing t240 test still sees 7.
4. **Failure record** (`core-observation.ts`). The record is a second route to another repair. `recovery/context.ts` sends the record's `expected` to the recovery ladder (node patch), and that text already holds "The check's own advice: …". So `expectedText` now places `Core checked the rows the check names: …` between Core's fix and the advice. If the 1,024-character bound cuts anything, it cuts the advice first.

Tests:

- New: `result-verification/build-test/tests/judge-rows.test.ts` (2 tests)
- New: `recovery/refuted-result/tests/brief-checked.test.ts` (2 tests)
- New: `flow-bootstrap/unfinished-build/tests/judged-wrong-rows.test.ts` (2 tests). This one runs end to end through the real judge, `JudgeFinished`, `JudgementValue` and the resume entry.
- `result-verification/tests/core-observation.test.ts`: 2 tests added.

All of them use the c25 fixture `request-rows/tests/run-muw60j7c.ts`. The test summary is given `stores`: 20 rows from step 9 plus 10 from step 10, appended into one dataset, 30 in all.

## Commands run and observed results

**Fail-first**, before any source edit (from `packages/fluxiq`, the four new or extended test files): `Test Files 4 failed (4)`, `Tests 7 failed | 12 passed (19)`. The failures:

- `judge-rows`: `expected { verdict: 'no', …(4) } to match object { verdict: 'no', records: { …(3) } }`. The stored count was 0.
- `judge-rows`: `expected '' to contain 'Lumo Audio Drift Pro Wireless Earbuds…'`. There was no `fix`.
- `judged-wrong-rows`: `expected '' to contain 'Lumo Audio Drift Pro Wireless Earbuds…'` and `2 steps: expected 'The Flow you said was ready was teste…' to contain 'judgement.judge.fix'`.
- `brief-checked`: `…(B0J5MCMBAY) is in the result, although the check calls it left out…: expected -1 to be greater than -1`, and step 3 was missing the sentence.
- `core-observation`: `Received: "A result that answers the request the Flow was built for. To fix: Compare … The check's own advice: Fix the plus condition, which alone excluded B0J5MCMBAY."`. The check line was absent.

**After the change**:

- The same four files: `Test Files 4 passed (4)`, `Tests 19 passed (19)`.
- `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/recovery/ src/programs/automation-studio/runtime/flow-bootstrap/unfinished-build/ src/programs/automation-studio/runtime/result-verification/ src/programs/automation-studio/runtime/service/runtime-adaptation/`:
  - First run: `1 failed | 1246 passed`. My first wording of step 3 replaced the pinned sentence in `brief.test.ts` ("A condition that rejected rows the request wanted is the one to correct."). I reworded step 3 to keep that sentence.
  - Rerun: `Test Files 120 passed (120)`, `Tests 1247 passed (1247)`.
- `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/llm/evidence-loop/` (because of `resume.ts`): `Test Files 25 passed (25)`, `Tests 259 passed (259)`.
- `pnpm.cmd run check`: `EXIT=0`. The first run printed `"build-cache":"build" … "no stamp"`, with no tsc errors; the second run reused the stamp.
- `node scripts/structure-audit.mjs` (Core root): `EXIT=0`. No violation; the earlier `carried-steps-as-saved` violation is gone. My files raise no warnings.

## Not verified

- No live run or Lab run.
- The recovery ladder's structured copy of the directive still drops `checked`. Of the ladder's two routes, only the failure record's `expected` text now carries it. The structured route is `recovery/refuted-result/attempt.ts` (`resultRepairInput`) into `recovery/context.ts` (`resultRepairSection`), and both copy only findings, fix, judgement and withheld. Neither file is mine, and each needs a one-line `checked` copy.
- `records.stored` now means what the Flow would store. `progress.ts`'s `records_stored` / `fewer_records_*` measure therefore compares those figures from now on. A verdict without `stores` still falls back to the old count. The repair-round suites pass; I did not reason through every progress case.
- `rowFix` relies on `repair-directive.ts` putting the left-out fix lines first, one per finding. The tests exercise this through the real directive, so a reorder would fail them, but nothing in the type enforces it.

## Open questions or contradictions found

- The brief's path `RT/flow-bootstrap/unfinished-build/resume.ts` does not exist; I used `RT/llm/evidence-loop/resume.ts`.
- `RT/flow-bootstrap/unfinished-build/contracts.ts` was edited without being in Owns; see Outcome.
- In a test file, the import order matters. Loading `llm/evidence-loop/index.ts` before `result-verification/index.ts` leaves `runAutomationStudioLlmHarness` undefined in `verify.ts` (a module cycle), so the judge fails silently as `not_judged`. `judged-wrong-rows.test.ts` imports the judge first and has a comment saying why. Production entry points were not affected in these runs, but the cycle is real.
