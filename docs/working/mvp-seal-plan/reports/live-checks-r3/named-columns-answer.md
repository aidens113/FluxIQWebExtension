# Named columns in the answer-first result (run-mwb2kkv5-1baeee11)

## Outcome

Partial. The fix is done and tested in the owned files (Core answer-first `rows/`). It takes effect live only once one property is added to `attempt/run-attempt.ts`, which this brief does not let me edit. The exact line is given below. A second, deeper drift sits in `runtime/llm/node-tools/replay/replay.ts`, also outside my paths; it is described below but not changed.

All paths below are in Core: `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ/packages/fluxiq/src`. Abbreviations: `af` is `framework/automation-service/service/answer-first`, and `boot` is `runtime/flow-authoring/bootstrap`.

## Trace

### (a) Where Core decides the declared and named columns

- **Reading the person's words.** `boot/answerability/instruction-columns.ts:71` (`automationStudioFlowBootstrapInstructionColumns`). This run's request gives exactly `["name","price","rating"]`. The full stop in "$12.97" ends the scan, and the `,` after "and rating" closes the list. A test pins this.
- **Matching names to a read's fields.** `boot/authoring/instruction-record-columns.ts:50-71`. A name matches a field exactly, or with case and separators ignored.
- **Assembly declares them in the saved Flow.** `boot/authoring/normalise.ts:111-125` passes `namedColumns` into `boot/authoring/assembled-record-output.ts:51-102`. That code sets the extraction's record-output schema to the matched named columns (lines 69-86).
- **The domain narrows the saved read to that schema.** Downstream `domain/src/output-nodes/extract-list/declared-columns.ts:108-134` does the narrowing. `domain/src/runtime/llm-evidence/plan-resolution/extraction/run-record-output.ts:43-51` writes note 0075 ("A saved read drops a column ... link"). So the saved Flow holds name, price and rating.

### (b) Where the result and the shown rows take their columns, and why they missed the declared set

- **What the chat shows.** `packages/ui-components/src/chat/answer/model/rows-model.ts:20-21` renders `result.rows.columns` and `previewRows`.
- **Where the result's rows come from.** `af/attempt/keep.ts:77-82` (`rowsOf`) copies them from the sink's summary. `af/attempt/ending.ts:45,53` calls `run.sink.readBack()` and passes the result to `automationStudioAnswerFirstResultAs`.
- **What the judge reads.** The judge gets the same read-back, through `af/attempt/run-attempt.ts:186` (`rows: () => sink.readBack()`).
- **Where the sink sets the columns.** In `af/rows/row-sink.ts`, `summary()` and `readBack()` take the columns from the read's schema, or from its `process.columns` when it declares any (`summary` at :195, `readBack` at :337-363).
  - A read the model ran gets a schema made from its own rows (`derived-schema.ts`).
  - A saved Flow's run gets the batch's schema and processing (`recordBatch`).
- **Why the declared set was missed, in two parts:**
  1. **The sink never knew the person's columns.** It is built at `af/attempt/run-attempt.ts:163` with `runId`, `readRowsKey`, `onRecordBatch` and `reader` only. Nothing in the answer-first result path read the named columns.
  2. **The replayed read was declared without them.** This run's 16 rows came from `core.run_flow` (steps 0061-0069). Its replayed read 0066 carried a record output declaring `name, price, rating, link`, with titleised labels and label = node id. The model's own read calls (0019, 0026, 0028) wrote no record output. So the record output was derived by `runtime/llm/node-tools/replay/replay.ts:266-289` (`assembledRecordOutput`). That function calls the same `automationStudioFlowBootstrapAssembledRecordOutput` that assembly uses, but without `namedColumns` (compare `normalise.ts:121`). The test's dataset and the saved Flow's dataset therefore drift apart, which that module's own header says must not happen.

### (c) Whether the judge is told the named columns

- **What it is told.** Only as part of the request's text (judge request 0074, line 289: "Give me a table with columns name, price and rating ...").
- **What it saw.** `recordSets[0].columns: name, price, rating, link` (lines 311-315).
- **No check exists for extra columns.** Nothing in the flow-less prompt, and no Core fact, says that a column the request does not name is a defect. `runtime/result-verification/computed-facts/columns.ts:56-79` checks only for named columns that are missing or empty.
- **The fix covers the run's case.** Once the sink is wired, the judge reads the projected read-back, so it sees exactly the columns the person sees. No judge change is needed for this run's shape.
- **Proposal for the remaining case, not implemented.** The remaining case is a named column that no stored column matches, where nothing is projected. Add one information sentence to the flow-less result summary, built from the same reader. The words are generic:

  > "The request names the columns its answer holds: <names>. A column a record set holds that the request does not name was not asked for, unless it is one of the named columns under another name."

  This would make the judge stricter only about columns. I did not add it: in that case Core cannot itself tell whether an extra column is a named one under another name ("url" read as `link`).

## What changed and why

- **`af/rows/row-sink.ts`**
  - New private `askedColumns`, `closedNames` and `namedColumnsOf` (:380-410).
  - Reads the named columns once from `input.instructionText` (:157).
  - Applies them to a model read's declared processing (:251).
  - Applies them to a saved run's batch processing (:298-300), storing the batch with that processing.
  - Header paragraph "The columns the person named are the answer's".
  - **Rule.** A read or batch that declares no `process.columns` gets `columns` set to the named columns, in the person's order, when every named column matches a stored column. Matching is exact, then with case and separators ignored. A closing list item that ran on is closed as assembly closes it. A `where` field the processing names is kept shown, because the contract refuses a `where` over a dropped column.
  - **Nothing changes when:**
    - there is no instruction;
    - the instruction names no columns;
    - any named column matches no stored column (never drop an asked-for column);
    - the processing declares its own `columns`;
    - the named columns are already every stored column, in order;
    - the contract would not accept the result.
  - **Why `process.columns`.** It is the existing way a record output says which columns are its answer. The store, the summary and the read-back already honour it.
- **`af/rows/sink-input.ts`.** New optional `instructionText`.
- **`af/rows/tests/named-columns.test.ts`** (new, 10 tests).
  - This run's shape on both paths: a run's batches, and the model's own reads.
  - "Nothing changes when no column is named", checked as deep equality against a sink given no instruction.
  - An unmatched name, a read's own `columns`, case and separator matching, a `where` field kept, all-stored-columns, and a closing item that ran on.
- **`af/rows/tests/row-sink-real-store.test.ts`.** One new real-SQL test. Collected rows keep `link`. The read-back while the attempt is open and the processed page both serve `title, price`.
- **Where the full read stays available.** This follows the existing `process.columns` design:
  - The collected rows in `run_dataset_rows` keep every column, `link` included.
  - Once processed, the store's page and its CSV/JSON export serve the answer rows. See `framework/persistence/automation/project/run-dataset-store.ts:343-344` and `:522`, and `run-dataset-answer/answer.ts`. The export therefore shows the named columns, exactly as for any record output that declares `columns`.
  - Each read's own rows in `readPages`, which the judge is told, are unchanged.
- **Behaviour the contract brings with it.** When `columns` is set, the default dedupe key becomes those columns (`contracts/src/record-sets/process/process-rows.ts:10-12, 99-100`). Two rows identical in every shown column are now shown once. A saved Flow behaves the same way, because the domain narrows its schema.
- **Why the logic is private inside `row-sink.ts`.**
  - `rows/` is at the audit's 25-file limit; a 26th file failed `directory-files`.
  - A subdirectory under `rows/` breaks the 9-segment depth limit; this failed `naming`.
  - A new `answer-first/` sibling directory is outside my paths.
  - `authoringInstructionRecordColumns` is deliberately unpublished, and a deep import is ratcheted, so the small matcher is mirrored from `boot/authoring/keys.ts`.
  - As a result, `row-sink.ts` grew from 400 to 456 lines: a new advisory warning (the hard limit is 800).

## Exact changes needed outside my paths

1. **`af/attempt/run-attempt.ts:163-165`. Required for the fix to work live.** In the `automationStudioAnswerFirstRowSink({ ... })` call, after `readRowsKey: input.binding?.readRowsKey,`, add:
   ```ts
       // The columns the person names are the result's (`../rows/row-sink.ts`, run-mwb2kkv5-1baeee11).
       instructionText: input.instructionText,
   ```
   (`input.instructionText` is a `string`, per `attempt/contracts.ts:55`.)
2. **`runtime/llm/node-tools/replay/replay.ts:266-289`. Recommended, to fix the replay/Flow drift.** `assembledRecordOutput` should pass `namedColumns` to `automationStudioFlowBootstrapAssembledRecordOutput`, as `normalise.ts:121` does. That needs the instruction's columns threaded in beside `partOf`, through `automationStudioNodeReplayStepCall` and `automationStudioNodeReplayVerifyCall` (:194, :222) and their callers in `replay/span.ts:357` and `replay/draft.ts`. A replayed read would then declare the same schema as the saved Flow. Change 1 makes the answer right either way.

## Commands run and observed results

All Core commands ran in `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ`. Vitest commands ran in `packages/fluxiq`.

- **New tests:** `npx vitest run .../rows/tests/named-columns.test.ts`, final version, gave 10 passed, exit 0. Before that rewrite, `named-columns` (5 tests then), `row-sink-real-store` (6) and `row-sink` (14) together gave 25 passed, exit 0. The final versions of all three are part of the brief's set below.
- **Revert check, done twice.** I made `askedColumns` return the processing unchanged, then reran named-columns and real-store: exit 1, 6 failed and 10 passed. The failures were the saved run's three columns, the model's own read, case and separator matching, the `where` field, the closing item, and the real-store projection. The "no named column", "unmatched name", "own columns" and "already every column" tests passed either way, as intended. The fix was then restored; a grep for the marker found nothing.
- **The brief's vitest set:** `npx vitest run src/framework/automation-service/service/answer-first/rows .../attempt .../attempt-store .../tests src/runtime/result-verification` gave 281 files and 2160 tests passed, exit 0. This is the final code.
- **Typecheck:** `pnpm --filter fluxiq check` exited 0 on the final code. One earlier run failed with an `exactOptionalPropertyTypes` error on the batch spread, which I fixed.
- **Structure audit:** `pnpm structure:check` printed "structure-audit: passed (529 warning(s), 969 baselined)", exit 0. The only warning on a touched file is `row-sink.ts: 456 lines is past the 400-line advisory threshold` (it was 400 at HEAD). Earlier attempts failed on `directory-files` with 26 files, then on `naming` with depth 10; the restructure above fixed both.

## Not verified

- **No live, Lab or paid run.** Nothing confirms the chat answer or the Lab's scoring live. That needs change 1 and a rerun.
- **The live path is not wired.** No test drives `runAutomationStudioAnswerFirstAttempt` end to end with `instructionText`, because `run-attempt.ts` does not pass it yet.
- **Not checked live:** the carry-on copy path (`copied-rows.ts`). It copies `previewRows`, which are already projected; by the code, the named columns then equal the stored columns and nothing changes.
- **Not run:** the extension's or Lab's own checks.

## Open questions or contradictions found

- **The saved Flow drops more than the answer does.** Assembly declares the matched named columns even when some named column is unmatched (`assembled-record-output.ts:79,92-99`), so a saved Flow can drop a column the person asked for under another name. The answer-first projection does not project in that case. Should assembly follow the same "all or nothing" rule?
- **The replay/Flow drift is a defect of its own** (change 2 above): "Two derivations would drift" (`assembled-record-output.ts` header).
- **`rows/` has no room.** It is at the 25-file limit and cannot hold a subdirectory. A later split, such as moving the session files to `answer-first/session/`, would let the named-columns rule be its own module and bring `row-sink.ts` back under 400 lines.
