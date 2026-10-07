# Report: s3-judges (lead, read-list S3 and proof 1)

Brief: "Brief: read-list S3 judges and build test (lead; 2026-10-07)" in `docs/working/mvp-final-month-plan.md`, plus the
shared rules of the round-3 fix briefs. Design: `read-list-collect-design.md` sections (5), (7) row S3, proof 1.
Trees `fxwork/t291/` (branch `task/t291-read-list-s3-judges`). Nothing committed. R = Core
`packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. S3 is implemented and proof 1 passes. Core changes only. No downstream source changed. No Lab, browser or
provider call was made.

## Partition (by file) and who did what

| Piece | Agent | Files | Worker report |
|---|---|---|---|
| Contracts | lead | `R/result-verification/contracts.ts`: `AutomationStudioBuildTestStore` (`passes`, `collected`, `answer {rows, labels}`, `removed?`, `keptNone?`, `repeated?` on the answer); `AutomationStudioResultReadAccount.keptPerPage`; `AutomationStudioResultRecordSetSummary.processing` | - |
| Build-test answer | worker-high | `build-test/{stores,summary,judge}.ts`, `verdict.ts` (count only), `R/llm/node-tools/{replay-span,replay-draft}.ts` (observation `records`, internal, never sent) | `s3-build-test-answer.md` |
| Finished-run read account, kept-none, record set processing | worker-high | `read-account/{accounts,stop,pages-clause,page-bound-sentence,judge-paging,sentence,index}.ts`, new `read-account/{loop-passes,looped-account}.ts`, `result-summary.ts`, `repair-directive.ts` | `s3-read-account.md` |
| Activity words | worker | new `R/activity/loop/**`, `activity/step/started.ts`, `activity/decision-answer/edit-words.ts`, `executor/graph-run.ts` (call sites, +3 lines), `src/ui/activity-action/action-of.ts` | `s3-activity-words.md` |
| Model words and pins | lead | `R/llm/diagnosis-instructions.ts` (finished-run judge: looped read accounts, record sets as answers with `processing`, no advice for a loop or dedupe the Flow already does; build-test judge: the new `stores` shape, a page-boundary repeat is no row stored twice); `R/recovery/refuted-result/brief.ts` (no "pagination setting"; the loop's most passes); `R/llm/deepseek/tests/system-prompt-pins.json` | - |
| Proof 1 | lead | `R/result-verification/build-test/tests/paged-read-proof.test.ts` (new) | - |

Outside the row: `R/flow-bootstrap/unfinished-build/tests/judged-wrong-rows.test.ts` (one store fixture moved to the
new shape). `R/llm/evidence-loop/rerun-input.ts` was not changed: its `maxPages` mentions are history in comments, not
model-facing text.

## What a reader now sees

- **The build-test judge** (`buildTest.stores`): per dataset, `passes` and `collected`, then `answer` made by
  `processAutomationStudioRecordRows`, the function the run's end calls. The default dedupe is the whole row, then the
  record output's `process`. `removed {duplicates, filteredOut, cut}` follows. `repeated` is computed on the answer.
  A labels-only read (no `outputs.records`) keeps the old behaviour with `removed` absent. `builtin.control.repeat` is
  a routing node, so a do-while Flow keeps its steps (the supervisor's S6 note).
- **The finished-run judge:** a read node that ran as the passes of a Repeat gives one account. `pagesRead` is summed
  and `keptPerPage` set. `stop` is `ended`, `bound` or `failed`, and `pageLimit` is the Repeat's `most`. The words say
  "every page (5) and the list ended: the step that moves it on found no page after page 5". The bound advice is to
  raise the Repeat's `most`, never `maxPages`. Each record set carries its `processing` account.
- **Kept-none** (`result.kept_none_rows_rejected`): it replaces "found none" when nothing was kept while the reads'
  conditions rejected rows. It also fires per set when that set's answer kept none.
- **The chat:** "Running step 3 of 5: Reading page N", then "Clicking “Next” on page N". The end of the loop is said
  once: "The list ended after 5 pages", or at the bound "The loop stopped at its most passes (N pages)".

## Proof 1 (design section 7)

`paged-read-proof.test.ts` uses lane C's shape: navigate, optional Decline, type, read repeated through Next page while
it succeeds, Next page. The read was assembled by the real assembler (S1's per-step record output). The fake host
serves 5 pages of 3/4/3/4/3 rows, each page after the first opening with the previous page's last row. That is 17 rows
collected and 13 distinct. Next page answers `ended` after page 5.

1. Build test (`replayAutomationStudioFlowDraft` -> `automationStudioBuildTestResultSummary`): 5 reads. Next page's
   pass 5 is `core.replay.ended`. The store is `{steps: [4], passes: 5, collected: 17, answer: {rows: 13, labels:
   Earbuds 1..13}, removed: {duplicates: 4, filteredOut: 0, cut: 0}}`, with no `repeated` and no `keptNone`.
2. The judge (`automationStudioBuildTestJudge`, scripted provider): the request's `resultSummary.buildTest.stores[0]`
   carries the answer and the account. No stored price or link reaches the request.
3. The stored Flow, run by `runAutomationStudioGraph` with fake natives (dispatch effects carry the assembled record
   output with the domain's records path), went into the real `AutomationStudioProjectRunDatasetStore` and through
   `processRunDatasets`. Result: 5 reads; Next routes `success x4, ended`; `processing {collected 17, duplicates 4,
   kept 13}`; passes `[3,3] [4,3] [3,2] [4,3] [3,2]`. `getPage` returns the same 13 names in the same order, under the
   dataset id the build test named.

Against the pre-S3 `stores.ts` (HEAD), all 3 proof tests fail; with S3 all 3 pass. The file was restored and the
diff is intact.

## Validation (lead, observed)

- Pins fail first: after the words changed, `system-prompt.test.ts` showed 4 failed (loop_verification and
  loop_verification_build_test, each in 2 cases). The pins were regenerated from the builder with a throwaway vitest
  file (there is no owning script), then deleted. Result: 31 passed, and the pin JSON diff is 2 lines.
- `npx vitest run --testTimeout=120000` from `packages/fluxiq` on `R/result-verification/{build-test/tests,tests,
  read-account/tests}`, `R/llm/{node-tools,deepseek,evidence-loop}/tests`, `R/recovery/{refuted-result/tests,tests}`,
  `R/activity`, `R/executor/tests`, `src/ui/activity-action/tests`, `R/flow-bootstrap/unfinished-build/tests` and
  `R/flow-bootstrap/authoring/tests/repeat-loop.test.ts`: 214 files, 2451 tests passed, twice.
- The first run of that set had 3 brief failures, caused by my brief words: a dropped pinned phrase, and 7123 > 7000
  characters. I reworded within budget, and `recovery/refuted-result/tests` then passed 72 of 72.
- `R/service/flow-bootstrap-commands/tests`, `R/tests/service-authoring/tests`, `R/service/datasets/tests`: 16 files,
  99 passed.
- `paged-read-proof.test.ts`: 3 passed, twice.
- Core: `fluxiq:check` exit 0; `structure-audit:check` exit 0 ("passed (276 warning(s), 349 baselined)"). The proof
  file's first imports reached past barrels; that was fixed. `pnpm.cmd build` exit 0.
- Downstream (t291, against the rebuilt Core): domain check exit 0; extension check exit 0;
  `node scripts/structure-audit.mjs` "passed (175 warning(s), 118 baselined)".

## Not verified

- No live run or UI review. Proof 3 (lane C live) must see "Reading page N", "The list ended after 5 pages", and no
  "paginate".
- The domain replay's `outputs.records` was not exercised end to end from the real domain. The proof host plays it,
  as `webNodeReplayFlowRows` does.
- A loop that ends on `ended` only after a recovery says no end sentence: the second `attempts.push` site in
  `graph-run.ts` is not hooked.
- Nested loops are untested in the read account and the activity words.
- The Repeat's own card still reads a bare "Running step 2 of 5" on each pass.
- The kept-none count of rejected rows is a floor: each read's largest single condition count.
- A run with no record set at all still gets `noRecordSet`, not kept-none.

## For S6/S7 and the supervisor

- `stores.ts`'s fallback for a labels-only read stays until every domain replay sends `outputs.records`; the web
  domain already does.
- `diagnosis-instructions.ts` still says "whether it already pages" for non-looped reads. S7 may drop it when the
  read's own paging is retired.
