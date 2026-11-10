# Result list switch (cause 1d, run-mwafor01-bb471f52)

Worker report. Core worktree: `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ`. Step logs:
`C:/Users/osrs_/FluxStuff/lab-runs/2026-11-10/run-mwafor01-bb471f52/steps/`.

## Outcome

Done. A read that changes which rows the result holds now carries a note from Core on its own answer
(`resultList`). The note gives the result's rows now, the pages they came from, and what the result held
just before: its row count, columns and pages, and the call that last read it. The model sees it in its
next request. Which list a read joins is unchanged. The uncommitted 1a/1c row-sink changes from the
earlier worker are kept as they were, and all their tests still pass.

## Cause, with step evidence

The earlier report says the 5-row list became the result "after judge 0073 said no, runRowsRefused". The
logs show a more specific sequence, and it also corrects that report on one point: the list that was
dropped was the Flow's own correct list of both pages (16 rows), not the 12-row page-1 read.

1. **0071** `page1.recheck.1`: a by-hand read of page 1 with 3 conditions and no record output. This makes
   an unnamed list of 12 rows, D3. Judge **0073** said no with `totalRecordCount: 12`, and refusal 0074
   showed `resultHolds.totalRows: 12`.
2. **0075** `run_flow_10_13_p1`: the Flow's step 10 ran with 4 conditions. Each pass was a call through the
   chain and the row sink. Its input carries `recordOutput.datasetId: "web-output-dom-extract-list-d14"`, so
   it joins the named list d14 (`rows/dataset-of-read.ts:24`).
   - Pass 1 (0076): page 1, "kept 11 rows".
   - Pass 2 (0078): page 2, "kept 5 rows". Neither pass named a place, and no row was known yet, so pass 2
     was taken as the next page (`rows/list-after-read.ts`, rule 5).
   - d14 then held 16 rows, and as the latest stored list it became the result (`rows/result-dataset.ts:26`).
   - The run_flow answer the model saw (0081 request, line 147) says only "Steps 10 to 13 ... passed". It
     does not say what the result holds.
3. **0081, 0085**: two more runs. Each re-read page 2 with the same 5 rows in the same order, so they
   carried d14 on (rule 1). The result was still 16 rows.
4. **0093/0094** `page2.full.1`: the model read page 2 by hand with the same 4 conditions, but with no
   record output and without the `sponsored` field. That is a different identity, so it started a new
   list, D4, with 5 rows. As the latest read, D4 became the result. This is correct by the rule. The model
   was told nothing: the answer it saw in the 0096 request (line 159) is the domain's read, "extracted holds
   all 5 kept rows". The only result count in that request is the stale refusal from step 20, which says
   `resultHolds.totalRows: 12` (line 170). Nothing in it says the 16-row list had just stopped being the
   result. The 5 rows came back later through `sink.fromCall` (`attempt/call-chain.ts:83` before this
   change), and nothing of them was shown to the model.
5. **0096** complete. Judge **0097** said "unknown, page 1 was never read", with `totalRecordCount: 5` and
   `readPages [{place: page=2, kept: 5}]`.
   - The model then believed page 1 had been read.
   - 0103 recalled the old 12-row read.
   - 0106 completed with "Read both result pages".
   - Judge 0107 said no.
   - After that it repaired the Flow (0109 onwards) and never re-read the result's list. The loop detector
     ended the attempt at 0153.

So the cause is that the row sink switches the result's list silently. `fromCall` knew the result was
switching, but nothing put that on the answer the model reads. The model only saw what the result held
when a judge refused, and that was always one step behind.

## The change

- **New `rows/result-change.ts`.** It defines the type `AutomationStudioAnswerFirstResultChange` and the
  function `automationStudioAnswerFirstResultChangeTold(answer, change)`. The function adds
  `evidence.resultList` beside what the domain answered, with these members:
  - `code` and `rows`;
  - `pages`, each with `place` and `kept`;
  - `replaced`, with `rows`, `columns`, `pages` and `lastReadBy`;
  - `instruction`.

  If the evidence is not an object, it is kept whole under `answered` and the note goes beside it. The
  instruction says what happened and how lists are told apart (the same record output name and columns,
  or the same node, arguments apart from the page, columns and view). It tells the model to read the other
  pages exactly as this read was asked, or to re-read the replaced list if that was the right one. A second
  text covers a start-over. The wording names no site, task or row, and nothing is capped.
- **`rows/row-sink.ts`:**
  - header paragraph;
  - `Held.by`: the call that last stored rows, set at :242;
  - `standing()` at :166: the result before the read, ignoring a working (`lookUp`) list;
  - `changed()` at :174: `other_list` when the result is now this read's dataset and was another list.
    `started_over` when the same list started over and row ties show it lost a row it held, so re-reading
    the whole list says nothing;
  - `fromCall` returns `resultChanged` (:195, :245);
  - `readPages` shares the new `pagesOf` helper (:330).
- **`rows/rows-call.ts`:** `resultChanged?` added to `AutomationStudioAnswerFirstRowsStored`.
  **`rows/index.ts`:** exports the new function and type.
- **`attempt/call-chain.ts:86-94`:** keeps what `fromCall` returns. When it holds `resultChanged`, the chain
  returns the answer with the note. The header has a short paragraph on this.
- **Not changed:** dataset identity, list-after-read, result-dataset, the closed execution-result key list
  (the note sits inside the opaque `evidence`), the judge, and the refusal text. No prompt digest pins this
  text, and none were touched.

## Tests

- **`answer-first/tests/latest-read.test.ts`**, new describe "a read that changes which rows the result
  holds says so in the model's next request". It runs through the real service with a scripted model and
  real SQL, on the lending-library fake.
  - Pages 1 and 2 are read the same way. The request after page 2 has no note.
  - Page 2 is then read asked otherwise. The model's next request shows on that call's entry exactly
    `{code: answer_first.result_list_replaced, rows: 1, pages: [{place: page=2, kept: 1}], replaced: {rows: 3,
    columns: [title, due], pages: [{page=1, 2}, {page=2, 1}], lastReadBy: "page-two"}, instruction: ...}`,
    and the answered result is 1 row.
  - A second case covers a named list read again with `replace` that loses a row: it gets `started_over`.
  - These sit in the existing file because `answer-first/tests/` is at its 25-file limit. A new file there
    failed `structure:check` (26 > 25).
- **New `rows/tests/result-change.test.ts`, 5 unit tests:**
  - the sink reports `other_list` with the replaced list's pages and `lastReadBy`;
  - a carried-on page reports nothing;
  - a start-over that re-reads every row reports nothing, and one that drops a row reports `started_over`;
  - a working list going away reports nothing, and a working read that leaves the result in place reports
    nothing;
  - the told answer keeps the domain's evidence unchanged and does not mutate the original;
  - evidence that is not an object is kept whole.

## Commands run and observed results

All commands were run in `!FluxIQ` or `!FluxIQ/packages/fluxiq`.
- `npx vitest run <af>/rows/tests/result-change.test.ts` -> "Tests 5 passed (5)".
- `npx vitest run <af>/rows <af>/attempt <af>/completion <af>/tests` (`<af>` = `src/framework/automation-service/service/answer-first`)
  -> exit=0, "Test Files 72 passed (72)", "Tests 492 passed (492)". That run still held the standalone
  version of the end-to-end test, which I then moved into `latest-read.test.ts` and deleted.
- `npx vitest run <af>/tests/latest-read.test.ts` after the move -> exit=0, "Tests 20 passed (20)", the two
  new tests among them.
- **Revert check:**
  1. Copied `call-chain.ts` to the scratchpad and replaced its return with `return answer;`.
  2. Ran `-t "says so in the model"` -> "2 failed | 18 skipped": "expected undefined to deeply equal { …(5) }"
     and "expected undefined to match object { …(3) }".
  3. Restored the file and confirmed the told line is back: grep count 1, `git diff --stat` shows 8+/4-.

  The same check on the standalone file before the move also gave 2 failed.
- `pnpm --filter fluxiq check` -> exit 0 (tsc --noEmit ran: "inputs changed").
- `pnpm structure:check` -> exit 0, "structure-audit: passed (538 warning(s), 1095 baselined)". The first
  run, with the new file in `answer-first/tests/`, exited 1 for the 26-file limit, which is fixed above.
  `rows/` is now at 25 files, within the limit.
- No runtime/llm directory was changed, so no runtime/llm vitest was due. No build, no Lab run, no paid call.

## Not verified

- No live run. Whether Haiku acts on the note by re-reading page 1 the same way, or by reading the
  replaced list again, is not observed.
- **Switches inside `core.run_flow` are not told to the model.** The run_flow binding wraps the executor
  above the chain (`runtime/llm/node-tools/run/flow.ts:120-125`), so its passes go through the chain but
  the run_flow call itself does not. The model sees only the run's summary (`flow-part.ts` `last`). A pass
  that switches the result puts the note on the pass's own answer, which the model does not see unless it
  was the last step. On this run every pass stayed in d14, so this did not matter here.
  - A proposal for a separate brief: in `flow-part.ts`, carry the latest pass's `evidence.resultList` onto
    the run_flow answer. Better still, compute the change across the whole run.
- The started-over case is told only when a held row is lost, judged by `automationStudioAnswerFirstRowTies`.
  A row whose values all changed in place and could not be tied would be reported as lost, wrongly. That
  errs toward telling.
- The sequence in the Cause section (d14 holding 16 rows before 0094) is rebuilt from the step logs and the
  sink's rules. The logs record no sink state directly.

## Open questions or contradictions found

- The earlier report says the 12-row page-1 list was dropped and that the switch followed judge 0073's
  `runRowsRefused`. The logs show the dropped list was the Flow run's d14 list of both pages (16 rows,
  0076 and 0078). Exploration runs reach the sink through `fromCall`, so `ran` is empty here. The switch
  happened at the 0094 read itself.
- The refusal's `resultHolds` does not say which pages the result holds or which list it is. The judge's
  words covered that on this run. Adding `readPages` there is a possible follow-up, and it is not done.
