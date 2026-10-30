# S3-repeat-paging

## Outcome
Done for part 1 (new check + test). Part 2: inventory found nothing to change.

## What changed and why
- New `RT/flow-bootstrap/script-statements/repeat-where-in-process.ts`, export `automationStudioFlowPlanRepeatWhereInProcessIssues({plan, registry, resolution})`, code `record_output.process_where_in_repeat`. Reads the assembled plan like `listing-order-in-repeat.ts`: a listing feeding a For Each (`items` port) whose body (loop-body.ts) has a step with a lasting consequence (`isAutomationStudioActionConsequence`) and whose record-output param carries a non-empty `process.where` is refused once at `plan.subflows.N.nodes.M.parameters.<recordParam>.process.where`. Message is Core's own sentence ("Put the condition on the listing's read so the repeat runs over kept rows only (the read's own where has the same vocabulary), and take the where out of the saved answer."). Not looped / no lasting act / no where (absent, `[]`, null, false, "") gives no issue. canMeet unaffected (true).
- New test `script-statements/tests/repeat-where-in-process.test.ts` (3 tests).
- No automatic rewrite: the node registry/definition metadata names only `answersRows` and `recordProcessWrittenAt` (keys `sort`, `limit` only). Nothing domain-neutral names a read's condition parameter, so there is nothing to move the where to. A `recordProcessWrittenAt.where` style key would be needed (domain definition change, not mine).
- Structure note: I tried a `process-where/` subdirectory to dodge the 25-file limit; the audit rejects it (depth limit 9 segments), so the file is flat in script-statements.

## Paging inventory (part 2): no change
Searched RT/flow-bootstrap/**, RT/llm/**, RT/service/candidate-trial/** for paging/next page/paginate/every page/maxPages/pagesRead/continues.
- Nothing in these dirs adds, asks for or requires paging of a read without a report. The only advice that tells the builder to move a list on is `result-verification/read-account/list-continues.ts` (`fix` line), and it is already gated on `read.listContinues` (and is silent for a read with `paginates`, `pagesRead>1`, `keptPerPage` or `stop`). A client sending no `listContinues` gets nothing. candidate-trial/feedback.ts only carries `listContinues`/paging record through (`withContinuation`, `withPaging`); gated on the field already.
- Other hits are teaching text or comments, not firing logic: `plan/flow-script-format.ts` (paging example and `repeat while` text, off-limits), `authoring/draft-routing.ts:98` (NO_ROW_LOOP_IN_PAGE_LOOP, explains a refusal, off-limits), `llm/diagnosis-instructions.ts:171` (tells the judge how to read paging words; mentions "a read whose paging words say its list goes on", off-limits), `result-verification/located-defects.ts:199` (`listGoesOn` also treats a read that pages and stopped other than at list end as going on; reads, does not add paging; off-limits), `draft-amendment-feedback/row-act.ts:30` (describes an existing paged read), comments in evidence-schema.ts, answerability/check.ts, unfinished-build/judgement.ts.
- Edits proposed: none.

## Wiring (supervisor; not touched)
- `script-statements/index.ts`: add `export * from "./repeat-where-in-process.ts";` (beside the listing-order / record-replace exports).
- `llm/harness-options/bootstrap-completion.ts`: line 166 import add `automationStudioFlowPlanRepeatWhereInProcessIssues`; after line 465 (`const ordering = ...`) add `const wherePlaced = automationStudioFlowPlanRepeatWhereInProcessIssues({ plan: buildPlan.plan, registry: input.registry, resolution: input.resolution });` and change line 466 to `if (replacing.length || ordering.length || wherePlaced.length) failures.push({ ..., issues: [...replacing, ...ordering, ...wherePlaced] });`.
- Heads-up: an existing listing-order test allows `process.where` with columns on a lasting repeat; with the new check wired, any fixture of that shape elsewhere would now be refused.

## Commands run and observed
- `npx tsc --noEmit -p .` in packages/fluxiq with `--max-old-space-size=8192` (default heap OOMs): no output (clean) on the final run. An earlier run showed a contracts error `condition-date-cases.ts` not found, since gone (another lane's file).
- `pnpm test src/programs/automation-studio/runtime/flow-bootstrap/script-statements` (run in packages/fluxiq; repo-root `pnpm test` fails in apps/web on a stale Core dist guard): parallel group `Test Files 1 failed | 17 passed (18); Tests 1 failed | 177 passed (178)`; `repeat-where-in-process.test.ts (3 tests)` passed. The one failure is `numeric-text-test.test.ts` (another worker's file, `matches: "(19|20)\d\d"` kind expectation). real-sql group: "No test files found" (nothing there matches).
- `pnpm structure:check`: 6 violations, none from my file content, but `script-statements/: 29 source files exceeds the 25-file limit` includes my file (it was 25 before; other lanes added numeric-text-*, toggle-*, separating-column etc.). Others: authoring/ 27 files, assemble.ts 809 lines, numeric-text-hint.ts and row-mark.ts barrel imports, contracts `condition-` prefix.

## Not verified
Wiring into completion (not mine), live behaviour; the process-where check on real plans.

## Open questions
Supervisor must regroup script-statements (29 files) for the 25-file limit; a prefix group such as `repeat-*` (repeat-bound, repeat-order, repeat-pace, repeat-where-in-process) is the natural one but touches the barrel.
