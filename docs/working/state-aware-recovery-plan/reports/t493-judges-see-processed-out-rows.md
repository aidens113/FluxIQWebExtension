# t493 judges-see-processed-out-rows: worker report

Tree: Core `C:/Users/osrs_/FluxStuff/fxwork/t493/!FluxIQ`, branch `task/t493-judges-see-processed-out-rows`. Nothing committed.

## Outcome

**Done**, after the continuation brief.

- The first pass did F1 (goals 1 and 2), goal 4, the coordinator's `startView` placement, and the F2 comparison, and reported Partial: F2 needed `submission.ts`.
- The continuation extended my ownership to `flow-bootstrap/candidate/submission.ts`, `llm/diagnosis-instructions.ts` and the pins file. With that:
  - F2 is wired in.
  - The judge instruction now describes the dropped rows.
  - The legacy build-test path has been checked; candidate builds do not reach it (see "Continuation" below).

## What changed and why

### F1. Processing names, for each `where` condition, the rows it alone left out

These changes are in the contracts package (`packages/contracts/src/record-sets/process/`).

- **`types.ts`.** Adds two types:
  - `AutomationStudioRecordProcessingLeftOutRow`, which is `{ field, label }`.
  - `AutomationStudioRecordProcessingConditionAccount`, which is `{ field, condition, rejected, alone, leftOutOnlyByThis }`.

  `AutomationStudioRecordProcessingAccount` gains an optional `conditions`, with one entry per `where` condition. It is present only when the declaration has a `where`, so every existing account and assertion is unchanged.
- **`process-rows.ts`.** For each collected row, it records which conditions the row fails.
  - `rejected` counts the rows that fail this condition.
  - `alone` counts the rows that fail only this condition.
  - `leftOutOnlyByThis` names those rows, each label once, in capture order.
  - A row's label is its first stored column, in schema order, that holds text. This matches how `summary-reads.ts` labels stored rows.

  The rows are named with their label only, as the brief asks.

  "Bounded like the read's left-out lists": the read's lists have no numeric cap (user rule of 2026-09-30, "no limits"). Both are limited only to rows left out by one condition alone. Here the dataset's per-run row limit also bounds them.
- **`condition-text.ts` (new).** Exports `automationStudioRecordConditionText`, which gives a condition in words, for example `name not contains "Charging Case"`.

These changes are in Core (`packages/fluxiq/src/programs/automation-studio/runtime/`).

- **`result-verification/processing-account.ts` (new).** Exports `automationStudioResultProcessingAccount`. It turns the stored account into the copy the judge sees, and the judge-facing types `AutomationStudioResultProcessingCondition` and `AutomationStudioResultProcessingAccount` are defined here. It screens the same way stored rows are screened:
  - With no declaration, it keeps the counts only: no rows and no wording.
  - A label from a denied column, or one shaped like a credential, becomes `(withheld)`.
  - A condition on a denied column loses its wording.
  - Anything screened out sets `withheld`.

  It sets `testedLabel` when every named row is labelled by the column the condition tested.
- **`result-summary.ts`.** Uses that function in place of the old counts-only copy (the old line 401).
- **`result-verification/contracts.ts`.** `processing` is now typed as `AutomationStudioResultProcessingAccount`. The types live in `processing-account.ts` because putting them here took this file to 824 lines, over the audit's 800-line limit. It is now exactly 800.
- **`request-rows/summary-reads.ts`.** This extends the existing guard rather than adding a second one.
  - Each record set's processing conditions become conditions of the read whose passes collected the set (`processing.passes[].node`).
  - They are named `recordOutput.process.where <wording>`, so every finding and fix line says where to change them.
  - If no read account names that node, the set becomes a read of its own.
  - The flag (`left-out-naming-the-item.ts`), the check of a yes (`unaccounted-rows.ts`), the check of a no (`checked-rows*.ts`) and `verdict.ts` therefore treat rows dropped by processing exactly like rows the read left out. Nothing in `verdict.ts` changed.
- **`read-account/without-tested-label.ts` and `judge-paging.ts`.** The judge's copy, and the repair summary in `annotate.ts`, also remove `testedLabel` from processing conditions. `judge-paging.ts` used to return early when a summary had no reads; it now removes `testedLabel` first.
- **`service/candidate-trial/processed-out.ts` (new) and `feedback.ts`.** A judged trial's feedback now carries `stored.processedOut`: for each processing condition, its rows with the dataset, wording and counts, plus one sentence on how to read them. That sentence uses no scenario words: it says an item sold with an excluded part is still the item, and to change the condition that left out a wanted row.

### F2. The `datasetId` comparison (`flow-bootstrap/candidate/unchanged-submission.ts`)

`automationStudioCandidateSameBehaviour(a, b, options?)` now takes `{ datasetId: "set_aside" }`. The default still compares `datasetId`, so t485's rule is untouched. The header records the policy and the D2 evidence.

### Coordinator addition: `startView` first

- In `result-summary.ts`, and the same in `build-test/summary.ts`, `startView` is now serialised immediately after `schemaVersion`, before every per-trial count, row and step.
- Only the placement moved; no wording changed.
- Nothing else in the summary is reliably the same across trials. `flowShape` changes with each revision and carries per-run `changed` values. `startedWith` is appended later by `candidate-trial/summary.ts`, which is not my file.

## Continuation (coordinator, after the first report)

### 1. F2 is wired into `flow-bootstrap/candidate/submission.ts`

- The controller now keeps every revision it accepts this session (`accepted`).
- After the existing checks (same digest, reworded, a digest the judge refuted), a new private method `renamedRefuted` looks through the accepted revisions, newest first. It looks for one whose digest `history.refuted` names and that has the same behaviour once its `datasetId` is set aside (`automationStudioCandidateSameBehaviour(..., { datasetId: "set_aside" })`).
- If it finds one, the submission is refused through the existing `unchanged()` path. The result is `candidate.unchanged_after_no`, carrying the judge's finding under `judged`. No new revision is made, so there is nothing to trial, and whatever revision stood before stays current.
- The refusal now takes a `datasetRenamed` flag (`unchanged-submission.ts`). Its instruction says: "Nothing the Flow does changed: this is a Flow the judge already refuted with only where it saves its rows (its datasetId) renamed, which cannot change which rows it keeps, so it was not made a new revision".
- The comparison with an unrefuted revision is unchanged, so t485's rule stands.
- New controller-level tests in `flow-bootstrap/candidate/tests/unchanged-submission.test.ts` use a demo node with a `recordOutput` parameter:
  - **The round-14 sequence.** Revision 1 is accepted. Revision 2 changes the step text and stands. History marks revision 1 as refuted. Revision 1 resubmitted with `datasetId` renamed is answered `unchanged_after_no` with `judged`, the instruction contains "where it saves its rows", and revision 2 is still current. Before the wiring, this test failed: the rename was accepted with `ok: true`.
  - **The control.** The same rename with nothing refuted is accepted as revision 3.

### 2. Judge instruction (`llm/diagnosis-instructions.ts`) and pins

- The old processing clause was "... were left out or cut, and what each pass added."
- It now continues: "..., and in processing.conditions, for each where condition of the saved answer, the rows that condition alone left out (leftOutOnlyByThis, each by its label): none of them was stored, so read each against the request as you read a read's left-out rows, and answer yes over them only if the request excludes each one, naming each row and saying why the request excludes it."
- The text is abstract and uses no scenario words.
- `llm/deepseek/tests/system-prompt-pins.json` is updated by the same exact replacement in its two pins that carry this text, `loop_verification` and `loop_verification_build_test`.

### 3. The legacy build-test `stores.removed` path: candidate builds do not reach it

- `automationStudioBuildTestStores` is called only by `automationStudioBuildTestResultSummary` (`build-test/summary.ts`). That in turn is called only by `service/flow-bootstrap-commands/build-judge.ts`, the draft path's judge.
- In `runtime/service.ts` the candidate branch (`if (authoringMode === "candidate") {`, line 1558) returns at about line 1585, before `buildJudge` is created at line 1597.
- Candidate trials judge `automationStudioCandidateTrialSummary`, which is `summarizeAutomationStudioRunResult`, the run path that now carries the dropped rows. They only reuse the build-test *judge function*.
- So I left `stores.removed` counts-only, as the continuation allows.

## Commands run and observed results

**Continuation runs:**

- `npx vitest run` over these fluxiq directories:
  - `result-verification/{tests,request-rows/tests,read-account/tests,build-test/tests}`
  - `service/candidate-trial/tests`
  - `flow-bootstrap/candidate/tests`
  - `llm/deepseek/tests`
  - `llm/tests`

  It gave `Test Files 121 passed (121)`, `Tests 1352 passed (1352)`.
- Contracts `npx vitest run src/record-sets`: `Tests 121 passed (121)`.
- `pnpm check` (fluxiq) ran tsc and printed no errors.
- `pnpm structure:check` (Core root) reported no violations, only the existing note `2 baseline entries can be lowered`.

**First-pass runs:**

**Fail-first runs.** Each new test failed before its fix:

- Contracts process tests: `3 failed | 64 passed`.
- The fluxiq guard, verdict and summary tests: `5 failed | 32 passed`. This includes the round-14 shape: a yes over `filteredOut: 5` was taken.
- Trial feedback: `3 failed`, `automationStudioTrialProcessedOutFeedback is not a function`.
- `unchanged-submission`: `1 failed | 13 passed`.
- `startView` placement: put the old order back temporarily, saw `1 failed | 14 passed`, restored the file, saw `15 passed`.

**Runs after the fixes:**

- `npx vitest run src/record-sets` (contracts) gave `Test Files 12 passed (12)`, `Tests 121 passed (121)`.
- `pnpm --filter @fluxiq/contracts build` ran the cache build and stored 149 files. This was needed because fluxiq resolves contracts through `dist`.
- `npx vitest run` over these fluxiq directories:
  - `result-verification/{tests,request-rows/tests,read-account/tests,build-test/tests}`
  - `service/candidate-trial/tests`
  - `flow-bootstrap/candidate/tests`

  It gave `Test Files 84 passed (84)`, `Tests 777 passed (777)`.
- `pnpm --filter @fluxiq/contracts check` passed, with no tsc output.
- `pnpm check` in `packages/fluxiq` (the tsc typecheck) passed, with no tsc output.
- `pnpm structure:check` at the Core root:
  - The first run gave 2 violations, both mine: `as never` in the fixture, and `contracts.ts` at 824 lines.
  - After the fixes it reports no violations and only the existing note `2 baseline entries can be lowered`, which already appeared on the first run. `.structure-baseline.json` is not mine to change.

**The round-14 test.** `request-rows/tests/run-mv6bg8d8.ts` builds the set through the real `processAutomationStudioRecordRows` and `summarizeAutomationStudioRunResult`: 17 collected rows, 2 repeats, and `not contains "Ear Tips"` / `not contains "Charging Case"`. The result:

- The guard flags exactly the 3 earbuds and neither accessory.
- A yes saying "5 filtered out as accessories" becomes `does_not_answer`, and its finding, fix and checked lines name each row and the processing condition.
- `verifyAutomationStudioRunResult` sends the judge a request with those rows and no `testedLabel`.

## Not verified

- **No full suites, Lab or provider runs**, as the brief directs.
- **`llm/deepseek/tests/system-prompt-pins.json`**: no system-prompt text changed, so I did not run that test.
- **The downstream web extension**: not type-checked against the new optional `conditions` field.
- **The `run-dataset-store` path**: I traced that it JSON-stores the whole account, so `conditions` should persist. I did not run a store test that processes with a `where`, because that file is not mine.
- **The build-test path** (`build-test/stores.ts` `removed`) still carries counts only. Only the draft build reaches it, not candidate builds (see the continuation).
- **The trial-gate's own refusal of a test** for a renamed refuted Flow was not exercised. The submission is now refused before any revision exists, so there is nothing to test.

## Open questions or contradictions found

1. (Resolved in the continuation) F2 wiring and the judge instruction, both described above.
2. **Tested values left out.** Processed-out rows carry the label only, as the brief asks. Unlike a read's rows, they do not show `— field: value` for conditions on other columns. The debug's F1 proposed adding that value; adding it later would be a small change in `process-rows.ts` and `processing-account.ts`.
3. **`contracts.ts` is at exactly 800 lines**, the audit limit. The next addition there needs a split.
