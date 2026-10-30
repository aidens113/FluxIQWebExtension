# t795 / w3-stored-facts — report

## Outcome

Done, with two gaps the brief's ownership kept me from closing (see Open questions):

- `answer.rows` does not yet reach the judge's checklist end to end.
- `verbatim` computes no fact, because the data it needs does not exist yet.

Four facts are filled in: count, columns, repeated and kept_bounds. Every new test was seen failing first. The four acceptance directories pass (45 of 45 files), and `pnpm check` in packages/fluxiq exits 0.

## What changed and why

Core root: `C:/Users/osrs_/FluxStuff/fxwork/t795/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`. RV means `result-verification/` under it.

**K2 schema (`answer.rows`)**
- `project-agents/contracts/task-spec.ts` is the task-spec parse file. Its `read`, `readPart` and `readAnswer` functions are the parse path, and `supervisor/plan-input.ts` reaches them through `automationStudioProjectTaskSpec.parse`, so plan-input needed no edit.
  - New type `AutomationStudioProjectTaskAnswerRows = {count?, atLeast?, atMost?}`.
  - New function `readRows`: each value is a whole number from 1 to 10000; at least one key is required; `count` may not appear beside `atLeast` or `atMost`; `atLeast` must not exceed `atMost`. Anything else is refused with `project.answer_rows_invalid` at the path of what is wrong, and an unknown key with `project.unknown_field`.
  - A spec without `rows` keeps its digest.
- `project-agents/supervisor/tools.ts`: the answer schema now has an optional `rows` (integer `count`, `atLeast` and `atMost`, no other keys). Its description is generic, and its examples are a library's (5 newest books, 3 reviews, 10 titles).
- `RV/contracts/requested-output.ts`: new `AutomationStudioResultRequestedRows`, carried on `RequestedAnswer.rows` and on `RequestedOutput.parts[].rows`.
- `RV/requested-output/owed.ts`: carries `rows` from the checklist part or the caller's declaration.

**Facts** (all in `RV/computed-facts/`)
- **`count.ts`** compares against the one owed part that declares rows and the one answer set.
  - The answer set is the finished run's only record set that is not working rows, or the build test's only store whose answer was made (`removed` present).
  - **Too many** (more than `count` or `atMost`) fails as `kept_not_asked`.
  - **Too few** fails as `asked_missing` only in two cases:
    - a limit cut rows (`processing.cut` or `removed.cut`); the limit applies after the conditions and the dedupe, so those rows passed everything.
    - the collecting read has no condition, the answer's processing filtered nothing, and the read stopped short of a list that went on: its page bound stopped it, `truncated`, or `listContinues` of kind `next_page` or `load_more`.
  - Feeds (lists that grow as they are scrolled) are excluded, per t741 D: going on past the page's end is not rows missing.
  - Any other short answer, or an answer that is ambiguous, gives no fact.
  - `requestWords` is the checklist part's quote; failing that, the first instruction's body.
- **`columns.ts`** works on finished runs only.
  - Requested columns are `answer.columns` plus the instruction's named columns, read by `automationStudioFlowBootstrapInstructionColumns`.
  - Stored columns are the schema columns of the non-working sets. No fact if any column list was cut or any set is missing from the summary.
  - **Missing:** no stored column has the same name, or the same name with case and separators ignored, and none shares a word with it. A name that shares a word without matching ("book title" beside `title`) gives no fact.
  - **Empty:** every stored row was read back and holds an explicit empty or null value, unless a read's own condition keeps the column empty (`emptied-columns.ts`).
  - A blank cell on some rows holds. A withheld value, or a key a row does not carry, leaves the column unsettled.
  - Any unsettled column means no fact at all.
- **`repeated.ts`**
  - **Fails** on whole-row repeats in a non-working set, and on repeats under the collecting reads' shared `dedupeBy` key (key cells all non-empty). Rows holding `[withheld]` are not compared.
  - Each defect is kind `other` and names the row's label with "stored N times".
  - **Holds** only when every row was read back and none was withheld.
  - `processing.duplicates` are rows a dedupe already removed, so they are never a repeat.
  - Build tests:
    - `stores[].repeated` gives no fact; see Open questions.
    - A made answer whose every row is labelled, with no label repeated, holds.
- **`kept-bounds.ts`** plus **`RV/value-readings/settled-rows.ts`**
  - New export `automationStudioResultStoredValueAgainst(condition, value)`. It applies the existing numeric, presence and text classification to a stored value. Date bounds and values that state no number return undefined.
  - The fact reads each read's sets that only that read collected and that are not working rows.
  - The condition is taken as authored via `automationStudioResultReadAuthoredCondition`, never by reading its wording back. It is parsed in Core's grammar on the stored column it tests.
  - A failing stored row is a `kept_not_asked` defect (label, column, value) only where a sentence of the request states the bound: the bound's number, a text test's words, or the column a presence test asks for. That sentence becomes `requestWords`. Where no sentence states it, there is no fact.
  - **Holds** only when every row was read back and every reading held.
- **`verbatim.ts`** is unchanged in behaviour (always `[]`). Its header now says exactly what data is missing; see Open questions.

**Tests**
- New in `RV/computed-facts/tests/`: `count`, `columns`, `repeated`, `kept-bounds` and `verbatim` (`.test.ts`), plus `library-fixture.ts`. All use a library catalogue example.
- `project-agents/supervisor/tests/answer-declaration/tests/answer-rows.test.ts` is new. It sits there, not at the brief's `supervisor/tests/answer-rows.test.ts`, because that directory was at the audit's 25-file limit. The existing nested `answer-declaration/tests/` group is the feature group for a part's answer.
- `answer-declaration/tests/answer-declaration.test.ts` is not owned but needed an edit: its exact `toEqual` on the answer schema broke once `rows` existed. It now compares every field except `rows`, which `answer-rows.test.ts` covers.

## Commands run and observed results

Every vitest and tsc run was under `heavy-check.lock`, and the lock was released after each.

1. **Fail-first.** I temporarily restored `HEAD`'s `tools.ts` and `task-spec.ts` (read-only `git show` into the files, then copied my edits back) and ran `vitest run computed-facts/ supervisor/tests/answer-rows.test.ts` against the stubs.
   - All 5 answer-rows tests failed, and every test of count, columns, repeated and kept-bounds that expects a fact failed (24 of my tests in all).
   - `verbatim.test.ts` passed: its expected value is the stub's.
   - Other workers' `order.test.ts` and `left-out-accounted.test.ts` were also red at that point.
2. **Acceptance tests.** `pnpm test <computed-facts> <requested-output> <value-readings> <project-agents/supervisor>`:
   - first run: exit 1, failing only in other workers' then in-progress files (`left-out-accounted`, `order`, `value-readings/tests/order-claim.test.ts`); all of mine passed.
   - final run: exit 0, `Test Files 45 passed (45)`, including `answer-rows.test.ts (5 tests)`.
3. **`pnpm check`** (packages/fluxiq, tsc):
   - run 1: exit 1, a syntax error in `order-claim.ts:72`, which another worker was editing at the time.
   - run 2: exit 2, TS2379 in my `count.test.ts`, because the `checklistOf` fixture was typed as possibly undefined (fixed), plus `tests/verify-computed-facts.test.ts:104` (not mine).
   - run 3: exit 2, only `verify-computed-facts.test.ts:104`.
   - **final run: exit 0.**
4. **`node scripts/structure-audit.mjs`** (Core root):
   - first run: my violations were three `as never` casts (answer-rows, count and repeated tests) and `supervisor/tests/` at 26 files. I fixed them with typed stores and the typed rows parameter, and moved the test as described above.
   - final run: 5 violations, none in my files: `request-rows/` 27 files, `request-rows/tests/` 29, `result-verification/tests/` 26, `computed-facts/left-out-accounted.ts` imports past a barrel, and statement packing in `verify-computed-facts.test.ts`.
   - One advisory warning is mine: `library-fixture.ts` exports 10 values (the advisory threshold is 8; it is not a failure).

## Not verified

- No full test suite or Lab run, and no model call (per the brief).
- The facts were not run through `verify.ts`, `computed-facts.ts` or the other workers' wiring. I checked only that the functions compile and pass their own tests.
- `answer.rows` in a live supervisor plan, and the guidance's step text (`guidance.ts`, not owned), which still says only `answer: {kind, columns}`. The model learns about `rows` from the schema description alone.

## Open questions or contradictions found

1. **The K2 wiring stops before the judge's checklist.** Both of these copy only `{kind, columns}` and so drop `rows`:
   - `RV/build-test/task-checklist.ts:66` (the type) and `:120` (the copy). Not owned.
   - `service/project-build/task-checklist.ts:55` and `:116`. Must not touch.

   Until each copies `rows`, the count fact sees rows only through a caller's `requestedOutput` or a hand-built checklist. Each fix is one spread, `...(part.answer.rows ? { rows: { ...part.answer.rows } } : {})`, plus the type at `:66`.
2. **The brief lists `buildTest.stores[].repeated` and `processing.duplicates` as fails; I made neither one.** Both would be wrong as Core nos:
   - `processing.duplicates` counts rows a dedupe already removed, so they were never stored.
   - `stores.ts` says labels alone cannot tell two rows apart. With `removed` present, repeated labels have already survived the store's own dedupe as two different rows. With `removed` absent, a run's end would still dedupe them.

   So `repeated` cannot conclusively show one row stored twice, and making it a no without a judge could wrongly refuse correct answers. Say if you want that policy anyway.
3. **The kept-bounds gate is my judgement call.** A stored row failing its read's condition proves only that the result contradicts the Flow's own condition, not the request. So I require a sentence of the request to state the bound: its number, a text test's words, or a presence test's column. The remaining risk is a number shared by coincidence, such as "15 cheapest" beside a price bound of 15. A typed bound on the task spec (op and value per condition) would make this exact; the contract has no such field.
4. **The `requestWords` and `row` conventions should be checked against the located-defects wiring.** For count and columns I used the dataset id as `row`, since no single row is at fault. For repeated I used the clause of the request the rows fall under. Check that the worker wiring `verify.ts` accepts a dataset id as `row`.
5. **Verbatim has no data to work from.** It needs each stored cell's source element and that element's text:
   - `endView` is only the last page, not the list each cell was read from.
   - Build-test `observed` and `stores` name rows by label only.
   - `leftOutCells` and `leftOutTogether[].cells` are the cells of rows that were left out, not stored ones.

   Paired W5 source references are needed.
6. **One deviation from Core's one-export-per-file rule.** `settled-rows.ts` now exports two values. The audit allows it (it is under the advisory threshold), and the brief owned only that file in `value-readings/`, so I could not add a separate file to the barrel.
7. **The contract (`RV/contracts/computed-facts.ts`) was unchanged and needed no new field.**
