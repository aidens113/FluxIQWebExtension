# t467: filter-column evidence for the judge

Status: Done (worker). Not committed. Owner: t467 worker. Paired: downstream and Core, both on `task/t467-filter-column-evidence-for-judge`.

## Outcome

Done. Two of the brief's causes were real pipeline defects, and both are fixed:

1. A condition over a column read only to filter by now shows the judge the value it read on a row it kept, for example `badge (read "Verified" on a row it kept) is present`.
2. Witness pages in a looped read now give the page within the whole read: 1, 2, 3, and so on.

Cause 3 (two different listings called duplicates) is **not** a pipeline cause. The judges had every field that tells the two rows apart. Evidence is below.

## Causes, checked against the run

**Cause 1. Confirmed, but the fault sat in a different place than the debug thought.** The model wrote `{field: "plus", is: "present"}`, from step 0032's `submit.7`. `plus` is not in `recordOutput.schema`, so before dispatch the domain's `output-nodes/extract-list/declared-columns.ts` takes it out of the field map and rewrites the condition to `{read: <plus spec>}`. That is why every witness says `source: read`. On the page, the condition was therefore a `read` condition, and `item-filter.ts:116` already recorded its value into `conditions.seen`.

The value was dropped in **Core**. `condition.ts` names the condition by the authored `field: "plus"`, so `ownRead` is false and the found value is never said. The judge request at step 0035 shows `condition: plus is present` beside eight witnesses that read `readKind: attribute, state: absent` and carry no value.

The extension gap is real too, for a different path: a `field` condition on a column that is read but not stored. This happens when the schema was not narrowed, or when `process.columns` cuts the column. In that case `seen` stayed `null`. Both halves are now fixed.

I could not find the run's workspace `project.sqlite`, so I did not read the stored `conditions.seen` directly. The conclusion rests on reading the source and on the step 0035 request.

**Cause 2. Confirmed.** In step 0035, every witness says `page: 1`. `looped-account.ts` concatenated each pass's witnesses without renumbering their pages.

**Cause 3. Not a pipeline cause.** The judges at 0019, 0069 and 0074 were shown both rows in full:
- the names differed: `… Built-in Mic, Ivory` and `… Built-in Mic, Ivory with Wireless Charging Case`;
- the urls differed: `/dp/B0VNKJTVCD` and `/dp/B0HKSZ2BM6`. These are lines 154–178 of the 0069 and 0074 requests.

Judge 0019 quoted both SKUs, and still said "two rows for the same product … with different URLs". Judge 0069 named both titles and said "the same product appears under different names". The judges had the distinguishing evidence and made a judgement call that a listing which includes a charging case is the same pair. Nothing was missing from what they were given. The debug's follow-up 4, an account of what dedupe removed, is a separate improvement and was not done here.

## What changed and why

Downstream:
- `apps/extension/src/content/extraction/item-filter.ts`: `seen[index]` is now recorded for column (`field`) conditions too, with the same first-non-empty-value-on-an-item-the-condition-held-of rule. The header and type doc were updated. The wire shape is unchanged.
- Updated tests:
  - `tests/item-filter.test.ts` gets a new case: a column condition over an attribute column keeps "Verified" and nothing from the row it rejected. The old "a column's condition keeps none" expectations were updated.
  - `tests/list-reader.test.ts`: four `seen` expectations now carry the column value.

Core, in `packages/fluxiq/src/programs/automation-studio/runtime/result-verification/read-account/`:
- `stored-columns.ts` (new, exported through the barrel `index.ts`) works out which columns a read stores. It keeps the columns that every stated layer keeps. The layers are:
  - `extraction.fieldNames`, the narrowed field map the page actually read;
  - the record output's `schema.fields[].id`;
  - the record output's `process.columns`.

  If none of these is stated, it returns `undefined`, meaning every column is stored, which is the old behaviour.
- `condition.ts`: `automationStudioResultReadConditionText` takes an optional `stored` set. A condition named by a column, either `field` or a `read` equal to a column's declared read, says the found value when that column is not stored. The existing screens still apply: locator-shaped text, secret-shaped text and denied keys. A denied column is still never named. A stored column still says nothing.
- `accounts.ts`: computes `stored` from the extraction and the node's `parameterValues`, and passes it through `conditionAccounts`.
- `looped-account.ts`:
  - Each pass's witness `page` is moved on by the sum of `pagesRead` over the earlier passes.
  - Condition wording is taken from the first pass that kept rows, falling back to the first pass that has wording. This means a first pass that kept nothing cannot hide the found value.
- Tests:
  - New `tests/stored-columns.test.ts` with 6 cases, using a generic article/"Verified" fixture.
  - `tests/looped-account.test.ts`: the existing case now uses realistic per-pass page 1, plus two new cases (renumbering, and wording choice).
  - `tests/condition-observation.test.ts`: the t461 aggregation fixture had the third pass report page 3 by itself, which a real pass never does. It now reports page 1 and the merged account says page 3.

No judge-instruction text was added.

## Commands run and observed results

- Fail-first, extension: I replaced `item-filter.ts` with its HEAD content, then ran `EXTENSION_TEST_BUILD_LABEL=t467 node apps/extension/scripts/test-extension.mjs content/extraction/tests/item-filter.test.ts`. Result: `tests 9, pass 6, fail 3`. The new case failed with actual `[null]` against expected `['Verified']`. I then restored the fix.
- Extension, with the fix: `EXTENSION_TEST_BUILD_LABEL=t467 node apps/extension/scripts/test-extension.mjs` over 8 files: item-filter, rejected-samples, list-reader, read-checkpoint, extraction-continuation, extract-list, extract-list-rejected-samples, filtered-answer.
  - First run: 87 passed and 3 failed, all list-reader tests that pinned `seen: null` for column conditions.
  - After updating them: `tests 90, pass 90, fail 0`, exit 0.
- Fail-first, Core: I replaced `condition.ts` with its HEAD content, then ran `npx vitest run …/read-account/tests/stored-columns.test.ts`. Result: `3 failed | 3 passed (6)`. I then restored the fix.
- Fail-first, Core: `npx vitest run …/read-account/tests/looped-account.test.ts` before the `looped-account.ts` change: `3 failed (3)`.
- `npx vitest run src/programs/automation-studio/runtime/result-verification/read-account`:
  - First run: 1 failed, the t461 pass-page fixture described above.
  - After the fixture fix: `Test Files 11 passed (11), Tests 80 passed (80)`.
- `npx vitest run src/programs/automation-studio/runtime/result-verification`: `Test Files 50 passed (50), Tests 460 passed (460)`.
- `npx vitest run …/recovery/refuted-result …/service/summaries …/service/candidate-trial`: `Test Files 32 passed (32), Tests 265 passed (265)`.
- Core typecheck, `npx tsc -p tsconfig.json --noEmit --incremental false` in `packages/fluxiq`:
  - First run: exit 2, with TS2345 in `stored-columns.ts:22`.
  - Fixed by making `keys` take `unknown`. Rerun: exit 0. Read-account was rerun: 80 of 80 passed.
- `pnpm.cmd --filter @fluxiq-web-extension/extension exec tsc -p tsconfig.json --noEmit --incremental false`: exit 0.
- Domain `tsconfig.json` and `tsconfig.test.json`, run the same way: both exit 0.
- `node scripts/structure-audit.mjs` in Core: exit 0, `passed (332 warning(s), 1159 baselined)`. There is one new advisory warning: `read-account/: 16 source files is past the 15-file advisory threshold`, caused by the new `stored-columns.ts`.
- `node scripts/structure-audit.mjs` downstream: exit 0, `passed (184 warning(s), 646 baselined)`.
- `git diff --check`: clean in both trees.

## Not verified

- No Lab or browser run. Whether a judge says yes given the new wording is a model outcome that remains unproven.
- I did not read the run's stored `conditions.seen`, because I could not locate its workspace `project.sqlite`.
- No domain tests were run, because no domain source changed.
- The Core library build (`dist`) was not rebuilt. The downstream typecheck ran against the existing Core output, and no domain-facing Core type changed.
- A sort or dedupe helper column that the domain adds to the stored schema at dispatch is not in the authored schema. Core will therefore treat it as unstored and say its value beside its condition. The only effect is one extra piece of evidence; nothing is withheld.

## Open questions or contradictions found

- `domain/src/actions/extraction/seen-values.ts`, which I do not own, still says in a comment that `seen` is `null` for "a condition that names a column of the read". It is now stale and should get a one-line comment fix.
- The brief said "on the kept rows". The existing rule, which I kept, records the first value on an item **the condition** held of, which may be a row that another condition then dropped. That matches the established wording "on a row it kept", where "it" is the condition. Recording only on rows the whole read kept would also change the existing `Dear`/`Cheap` test semantics, so I left that to the supervisor.
- The debug blamed `item-filter.ts:116` for this run. In this run the domain's rewrite made the condition a `read`, so the failing half was Core's alone. The extension change covers the other path, a field condition on a column that is read but not stored.
- The `read-account/` directory is now one file over the advisory threshold. Splitting the directory was out of scope.
