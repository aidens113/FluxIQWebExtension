# r3-c-tested-label: report

## Outcome

Done. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQ` (branch `task/t274-live-lane-c`). Nothing was committed.

## What changed and why

Cause (run `run-mux6naez-6c20f26e`): for a finished run, `summary-reads.ts` worked out `testedLabel` from the rows' shape (every row said by its label alone). When a condition's column was not stored, as with `plus` and `sponsored`, the rows also came by label alone. So `plus is present` was treated as a test of the name, and non-Plus pairs that mention "Wireless Charging Case" were flagged as the item. A run's `testedLabel` is now decided from structure in `accounts.ts`.

`R` = `packages/fluxiq/src/programs/automation-studio/runtime/result-verification`

1. `R/contracts.ts`: added `testedLabel?: true` to the `AutomationStudioResultReadAccount.conditions` element type. Its doc comment explains the field and cites the run.
2. `R/read-account/accounts.ts`:
   - `conditionAccounts` now computes `tested = automationStudioResultReadConditionColumn(written[index], columns)` once and uses it for `withTestedValue`.
   - It adds `testedLabel: true` only when `leftOutOnlyByThis` is non-empty and `labelledBy(aloneRows[index], tested)` holds.
   - New helper `labelledBy`: the column is known, the raw rows are a non-empty array, and every row is an object whose first key equals the tested column.
   - Added a header paragraph citing the run.
3. `R/request-rows/summary-reads.ts`:
   - `condition(name, rows, testedLabel)` now takes `testedLabel` as an argument.
   - A build test still works it out (every row said by label alone, using the `TESTED_VALUE` regex).
   - A run read uses `entry.testedLabel === true` from the account.
   - The header explains both senders and cites the run.
4. `R/request-rows/types.ts`: rewrote the `testedLabel` doc comment to cover both sources and cite the run.
5. `R/request-rows/left-out-naming-the-item.ts`: added a header paragraph: a run's condition tested the label only where its account says so (cites the run).
6. Tests:
   - `R/request-rows/tests/left-out-naming-the-item.test.ts`: new test "run mux6naez: rows the plus condition alone left out are not flagged, though they name the item first and a charging case after".
     - It uses the round-1 run summary.
     - The two given rows (Zephyrline Z1, Pulsebud Mini 30H) are appended to `plus is present`.
     - The name condition is cut to the two accessories.
     - It expects `[]`.
   - `R/request-rows/tests/run-muw60j7c.ts`: the run read's `name not contains [...]` condition now carries `"testedLabel": true`, as accounts now emits. The existing step 0039 test still flags the three pairs.
   - `R/read-account/tests/alone-rows.test.ts` (extended an existing file; no new file):
     - The first test's `toEqual` on the accessory rule now expects `testedLabel: true`.
     - New test "run mux6naez: mark only the condition that tested the label's own column as testing the label". The authored where is `field: plus` / `field: sponsored` / `field: name`, and the stored rows hold name/price/rating/url.
     - It asserts that all rows are said by label alone and that `testedLabel` is `[undefined, undefined, true, undefined]` (the 4th condition is a count with no authored wording).

## Commands run and observed results

- Fail-first, before the fix, from `packages/fluxiq`: `npx vitest run src/.../request-rows/tests/left-out-naming-the-item.test.ts`. Result: 1 failed | 5 passed (6). `AssertionError: expected [ { …(5) } ] to deeply equal []`. Received `{ condition: "plus is present", item: "wireless earbuds", also: ["charging cases"], nodeId: "node.bootstrap.589d57d24ac663c7.main.s7", rows: [Zephyrline Z1 ..., Pulsebud Mini ... 30H ...] }`. This reproduces the live defect.
- After the fix: `npx vitest run $R/request-rows/tests $R/read-account/tests $R/tests $R/build-test/tests`. Result: Test Files 39 passed (39); Tests 377 passed (377).
- `node scripts/build-cache/cli.mjs fluxiq:check` (Core root): exit 0 (`"step":"fluxiq:check","reason":"inputs changed: packages/fluxiq ..."`, 58 s).
- `node scripts/build-cache/cli.mjs structure-audit:check`: `structure-audit: passed (264 warning(s), 349 baselined).`, exit 0. Re-run: exit 0.
- `pnpm.cmd build` (Core root): exit 0; web:build finished (`"step":"web:build"`, 246 s).

## Not verified

- No live or Lab run (out of scope by the brief).
- I did not run the new accounts test against the pre-fix code. It asserts a field that did not exist before, so by construction it could not have passed.
- I ran no Core vitest folders outside the four named directories. Whole-suite runs are reserved for the sweep.

## Open questions or contradictions found

- `testedLabel: true` now appears on `resultSummary.reads[].conditions[]`. The result judge receives that summary as JSON (`judge-paging.ts` passes reads through, and `recovery/refuted-result/history.ts` copies them). So the judge will see a field its instruction text does not describe. I did not change any instruction text, and no prompt pin test failed. If the supervisor wants it hidden from the judge, it should be stripped in `read-account/judge-paging.ts` (not in my ownership).
- A run whose label column is not the condition's column but whose rows carry the tested cell is unaffected: that row already has a second cell, and the label-alone rule only ever applied to build tests.
