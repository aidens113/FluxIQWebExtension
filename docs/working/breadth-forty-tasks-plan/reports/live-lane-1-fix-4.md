# Live-lane-1 fix 4 (Core): a no whose only complaint is a settled row is refuted

Worker report. Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t563/!FluxIQ` (branch `task/t563-a8-lab-comparison`). Nothing committed, Core was not built, and nothing under `dist` was written.

## Outcome

Done. The real judge input and both answers of `run-mvd8ypsv-32cde667` were replayed through Core's own code. Before the fix, both nos came back `wholly: false` and the agreement gave no `refutedNo`, so the double no stood and the run ended unverified. After the fix, both nos are `wholly: true` and the agreement gives `refutedNo.calls = [1, 2]`. `verify.ts` therefore asks each call once more with Core's finding about the Tidemark row. The judge's copy also no longer lists the four settled copies in `leftOutAlsoInResult`.

## Why the nos were not refuted (code path)

`verify.ts` builds the agreement input and calls `automationStudioResultVerificationAgreement`. For a double no, `agreement/agree.ts` calls `refutedMark(input, [1, 2])` in `agreement/weighed-no.ts`. That calls `automationStudioResultRefutedReading(judgement, record)` in `refuted-no/weigh.ts`, with the record built by `refuted-no/record.ts` from the summary.

- The record was right. All five condition-1 rows are `settled: true` and `quotesRequest: true`, with `quoted.texts = ["sponsored"]` and `read: "Sponsored"`. That is the t660 request-exclusion test working. Condition 1's `leftOut` accounts for the four copies as `also_in_result` and for Tidemark as `request_words`.
- `observed` splits into three sentences. Weighed one at a time against the real record:
  1. "16 rows kept across 2 pages, …" weighs `none`.
  2. "Condition 1 left out 5 rows, but 4 of them (…) are also in the result via another copy, so not missing." weighs **`standing`**.
  3. "Tidemark … is left out only by condition 1 and is absent from the stored rows." weighs `refuted`: the missing claim and the row-reference claim both refute it with the settled finding.
- Sentence 2 makes no claim Core checks. It names condition 1 and three stored rows, so it falls through to the last line of `weighed()`: `namesSomething && NEGATIVE.test(...)`. `NEGATIVE` matches "but", "not" and "missing", so the sentence stood as a reason of its own. It actually agrees with Core's record: each row it names is a stored row of which a condition also left a copy out.
  - I confirmed this by pairing sentences: sentences 1 and 3 together weigh `wholly: true`; sentences 2 and 3 together weigh `wholly: false`.
- With one sentence standing, `wholly` was false for both calls. `refutedMark` returned `{}`, no re-ask happened (only steps 0056 and 0057 exist in the run), and the double no stood.
- The advice was not the cause. `advice-condition.ts` rightly declines advice that names a row (Tidemark), and the second judge's advice says "only", which counts as narrowing. In both cases the no is weighed on its `observed` sentences.

## The fix as built

1. **`refuted-no/weigh.ts`**: each sentence is weighed without its clauses that only say rows came back by another copy. Clauses come from `automationStudioResultReasonClauses`. The new private helpers are `withoutRowsInResult` and `grantsRowsBack`. A clause is set aside only when all of these hold:
   - every row it names is a stored row of which a condition also left a copy out;
   - it names no left-out row and no row Core cannot find;
   - it says the result holds them. The `IN_RESULT` pattern covers generic words such as "is also in the result", "are among the stored rows", "not missing" and "came back".
   - after those words and a leading "but" are removed, nothing in it says something is wrong (the existing `NEGATIVE` and `APPROVED` tests, now shared through `saysWrong`).

   The rest of the sentence is weighed as before. A clause that says the row came back and also says something else is wrong ("… is in the result but is not …") is kept. So is a clause naming a stored row with no left-out copy. I also added `wrong(?:ly)?` to `NEGATIVE`. Without it, a part such as "condition 1 wrongly left out 5 rows" would have counted as no complaint once the grant clause was removed. The header gains a paragraph naming live-lane-1 fix 4 and the run, and the barrel header gains one line.
2. **`request-rows/summary-with-also-in-result.ts`**:
   - A row in its condition's `leftOutSettled` is no longer listed in `leftOutAlsoInResult`; its settlement already accounts for it.
   - `ALSO_IN_RESULT` now adds: "A row this condition alone left out that leftOutAlsoInResult does not list is not thereby missing or wrongly left out: this list says only which rows came back by another copy, and each other row is accounted for by this condition's own entry, by leftOutSettled and settled where it is listed there."
   - `storedThoughLeftOut` and every other behaviour are unchanged.
   - The header gains a paragraph naming lane-1 fix 4 and the run.
3. The model-guidance rule holds. The new sentence and the patterns are generic, with no words about any site, product or task. Only the code comments name the run id. The test fixture is a plant nursery's catalogue, which is not one of the ten scenarios.

## Files changed (all under `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/`)

- `refuted-no/weigh.ts`: the fix, plus its header.
- `refuted-no/index.ts`: one header line.
- `refuted-no/tests/weigh.test.ts`: new describe block with the run's shape and the guards.
- `request-rows/summary-with-also-in-result.ts`: the fix, plus its header.
- `request-rows/tests/summary-with-also-in-result.test.ts`: new describe block. The two older cases now use unsettled copies, through a helper `unsettledCopies()`.
- `request-rows/tests/promoted-copies-fixture.ts`: **new**. The run's shape: five settled presence-test rows, four kept by another copy, one sponsored-only (here "promoted"), and both nos worded as the run's were.
- `request-rows/tests/stored-though-left-out.test.ts`: "keeps a copy the same read stored as also in the result" now asserts that settled copies are not listed, then checks the old listing with them unsettled.
- `value-readings/tests/text-settled-judge.test.ts`: the judge copy now has no `leftOutAlsoInResult` (its copies are settled), and the two yeses are still confirmed.

These three old tests asserted the behaviour the brief changes: their fixtures' copies are all settled. I updated them to keep their intent; none was deleted.

Layout: `refuted-no/` was already at the 25-file limit, and a subdirectory would exceed the depth limit of 9 path segments. So the clause logic is private inside `weigh.ts`, which owns sentence weighing. The fixture lives in `request-rows/tests/` (now 25 files), and the refuted-no test imports it from there.

## Fail-first output

The fix was backed out temporarily: the weigh map was replaced with an identity and the settled filter disabled. Copies of the fixed files were kept in scratch and restored byte-identical afterwards (`cmp` printed `RESTORED`). Command: `npx vitest run …/refuted-no/tests/weigh.test.ts …/request-rows/tests/summary-with-also-in-result.test.ts`

```
× … > step 0056 is wholly refuted: the rows it grants came back are no reason of its own
× … > step 0057 is wholly refuted: the rows it grants came back are no reason of its own
× … > has both calls asked once more with Core's findings
× … > is refuted beside any wording of the grant alone
× the left-out rows Core settled > are never also listed as in the result: settlement already accounts for them
× the left-out rows Core settled > leave the unsettled copies listed, with a sentence saying …
AssertionError: expected { wholly: false, …(1) } to deeply equal { wholly: true, …(1) }
AssertionError: expected undefined to deeply equal [ 1, 2 ]
AssertionError: expected false to be true // Object.is equality
AssertionError: expected { number: 1, …(8) } to not have property "leftOutAlsoInResult"
AssertionError: expected [ …(4) ] to deeply equal [ …(2) ]
      Tests  6 failed | 16 passed (22)
```

The guard cases (where a no still stands) passed before and after, as they should.

## Commands run and observed results

- **Replay of the real run.** This was a scratch test, deleted afterwards. It read `steps/0056-judge/request.json` (instructions and resultSummary, with the judge-copy keys `leftOutAlsoInResult` and `alsoInResult` stripped) and both `decision.json` answers.
  - Before the fix: `WEIGHED {"wholly":false,"findings":["Core's read saw \"Tidemark Paper Towels, 12 Mega Rolls\", and only condition 1 (sponsored is absent) left it out: …"]}` for both calls.
  - After the fix: `REPLAY WEIGHED {"wholly":true,…}` twice, `REPLAY AGREEMENT refutedNo.calls [1,2]`, and `REPLAY JUDGE COPY c1 leftOutAlsoInResult: false`.
- `cd packages/fluxiq && npx vitest run src/programs/automation-studio/runtime/result-verification` printed `Test Files 129 passed (129)`, `Tests 1077 passed (1077)`.
- `pnpm --filter fluxiq check` (from Core's root) exited 0. Output: `{"build-cache":"build","step":"fluxiq:check",…,"ms":44102,…}`.
- `node scripts/structure-audit.mjs` (from Core's root) exited 0 and printed `structure-audit: passed (401 warning(s), 1154 baselined).` The only nearby warning is the existing `scripts/structure-audit/rules/` advisory. An earlier run failed on 3 violations from my first layout (an `as never` cast, and `refuted-no/` plus its `tests/` past 25 files). The next layout failed on 2 depth-limit violations. Both are fixed by the layout above.

## Not verified

- What the re-asked judges answer. `verify.ts` re-asks each call with Core's finding (`reask.ts`); I did not exercise that live or with a scripted provider for this shape. A no that is still refuted after the re-ask becomes unsure, not a yes. So the run reaches "verified" only if both re-asks say yes.
- No live Lab run, and no Core build. The dist the live run uses does not contain this change until the supervisor rebuilds.
- The global judge instruction in `runtime/llm/diagnosis-instructions.ts` was not changed (it is outside the brief's directory). Its sentence about leftOutAlsoInResult rows still holds after the change.

## Open questions or contradictions found

- Adding `wrong(?:ly)?` to `NEGATIVE` changes behaviour beyond the brief. A sentence with no claims that says "wrongly" of something it names now stands where it did not before. All 1077 tests pass with it. Remove it if unwanted, but then the clause removal can drop a "wrongly" complaint about a condition.
- Line endings: Python's text mode wrote CRLF, which I normalised back to LF in the files I edited. The index stores LF (`i/lf`), so the diff is content only (`git diff --stat`: 7 files, +163/−11, before the final weigh.test.ts additions). Git may warn "LF will be replaced by CRLF" in this checkout.
