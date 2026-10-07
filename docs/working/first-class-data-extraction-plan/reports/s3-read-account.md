# Report: s3-read-account (read-list S3, finished-run judge)

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t291/!FluxIQ`, branch `task/t291-read-list-s3-judges`.
R = `packages/fluxiq/src/programs/automation-studio/runtime`. Nothing committed.

## Outcome

Done. All four tasks are implemented, with a test for each. Tasks 1, 3 and 4 failed first. Every test file in
`R/result-verification/read-account/tests/` and `R/result-verification/tests/` passes on two runs (27 files,
287 tests). `fluxiq:check` and `structure-audit:check` both pass.

## What changed and why

**Task 1. A looped read's account adds up every pass.**
- New `R/result-verification/read-account/loop-passes.ts` exports `automationStudioResultReadLoopPasses(attempts, isRead)`.
  - It works only from the attempts, in run order. The only definition id it reads is `builtin.control.repeat`.
  - A read attempt is a pass when the last Repeat attempt before it answered `body`, and one of these holds:
    - that Repeat ran again later, or
    - no step between the two succeeded on a route that leaves the loop. The routes that stay in the loop are
      success, skipped, state_routed, body and done.
  - The second condition is what separates a pass from a read placed after a loop that ended. Its test is
    "leaves a read outside any loop as it was".
  - Stop is decided after the last pass, in this order:
    - `failed` if the last pass itself failed;
    - otherwise the first of these: Repeat `done` gives `bound`, a step that succeeds on a leaving route gives
      `ended`;
    - otherwise `failed` if a step failed;
    - otherwise no stop.
- New `read-account/looped-account.ts` exports `automationStudioResultReadLoopedAccount`. It combines the passes'
  accounts into one, following the `keptPerPage` contract:
  - **Summed:** pagesRead, kept, itemsSeen, earlierPageRepeats, and each condition's `rejected` and `alone`.
  - **Joined:** leftOutOnlyByThis, in pass order.
  - **Set directly:** `paginates: true`, `keptPerPage`, `stop`, `attempts` (counts every read attempt), and
    `pageLimit` (the Repeat's authored `most`).
  - **Any pass true:** truncated and unfiltered are true when any pass was.
  - **testedLabel:** true only when every pass that left rows out had it.
- `accounts.ts` now runs the loop finder for each read step:
  - In a loop: one account per pass, from that pass's last successful attempt (or its last attempt if none
    succeeded), then combined.
  - Outside a loop: unchanged.
  - `pageLimit` comes from `flowNodes` (the Repeat node's `parameterValues.most`, when it is a positive count).
- The barrel `read-account/index.ts` exports both new modules.

**Task 2. The words.** Each changes only when the read has `keptPerPage`.
- `stop.ts`: `ended` means list_ended, `bound` means page_bound, `failed` (or no stop) means other. A read
  outside a loop is read exactly as before.
- `pages-clause.ts`, by how the loop ended:
  - `ended`: "every page (5) and the list ended: the step that moves it on found no page after page 5"
  - `bound`: "3 pages over 3 passes of its loop, until the loop's bound of 3 passes stopped it"
  - `failed`: "..., until a step of the loop failed"
  - no stop: "N pages over N passes of its loop"
- `page-bound-sentence.ts`: "The loop's bound stopped it at 3 passes, not the list, so the list may go on:
  raise the most passes (`most`) of the Repeat that loops it if the request needs rows past page 3."
  It never names maxPages.
- `sentence.ts`:
  - The head says "(3, 3, 3, 2, 2 by page, one pass of its loop each)" instead of "the last of N reads".
  - The brief tail says "it reads a page a pass of a loop".
  - The full tail says "It already runs in a loop that reads a page a pass[, and read to the end of the list, so
    more passes would read nothing more]; do not add another loop around it."
- `judge-paging.ts`: for a looped read, the counts-agree check compares `pageLimit` with the number of passes,
  not with pagesRead.
- A test asserts that none of these sentences contain maxPages, maxScrolls, Next, paginat-, click, button or
  scroll.

**Task 3.** In `result-summary.ts`, each record set summary now carries `processing`, copied from the store's
`AutomationStudioRunDatasetSummary.processing`. It is a copy (its passes are cloned too), and it is absent when
the store has none.

**Task 4.** `repair-directive.ts` adds the code `keptNoneRowsRejected = "result.kept_none_rows_rejected"`.
- **When the whole run stored nothing:** in the branch where nothing was stored and nothing refused, if the
  reads' conditions rejected any row, this finding replaces `noRecordsStored`. It reports:
  - "at least N rows over P pages (of S items seen)";
  - N is the sum, over the reads, of each read's largest single condition count. A row can fail more than one
    condition, so this is a floor.
- **When one set's processing says `keptNone` but the run stored rows elsewhere:** the same finding is given for
  that set, with its `datasetId`. It is computed from the reads named in `processing.passes[].node`, or from all
  reads when the set names none.
- **Fix line:** "Either a condition leaves out what the request asks for, or the list holds none of it: compare
  each condition of the read that rejected rows with the request's own words, and change the one that leaves out
  rows the request asks for; where every one says what the request says, the list holds none of what it asks for."

Files changed (all under `R/result-verification/`):
- New: `read-account/loop-passes.ts`, `read-account/looped-account.ts`, `read-account/tests/looped-read.test.ts`,
  `read-account/tests/looped-words.test.ts`
- Edited: `read-account/{accounts,index,stop,pages-clause,page-bound-sentence,sentence,judge-paging}.ts`,
  `result-summary.ts`, `repair-directive.ts`, `tests/result-summary.test.ts`, `tests/repair-directive.test.ts`

## Commands run and observed results

All vitest commands ran from `packages/fluxiq` with `--testTimeout=120000` and exact paths.

**Fail-first runs:**
- **Task 1:** `npx vitest run .../read-account/tests/looped-read.test.ts` gave "Tests 5 failed | 1 passed (6)". The
  account had pagesRead 1, kept 2, itemsSeen 6 and paginates false: the last pass only. The one passing test was
  the outside-loop control. After implementing: 6 passed. Two sentence tests still failed until Task 2.
- **Task 3:** `npx vitest run .../tests/result-summary.test.ts` gave "Tests 1 failed | 16 passed (17)" ("expected
  undefined to deeply equal { collected: 15 ... }"). After implementing: 17 passed.
- **Task 4:** `npx vitest run .../tests/repair-directive.test.ts` gave "Tests 2 failed | 20 passed (22)" ("expected
  [ 'result.no_records_stored' ] to deeply equal [ undefined ]"; "expected [] to have a length of 1"). After
  implementing: 22 passed.
- **Task 2:** `looped-words.test.ts` was written after the code, so it did not fail first. It passes: 6 passed.

**Final runs:**
- `npx vitest run <27 files: read-account/tests/*.test.ts + result-verification/tests/*.test.ts>` was run four
  times: twice before and twice after the test-only type fixes. Each run printed "Test Files 27 passed (27)" and
  "Tests 287 passed (287)".
- `node scripts/build-cache/cli.mjs fluxiq:check`, first run: two type errors, both in my own test files:
  - TS2352, a cast in looped-read.test.ts;
  - TS2379, `conditions: undefined` under exactOptionalPropertyTypes in repair-directive.test.ts.
  I fixed both. The re-run printed no errors: `{"build-cache":"build","step":"fluxiq:check","reason":"no stamp;
  stored in the shared store ..."}`. No type errors appeared in files owned by other workers.
- `node scripts/build-cache/cli.mjs structure-audit:check`: "structure-audit: passed (276 warning(s), 349
  baselined)". It was rebuilt after my edits ("inputs changed").
  - Sizes: `repair-directive.ts` 491 lines (it was 444 and already past the 400 advisory), `result-summary.ts` 418,
    `accounts.ts` 269. All are under 800.
  - `tests/` holds 20 files and `read-account/tests/` holds 10, both under 25.

## Not verified

- No Lab, browser or provider call was made. The loop finder is tested on synthetic attempt traces shaped like
  `repeat-loop.test.ts`, not on a recorded live run.
- I did not run tests outside the two named directories. Readers of the summary elsewhere (`R/llm`, `build-test`,
  and `request-rows`, which uses conditions) were not exercised with looped accounts, and neither were readers
  of the new stop words.
- Per design 5.2, the line in `R/llm` diagnosis-instructions.ts:72 ("the pages it read ... whether it already
  pages") should change to describe passes, the loop's end and its bound. I did not change it: `R/llm/**` is
  outside my ownership.

## Open questions or contradictions found

1. **A run with no record set is unchanged.** When `recordSetCount === 0`, the result still says `noRecordSet`
   even if the reads' conditions rejected every row. I left it because `build-test/judge.ts` deliberately drops
   `noRecordSet`, and moving that case to the new code would change what build tests are told. If the C5
   collection can leave a run with no dataset at all after a filtered read keeps nothing, the supervisor should
   decide whether that case should also get `kept_none_rows_rejected` (with build tests excluded).
2. **Rows rejected is a floor.** The account has no exact count of rows the conditions rejected; the extraction
   has one (`conditions.applied/kept`), but the contract does not carry it. An exact count would need a contract
   field such as `rejectedRows` on `AutomationStudioResultReadAccount`. I did not add it, because `contracts.ts`
   is outside my ownership.
3. **One known limit of the loop finder.** On a loop's last pass, if a step inside the loop body before the read
   succeeds on a route that leaves the loop (for example a Branch's `true`/`false`) and the Repeat never runs
   again, that last read is treated as outside the loop. Earlier passes are unaffected, because the Repeat ran
   again after them.
4. **Looped accounts drop the retry wording.** `attempts` on a looped account counts every read attempt,
   retries included. The sentence no longer says "the last of N reads" for a looped read, because the account
   is not the last read's.
