# t511 Core half: judges see how values were read

Tree: Core `fxwork/t511/!FluxIQ`, branch `task/t511-no-effect-press-and-judge-values`. Nothing committed.

## Outcome

Done. A run summary (the one the trial judge and the finished-run judge get) now says how Core read the values its conditions and sort compared:

- **Goal 1 (bounds).** Each read condition, and each saved-answer (`recordOutput.process.where`) condition, gets `valuesRead`. A bound says what number it read, on up to 4 kept rows and up to 4 left-out rows, for example `left out "Systems Engineer": salary read as 72 from "£72k – £80k per annum"`. Each record set with a `process.sort` gets `sortRead`, one entry per key: `{ field, inOrder?, said }`. For the first key, `inOrder` is Core's own check of the rows shown. `said` reads, for example: `Core sorts this answer by posted, newest first, reading posted as a date: 3 of 3 rows state one. The rows above are in that order. Read: "Today" as 2026-10-13; "Posted 3 days ago" as 2026-10-10; ...` (at most 4 readings, then "and N more rows").
- **Goal 2 (text).** For a text test (matches, contains, startsWith, endsWith), each kept row says which part of its text the test found, and the whole word when the match sits inside a longer one: `kept "Trust & Safety Engineer": title "Trust & Safety Engineer" matched "rust" inside the word "Trust" (matches "Rust")`. For a `not` test, the left-out rows say this instead.
- **Goal 3.** When two judges both said no, `agreement.ts` now marks a reading as contradicted if it denies the order of a sorted column that every record set's `sortRead` says is in order. This follows the t501 paging pattern. The label is `Judge call N (contradicted by Core's record: Core sorted the answer itself, and its sortRead says ...)`. The reading must name the sorted column, so a claim about a different column is never marked. The t503 unsure re-ask (`contradictedUnsure`) is still paging-only; see the open questions.
- **Goal 4.** All new model-facing words are generic and use no scenario words. No prompt or pinned text changed, and the budget tests pass unchanged.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/`.

- **New `value-readings/`:**
  - `text-match.ts`: finds the part of the text a test found, using Core's own `automationStudioRecordConditionPattern`, or a case-blind search for literal tests.
  - `condition-readings.ts`: builds the bounded per-condition lines and exports `AUTOMATION_STUDIO_RESULT_READINGS_PER_SIDE = 4`.
  - `sort-reading.ts`: reads each sort key with the contracts readers (`automationStudioRecordAutoSortKind`, `readAutomationStudioRecordSortValue`) and checks the order. A key is skipped if any row holds its column withheld.
  - `record-outputs.ts`: finds a step's `datasetId` and `process` by what the parameters hold, not by key name.
  - `summary-readings.ts`: sets `valuesRead` and `sortRead` on the summary. It uses only rows the summary already screened (`sampleRows`, plus each condition's `leftOutOnlyByThis` "label — column: value"). It parses the authored condition with Core's `parseAutomationStudioRecordCondition`; a spelling only the domain reads is skipped.
  - `order-claim.ts`: the generic order-denial words plus the check against `sortRead`.
  - `index.ts`: the barrel.
- **`result-summary.ts`:** calls the readings after reads and record sets are built. New optional input `now`; it defaults to `Date.now()` and anchors relative dates.
- **`agreement.ts`:** new optional input `recordSets`. `bothReadings` gives each contradicted reading its own label: the paging label as before, or the new order label.
- **`verify.ts`:** passes `recordSets: request.summary.recordSets` into the agreement.
- **`contracts.ts`:** read condition type gains `valuesRead?: string[]`. To stay under the 800-line structure limit (it was 799 lines), `AutomationStudioResultRecordSetSummary` moved, unchanged apart from the new `sortRead`, to the new `record-set-summary.ts` together with `AutomationStudioResultSortRead`. Both are re-exported from `contracts.ts`, so no import changes elsewhere.
- **`processing-account.ts`:** processing condition type gains `valuesRead?: string[]`.
- **`read-account/read-parameters.ts`:** new file. The private `readParameters` was taken out of `accounts.ts` so the readings can reuse it; `accounts.ts` now imports it, with no change in behaviour. Exported from the `read-account/index.ts` barrel.
- **Tests:**
  - New `value-readings/tests/condition-readings.test.ts` (6 tests), `sort-reading.test.ts` (4 tests) and `summary-readings.test.ts` (4 end-to-end tests through `summarizeAutomationStudioRunResult`).
  - `tests/agreement-both-readings.test.ts` gains 2 order-claim tests.
  - The end-to-end tests were first one new file in `tests/`, but that put the directory one over its 25-file structure limit. They were split as listed above.
- **Line endings:** edited files were brought back to CRLF to match the tree.

## Commands run and observed results

Commands ran from `packages/fluxiq` unless noted.

- **Fail-first.** I temporarily restored HEAD's `result-summary.ts` and `agreement.ts` (by copying, not with git commands), ran `npx vitest run .../tests/judge-sees-value-readings.test.ts`, then put my versions back. Result: `Tests 4 failed | 2 passed (6)`. The failures were the bound readings, the text match, the sort reading, and the order marking. The 2 that passed are the negative cases. Those tests now live in `value-readings/tests/summary-readings.test.ts` and `tests/agreement-both-readings.test.ts`.
- **Main test set.** `npx vitest run src/.../runtime/result-verification src/.../runtime/service/candidate-trial src/.../llm/harness-options/tests/bootstrap-completion.test.ts src/.../service/flow-bootstrap-commands/tests/build-judge.test.ts` gave `Test Files 77 passed (77)` and `Tests 743 passed (743)`. This includes `build-test/tests/request-size.test.ts`.
- **Extra check.** `npx vitest run src/.../runtime/recovery/annotation src/.../runtime/llm/deepseek` gave `Test Files 23 passed (23)` and `Tests 268 passed (268)`. This includes the system-prompt pins.
- **Typecheck.** `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` exited 0 with no output, on the final tree. An earlier run caught an `exactOptionalPropertyTypes` error in a test, which is fixed.
- **Structure audit.** `node scripts/structure-audit.mjs`, run from the repo root, printed `structure-audit: passed (340 warning(s), 1159 baselined)`. Before the fixes above it printed 2 FAILs: `tests/` had 26 files, and `contracts.ts` had 824 lines.

## Not verified

- **No live test.** No Lab, provider or live judge run. Whether judges actually stop making the false sort and regex claims has not been tested.
- **Not replayed on the real run.** The readings were not run on the stored `run-mv6qr7fk-77f30b49` request. That request's `flowShape` holds screened parameters (`{count, items}`), not the raw `parameterValues` the code reads. The tests use the same shape of Flow (a read with `where` and a `recordOutput.process.sort`) with raw arrays.
- **Interaction with t510.** Not checked against t510's number reader. The tests take their expected numbers from `readAutomationStudioRecordNumber` itself, so they hold whatever t510 changes.
- **Build-test path.** The build-test judge (`build-test/summary.ts`, `readRows`) was not given readings. Its summary is built with `recordSets: []`, so nothing is added there.

## Open questions or contradictions found

1. **The judge instruction does not name the new fields.** `AUTOMATION_STUDIO_RESULT_VERIFICATION_INSTRUCTION` in `llm/diagnosis-instructions.ts`, which I don't own, lists the summary's fields but not `valuesRead` or `sortRead`. I wrote the new text to explain itself ("Core sorts this answer by ...", "read as ... from ..."). One sentence in the instruction would help further. That changes pinned text (`llm/deepseek/tests/system-prompt-pins.json`), so it is the supervisor's call.
2. **The row cap conflicts with a user rule.** The brief asked for a bounded number of rows (4 per side). The user's rule of 2026-09-30, "no limits on elements passed to model", is quoted in `read-account/accounts.ts`. The values themselves are still shown whole elsewhere; only Core's readings of them are capped. The cap is `AUTOMATION_STUDIO_RESULT_READINGS_PER_SIDE` if it should be raised.
3. **The order marking covers only a double no.** The t503 re-ask (`contradictedUnsure`, `recheckWords`) still reacts only to paging. Extending it to order claims needs its own recheck wording, and probably a new field on `contradictedUnsure`.
4. **Baseline.** The structure audit says "2 baseline entries can be lowered". I did not run `pnpm structure:baseline`; `.structure-baseline.json` is not mine to edit.
