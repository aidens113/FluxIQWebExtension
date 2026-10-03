# t194-w55: the build-test judge sees a replayed read's rows

## Outcome

Done. When a list read is replayed, its answer now lists rows as well as giving the counts line. The judge of a
build's test gets those rows as screened labels in `buildTest.steps[].observed.readRows`:

- `rows`: the labels of the rows the read returned, at most 50, with `rowsNotShown` giving how many more there were.
- `leftOutOnlyByThis`: one entry for each condition that removed rows by itself, with that condition's rows.

Every label is screened by Core's runtime-judge function, `automationStudioResultReadAloneRows`. The replay now asks
the page for each condition's alone rows (`rejectedSamples: "alone"`), the same way a Flow's playback does.

Both judges also get one general sentence (C5): a row the request excludes is a row that *is* the excluded kind of
thing, not a row whose text only mentions it. Only the `loop_verification` pin moved.

## Judge text, before and after (run `muqk713g`'s read, step 8)

Before (counts only):

```json
{"ok":true,"code":"core.replay.replayed","said":"the step ran again: kept 10 rows from 5 pages, stopped on control_disabled; 94 items seen; per condition rejected (removed alone): ... name 20 (5)"}
```

After (the shape Core's test `build-test/tests/read-rows.test.ts` asserts, with run-15/16 labels):

```json
{"ok":true,"code":"core.replay.replayed","said":"the step ran again: kept 10 rows ...; per condition rejected (removed alone): price 40 (3), name 20 (2)",
 "readRows":{"rows":["Trevio T5 Wireless Earbuds, Ivory","Soundcrest Air Lite"],"rowsNotShown":8,
   "leftOutOnlyByThis":[{"condition":"price","rows":["Soundcrest Air Pro Max"]},
                        {"condition":"name","rows":["Lumo Audio Drift Pro Wireless Earbuds, Bluetooth 5.3, Wireless Charging Case, Touch Control, White","Aurelle Pods Fit Wireless Earbuds, Ivory with Wireless Charging Case"]}]}}
```

New instruction text (the `loop_verification` system prompt):

- In the result-verification instruction, after the `leftOutOnlyByThis` sentence: "A row the request excludes is one
  that is the excluded kind of thing, not one whose text only mentions it: an item sold with or including an excluded
  part is still the item."
- In the build-test instruction, after the `observed` sentence: "A replayed list read's observed may carry readRows:
  rows, the labels of the rows it returned (rowsNotShown more not listed), and readRows.leftOutOnlyByThis, per
  condition, the rows that condition alone left out, read as a read's leftOutOnlyByThis is above: none of them came
  back, and if the instructions ask for any of them, answer no and name that condition in changed."

The exclusion sentence appears only once. The `loop_verification` prompt joins both instructions, so it covers
`readRows` too. A comment in the source says so.

## What changed and why

### Core (`C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQ`, R = `packages/fluxiq/src/programs/automation-studio/runtime/`)

- `R/result-verification/build-test/read-rows.ts` (new): `AUTOMATION_STUDIO_BUILD_TEST_READ_ROWS_KEY = "readRows"` and
  `automationStudioBuildTestReadRows(value, deniedKeys)`.
  - It turns each one-column `{ column: label }` list into labels with
    `automationStudioResultReadAloneRows`, imported from `../read-account/index.ts`. The screening is reused, not
    copied.
  - A label from a denied column, or one shaped like a credential, becomes `(withheld)` and still counts as a row.
  - A malformed member is dropped, and the rest of the observation stays.
  - Condition names longer than 64 characters are dropped.
  - It returns `withheld: true` when a label was withheld.
- `R/result-verification/build-test/observation.ts`: the reader converts `readRows` *before* its own screening.
  Without that, `withoutKeys` would silently drop a denied column's record, and a single secret-shaped label would
  withhold the whole observation, counts included. `withheld` also counts a withheld label. Header updated.
- `R/result-verification/build-test/index.ts`: barrel exports `read-rows.ts`.
- `R/result-verification/build-test/summary.ts`: header comment only (the `observed` bullet names `readRows`).
- `R/llm/diagnosis-instructions.ts`: added the two sentences above and a comment for each.
- `R/llm/deepseek/tests/system-prompt-pins.json`: only `loop_verification` changed, by the same two inserts. The
  other nine pins do not contain this prose and are byte-identical.
- `R/llm/tests/diagnosis-channel.test.ts`: two new tests (the exclusion sentence; the prompt names `readRows` and
  `readRows.leftOutOnlyByThis`).
- `R/result-verification/build-test/tests/read-rows.test.ts` (new), with four tests:
  - labels for rows and alone rows, and the judge request passes Core's evidence pre-flight;
  - denied and secret labels become `(withheld)`, `said` is kept, and `summary.withheld` is true;
  - malformed members are dropped;
  - no `as step N` replacement inside the row lists.

### Downstream (`C:/Users/osrs_/FluxStuff/fxwork/t194/!FluxIQWebExtension`)

- `domain/src/output-nodes/extract-list/dispatch.ts`: new export `webAutomationExtractListAloneRowsAsked(parameters)`.
  It wraps the existing private `withAloneRowsAsked`, so the replay asks exactly the way the playback dispatch does.
  Header updated.
- `domain/src/runtime/llm-evidence/node-run/replay.ts`: `replayStep`, for `web.dom.extract_list`, sends the resolved
  parameters through that helper. A read with conditions asks for `rejectedSamples: "alone"`, and a Flow that already
  sets `rejectedSamples` is sent as it is. A `replayed` answer now carries `readRows(payload, where)`. Header updated.
- `domain/src/runtime/llm-evidence/node-run/replay-answer.ts`:
  - New `webNodeReplayReadRows(payload, where)`. It builds `readRows` from `payload.extracted` (rows) and from
    `extraction.rejectedSamples` with `rejectedSamplesAlone` (the leading alone rows for each condition).
  - Each row is `{ column: label }`. The label is the first value in field order that contains a letter and is not
    an address, otherwise the first value. This is the same rule as Core's `rowLabel` in
    `service/summaries/extraction-summary.ts`.
  - Columns this domain denies are never used as labels, and labels go through `screenedText`.
  - Each list holds at most 50 rows (`READ_ROWS_SHOWN`, not exported), plus `rowsNotShown`.
  - Conditions are named the same way the `said` line names them. That shared logic is now the helper
    `conditionNames`.
  - The answer type gains `readRows?`, built with `present<T>()`, which the structure audit's contract-spread rule
    requires.
- `domain/src/runtime/llm-evidence/node-run/tests/replay-read-account.test.ts`: four new tests.
  - A read with conditions asks for `"alone"` and names its rows and each condition's alone rows (run 16's Lumo and
    Aurelle labels).
  - The 50-row bound with `rowsNotShown: 3`, a card-number label withheld, and a read without conditions asks for
    nothing.
  - A Flow's own `rejectedSamples: false` is respected.
  - A step that is not a read has no `readRows`.

  I put these tests in this existing file because a new file made `node-run/tests/` hold 26 files, which fails the
  audit's 25-file limit.
- `domain/src/output-nodes/extract-list/tests/dispatch-alone-rows.test.ts`: one test for the new export.

## Commands run and observed results

- Core, failing first (before implementation), `npx vitest run .../build-test/tests/read-rows.test.ts .../llm/tests/diagnosis-channel.test.ts`:
  `Tests 6 failed | 4 passed (10)`. The read-rows tests failed because records were passed through whole, and the
  secret test failed because the whole observation was withheld. The 2 instruction tests failed because the strings
  were missing. The "no as step" guard already passed on the old code, as expected.
- Core, after, `heavy.sh "t194-w55 core vitest" npx vitest run $R/result-verification $R/llm/tests $R/llm/deepseek/tests`:
  `Test Files 54 passed (54)`, `Tests 664 passed (664)` (final run; an earlier run gave 657, before other workers added tests).
- Core `heavy.sh "t194-w55 core check" pnpm check` in `packages/fluxiq`:
  - The first run gave EXIT=2 with 14 `error TS`, all in `R/llm/node-tools/tests/{draft-from-flow,run-start-pages,step-place}.test.ts`.
    Those are another worker's files, edited at the same time; none are mine.
  - The rerun gave EXIT=0. The output says `"build-cache":"reuse" ... "inputs and outputs match the stamp"`, so a
    passing check was stamped for exactly the current inputs, which include my files.
- Core `node scripts/structure-audit.mjs`: `structure-audit: passed (218 warning(s), 349 baselined)`, and no warning
  names my files.
- Downstream `heavy.sh ... npx tsc --noEmit -p domain/tsconfig.json`: EXIT=0. `-p domain/tsconfig.test.json`: EXIT=0.
- Downstream narrow tests, `heavy.sh "t194-w55 tests" node .../t194/narrow-tests.mjs <tree>/domain t194-w55 runtime/llm-evidence output-nodes/extract-list`:
  `narrow: 115 test files`, `# tests 727`, `# pass 727`, `# fail 0`. New tests: `ok 23`, `ok 180`-`ok 183`. w50's
  `ok 178` still passes.
- Downstream failing first: I backed up my `replay.ts` and `replay-answer.ts`, put the `HEAD` versions in place
  (`git show HEAD:<path> > <path>`), and ran narrow `runtime/llm-evidence/node-run`. It gave `# tests 168`,
  `# pass 165`, `# fail 3` (`not ok 103/104/105`, the three new replay tests that need the change). I then restored my
  versions; `git diff --stat` shows them back (`replay-answer.ts` 106 lines changed, `replay.ts` 22).
- Downstream `node scripts/structure-audit.mjs`: `structure-audit: passed (158 warning(s), 118 baselined)`, and no
  warning names my files. An earlier run failed on `apps/extension/src/content/extraction/tests/` (26 files) and on
  `list-reader.ts` (821 lines). Both belong to another worker, and both were gone by the final run.

## Commit messages

Core:

```
Build-test judge sees a replayed read's rows and each condition's alone rows (t194 w55)

The build-test judge of live run muqk713g passed a read that kept 10 of 13
earbuds: a replayed read reached it as counts only. A replayed read's
answer now carries readRows (the rows it returned and, per condition, the
rows that condition alone left out), which the observation reader turns
into labels with the runtime judge's alone-rows screen before its own
screening. The judge instruction says what readRows is, and both judges are
told that a row the request excludes is the excluded kind of thing, not one
whose text only mentions it (C5). loop_verification re-pinned.

Task: t194
Worker: t194-w55
```

Downstream:

```
Replayed list read asks for and names its alone rows for the build-test judge (t194 w55)

A replayed extract_list with conditions now asks the page for the rows each
condition removed by itself, as a Flow's playback does
(webAutomationExtractListAloneRowsAsked), and its replayed answer carries
readRows: the labels of the rows it returned (at most 50, with how many
more) and each condition's alone rows, labelled by Core's first-text-column
rule, denied columns never a label, secrets withheld. Core screens them for
the judge of the build's test (live run muqk713g, C3).

Task: t194
Worker: t194-w55
```

## Not verified

- No live or Lab run, and no provider call (out of scope). I have not seen a real judge read `readRows` or the new
  sentence, so whether the build-test judge now answers no on run 16's read is unproven.
- The extension side of a replayed `"alone"` request was not exercised. It is w49's extension path, which the Flow
  playback already uses. The replay dispatches the same parameter through the gateway, which I tested with a mocked
  gateway only.
- The Core `pnpm check` pass is the build cache's stamp reuse for identical inputs, not a fresh `tsc` run in my
  session. My first fresh run failed only in another worker's files.
- I did not measure the judge request's size with real 50-row reads. Labels are whole titles, about 100 characters
  each, so a full list adds roughly 5 KB per list.

## Open questions or contradictions found

- **Bound versus "no limits".** The brief asked for a *bounded* sample of kept rows, and I bounded kept rows and each
  condition's alone rows at 50 each, with `rowsNotShown`. This conflicts with the user's standing "no limits on
  elements passed to the model" (quoted in `actions/extraction/rejected-samples.ts`), and the runtime judge gets
  every alone row. If the alone rows should be unbounded, `shown()`/`notShown()` in `replay-answer.ts` are the only
  place to change.
- **The label rule exists twice.** The rule is written in the domain (`replay-answer.ts` `labelled`) and in Core
  (`service/summaries/extraction-summary.ts` `rowLabel`, which is private and not my file). The screening is the
  shared one. To have a single rule, Core would need to export `rowLabel`, or the domain would need to send whole
  rows, and the brief ruled out new Core exports imported by the domain.
- The domain writes the literal `"readRows"`, and Core declares `AUTOMATION_STUDIO_BUILD_TEST_READ_ROWS_KEY`. They are
  paired by a comment and not by an import, as the brief required.
- `replayed` evidence also reaches the build model, not only the judge. It now carries row labels the model already
  saw while exploring. I judged that acceptable, and the replay header says so.
