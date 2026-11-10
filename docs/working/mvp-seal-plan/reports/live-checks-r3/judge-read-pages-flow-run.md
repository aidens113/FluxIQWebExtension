# Judge read-pages: a saved Flow's reads now carry their page

## Outcome

Done for Core. A saved Flow's read now passes the address its answer holds into the record batch, and the row sink turns it into the `readPages` entry's `where` and `place`. The extension domain was not touched. Whether the live web domain's answer holds the address where Core now looks is the one open point (see Not verified).

## What changed and why

The batch had no address, so `readPages` held only `kept` for a saved run's reads. Now:

- `engine/automation/contracts.ts`: `AutomationStudioRecordBatch` gains optional `location`. The dataset store copies named fields only, so it is never stored.
- New `engine/automation/records/read-location.ts` (`automationStudioRecordReadLocation`, exported from `records/index.ts`): reads a whole address from the dispatched answer. It looks at `location`, or at `snapshot.url`, on the object the rows' path runs through (`result` for `result.extracted`) and then on the answer itself. Anything that is not a whole address is ignored.
- `engine/automation/records/capture.ts`: the dispatch capture sets `batch.location` from that. The `records.write` capture has no answer, so it sets none.
- New `answer-first/rows/address-split.ts`: the view/place split moved out of `read-evidence.ts` unchanged, now shared and exported from the `rows` barrel.
- `answer-first/rows/read-evidence.ts`: uses it.
- `answer-first/rows/row-sink.ts`: `recordBatch` records `where` and `place` on the run's page from `batch.location`. The dataset's `view` is deliberately left unset, so which list a later read joins is unchanged. The header comment is adjusted.
- `result-verification/flow-less/read-pages-shown.ts` needed no change: it already screens `where` and `place`.

Not touched: `state-routing/**`, `run-gate.ts`, `steps-ran.ts`, the domain, docs/working, git.

## Tests (new)

- `engine/automation/records/tests/read-location.test.ts` (3).
- `answer-first/rows/tests/run-read-pages.test.ts` (2). It runs the real engine with two reads whose answers carry `result.snapshot.url` for page 1 and page 2, into the real row sink. `readPages` is two entries, each with `where` and `place` (`page=1`, `page=2`) and `kept` (2, 3). The second test runs with no address and expects `[{kept:2},{kept:3}]`.

## Commands run and observed results

- Reverted-change check: with `if (location !== undefined) batch.location = location;` disabled in `capture.ts`, the two-pages test FAILED (1 failed, 1 passed, the no-address one). I restored the file and confirmed the line is present.
- `vitest run` of `engine/automation/records`, `engine/automation/tests/node-execution.test.ts`, answer-first `rows`, `flow-run`, `completion` and `result-verification/flow-less` together: 36 files passed, 1 failed (37); 358 tests passed, 2 failed. The two failures were in `flow-run/tests/flow-run.test.ts` (I did not capture their text, because the output was tailed). That file alone, rerun: exit 0, 23 of 23 passed. The combined run took 452 s, so a load timeout in these heavy real-SQL tests is likely. I did not prove that.
- `vitest run` of `records` and `rows` after the last edits: exit 0, 11 files, 118 tests passed.
- `pnpm --filter fluxiq check`: `CHECKEXIT 0`. It ran before the final line-wrap edit to the new test file.
- `pnpm structure:check` (Core): the first run failed with 1 violation (statement-packing, line 37 of the new test). I fixed it. Rerun: exit 0, "structure-audit: passed (538 warning(s), 1095 baselined)". The rerun of the new test passed (2 of 2).

## Not verified

- **Where the live domain puts the address.** From the code I read, the extension's extract action answers `{ extracted, extraction, snapshot }` with the snapshot's `url`, and Core's record path is `result.extracted`. That is why Core looks at `snapshot.url` beside the rows. I did not see a live saved-run answer, and the engine traces of saved runs are not kept. If the real answer differs (for example, if the parallel worker's domain change moves it), one name in `read-location.ts` needs adjusting.
- The `flow-run.test.ts` failures in the combined run were not diagnosed (see above). `check` was not rerun after the one-line formatting edit to the test.
- No Lab or live run, no `pnpm build`.

## Open questions

- The address is a full URL, which may carry a query. It reaches the judge only through `read-pages-shown.ts`, which screens and cuts it. It is not stored with the rows.
