# t800 S1-statements report

## Outcome
Done for the code in my paths; wiring into submission/barrel/completion is left to the supervisor (lines below). Both modules are unit-tested and not yet reachable from a live submission.

## Inventory (on dev before this work)
- Numeric/date text test: nothing. `authoring/condition.ts` parses `contains/startsWith/endsWith/matches` (flow-script-format.ts line 359); no check of what they test.
- Listed-values: `script-statements/listed-values-advice.ts` (t785) is called from `candidate/submission.ts` line ~288 as `automationStudioFlowPlanListedValuesAdvice(plan.plan, instructionText)`. No rows are in reach there (the trial result handed to `submit` via `history.trialOf` is `{revision,digest,verdict,feedback}`; the run summary with `sampleRows`/`leftOutCells` exists only inside `service/candidate-trial/feedback.ts`). t790 `service/candidate-trial/row-mark.ts` computes the separating column from that summary for trial feedback only (`rowMark`).
- Once-refusal mechanism: `candidate/kept-step-hint.ts` (class, keyed set, `resend: "accepted_once"`), `kept-condition-refusal.ts`; the loop's wording for such codes is in `candidate/submission-refusal.ts` (`hintNext`, lines ~206-211).

## Design
1. `flow-bootstrap/numeric-text/found.ts`: `automationStudioFlowPlanNumericTextTests(plan)` finds, in any `where` list of any step's parameters, a `matches|contains|startsWith|endsWith` whose value (or list) tests a number (digit alternatives, `\d`, `[4-9]`, bare numbers) or a date (a year, 2+ month names or a month with digits, `3/14`, `2024-05`, `(19|20)\d\d`) by characters. A value with real words and digits ("Room 5 guide"), `equals`, and real bounds (`atLeast`) are never flagged.
2. `flow-bootstrap/numeric-text/hint.ts`: `AutomationStudioCandidateNumericTextHint.hint({plan, standing})` returns an `ok:false` check, code `candidate.numeric_text_test`, `resend: "accepted_once"`, instruction naming the number bound (atLeast/atMost/greaterThan/lessThan) and the date bound (`atLeast:"<dated>"`, `within:"<n> days"`, text only). Each test (field+test+pattern) is refused once; sent again it passes.
3. Listed values: `automationStudioFlowPlanListedValuesAdvice(plan, requestText, samples = [])`. `samples` is one list of rows (column id to text) per read/trial. The note gains one generic sentence naming the field only when the SAME field and kind separates kept from left-out rows on every sample holding both; no row value is quoted. No samples or no agreement: today's note exactly.
4. Shared logic: t790's `markOf`/`sharedStart` moved to `flow-bootstrap/listed-values/separating-column.ts` (`automationStudioSeparatingColumn`); `row-mark.ts` now imports it (behaviour unchanged, its tests pass).

## Files
New: `flow-bootstrap/numeric-text/{index,found,hint}.ts`, `numeric-text/tests/numeric-text.test.ts`, `flow-bootstrap/listed-values/{index,separating-column}.ts`, `script-statements/tests/listed-values-discriminating.test.ts`.
Edited: `script-statements/listed-values-advice.ts`, `service/candidate-trial/row-mark.ts`.
Deviation: the brief named `script-statements/numeric-text-test.ts`. `script-statements/` is at the 9-segment depth limit and over the 25-file limit, so the new modules sit in sibling directories of `flow-bootstrap/` with their own barrels.

## Wiring for the supervisor (not done by me)
- `candidate/submission.ts`: `import { AutomationStudioCandidateNumericTextHint } from "../numeric-text/index.ts";`, field `private readonly numericText = new AutomationStudioCandidateNumericTextHint();`, and after the `hinted` block (line ~270): `const numeric = holdKept ? this.numericText.hint({ plan: plan.plan, standing }) : undefined; if (numeric) { this.current = standing; return { ok: false, revision, check: numeric }; }`.
- `candidate/submission-refusal.ts` ~line 209: add a branch for `feedback.code === "candidate.numeric_text_test"` using `hintNext(feedback.instruction, feedback.standingRevision, "the text really is words")`; import the code constant from `../numeric-text/index.ts` (`AUTOMATION_STUDIO_CANDIDATE_NUMERIC_TEXT_TEST_CODE`).
- Samples for the note: submission.ts has none. To use them the trial gate must keep rows from the summary (e.g. an optional `sampleRows?: Record<string,string>[][]` on `AutomationStudioCandidateTrialResult`, set in feedback.ts from `rowsByRead`) and pass `history.trialOf(...)?.sampleRows` as the third argument at line ~288. Until then the note is unchanged.
- Barrel/optional: `script-statements/index.ts` needs nothing (nothing lives there). Possibly re-export `numeric-text`/`listed-values` from `flow-bootstrap/index.ts` if other directories should import them without a deep path.

## Commands run and observed
- `pnpm test <script-statements> <candidate> <candidate-trial>` (first run): Test Files 2 failed | 85 passed; one failure was my test's backslashes (fixed); the other `candidate/tests/refusal-locator-corpus.test.ts`: uncovered code `record_output.process_where_in_repeat`, from another worker's untracked `script-statements/repeat-where-in-process.ts`, not mine.
- Second/third runs (`script-statements` + `candidate-trial`): `Test Files 52 passed (52)`, `Tests 434 passed (434)`. After the move: numeric-text + script-statements + row-mark: `Test Files 19 passed (19)`, `Tests 183 passed (183)`, including numeric-text.test.ts (6), listed-values-discriminating.test.ts (5), row-mark.test.ts (5). The `candidate` group was not rerun after the first run (nothing there changed since).
- tsc (`node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit --incremental ...` in packages/fluxiq): only errors in `authoring/part/process-defaults.ts` (TS2307 core import path, TS7006), another worker's file. (An earlier run also showed an error in `candidate-trial/tests/reads-undated.test.ts`, another worker's, gone in the last run.) None in my files.
- `pnpm structure:check`: 6 violations, none in my files: script-statements 26 files (another worker's `repeat-where-in-process.ts`), candidate-trial/tests 26 files, contracts `condition-` prefix, `authoring/part/*` depth. My earlier violations (import reach-ins, depth) are fixed.

## Not verified
Behaviour through a real submission (not wired); the `candidate` test group after the final move; samples path in a live run.

## Open questions
Whether the trial result should carry sample rows (wiring above). Detection is deliberately conservative (single literals only when a year or an all-number value).
