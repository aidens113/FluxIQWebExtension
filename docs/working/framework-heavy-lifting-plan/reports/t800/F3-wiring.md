# t800 F3-wiring report

## Outcome
Done. All four wiring items made; tests, typecheck and structure audit clean.

## What changed and why
RT = packages/fluxiq/src/programs/automation-studio/runtime in the Core t800 worktree.
1. Numeric-text once-refusal: `RT/flow-bootstrap/candidate/submission.ts` imports `AutomationStudioCandidateNumericTextHint`, holds it as a field, and refuses after the kept-step hint block (`holdKept` only). `submission-refusal.ts` words it with `hintNext(..., "the text really is words")`. New test `candidate/tests/kept-step/tests/numeric-text-refusal.test.ts`: first submission with `matches: "^(4|5|6|7)$"` refused once (code, `resend: accepted_once`, next text), resubmission accepted; a test of words is never refused.
2. `sampleRows?: Array<Record<string,string>>[]` added to `AutomationStudioCandidateTrialResult` (`candidate/contracts.ts`), beside the feedback and never in it (the gate's evidence to the model is built field by field, so the rows are not shown). Deviation from the brief: it is set in `service/candidate-trial/run.ts` (`judged()` passes `automationStudioTrialSampleRows(summary)` to `answerFor`), not feedback.ts, because feedback.ts returns only `{verdict, code, feedback}`; feedback.ts is untouched. `row-mark.ts` gains the exported `automationStudioTrialSampleRows` (wraps its existing `rowsByRead`). `submission.ts` `sampleRowsOf(history)` takes the latest accepted revision's trial rows and passes them as the third argument of the listed-values advice. Test (same new file): the note names the separating field, quotes no row value; absent rows leave the note unchanged (existing S1 test).
3. `script-statements/repeat-where-in-process.ts` and its test moved to new `flow-bootstrap/repeat-where/` (barrel `index.ts`, `tests/`). It imports the loop-body reader through the script-statements barrel, so I added `export * from "./loop-body.ts"` to `script-statements/index.ts` (without it the first test run failed with `automationStudioFlowPlanLoopBody is not a function`). Wired into `llm/harness-options/bootstrap-completion.ts` beside the ordering check, issues spread into the failure.
4. Corpus (`refusal-locator-corpus.test.ts`): added `repeat-where/` to the scanned roots and a corpus case for `record_output.process_where_in_repeat` (a listing with a saved-answer `where` under a lasting repeat). `candidate.numeric_text_test` is not matched by the corpus's code-prefix scan, so it needed no registration. Nothing weakened.

## Commands run and observed
- `pnpm test` (packages/fluxiq) on RT/flow-bootstrap/{candidate,script-statements,numeric-text,listed-values,repeat-where}, RT/llm/harness-options, RT/service/candidate-trial: `Test Files 112 passed (112)`, `Tests 896 passed (896)`; real-sql group: "No test files found". Includes refusal-locator-corpus (6), repeat-where-in-process (3), numeric-text (6), numeric-text-refusal (3).
- `node --max-old-space-size=8192 node_modules/typescript/bin/tsc --noEmit -p .` in packages/fluxiq: no output (clean).
- `pnpm structure:check`: `structure-audit: passed (456 warning(s), 1152 baselined)`; no script-statements line.
- An earlier run, before the barrel export, had 4 failures from the missing loop-body export (bootstrap-completion, submission-loops); gone after the fix.

## Not verified
No live run; behaviour through a real trial's `sampleRows` end to end (only a stubbed trial result in the test).

## Open questions
None. Edits outside the owned list: `candidate/contracts.ts` (type), `service/candidate-trial/run.ts` (carries sampleRows), `script-statements/index.ts` (loop-body export).
