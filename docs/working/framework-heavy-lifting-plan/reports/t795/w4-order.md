# t795 w4-order report

RV = fxwork/t795/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/result-verification

## Outcome
Partial. Items 1, 3 and 4 are done and tested. Item 2 found the premise false, and that makes the photo run's own false claims impossible to contradict from inside the files I own. Three upstream facts block that, listed under "Open questions".

## What changed and why
- NEW RV/value-readings/kept-date-order.ts (exported from value-readings/index.ts): `automationStudioResultKeptDateOrders(set, now)`. For each column of a set's `sampleRows` that Core's own sort reader takes as a date (`automationStudioRecordAutoSortKind`), it says whether the rows run desc or asc. It counts only when every kept row states a date, the rows shown are the whole set (`length == recordCount`, not truncated), and the dates run one way. It also reports `nothingCut` (`processing.cut === 0`).
- RV/value-readings/order-claim.ts: signature is now `(text, recordSets, now = Date.now())`. The only caller, agreement/record-contradictions.ts:31, is unchanged and still compiles. The `sortRead` path behaves as before. New: a denial is contradicted when a set has a date column running one way, nothing was cut, and the text either says the matching way (newest/latest/most recent first or descending for desc; oldest/earliest first or ascending for asc) or names the column when it names no way. Cut rows are never vouched for, so cut > 0 is never contradicted.
- RV/computed-facts/order.ts filled in (export name and signature unchanged):
  - `fails` only when some set has `sortRead[0].inOrder === false`. The defect has kind `other`, a row, the column, and `requestWords` taken from the request's own order phrase (else its first sentence).
  - `holds` when every set that has a sort reads in order. With no sort anywhere, it holds when the request says newest or oldest first and every set of more than one row has a date column running that way with nothing cut.
  - Otherwise no fact.
- sort-reading.ts, record-set-summary.ts and result-summary.ts are unchanged (see item 2).
- Tests: NEW value-readings/tests/order-claim.test.ts (7 tests, including the named "a no calling date-ordered kept rows not newest-first is contradicted by their own date values", on loan dates of library titles) and NEW computed-facts/tests/order.test.ts (5 tests).

## Item 2: the premise is false. Fields left out are not stored or reachable at judging.
- Result summary: result-summary.ts:442 sets `columns` to the stored schema's field ids. `screenedRows` (:511-535) copies only those columns into `sampleRows`. A date field is judged only if it is a schema field.
- Packet in run mvtdn37t: 0103 request, `recordSets[0].columns = ["link"]`, sampleRows hold `link` only. The `when`/`date` field was never in the record schema.
- Storage: run-dataset-store.ts:484-501 (`answerOf`) keeps `process.columns` out of the pure function. It runs `processAutomationStudioRecordRows` on whole collected rows, then `rowOfColumns` narrows each answer row to `columns` before saving the answer's `rowJson`. So a schema field left out of `process.columns` is not in the answer rows the summary is built from. build-test/stores.ts:193 `answerOf` drops `columns` the same way.
- Collected rows still hold such a field in `row_json`, but the summary input (`AutomationStudioResultRecordSetInput`, result-summary.ts:152) carries only the answer `rows` and `checkedRows`. Only a hidden sort key is carried, as `hiddenSortKeys` (process-rows.ts:128).
- The cut rows' own values are not carried anywhere. `processing` has only the `cut` count.
- I did not carry anything more on the summary. The source rows are not in the summary input, and the callers that build the input are outside my paths. Carrying it needs a change in service/ or storage/ plus the build side, which must put the date field in the schema.

## Commands run and observed results
- Fail-first, with the old order-claim.ts and the stub order.ts swapped in: `pnpm test ...order-claim.test.ts ...order.test.ts` printed "Tests 5 failed | 7 passed (12)". The 5 failures are the date-claim test, the relative-dates test, and the 3 order-fact holds/fails tests.
- First run of the new code failed to load. Test Files 6 failed to load, 28 tests passed. I had mangled the escape characters in the regexes in order-claim.ts. I fixed them in place with Edit.
- A second run had one failure: "1d"/"4d"/"1w" are not dates to `read-date.ts` (see below). I changed that test and added the inverse test.
- Acceptance (three paths): `pnpm test .../value-readings .../computed-facts/tests/order.test.ts .../tests/result-summary.test.ts` -> "Test Files 10 passed (10), Tests 80 passed (80)".
- `pnpm check` in packages/fluxiq -> "check exit 0". Its only output is the `fluxiq:check` step, a `tsc --noEmit`.
- Scratch replay `scratchpad/t795-w4/replay.ts` (run with `node --experimental-transform-types`) on 0103, 0116, 0117, 0243 judge replies, each of expected, observed and summary: `contradicted=false` for all 12 texts. See next section.

## Replay: none of the real false claims is contradicted. Why.
- 0103, 0116 and 0117 show record set `columns:["link"]`, `cut:5`, `sortRead` absent. No date column is in the packet, and rows were cut. The judges' dates ("1d", "Sep 24") came from the end-view page text, not the record set.
- 0243 shows `cut:0`, but `columns:["link"]` again. No date column is in the packet.
- Core cannot contradict them from the record set. It needs the build to store the date, and the cut rows' dates.

## Not verified
- No full `pnpm test` or structure audit. The structure audit may flag the new file or the long ORDER_WORDS line. I did not run `pnpm structure:*`.
- No live replay with a real date column. Only synthetic tests (library loans).
- order.ts uses `Date.now()` for relative dates in the no-sort holds path. A set mixing relative and absolute dates would be time-dependent. The summary carries no `now`.

## Open questions or contradictions found
1. The brief and debug note say `read-date.ts` reads "1d", "4d", "1w". It does not. Its RELATIVE pattern requires "N units ago" ("4 days ago"). A bare "1d" or "1w" states no date, so a photo-site read whose date cell is "1d" would never be judged in order by this check. Fixing that is in contracts (`read-date.ts`, not mine; it is held equal to the domain's page-side parity table). I recorded it with a test.
2. To make the photo failures contradictable, upstream must (a) store the date field as a schema column, or carry it in the answer rows or a bounded summary field, and (b) carry the cut rows' dates or a Core-computed "every cut row is older" flag. Both sit in service/, storage/ and builder, outside my paths. I need a decision on whether to widen the paths for those, or whether the builder should be told to include the date column.
3. Cosmetic: order-claim.ts has a double blank line before `NEWEST_FIRST`.
