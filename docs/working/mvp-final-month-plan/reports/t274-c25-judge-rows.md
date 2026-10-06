# t274-c25: a judge cannot pass rows that name the asked item, nor steer a repair with rows the result contradicts

Core tree: `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQ`. RT = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. All three tasks are implemented and tested against the rows recorded in live run `run-muw60j7c-bb7c9a62` (steps 0031 and 0039). The result-verification suite passes (37 files, 365 tests), and `pnpm run check` exits 0. Nothing was committed.

## What changed and why

New directory `RT/result-verification/request-rows/` (barrel `index.ts`, exported from `RT/result-verification/index.ts`):

- `words.ts` reads text into words: lower-cased, singular, punctuation dropped, split into segments at clause punctuation. It also reads ids, meaning runs of six or more characters that hold both letters and digits.
- `request-phrases.ts` reads the request into phrases: two or more consecutive words inside one clause, holding at least one word that is not an empty word. For a label it gives the request phrases it names, in order, taking the longest match at each place.
- `summary-reads.ts` turns the summary into per-read rows. For a build test it uses `buildTest.steps[].observed.readRows`. For a finished run it uses the stored rows from the record-set samples and each read's `conditions[].leftOutOnlyByThis`; a run's read counts as keeping every stored label that none of its own conditions left out alone. It also strips the `label — column: value` suffix. A condition counts as testing the label column (`testedLabel`) when every one of its rows has no suffix, which is the encoding `read-account/alone-rows.ts` documents.
- `left-out-naming-the-item.ts` implements Task 1. The item is the start shared by the first phrase of every kept row (at least 2 words, and itself a request phrase). Within a `testedLabel` condition, a row is flagged when its first phrase starts with the item, it names another request phrase after that, and it is not in the result. `summary-with-left-out-naming-the-item.ts` sets `leftOutNamingTheItem` on the judge's copy of the summary.
- `row-naming.ts` decides how a row can be named. A prefix counts if it is the shortest prefix of at least 4 words (or the whole label) that no other row of the read shares. An id counts if it comes from the label and no other row of the read holds it.
- `unaccounted-rows.ts` implements Task 2. It returns the flagged rows that the reply did not name; the reply is expected, observed, changed and summary text together.
- `checked-rows.ts` implements Task 3. It splits the judgement into sentences, with "e.g."-style abbreviations kept intact. Ids are matched as substrings against every stored cell, then against labels; an id that more than one row holds matches nothing. Distinguishing prefixes (at least 4 words) are matched against stored and left-out labels. A sentence calls a row left out if it contains left out / dropped / excluded / rejected / omitted / missing / filtered out. The output lines are:
  - for each named row that no condition left out alone, is in the result, and was called left out: `<label> (<id>) is in the result, although the check calls it left out: the check misread which rows were left out; advice resting on that reading is not supported.`
  - for each condition: `Read <node>|Step <n>: the condition "<c>" alone left out these rows the check names: <label> (<id>) (also in the result); ...`
  - Only matched labels and ids are copied from the judgement.

Edits in files I own:

- `verify.ts` (`askOnce`): adds `automationStudioResultSummaryWithLeftOutNamingTheItem` around the existing paging and unread-column wrappers, so both kinds of judge are shown it. The verdict now reads the run's own summary plus the same `leftOutNamingTheItem`; the observation is unchanged, because the judge's paging words are left out of it.
- `verdict.ts`:
  - A `yes` with unaccounted rows becomes `does_not_answer`. It keeps the `core.result.does_not_answer_request` code, which is what routes a refuted run to `recovery/refuted-result/reauthor.ts`. It carries a directive with the new finding, a fix line per condition, and `checked` lines naming the rows. No judgement prose is carried.
  - A real `no` now carries `repair.checked` from `automationStudioResultCheckedRows`.
- `repair-directive.ts`:
  - New finding code `result.left_out_naming_the_item`.
  - New optional inputs `leftOutUnaccounted` and `checked`.
  - Unaccounted findings and fix lines come first. Each one names Step/Read, the condition, the `item`, the `also` phrases and the rows. `checked` is carried through to the directive.
- `agreement.ts`: no change to the rules, because a downgraded yes is already `does_not_answer`. Asked again, two of them refute; next to a genuine yes the pair is `model_disagreed`. The only change is that `said()` describes a downgraded first answer for what it was.
- `build-test/judge.ts`: the `no` verdict gains an optional `checked?: string[]` copied from `outcome.repair.checked`. It is mapped like any other no, so the finding code appears in `findings`.

Tests (all new):

- `request-rows/tests/run-muw60j7c.ts`: a fixture generated from the run's `request.json` and `response.json`.
- `request-rows/tests/left-out-naming-the-item.test.ts` (5 tests)
- `request-rows/tests/checked-rows.test.ts` (5 tests)
- `tests/judge-accounts-for-rows.test.ts` (6 tests): the downgrade, a yes that names every row, a partial yes, the pair rule, the real build-test judge through real verify with a scripted provider, and real verify on the 0039 no.

## Sentences the judge needs (for whoever owns the prompt; I did not edit it)

- What it is: "resultSummary.leftOutNamingTheItem, where present, lists rows a condition alone left out, tested on the row's own label, whose label names first the phrase of the request every kept row names first (item), and another phrase of the request only after it (also): by their own words they are the item asked for, sold with or including something else."
- A yes must account for them: "Answer yes over such rows only if the request excludes each of them, and say so row by row: name each row, by enough of its label to tell it from the read's other rows or by an id it carries, and say why the request excludes it. A yes that does not name each of these rows is not taken as a yes."
- A no must name rows: "When you answer no, name the concrete rows that are wrong or missing, by their labels as the summary gives them or by an id they carry (such as a product number), and which condition or step left each out or kept it; do not say a row was left out unless it is absent from the stored rows."

## Commands run and observed results

- Fail-first, run before `request-rows/` existed (from `packages/fluxiq`): `pnpm.cmd exec vitest run .../request-rows/ .../tests/judge-accounts-for-rows.test.ts` failed with `Error: Failed to load url ../request-rows/index.ts ... Does the file exist?` (3 suites failed).
- Behavioural fail-first: a scratch test (since deleted) ran the current `verdict.ts` on a summary carrying this run's `leftOutNamingTheItem` and the 0031 yes reply. It failed with `AssertionError: expected 'answers' to be 'does_not_answer' // Object.is equality`. The `checked` assertions could not have passed before the change either, because `repair.checked` did not exist.
- `pnpm.cmd exec vitest run src/programs/automation-studio/runtime/result-verification/` -> `Test Files 37 passed (37)`, `Tests 365 passed (365)`.
- `pnpm.cmd run check` -> exit 0. The build-cache line read `"step":"fluxiq:check","reason":"no stamp; ..."`, then no errors.
- `node scripts/structure-audit.mjs` (repo root) -> `structure-audit: 1 violation(s)`. The violation is in `RT/tests/refuted-result/tests/carried-steps-as-saved.test.ts` (an `[imports]` reach into `../../../llm/loop-configuration.ts`). That file is not mine; another worker's untracked file. My files show only advisory warnings: the fixture is 411 lines with 10 exported values, `repair-directive.ts` is 444 lines, and `result-verification/tests/` holds 18 files.

## Not verified

- No live run or Lab run.
- Nothing reads the new `repair.checked` or the build-test `no.checked` yet. `recovery/refuted-result/brief.ts` reads `directive.fix` but not `checked`, and `flow-bootstrap/unfinished-build/judgement.ts` (`judgedWrong`) copies only `findings` codes, expected, observed and advice. So:
  - Task 3's lines and the downgrade's row lines reach a runtime re-author only through `fix`, which is in the failure record's `expected`.
  - They reach a build's repair only as the finding code.
  - Wiring `checked` through needs edits in `recovery/` and `flow-bootstrap/`, which I am barred from.
- `core-observation.ts` (`automationStudioResultFailureRecord`) does not include `checked` in the failure record either. That file is not mine.
- The phrase rule was tested only against this run's request and rows, plus the existing suites. Other wording could produce false flags; one example is a request phrase that happens to start a kept row before the item. In that case the item cannot be found and nothing is flagged, which errs toward no flag.

## Open questions or contradictions found

- B0FLQUDT3X and B0PXG323U8, named in the same judge sentence as B0J5MCMBAY and B07Z1RZGJG, are in the stored result (copied in by the unfiltered read s6), and the Plus condition really did leave them out alone. I report them under the Plus condition as "(also in the result)", not as misreadings. Only B0J5MCMBAY and B07Z1RZGJG are reported as misread.
- The brief says the re-author "discarded the exact 13-row answer it held"; the 0039 summary holds 30 rows. I did not look for the 13-row state; it was not needed for these rules.
- The judge's sentence "sponsored is absent excluded non-sponsored rows (B0DPN4ANC7, B0KRUNHK42)" is reported as fact: the sponsored condition did leave those rows out alone. Their stored urls are `sspa/click` ad links, so the judge's "non-sponsored" is probably wrong, but Core does not judge that.
