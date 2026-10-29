# t790 / fix4: date bound in `where`, and a row-mark suggestion beside F3's note

Run cited: `run-mvswewhy-e4e469d4` (debug section 3, Fix 4).

## Outcome

Done. Both goals are built and tested. All structure-audit rules pass in both repositories, except one finding in another worker's file (see Open questions).

## What changed and why

### (a) Date bound in `where`

**The shape.** It reuses the existing bound keys, with a date written as text:
`{"field": "due", "atLeast": "2026-10-01", "as": "date"}`.
- `as` is optional and is checked: it must agree with the bounds.
- The canonical condition carries no `as`. A bound written as text is what marks a date bound, everywhere a condition is read.
- I chose this because the downstream plan resolver (`plan-resolution/extraction/conditions.ts`, not mine) copies conditions key by key through an exhaustive `present<T>()`. A canonical `as` would not compile there without editing that file. With this shape the resolver carries a date bound unchanged.

**How it behaves.**
- A bound counts as a date only if it names one date by itself: the year is written, it is not relative, and its day and month cannot be swapped. `2026-09-19`, `19 September 2026`, `Saturday 19 September 2026`, `Sep 19, 2026` and `19/09/2026` are accepted. `Sep 19`, `3 days ago`, `today` and `02/03/2026` are refused.
- A bound with no time of day covers that whole day: the row's own day is compared. So `atLeast` plus `atMost` keeps the days in between, both ends included.
- The row's date is read by the sort's date reader (`read-date.ts`). One exception: a numeric date whose day and month could be swapped (`02/03/2026`) counts as no date.
- An unparseable row date fails the condition whatever `not` says, so that row is never kept. The run-end account counts such rows (`undated`). Core's readings say "states no date Core can read". Settled-rows does not settle such rows, so a yes must still quote them row by row.
- An unparseable bound is refused at plan time:
  - In `recordOutput.process`, as `record_output.process_invalid_condition`, now with Core's own sentence. It names the field and how to write a bound, never the bound itself. The code was added to `AUTHORED_CODES`.
  - In `extractList.where`, the domain grammar refuses it at its key. The plan resolver turns that into `web.handle.malformed` at `where.N.atLeast`, and dispatch drops it.
- `automationStudioRecordConditionHolds(condition, cell, now = Date.now())`: the run-end processing passes its own `now`. The page judges at the moment it reads.

**Contracts** (`packages/contracts/src/record-sets/process/`):
- `processing-vocabulary.ts`: `AUTOMATION_STUDIO_RECORD_CONDITION_TYPES`.
- `types.ts`: `AutomationStudioRecordConditionBound`, `as?`, and `undated?` on the condition account.
- New files:
  - `compares-dates.ts` (`automationStudioRecordConditionComparesDates`)
  - `date-bound.ts` (`readAutomationStudioRecordConditionDateBound`)
  - `row-date.ts` (`readAutomationStudioRecordConditionDate`)
- Changed: `condition-holds.ts`, `parse-condition.ts`, `condition-text.ts` (wording `due atLeast "2026-10-01" as a date`), `process-rows.ts`, `index.ts`.
- Test: `tests/date-bound.test.ts`.
- I renamed the new files away from the `condition-`/`read-` prefixes after the audit's naming rule (3 files per prefix).

**Core plan** (`flow-bootstrap/plan/`):
- `flow-script-format.ts`: `AUTOMATION_STUDIO_FLOW_CONDITION_RULES` gains a "Date:" sentence. Its example is a library's loans. It says to write the year, and that a row stating no readable date is never kept and a date is never compared with a pattern.
- `record-output-contract.ts`: the processing help now covers date bounds, and the date-bound refusal sentence.
- `issue-feedback.ts`: adds `record_output.process_invalid_condition` to `AUTHORED_CODES`. Its fallback sentence quotes nothing.
- Tests: `tests/condition-rules.test.ts`, `tests/record-output-contract.test.ts`.

**Core result-verification wording** (date bound only):
- `value-readings/condition-readings.ts`: `starts read as 2026-09-21 19:00 UTC from "…"`, or `… read as no date Core can read`. It never reads the number inside a date.
- `value-readings/settled-rows.ts`: a date bound is settled by the date read ("Core read X as a date …"). Undated rows are not settled.
- `read-account/condition.ts`: `as` becomes the suffix ` as a date`, never a relation.
- Tests: `value-readings/tests/date-bound-readings.test.ts`, `read-account/tests/date-bound-condition.test.ts`.
- `request-rows/` is not touched.

**Domain** (`domain/src/actions/extraction/`):
- `condition-grammar.ts`:
  - String bounds are date bounds, validated through Core's own judge (`namesOneDate`). No second date reader exists downstream, and `fluxiq/automation-studio/nodes` needs no new export.
  - Bounds of mixed kinds are refused.
  - `as` is checked, then dropped. An `as` that disagrees, or one with no bound, is refused at key `as`.
- `request.ts`: `WebAutomationExtractConditionBound` (`number | string`).
- `schema.ts`: bounds are typed `["number","string"]`, which Core's `parameter-schema/fit.ts` reads. Adds `as` as an enum and updates the description.
- Test: `tests/date-bound.test.ts`.
- The page filter (`apps/extension/.../item-filter.ts`) needed no change: it already calls Core's `automationStudioRecordConditionHolds`.

**Docs:**
- Core `docs/architecture/package-boundaries.md`: new migration note.
- Downstream `docs/architecture/web-capabilities.md`: new section "Date bounds in a list read's `where`".

### (b) Row-mark suggestion in the trial feedback

**What per-row data Core holds when F3's note fires.**
- The note is added in `agreement/agree.ts` and `unsettled.ts` through `listedValuesAdvice(advice, wording)`. That function sees only the advice and the request wording.
- The trial feedback (`service/candidate-trial/feedback.ts`, the assembly file) holds the run summary. That gives each read's stored rows (a few per set, `sampleRows`) and each condition's left-out rows with every column the read declares (`leftOutCells`). Those are the read's own columns only.
- **Core never holds the read's structure fields** (their labels, coverage and samples). They exist only as domain evidence in the builder's history, which Core does not parse. In the cited run the membership sign was in no column the Flow read, so per-row data could not have found it there.

**What was built.** `service/candidate-trial/row-mark.ts` (`automationStudioTrialRowMark`), wired into `feedback.ts` as a top-level `rowMark` on a judged no and on an unsure. It fires only when the shown advice carries Core's note.
- It takes the values the advice listed and finds the read column holding them.
- It then looks for another column that separates those rows from the rest: present on every one and on none of the others, absent the same way, or a shared start of at least 4 characters cut at a whole word.
- If one separates them, it names that column and the condition, e.g. `{"field":"renew","is":"present"}`.
- If none does, it says the read's columns hold no such mark. It then words where to look in the structure: "a field present on some rows and not others -- a button, badge or label whose coverage is below 1 -- or a field whose value differs between the rows to keep and the rows to leave out; add it to the read's fields and test it with is: "present", is: "absent" or startsWith". **In the cited run this generic sentence is what would have been sent.**
- "The request defines its rows by a property" is taken to mean exactly "the note fired", i.e. the advice lists values the request does not say. I added no list of trigger words.
- It is advice, never a refusal.

**Sharing the note and its reader.** The note text and the reading of listed values moved to a new directory, `result-verification/listed-values/` (`note.ts`, `advice-values.ts`, `noted-values.ts`, `index.ts`). `agreement/exclusion-words.ts` uses it, and `LISTED_NOTE`'s text is unchanged.
- Reason: the agreement barrel (`agreement/index.ts`) is must-not-touch and does not export `exclusion-words.ts`, and the audit forbids reaching past a barrel.
- `service/candidate-trial/index.ts` now exports `row-mark.ts`.
- Tests:
  - `service/candidate-trial/tests/row-mark/tests/row-mark.test.ts`. It sits in a subfolder because `candidate-trial/tests/` is at the 25-file limit.
  - `agreement/tests/listed-values-advice.test.ts`: new case.

### Exact `where` JSON a Flow should use

- **Date bound** (the run's request, "on or after Saturday 19 September 2026"): `{"field": "posted", "atLeast": "2026-09-19", "as": "date"}`. For a range, add `"atMost": "2026-09-30"`. Both ends are included.
- **Presence mark:**
  1. Add the structure's mark field to the read, e.g. `extractList.fields.joinButton: <key of the field labelled button: 'Join group'>`.
  2. Write `{"field": "joinButton", "is": "absent"}` beside `{"field": "group", "is": "present"}`. The mark alone would also keep rows that are not in any group.
  3. Or, testing the audience label's text: `{"field": "audience", "startsWith": "Shared with Members of"}`, where `audience` reads the `svg aria-label` field.

## Commands run and observed results

- `pnpm --filter @fluxiq/contracts build`: build-cache "build", no errors. Run three times; final run after the renames. I removed the stale renamed outputs left in `packages/contracts/dist/record-sets/process/` (`condition-compares-dates.*`, `condition-date-bound.*`, `read-condition-date.*`).
- From `packages/contracts`, `pnpm exec vitest run <file>`:
  - `process/tests/date-bound.test.ts`: 12 passed
  - `condition-holds.test.ts`: 13 passed
  - `condition-text.test.ts`: 1 passed
  - `process-rows.test.ts`: 19 passed
  - `value-reading.test.ts`: 122 passed
  - `record-sets/tests/parse-output.test.ts`: 17 passed
- From Core, `pnpm --filter fluxiq exec vitest run <file>`, each passed:
  - `plan/tests/condition-rules` (4), `record-output-contract` (30; one assertion fixed after its first run), `flow-script-format` (77), `loop-format` (11), `issue-feedback` (20)
  - `value-readings/tests/date-bound-readings` (2), `condition-readings` (6), `settled-rows` (16)
  - `read-account/tests/date-bound-condition` (1)
  - `agreement/tests/listed-values-advice` (6)
  - `candidate-trial/tests/row-mark/tests/row-mark` (5), `feedback` (35), `processed-out` (6), `refuted-advice` (2)
- From `domain`, `DOMAIN_TEST_BUILD_LABEL=t790-fix4 node scripts/test-domain.mjs ...`:
  - `extraction/tests/date-bound`: 5/5
  - with `item-conditions` and `read-request`: 21/21
  - `plan-resolution/extraction/tests/conditions` and `output-nodes/tests/definitions`: 32/32
  - final run: 14/14
- `pnpm --filter fluxiq check`: passed with no diagnostics, twice; the second run was after the final changes.
- `pnpm --filter @fluxiq/contracts check`: passed.
- `tsc --noEmit -p domain/tsconfig.json`:
  - First run failed: `conditions.ts(194)`, property `as` missing. This led to the no-canonical-`as` design above.
  - After that change it exits 0.
- `node scripts/structure-audit.mjs`:
  - Core: 1 violation, `as-never` in `located-defects/tests/untested-column.test.ts` (not my file).
  - Downstream: "passed (232 warning(s), 616 baselined)".

## Not verified

- No Lab run, no browser run, no model call. Nothing was checked against a live page or a live builder.
- I did not run the extension's `item-filter` tests. The filter itself is unchanged and calls Core's function.
- Core's `fluxiq` dist was not rebuilt. Downstream `pnpm check` or `pnpm test` would refuse a stale Core through `core-build.mjs` until `pnpm --filter fluxiq build` runs. The domain tests above ran through `test-domain.mjs` directly. Its date-bound behaviour comes only from the contracts dist, which I rebuilt.
- Whole-package suites were not run, as the brief asked.
- I did not test `rowMark` on an unsure verdict, only on a judged no. The code path is the same function.

## Open questions or contradictions found

1. **Core holds no structure fields at either point where the note fires or the feedback is built.** So the acceptance case "structure offers a mark field, the feedback names that field" is met only when the read takes that field as a column. Otherwise the suggestion is worded from labels and coverage generically. Naming the structure field itself would need the domain to carry the detection's field list (labels, coverage) to Core, for example on the resolved read's parameters or the trial result. That is a cross-repo change outside this brief.
2. The audit's remaining failure, `as never` at line 37 of `located-defects/tests/untested-column.test.ts`, is in another worker's file (fix 3). I did not touch it.
3. Outside my ownership, optional follow-ups:
   - The downstream `output-nodes/extract-list/catalog-text.ts` still describes bounds as numbers only. It contradicts nothing, but could mention date bounds.
   - `output-nodes/extract-list/column-match.ts` (`webExtractionComparedShape`) treats any bound as wanting a "number" column. That only affects nearest-name guesses.
   - `plan-resolution/extraction/conditions.ts` needs no change with this design.
4. Judgement call to review: a date bound never keeps an undated row even under `not`. This departs from the numeric rule, where `not` keeps a missing value. The brief asked that an unparseable date is never treated as matching.
