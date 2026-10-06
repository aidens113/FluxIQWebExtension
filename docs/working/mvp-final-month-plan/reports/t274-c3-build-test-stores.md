# t274-c3: a build's test judge sees what the Flow would store

Worker report. Core tree `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQ`. RT = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

**Partial.** Item 1 is done and tested. Item 3 (the prompt sentences) is below. Item 2 is done on the card side and tested there, but it **does not show live yet**. The card reads its count from `outcome.observation`. For a build test, `RT/result-verification/verdict.ts` (`automationStudioResultObservation`) still writes that as "0 records stored", and I may not edit that file. The exact two-line change for it is in "Open questions" below. Until someone applies it, a build test's card still says "No rows came back."

## What changed and why

- **`RT/result-verification/build-test/stores.ts`** (new) adds `automationStudioBuildTestStores({ steps, nodes, answers, deniedEvidenceKeys })`. It returns one entry per dataset, in Flow order: `{ dataset, writeMode, steps, rows, labels, repeated? }`.
  - **Matching steps to nodes.** Each proposed step's node is the next plan node whose `definitionId` equals the step's `actionId`, skipping only routing nodes (`builtin.control.merge`, `builtin.control.for-each`). This is the rule `llm/node-tools/draft-from-flow.ts` (`planKeys`) already uses. The caller (`service/flow-bootstrap-commands/build-judge.ts`) passes only `planNodes(plan)`, not the assembler's `draftStepIdByNodeKey`, so the mapping has to be rebuilt here.
  - **What counts as storing.** A step stores when its node's `parameterValues` hold a record output: an object with a non-empty string `datasetId`. That is Core's contract shape, not a domain parameter name. The write mode is the output's own, or the contract's default `append`.
  - **Rows and labels.** For each answer the test gave that step (one per pass of a repeat), the rows are screened by `automationStudioBuildTestReadRows`, the same screen `read-rows.ts` uses. A locator-shaped label is also withheld, because the request evidence check refuses any locator in `buildTest`. `rowsNotShown` is added to `rows`. A `replace` clears what the dataset held before, which is what `storage/project/run-dataset-store.ts` does.
  - **Write modes.** When every step agrees, `writeMode` is that one word. When they differ, it lists each step's mode, e.g. "append at step 6, replace at step 7".
  - **Repeats.** `repeated` lists the labels that occur more than once, each once, in the order first seen. The withheld word is never counted as a repeat.
  - **No caps.**
- **`RT/result-verification/build-test/stored-words.ts`** (new) adds `automationStudioBuildTestStoredWords(stores)`, which returns e.g. "30 records would be stored". It is the observation head that `verdict.ts` should use for a build test.
- **`RT/result-verification/build-test/summary.ts`** sets `buildTest.stores`, but only when three things hold: denied keys are declared, a test report exists, and `input.nodes` is non-empty. Without the nodes or a test, what the Flow would store is unknown, which is different from "nothing". A withheld label sets `withheld`. The header comment gained a `stores` bullet. `recordSets: []` and `totalRecordCount: 0` are unchanged, because the test still stored nothing.
- **`RT/result-verification/build-test/index.ts`** now exports `stores.ts` and `stored-words.ts`, and its comment is updated.
- **`RT/result-verification/contracts.ts`** adds `AutomationStudioBuildTestStore` and `stores?` on `AutomationStudioBuildTestAccount`. I did not touch `leftOutNamingTheItem` or `checked`, which another worker had already added there.
- **`RT/result-verification/check-words.ts`**: a new `WOULD_STORE` pattern (`N records would be stored`) is checked before `STORED`. It produces "N rows would be stored." / "1 row would be stored." / "No rows would be stored." The header and doc comment are updated.
- **Tests added:**
  - `build-test/tests/stores.test.ts`: 7 tests covering run-muw60j7c's exact shape, a read that stores nothing, `rowsNotShown`, two datasets, `replace`, withheld labels, and the cases with no nodes or no test.
  - `build-test/tests/stored-words.test.ts`: 2 tests.
  - `tests/check-words.test.ts`: 3 tests.

## Commands run and observed results

**Fail-first, before any source change**, from `packages/fluxiq`:

`pnpm.cmd exec vitest run src/programs/automation-studio/runtime/result-verification/build-test/tests/stores.test.ts` reported 7 tests, 6 failed. The run-shape test failed as follows:

```
× ... > run-muw60j7c's two reads into one dataset: 30 rows, every label in order, the three stored twice
  → expected undefined to deeply equal [ { …(6) } ]
  (expected: dataset "web.output.dom-extract_list", rows 30, labels = 20 page-one + 10 filtered,
   repeated = ["Trevio T5 Wireless Earbuds, Ivory", "Soundcrest Air Lite Wireless Earbuds", "Kova Beat Mini Wireless Earbuds, Black"])
```

The 7th test, which checks that nothing is said when there are no nodes or no test, passed already, as expected.

`check-words.test.ts` before the change: 2 of 3 failed.

```
expected 'The result was judged to answer the r…' to be '30 rows would be stored. The result w…'
Received: "The result was judged to answer the request."
```

**After the change:**

- The same three files: `Test Files 3 passed (3)`, `Tests 12 passed (12)`.
- `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/result-verification/` printed `Test Files 3 failed | 34 passed (37)`, `Tests 349 passed (349)`. All three failures are suites that would not load, in another worker's untracked in-progress files: `tests/judge-accounts-for-rows.test.ts`, `request-rows/tests/checked-rows.test.ts` and `request-rows/tests/left-out-naming-the-item.test.ts`. Each failed with "Failed to load url ../request-rows/index.ts" or "../index.ts", because `request-rows/index.ts` did not exist yet. No test in my files failed.
- `pnpm.cmd run check` (tsc): my first run had 2 errors in my `stores.test.ts` (`TWICE[0]` typed `string | undefined`), which I fixed. The final run's only error is in a file I do not own: `src/programs/automation-studio/runtime/result-verification/tests/judge-accounts-for-rows.test.ts(103,47): error TS2339: Property 'checked' does not exist on type ...` (another worker's file), exit code 2. My files have no tsc errors.
- `node scripts/structure-audit.mjs` (Core root, extra): `1 violation(s) across 1 rule(s)`. The violation is `[imports]` in `runtime/tests/refuted-result/tests/carried-steps-as-saved.test.ts`, which is not mine. There are advisory warnings only for `build-test/summary.ts` (447 lines; 432 before) and `contracts.ts` (650 lines, which includes the other worker's additions).

## Not verified

- The card end to end (verify → `said` → activity) for a build test: it needs the `verdict.ts` change below.
- Live behaviour: no Lab run.
- **A read whose node writes no record output.** The web domain derives a dataset at dispatch (`domain/src/output-nodes/extract-list/derived-record-output.ts`), and Core cannot see that id, so such a read is left out of `stores`. Core's authoring writes a record output when the instruction names columns. run-muw60j7c's nodes `s6` and `s7` both carried one (`snapshots/flow-lane.json`). When the model writes none and the instruction names no columns, `stores` leaves that read out. Closing the gap needs either the registry or `draftStepIdByNodeKey` plus the derived ids from the caller.
- **Core's `builtin.data.write-records` node.** It stores rows it is handed, not rows it reads, so its entry would count 0 rows from this test.

## Open questions or contradictions found

1. **`verdict.ts` change needed for item 2** (must-not-touch for me). In `automationStudioResultObservation`, replace the first and third lines:

```ts
  const tested = summary.buildTest?.stores;
  const stored = tested ? automationStudioBuildTestStoredWords(tested) : `${summary.totalRecordCount} record${summary.totalRecordCount === 1 ? "" : "s"} stored`;
  const refused = summary.totalRefusedCount > 0 ? `, ${summary.totalRefusedCount} refused by record validation` : "";
  const sets = tested ? `, in ${tested.length} dataset${tested.length === 1 ? "" : "s"}` : `, across ${summary.recordSetCount} record set${summary.recordSetCount === 1 ? "" : "s"}`;
```

   Add the import `import { automationStudioBuildTestStoredWords } from "./build-test/index.ts";`. The barrel is required, because the structure audit refuses a reach into another directory's file. This creates a module cycle: verdict → build-test barrel → judge.ts → verify.ts → verdict. It is used only inside functions at call time, so ESM resolves it, but run the `result-verification/` tests after applying it. The observation also becomes the failure record's `actual` and the repair's input, and "30 records would be stored, in 1 dataset" is true where "0 records stored" misled.

2. `build-test/judge.ts` line 183 still reports `records.stored = summary.totalRecordCount` (0) in the build verdict's findings. That file is not mine. Decide whether it should carry the would-store count.

3. **Prompt (item 3)**, for whoever owns `RT/llm/diagnosis-instructions.ts`. The `system-prompt-pins.json` pin will need updating with it.

   Replace the clause `and stored nothing, so judge from buildTest.steps rather than from record sets` with exactly:

   > and stored nothing itself, so its record sets are empty; buildTest.stores is the answer the Flow would give: each dataset it would write, the steps that write it, writeMode (append adds to what earlier steps stored, replace clears it first), rows, the count those steps' reads returned in this test, labels, every row in the order it would be stored, and repeated, the labels it would store more than once. Judge buildTest.stores as the result, as you would a finished run's stored rows: answer no when it would store a row twice, a row the instructions leave out -- every row of a read that keeps everything it sees, stored beside a read that filters, is such a row -- or too few or no rows where the instructions ask for rows (a read with afterWithheld excepted, as below); and judge from buildTest.steps

   The sentence then continues unchanged: "whether the Flow does everything the instructions ask."

   One sentence for the comment block above it:

   > t274-c3 added `buildTest.stores` (`result-verification/build-test/stores.ts`; run `run-muw60j7c-bb7c9a62`, C-3): told the test "stored nothing", both judges read its result as empty and said yes while two reads appended 30 rows into one dataset, 20 of them an unfiltered page and 3 of them twice.
