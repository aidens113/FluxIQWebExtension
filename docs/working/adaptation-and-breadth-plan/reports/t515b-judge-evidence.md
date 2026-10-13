# t515 worker B: judge evidence

## Outcome

Done. All three Core defects from `run-mv6v2kzn-d593231f` are fixed. Each has a test that failed first. Tree: `C:/Users/osrs_/FluxStuff/fxwork/t515/!FluxIQ`. Nothing was committed.

## What changed and why

1. **The instruction-column reader stops at the end of the list.**
   - File: `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/answerability/instruction-columns.ts`.
   - The reader now splits the list but keeps the separators.
   - The list ends at the first of these:
     - the comma after an item that "and" or "&" introduced, which is how English closes a list;
     - a part longer than 3 words, which is a clause and not a name;
     - an ordering phrase: one ending in the word "first" or "last", or starting with "sorted", "ordered", "ranked", "sort by" or "order by".
   - A part refused only for its characters, such as "price (GBP)", is still skipped and reading continues.
   - "title, company, salary and link, newest first" now gives `[title, company, salary, link]`.
   - "first name", "last name" and "order number" are still read as columns.
   - New test: `answerability/tests/instruction-columns.test.ts` (7 tests). 3 failed before the fix.

2. **`sortRead` is given for a sort key that `process.columns` hides.**
   - `packages/contracts/src/record-sets/process/process-rows.ts`:
     - For each sort key that `columns` leaves out, the account now gets `hiddenSortKeys[]`, recorded before the columns are applied.
     - Each entry holds: field, position, order, kind, and how many rows state a value. The first key also gets `inOrder`. Date and number keys get up to 4 values (epoch ms or number, `null` where a row has none). No cell text is ever recorded.
     - The kind is decided over the rows that were sorted, as `sort-rows.ts` does it. The values are taken from the answer rows in answer order.
     - The column is never added to the answer. Per your decision, a sort over a hidden column stays allowed.
   - **Outside the owned list:** I had to add the field and the `AutomationStudioRecordProcessingHiddenSortKey` type to `packages/contracts/src/record-sets/process/types.ts`, because the account type is defined there.
   - `result-verification/value-readings/summary-readings.ts`:
     - `withAnswerReadings` now always removes `hiddenSortKeys` from `processing` (see the first open question for why).
     - When the summary carries rows, it says a key the stored rows lack from Core's record, in its sort position. Example: "Core sorts this answer by posted, newest first, reading posted as a date: 3 of 3 rows state one. posted is not one of the answer's columns: Core read it on the stored rows before leaving it out, and the answer's rows were in that order. Read, in row order: 2026-10-13; 2026-10-10; 2026-10-04."
     - The entry carries `inOrder`, so the existing `sortRead` checks in `agreement.ts` apply to it unchanged.
   - Tests, both failing first:
     - 2 new tests in `contracts/.../process/tests/process-rows.test.ts`.
     - 2 new tests in `value-readings/tests/summary-readings.test.ts`. The second one failed because the raw record reached `processing`, which proved it would otherwise leak.

3. **The result check asks once more after a reply it could not read.**
   - File: `result-verification/verify.ts`.
   - `askOnce` now sets `temporary` through a new `askAgainAfter`. It is true in three cases:
     - `metadata.retryable` is true, as before;
     - the code starts with `llm_output.`;
     - `automationStudioLlmProviderFailureSpendsCall` says the call was spent (the `spend_call` rule in `failure-disposition.ts`). This covers `llm.provider_output_truncated` and the malformed-reply codes.
   - A refused key, a purse refusal, a cancellation and an untyped error are still not asked again.
   - The limit is unchanged: `AUTOMATION_STUDIO_RESULT_VERIFICATION_ASKS_PER_CHECK = 2`, so at most one extra ask.
   - Header comment updated.
   - 4 new tests in `result-verification/tests/verify.test.ts`. 3 failed first: cut-off reply then no-no, malformed reply, and two cut-off replies stopping at 2 calls. The 4th (a refused key is not asked again) is a guard that passed before and after.

## Commands run and observed results

- Fail-first runs (`npx vitest run <file>`):
  - instruction-columns: 3 failed, 4 passed.
  - verify: 3 failed, 11 passed.
  - process-rows: 1 failed, 18 passed.
  - summary-readings: 2 failed, 14 passed.
- After the fixes:
  - `packages/contracts`: `npx vitest run src/record-sets` → 12 files, 161 tests passed.
  - `packages/contracts`: `pnpm build` → dist rebuilt. fluxiq imports contracts from `dist`.
  - `packages/fluxiq`: `npx vitest run src/programs/automation-studio/runtime/result-verification src/programs/automation-studio/runtime/flow-bootstrap/answerability` → 67 files, 602 tests passed.
  - `packages/fluxiq`: `npx vitest run .../storage/project/tests/run-dataset-store.test.ts .../runtime/flow-bootstrap` → 140 files passed, 1 skipped; 2028 tests passed, 2 skipped.
  - `packages/contracts`: `pnpm check` → no errors.
  - `packages/fluxiq`: `npx tsc --noEmit -p .` → 3 errors, all in `result-verification/tests/agreement-unstated-exclusion.test.ts`. That is another worker's in-progress file. My files have none.
  - Root: `node scripts/structure-audit.mjs` → "structure-audit: passed (341 warning(s), 1159 baselined)". None of the warnings is in a file I changed.

## Not verified

- No live, Lab or provider run.
- I did not check that a real truncated DeepSeek reply arrives as `llm.provider_output_truncated` in `diagnostics[0]` at the result check. This is taken from the debug's meta reading.
- I did not check that a dataset processed before this change (no `hiddenSortKeys`) behaves as before beyond the existing tests. It should: the field is optional.
- I did not run the full suites, as the brief says.

## Open questions or contradictions found

- **Screening:**
  - The reading of a hidden sort key is said only when the summary carries rows, which happens only with a denied-keys declaration.
  - `summary-readings.ts` does not receive `deniedEvidenceKeys`, so it cannot tell whether the hidden column itself is a denied key.
  - I limited the risk by never recording text: readings are only dates and numbers.
  - A full fix would pass `deniedEvidenceKeys` in from `result-summary.ts`, or screen in `processing-account.ts`. Neither file is in my ownership.
- **The record reaches `processing` unless removed:**
  - `processing-account.ts` copies every count field of the account into the judge's `processing` (`...counts`), so `hiddenSortKeys` would reach the judge raw.
  - `summary-readings.ts` now removes it on every path. This depends on `automationStudioResultValueReadings` running on every judged summary, which it does today (`result-summary.ts:245`).
  - A cleaner home for that removal is `processing-account.ts`, which is not mine.
- **Edit outside the brief:** `contracts/src/record-sets/process/types.ts` was edited. Fix 2 needs it.
