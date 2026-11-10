# Dropped organic row and the judge's yes (run-mwaknxf9-7549d126)

## Outcome

Done. The row was not lost in reading, dedupe or the list merge. Rows were stored correctly: at 0041 the result held all 16 expected rows. Two judges then wrongly said a correct row was sponsored, and the model followed them and added a condition that dropped the organic row by name. The root cause is in Core: the Flow-less judge was shown rows by name and pages by count only, so when two cards share a name it could not tell which card a row came from. Core now shows the judge, for each read, the rows it kept and the rows it left out, grouped by the condition that left them out. There are tests beside each change, and each test fails with its fix reverted.

## Q1: where the organic row was lost

| Step | What happened | Evidence |
| --- | --- | --- |
| 0027 (page 1 read) | Kept 11 rows, **including** the organic "Loftwell Select-A-Size ... 12 Double Rolls" ($19.94, 4.7). The ad condition `div_css-1p4czgx is absent` alone left out the ad copy. | `0027/result.json` `read.extracted[3]`; `rejectedRows.conditions[0].rowsAlone[0]` |
| 0041 (page 2 read) | Kept 5 rows. The result is now 16 rows, exactly the oracle's set (`resultList.rows: 16`, pages 11 + 5). | `0041/result.json` `resultList` |
| 0065 (model's check read, with `sponsored` column) | Shows the read marks the cards correctly: item 2 Loftwell `sponsored: "Sponsored"`, item 5 Loftwell `sponsored: null`; Hearthside 12 Double the same pattern. | `0065/result.json` `read.extracted[1]`, `[4]` |
| 0043 judge | Said **no** to the right 16 rows: "Two kept rows are marked Sponsored on the page: Hearthside Select-A-Size ... and ValueRidge Essentials Select-A-Size". Its end view was **page 2**, where those two names appear as sponsored cards. The rows had been read from page 1's organic cards. | `0043-judge/decision.json`; `request.txt` endView `&page=2`, `t2152 "Sponsored"` / `t2349 "Sponsored"` |
| 0060 judge | Said **no** again: "Loftwell Select-A-Size ... is a sponsored listing". Its end view was page 1, which shows both Loftwell cards, one under "Sponsored" and one not. | `0060-judge/decision.json`; `request.txt` (5 mentions of the name) |
| 0076 model | "Rerun the row read so it also leaves out the sponsored Loftwell Select-A-Size 12-roll pack", adding `{field: name read, matches: "Loftwell Select-A-Size Paper Towels, 12 Double Rolls", not: true}`. | `0076-decide/decision.json` |
| 0078 read | That condition alone left out the organic Loftwell (`where 4 rowsAlone`). The read's own note told the model to check it, but the judge had called it sponsored. 10 rows. | `0078/result.json` `rejectedRows.conditions[4]` |
| 0099 read | Page 2 with the same 5 conditions. The result became 15 rows (pages 10 + 5). | `0099/result.json` `resultList` |

The brief's candidates, checked:
- **Read fields or ad condition misreading the card:** no. See 0065, and 0027 kept the organic copy.
- **Dedupe before the filter:** no. Conditions apply per card on the page, and the sink's `wholeOnce` drops only whole-identical rows.
- **List-after-read merge:** no. 0041 held 16, and 0099's 15 come from 0078's 10 plus 5.
- **The model's conditions:** yes. 0076/0078 added the name exclusion, prompted by judge 0060's wrong defect.

## Q2: why judge 0114 said yes

Judge 0114 was shown:
- `recordSets`: the 15 rows, name/price/rating only.
- `endView`: page 1, which includes both Loftwell cards.
- `readPages`: `[{where, kept: 10}, {where, place: page=2, kept: 5}]`.
- No `looked`, no `witnesses`, no `acts`.

So it could see the two cards in the view, but nothing tied a row or an absence to a card. It also had no sign that a read had dropped the non-ad card through a condition on the name. It assumed the missing Loftwell was the ad: "Sponsored listings (Loftwell Select-A-Size, ...) are excluded". The same gap caused the two false noes: rows were not tied to the page or card they came from.

## What changed and why (Core, `packages/fluxiq/src`)

**Change:** each read page now carries the rows it kept and what its own conditions left out. The judge is shown both.

- `framework/automation-service/service/answer-first/rows/read-evidence.ts:56,94-170`: `leftOut` is now part of what a read says of itself. It reads two shapes:
  - Core's own `readRows` contract, from replays (`leftOutOnlyByThis`/`leftOutTogether` with `observations`).
  - The exploring read's `rejectedRows` (`fields`/`conditions[].rowsAlone|rows`/`rowsWithOthers`), plus `extraction.rejectedObservations` for what each condition read on the items it left out.

  The condition wording comes from the call's own `where` and `fields`, never from answer text.
- `rows/read-evidence-type.ts`, `rows/list-page.ts`: new members `leftOut` (on the evidence and the page) and `rows` (on the read page).
- `rows/list-after-read.ts:59`: the page a read makes keeps its `leftOut`.
- `rows/row-sink.ts:152` (an empty page keeps it too) and `rows/row-sink.ts:282,341` (`readPagesOf`): `readPages` now carries `rows` and `leftOut`. The note the model gets about a changed result still uses the lean `pagesOf`, with place and count only.
- `runtime/result-verification/flow-less/read-left-out.ts` (new): the `AutomationStudioFlowLessReadLeftOut` type.
- `flow-less/types.ts`: `readPages` entries gain `rows?` and `leftOut?`.
- `flow-less/read-pages-shown.ts:39,67,76,98`: the judge's copy now gives:
  - `keptRows`: the labels of the rows each page kept.
  - `leftOut`: one entry per set of left-out rows, with a `by` sentence naming the conditions, in the style `condition N (wording; it read "..." on the items it left out)`, followed by the rows.

  Labels are screened with `automationStudioResultReadAloneRows`, conditions are worded with `automationStudioResultReadConditionText`, and found values go through the same text screen as addresses. A field key that a column reads is said as that column (`name`, `rating`). It now takes `deniedKeys`, passed in from `judged-summary.ts:50`.
- `flow-less/question.ts:19`: one added sentence that says what `keptRows` and `leftOut` are. It says nothing about what to assume, and it names no site, product or task.

Replayed against this run's own reads (0078 and 0099 through the real sink and the real judged summary; output saved at `C:/Users/osrs_/AppData/Local/Temp/claude/bc302d3e1bd85154/1d7e40a9-22b4-41e1-ad74-ba7e457da62b/scratchpad/judge-0114-shown.json`), judge 0114 would now see on page 1:
- `condition 5 (name not matches "Loftwell Select-A-Size Paper Towels, 12 Double Rolls"; ...) by itself`, which left out "Loftwell Select-A-Size ...";
- `condition 1 (div_css-1p4czgx is absent; it read "Sponsored" ...) and another condition`, which left out the other Loftwell card.

On page 2 it would see that condition 1 alone left out the sponsored "Hearthside Select-A-Size" and "ValueRidge Essentials Select-A-Size", while page 1's `keptRows` hold those names. That answers 0043's and 0101's defects.

Tests:
- New: `rows/tests/read-left-out.test.ts`, 4 tests: an exploring read, a replayed read, no account, and the page through to the judge's copy.
- New: `flow-less/tests/read-left-out.test.ts`, 4 tests: wording of all three set kinds, a credential-shaped label withheld, a page that holds neither member, and the question and digest.
- Updated: `rows/tests/read-pages.test.ts` and `rows/tests/run-read-pages.test.ts` now expect the `rows` member on each page.

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ`. Tests ran from `packages/fluxiq`.

- `node node_modules/vitest/vitest.mjs run src/framework/automation-service/service/answer-first/rows src/framework/automation-service/service/answer-first/completion src/framework/automation-service/service/answer-first/flow-run src/runtime/result-verification/flow-less` → `Test Files 37 passed (37)`, `Tests 287 passed (287)`, exit 0.
- Fix reverted, by putting back the `HEAD` copies via `git show` and then restoring mine:
  - `rows`: `row-sink.ts`, `read-evidence.ts`, `list-after-read.ts`, `list-page.ts` at HEAD → `rows/tests/read-left-out.test.ts`: `3 failed | 1 passed`. The test that passed asserts that nothing is said.
  - `flow-less`: `read-pages-shown.ts`, `judged-summary.ts`, `question.ts` at HEAD → `flow-less/tests/read-left-out.test.ts`: `3 failed | 1 passed`. The test that passed is the unchanged "neither member" case.
- `pnpm --filter fluxiq check` → tsc build-cache step `fluxiq:check` ran, exit 0.
- `pnpm structure:check`:
  - First run: exit 1, with 2 violations: `rows/` held 26 files against a limit of 25, and a non-barrel import from `read-account`.
  - Fix: I folded the reader into `read-evidence.ts` and imported `../read-account/index.ts`.
  - Re-run: `structure-audit: passed (538 warning(s), 1095 baselined)`, exit 0.
- A throwaway vitest file (deleted afterwards) replayed steps 0078 and 0099 through the sink and the judged summary. Its output is quoted above.

## Not verified

- **No live run and no paid judge call.** That a judge now answers no on 0114's evidence, and yes on 0043's 16 rows, is expected but not observed.
- I did not run full package suites, by the twice-a-day rule. Only the four directories above ran.
- I did not check other callers of `readPages` beyond `completion/check.ts`. It passes the pages through, and its tests pass.

## Open questions and extension notes (not edited)

1. **Contract.** Core now reads the web domain's `rejectedRows` member on an exploring read by name. Core already reads `extraction.conditions.unfiltered` and `url` the same way. The shape is the domain's: `domain/src/runtime/llm-evidence/node-run/rejected-rows.ts:182-241` (`rejectedRows` and `tabulated`), sent from `run.ts:512`. Proposed extension change: add a domain test that pins `fields`/`conditions[].where|rowsAlone|rows`/`rowsWithOthers[].failed|rows` as Core reads them. Alternatively, send Core's `readRows` contract (`leftOutOnlyByThis`/`leftOutTogether`) on exploring reads too, so one shape serves both.
2. **Identical-value cards.** `rejected-rows.ts:199` keys a row by its values, and the page samples say an identical row once. So the ad Loftwell, which fails both the ad and the name condition, is said as "condition 1 and another condition" without naming condition 5. This is accurate but less specific. It needs a card identity in the samples; it is not a Core change.
3. **Model side.** At 0078 the read's own note already listed the organic Loftwell as removed by itself by the name condition, and said to check it. The model trusted judge 0060 over that note. I left the model guidance unchanged, since the cause was what the judge was shown.
4. 0015-0022 (robot check) was ignored, per the brief.
