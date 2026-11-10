# Paged reads and the saved Next page (live-checks r3)

Worker report for the paged-reads and next-page brief. Evidence: step logs under
`C:/Users/osrs_/FluxStuff/lab-runs/2026-11-10/<run>/steps/`, Lab attempts under
`test-runs/instances/t885-live/attempts/<run>/`.

## Outcome

Partial. Defect 1 has four causes. Two are in Core and are fixed, with tests. Two are in t890's
lane, so I left them alone and give the proposed change for each below. Defect 2's cause is in the
extension's content script, also t890's lane. I did not edit it; the exact change is below.

## Defect 1: a multi-page read ends with only the last page's rows, or with rows the task excludes

### How the hubs run (run-mwaf6gnt-638d90a0, attempt 1) got to five judge rounds

1. **0041-0044: `core.run_flow` stopped at page 2.** Pass 1 of the loop kept 10 rows on page 1
   (0042). Next page moved to page 2 (0043). Pass 2's read kept 0 rows, which was correct because
   every page-2 item costs more than 10,00 €. The replay judged that pass `core.replay.changed`
   ("the step read nothing where it read 10", `ok: false`, 0044), and the run stopped. **Cause 1b,
   t890's lane:** `domain/src/runtime/llm-evidence/node-run/replay.ts:229` (`readChange`) compares a
   later loop pass's count with the count the step recorded on page 1. A later page that showed
   items and kept none of them is a normal pass of the loop, as `output-nodes/extract-list/dispatch.ts`
   ("Only the rows it kept (C5)") already says.
2. **0039 and 0049: the judge answered "unknown", fairly.** Both said only page 1 was read. Page 2's
   empty pass was not a stored read, so it was told nowhere: `readPages` showed one read
   (`recordSets` 10 rows, one entry in `readPages`). Even with 1b fixed, a later page that kept 0
   rows stores nothing, and the row sink's `readPages` listed only pages that stored rows. The judge
   could not rule out a qualifying hub on page 2. **Cause 1c, Core, fixed.**
3. **0051-0054: the model read page 2 directly to prove it held nothing.** That read
   (`core.run_node` extract_list, the same three conditions, `recordOutput.datasetId:
   "usb_c_hubs_p2"`, `minItems: 0`) kept none of its 20 items. Exploration reads carry no `answer:
   "kept"`, so the page answered with **all 20 rejected rows** under `read.extracted`, and said so in
   its own account: `read.extraction.conditions.unfiltered: true`, plus the validation line "where
   kept none of the 20 items ... returned unfiltered" (0054 `result.json`). The source is
   `apps/extension/src/content/extraction/filtered-answer.ts:129`, the "too much, never nothing"
   floor that applies only to exploration reads. Core's row sink took `read.extracted` as the read's
   rows (`rows/found-rows.ts`, before the fix). Because the model gave the read a different name, it
   became a new dataset and, as the latest read, the whole result: 20 rows ≥ 10. The judge request at
   0056 shows `recordCount: 20` and one `readPages` entry `place: page=2, kept: 20`. **Cause 1a, Core,
   fixed:** the sink stored rows that the read itself said its conditions had rejected. This is the
   "page-2 read kept such rows" and the "page 1's rows not kept with them" of the brief. The page-2
   read never had any rows of its own, yet it displaced page 1.
   - The model was also told something false: the read it was shown says "extracted holds all 20
     kept rows and rejectedRows those the conditions turned down". That sentence comes from
     `domain/src/runtime/llm-evidence/node-run/shown-rows/account.ts:55-63` (`restOfRows`), which
     never checks `conditions.unfiltered`. That file is t890's lane (see "Proposed changes").
4. **0056: the judge said no, naming every defect in the task's terms**: the price over the ceiling,
   "Leave out the ads", paid shipping, the non-hub charger, the price order, and "the cheapest
   results on page 1 were never read". The model then set the site's Max price filter, which made
   the list one page. Judge 0071 said yes.

Judge 0032's "unknown" came earlier, while the draft was still being rebuilt, and is not part of
this chain. So the five rounds were: two fair unknowns, because empty later pages were never told
(1b and 1c), one fair no, because 20 rejected rows had become the result (1a), and then yes. Every
"no" named the missing or wrong part in the task's terms. The extra rounds came from evidence
missing from what the judge was shown, not from vague verdicts.

No filter was lost on a reload. Every read in this chain had the same three `where` conditions and
read the sorted list's address. The rows were unfiltered because of the extension's exploration
floor (1a), not because of a robot check.

### The towels run (run-mwafor01-bb471f52, Haiku)

- Step 0093/0094 read page 2 with **four** conditions, after the model added a holder/dispenser
  exclusion. Page 1 had been read with three (0071, 12 rows). A read asked differently is a different
  list (`rows/dataset-of-read.ts`), and that is right: the 12 page-1 rows include the holder the new
  condition excludes. After judge 0073 said no, `runRowsRefused` cleared the run's precedence, and the
  5-row page-2 list became the result. Judge requests 0097 and 0107 both show `totalRecordCount: 5`
  and `readPages: [{ place: page=2, kept: 5 }]`.
- Page 1 was never read with the four conditions. 0099 was refused as a repeat. 0101 pressed page 1.
  0103 called `core.recall_result`, which only shows an old answer again and stores nothing. Then the
  model completed (0106), saying "both result pages were read".
- 0097 was an honest "unknown: page 1 was never read", true of the result's list. 0107 said no and
  named each missing page-1 row in the task's terms.
- **Cause 1d, not fixed:** the model was never told that its read had switched the result to a new,
  5-row list and dropped the 12 rows it had read with other conditions. The row sink's
  `fromCall` return (`datasetId`, `startedOver`) is not shown to the model
  (`answer-first/attempt/call-chain.ts:83`). The model sees `resultHolds` only after a judge refuses.
  The fix is to say on the read's own answer what the result now holds ("the result is this read's
  list, N rows; the M rows read with other conditions are no longer in it: read its other pages the
  same way"). That puts a new member on the evidence Core reads against a closed key list, so it
  needs its own brief. I did not do it here.

### Fixes in Core (my lane)

- **1a: `packages/fluxiq/src/framework/automation-service/service/answer-first/rows/found-rows.ts:27-51`.**
  When the read's own account says it answered rows its conditions rejected
  (`<holder>.extraction.conditions.unfiltered === true` beside a live read's rows, or
  `outputs.result[.result].extraction...` beside a replayed read's `outputs.records`), the read has
  answered but holds **no rows**: `[]`. The account's contract is Core's own
  (`service/summaries/extraction-summary.ts`). The sink then stores nothing and counts it in
  `readsAnswered`. Under the existing rule, a read that stored nothing never displaces one that did,
  so page 1's rows stay the result.
- **1c: `rows/row-sink.ts`** (header paragraph, `Held.idColumns`, `emptyPage` at :130, the call at
  :163, the empty-batch branch in `recordBatch`) **and `rows/list-after-read.ts:69,77`.** A read with
  no rows is kept as an empty page (`kept: 0`) of a list only when all of these hold:
  - it is the **same read** of that list, meaning `automationStudioAnswerFirstReadDatasetId`, given
    the list's own id columns, names that dataset. That rules out another `where`, another name,
    another view, or a working read;
  - it names a place;
  - the list has not already read that place.

  A saved run's batch with no rows at a new place is kept the same way. Empty pages add no row and
  move no result. `list-after-read` passes them by when deciding re-read against next page, and a
  later read with rows at that place takes their slot.
- `rows/sink-type.ts`, `rows/list-page.ts`: doc lines for the `kept: 0` entry.
- `packages/fluxiq/src/runtime/result-verification/flow-less/question.ts:19`: the judge is told "a page
  with kept 0 was read the same way and held no row to keep". The wording is generic and names no
  scenario. `flow-less/tests/judge.test.ts` still passes.

### Tests (all provider-free, vitest)

- New `rows/tests/rejected-rows.test.ts` (3 tests): such a read holds no rows, both live and
  replayed; and in the sink, a read of page 2 that returned only rejected rows, named otherwise or
  not, stores nothing and leaves page 1's two rows as the result.
- `rows/tests/read-pages.test.ts` (+3 tests): a further empty page of the same read is told with
  `kept: 0` once and changes no row; an empty read asked another way, named otherwise, of another
  view, or with no place, is not told; an empty-told page read again with rows carries the list on
  in its place.
- `rows/tests/run-read-pages.test.ts` (+1 test, `runTwoReads` takes the second page's rows): a
  saved run's second page that kept no row goes through the real engine's capture, and `readPages`
  is `[{page=1, kept 2}, {page=2, kept 0}]`.

**Checked failing with each fix reverted.** I put back the HEAD copy of the source file from a
scratch backup, ran the test, then restored the fix:
- `found-rows.ts` at HEAD: `rejected-rows.test.ts` failed 3 of 3.
- `row-sink.ts` and `list-after-read.ts` at HEAD: "names a further page ... kept 0" (read-pages) and
  "names a later page that kept no row" (run-read-pages) failed, 2 failed and 6 passed.
- Only `list-after-read.ts` at HEAD: "carries the list on when a page told empty is read again with
  rows" failed, 1 failed and 4 passed.

## Defect 2: hubs attempt 2's saved Next page failed (0073)

- **What the step targeted:** step 10, `web.output.dom-next_page` with `nextPage.item = main > div >
  section > div:nth-of-type(2) > div.css-0c6j7hs` and `pagination: { mode: "numbered", pages: "main
  > div > section > div:nth-of-type(3) > a.css-0jqlv5u" }`. It is the same step that failed in
  attempt 1's `run_flow` at 0066 (`core.replay.failed`, `outcome_uncertain`, `send.next_page`
  failed after 337 ms).
- **What the page held:** `~/search?q=usb+c+hub&sort=price_asc&maxPrice=10`, "ARRIVED reload". The
  list was present: the Max price field showed 10, and 16 items were shown. There was **no pager at
  all**: no numbered page links, no Next. The results fit one page because the model's Max price
  filter (added at 0058-0063) now narrows them. A notification layer covered part of the page.
  Attempt 2's hand-off shows one traffic check, cleared, on the third results load, which is the Max
  price OK. That reload kept `maxPrice=10`, so the cleared check was not the cause. The same failure
  happened in attempt 1 at 0066.
- **Why the saved target did not match:** the target was not stale. There was nothing to find,
  because a one-page list has no pager. `apps/extension/src/content/extraction/page-advance/move-page.ts:63-66`:
  `pageShownNow(way, item)` returns `undefined` when `way.pages` matches no control. The numbered
  branch then fails `page_fault` ("The pager ... does not say which page is showing"). Its guard
  against guessing the current page also fires when there is **no pager at all**. `page_fault`
  becomes `ACTION_FAILED` (`content/actions/next-page.ts` `FAULT_CODES`), which is read as a press
  whose effect is uncertain. So it is held back (`outcome_uncertain`) and the run stops, even though
  nothing was pressed.
- **Re-finding the target from its source step would not help:** no element is there to find. The
  right fix is by page state, which the brief allows: the list is on the page and its pager shows no
  page control, so the list has no next page, and the step answers `ended`. `next-page.ts` already
  answers that with `route: "ended"`, Core routes it down the loop's `ended` output, and the replay
  passes it (`replay.ts` header).
- **Not fixed by me:** `apps/extension/src/content/**` is t890's lane.

## Proposed changes for t890 (not made; outside my owned paths)

1. **Defect 2, `apps/extension/src/content/extraction/page-advance/move-page.ts:63`.** Before the
   `page_fault` guard, add:
   `if (way?.mode === "numbered" && document.querySelectorAll(way.pages).length === 0) return { outcome: "ended", stop: "no_following_page" };`
   Keep `page_fault` only for a pager whose controls exist but none of them marks the current page.
   Test it in `page-advance/tests/` with a list of items and no element matching `pages`, which
   should give `ended`/`no_following_page` and press nothing. Also consider: a fault decided before
   anything is pressed should carry `noEffect` (`NEXT_PAGE` `NO_EFFECT`), so it is not reported as
   `outcome_uncertain` and Core can retry it. Today any `page_fault` reads as a press that may have
   landed.
2. **Cause 1b, `domain/src/runtime/llm-evidence/node-run/replay.ts:229` (`readChange`).** "The step
   read nothing where it read N" must not apply to a read on a different page from the one the step
   recorded, such as a loop's pass 2 or later, or a `from.location` whose place differs. Nor should it
   apply where the list showed items (`itemsSeen > 0`) and the conditions, applied under `answer:
   "kept"`, kept none. That page held nothing to collect. Keep the `itemsSeen` going to 0 rule (the
   list vanished) and the `unfiltered` rule. Without this, `core.run_flow` stops at the first honest
   empty page, and the empty-page telling added here in Core (1c) never gets an answer to tell.
3. **Cause 1a, model-facing, `domain/src/runtime/llm-evidence/node-run/shown-rows/account.ts:55-63`.**
   `restOfRows` says "extracted holds all N kept rows" for an unfiltered answer. It should say those
   rows are the ones the conditions rejected, and that the read kept none. A cleaner option, the
   lead's call because it reverses the documented exploration floor in `filtered-answer.ts`: have
   `run.ts` (my lane, not changed, since I could validate with vitest only) send the exploring
   extract_list with `answer: "kept"` wherever it already asks `rejectedSamples: true`
   (`webNodeDispatchParameters`, run.ts:427). `rejectedRows` already shows every rejected row with
   `rowsAlone`, so the floor's original reason, that an empty table hides what the conditions
   rejected, no longer applies. The Core fix makes the stored result right either way.

## Commands run and observed results

- `npx vitest run src/framework/automation-service/service/answer-first/rows` (in
  `!FluxIQ/packages/fluxiq`) -> 9 files, 79 tests passed.
- The revert checks above -> 3 failed, then 2 failed, then 1 failed, as listed. Each time I restored
  the fixed file and confirmed it with `git diff --stat`.
- `npx vitest run <answer-first>/rows <answer-first>/flow-run <answer-first>/completion <answer-first>/run-acts src/runtime/result-verification/flow-less`
  -> exit 0, "Test Files 40 passed (40)", "Tests 377 passed (377)".
- `pnpm --filter fluxiq check` (tsc `--noEmit`) -> exit 0.
- `pnpm structure:check` (Core) -> exit 0, "structure-audit: passed (538 warning(s), 1095
  baselined)". The one warning on a touched directory is the existing `answer-first/rows/: 24 source
  files` advisory, and I added no source file.
- I ran no build, no Lab command, and no domain or extension test build.

## Not verified

- No live run with these changes. Whether a judge given `kept: 0` for page 2 answers yes on the hubs
  task is inferred from the 0039/0049 wording, not observed.
- Cause 1c is only reachable through `core.run_flow` once t890 fixes `readChange` (1b), or through an
  exploring read of the same request at a new place. The hubs 0053 read named another dataset, so it
  is not told; with 1a fixed it also no longer displaces page 1.
- I could not see the Flow-run trace for attempts 3 and 4. They passed "whole with no decisions",
  but the Flow still held the Next page step, so how step 10 passed there is not traced.
- Towels cause 1d is diagnosed but not fixed. The towels run had ended at step 0153 (`ask_person
  near_repeat x4`) when I read it.
- `strands_a_step` refused dropping the Next page step (0069, 0076) because step 5, the Max price
  type, was recorded on `page=2`, and the Next page step is the only step that brings the Flow
  there. A results filter that works on any page is held to one page number. I did not trace this
  further.

## Open questions or contradictions found

- `filtered-answer.ts`'s header says the unfiltered floor belongs to the exploring model and that
  `unfiltered` makes the rows' status visible. But nothing in Core's answer-first row path read
  `unfiltered` before this fix, so the floor's rows went straight into the result. Whether to keep
  the floor at all (proposal 3) is a design choice for the lead.
- Whether `readChange` (1b) should key on loop pass or on the replay's `from` place is t890's
  choice. Both data are on the replay call (`pass` in step meta, `from.location`).
