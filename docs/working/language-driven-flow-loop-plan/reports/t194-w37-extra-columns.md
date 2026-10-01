# t194-w37: the Lab says "extra columns" instead of an empty values-differ

## Outcome

Done. The judgement is unchanged and still strict: `judgement.ts:292` (`matchesExtractionRecord`) still rejects a record that has a key the expectation does not name. Only the mismatch artifact changed.

## What changed and why

`packages/test-runner/src/run-expectations/extraction/mismatches.ts`:

- `extractionMismatchKinds` gains `"extra-columns"`. A record gets this kind when every named field agrees and it still failed because it carries a key the expectation names nowhere. A record that is wrong on a named field stays `values-differ` (its `fields` are non-empty).
- `ExtractionRecordMismatch.extraFields?: string[]` holds the unnamed keys' names in the record's order. It applies to `extra-columns`, `values-differ` and `observed-not-expected`, is capped at `MAX_FIELDS_PER_RECORD`, and each name is cut at `MAX_VALUE_CHARACTERS`. It is published only under the `fixture-page` disclosure rule. `unexpectedFields` (the count) is unchanged.
- `ExtractionStepMismatches.extraColumns?: ExtractionExtraColumns` is a new step summary, present only when some observed record carried an unnamed key. Its shape is `{ records, names?, furtherNames, matchedRecords, matchedInAnyOrder }`:
  - `records` is how many observed records carried an extra key.
  - `names` is the distinct extra keys, in first-seen order, published only under `fixture-page`.
  - `furtherNames` counts the distinct extra keys beyond the cap. When `names` is withheld, it counts all of them.
  - `matchedRecords` and `matchedInAnyOrder` say how many rows would pair on the named columns alone. They are computed with the same `extractionRecordPairing` as the verdict, over records with their unnamed keys removed.
- For live run 11, this reads as `extraColumns: { records: 13, names: ["plus","ad"], matchedInAnyOrder: N, ... }`.
- The header comment, the `BOUNDARY` policy string and the field docs now state the new disclosure: key names under `fixture-page` only, never values.

`tests/mismatches.test.ts`:

- The old test "a field the expectation names nowhere is counted and never named" is rewritten. It now asserts:
  - under `fixture-page`, the key is named and its value never leaves;
  - under `scenario-declares-secrets`, the key is counted and not named.
- New test, modelled on run 11: rows with helper columns `plus`/`ad`. Rows right on every named column are `extra-columns`, a wrong-price row is `values-differ` and still names the extras, `extraColumns.matchedRecords`/`matchedInAnyOrder` = 2, and the verdict's `matchedRecords` stays 0.

Contract change: none in `packages/test-contracts`, because the mismatch kinds are declared only in `mismatches.ts`. The artifact `snapshots/extraction-mismatches.json` gains:

- the kind value `extra-columns`;
- the optional members `records[].extraFields` and `extraColumns`.

`schemaVersion` stays `"0.1"`, since the change only adds members. The only producer is `flow-lane/run-flow-lane.ts` (`flowExtractionMismatches`), which passes the report through unchanged. I found nothing that validates the artifact's schema.

## Commands run and observed results

All were run from the tree root through `build-slots/heavy.sh`.

- `pnpm --filter @fluxiq-web-extension/test-runner check` passed. The tsc step (`test-runner:check`) built and stored with no errors.
- `pnpm --filter @fluxiq-web-extension/test-runner build` passed (`test-runner:build` stored).
- `node --test dist/run-expectations/extraction/tests/*.test.js` (in `packages/test-runner`): `# tests 44 # pass 44 # fail 0`.
- Fail-on-old-source check:
  1. I restored `git show HEAD:.../mismatches.ts` and rebuilt. The build exited 2 because the new tests reference members the old types lack, but tsc still emitted.
  2. `mismatches.test.js` gave `pass 10, fail 2`: the two changed or new tests, with `expected: 'extra-columns'`, `actual: 'values-differ'`.
  3. I put my version back from the scratchpad copy, rebuilt (restored from the store), and re-ran: 44/44 pass.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (154 warning(s), 118 baselined)`. No warning names `packages/test-runner/src/run-expectations/extraction/`. `mismatches.ts` is 355 lines.

## Not verified

- No live run or Lab replay of run 11's bundle, so the real run's `matchedInAnyOrder` number is not measured.
- I did not run the flow-lane, bench or ui-e2e tests (`run-flow-lane.test.ts`, `lane-observation.test.ts`, `ui-e2e/suite.test.ts`), which use `ExtractionStepMismatches`/`unexpectedFields`. Type-check passed for them, but a `deepEqual` on a whole record or step that has an extra key would now see `extraFields`/`extraColumns`/`extra-columns` and could fail. A grep listed them as mentioning `unexpectedFields`; I did not inspect their assertions.
- `measureExtraction` and the `evaluation.json` counts are unchanged. A named-columns-only match count is not in the evaluation, because that would be a test-contracts `RunExtractionMeasurement` change.

## Open questions or contradictions found

- The brief asked to name the extra keys, but the module's documented boundary, and the test it rewrote, said unnamed keys are "counted, never named", because a key could be something a page chose. I resolved this by naming keys only under the `fixture-page` disclosure rule, the same rule that already publishes observed values, and counting without naming under `scenario-declares-secrets`. The supervisor should confirm this boundary change is acceptable. It also affects `docs/architecture` text, if any describes this artifact; I did not check, since that is outside my ownership.
- The working tree has other uncommitted changes from other workers (`domain/src/runtime/llm-evidence/tools.ts` and its test, `reports/t194-live-judge-answer.md`). I did not touch them.
