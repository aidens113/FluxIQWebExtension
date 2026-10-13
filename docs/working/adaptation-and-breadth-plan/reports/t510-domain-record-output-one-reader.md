# t510 domain half: record output, one reader (plus k/m number reading)

Tree `fxwork/t510/!FluxIQWebExtension`, branch `task/t510-record-output-one-reader`. Core (`../!FluxIQ`) was
read only, never edited. Nothing was committed.

## Outcome

Done. All four brief goals are met, and so are the two additions the coordinator sent mid-task (k/m magnitudes in
the domain's number reader; Core's shared value-reading table run against the domain's reader and the extension's
`order-rows.ts`).

- **F1, one reader.** At submit the resolved extraction step's `recordOutput` is replaced by the record output its
  dispatch builds: the same reconcile, the same narrowing, the read's processing, the records path, all as Core's
  parser returns it. Core's plan validation therefore checks what will run, and the Flow saves it. Dispatching
  the saved value again builds the same value (tested).
- A field that `process.sort`, `process.dedupe.by`, `process.where` or `process.columns` names stays stored as a
  helper. This holds when the schema marks it `handling: "exclude"` and when the schema leaves it out. When the
  author wrote no `process.columns` and a helper is stored only for processing, the dispatch writes
  `process.columns` = the declared columns (plus any helper a `process.where` names, because Core refuses
  `process_where_column_dropped`). Stored is not shown. A helper kept by the read's own `extractList.sort` is
  hidden the same way.
- A schema field marked `exclude` over a column the read reads is now a helper, not a declared column. If no
  process needs it, it leaves the read and the stored schema, and only its conditions read it (they read it
  through its own spec, as for any helper).
- **Auction 0022 / 0024** (tested at dispatch and at submit) are both accepted. The stored schema is
  `title, price, bids, postage, <sortField>`, none excluded. `process` is
  `{sort: [{field: <sortField>, order: asc}], columns: [title, price, bids, postage], minRows: 0}`. Core's
  `automationStudioFlowBootstrapRecordOutputIssues` returns `[]` on the saved value, and
  `["record_output.process_excluded_field"]` on the value as the model wrote it.
- **F4.** Every refusal the dispatch's record-output parse gives now carries `{code, field, valid}` where the code is
  about a field: `process_unknown_field` / `process_excluded_field` (valid = stored ids) and
  `process_where_column_dropped` (valid = `process.columns`). Other codes stay `{code}`. Also, the
  `process_unknown_field` that `stored-columns.ts` adds beside `column_not_read` now carries `valid` (the read's
  columns).
- **F5.** `process_invalid_sort` names the bad key. A stray key gives `{field: "direction", valid: [field, order, as]}`.
  A missing or wrong `order` gives `{field: "order", valid: [asc, desc]}`, a wrong `as` gives the sort types, and a
  missing `field` gives the stored ids. The auction's 0020 sort key `{field, direction}` gets two issues: the
  stray `direction`, and the missing `order`. At submit these reach the model through `webPlanUndispatchable`'s
  issues.
- **Numbers (coordinator, final rule from the supervisor's refinement; it matches Core's landed `read-number.ts`).**
  - `k`/`K` attached to the digits, and followed by anything but a letter or digit, is a thousand (`£72k`,
    `72K`, `€1,5k`). So is the word `thousand`.
  - `m`/`M` attached to the digits is a million only when a Unicode currency sign is written directly before the
    digits, or the number has a decimal separator, the continental comma included: `$1.2m`, `£3m`, `€2M`,
    `1.5m` and `1,5m` are millions. The word `million` always is.
  - A bare `3m ago`, `10m` or `10M followers` stays as written (3, 10, 10).
  - Not magnitudes: `72kg`, `5 km`, `10 m`, `€85 k`.
  - Scaling is decimal, so `1.15k` is exactly 1150.
- **Ranges.** The reader reads the first number only, with that number's own magnitude. `£72k – £80k` is 72000,
  `£60k–£72k` is 60000, and `£60-72k` is 60 (a magnitude on the second end is not carried back, the same as in
  Core).

## What changed and why

Domain, extraction output node (`domain/src/output-nodes/extract-list/`):
- `declared-columns.ts`: a schema field marked exclude over a read column is a helper. The orderings now include
  every field the authored `process` names. A new result member `shown` holds the answer columns to write when a
  helper is stored only for processing and no `process.columns` was written. A schema that declares no column
  narrows nothing. The header explains why (the auction run).
- `reconciled-record-output.ts`: a new optional fourth parameter `shown`, written as `process.columns` (the
  author's other `process` members are kept).
- `dispatch.ts`: passes `narrowed?.shown`. The parse refusal now builds its issues from the output it refused,
  through `process-issues.ts`.
- `process-issues.ts` (new): `webAutomationRecordOutputIssues(codes, output)`, covering F4 and F5. It is named
  `process-` and not `record-output-issues`, because the structure audit's naming rule refuses three `record-`
  files in one directory.
- `stored-columns.ts`: `process_unknown_field` beside `column_not_read` now carries `valid`.
- `index.ts`: exports `process-issues`.

Domain, plan resolution (`domain/src/runtime/llm-evidence/plan-resolution/`):
- `extraction/run-record-output.ts` (new): `webPlanRunRecordOutput(parameters)` replaces `recordOutput` with the
  dispatch's `payload.recordOutput`. It does this only when the step has an object `recordOutput` and the dry
  dispatch accepts it. A step with no record output keeps none, so no dataset the model never named is written
  into its Flow.
- `extraction/index.ts`: exports it.
- `resolve-plan-node.ts`: two edited lines, so the file stays at 800 lines. The final `return` of `resolveNode` now
  passes `extractionNode && scope.step ? webPlanRunRecordOutput(resolved) : resolved`, and the existing
  `./extraction` import line names the new function. Like the dry dispatch, it applies only to a Flow's step and
  only on the resolved path, so it covers a handle read or the Flow's own list. A literal "unchanged" node is not
  rewritten.

Number reading (the coordinator's additions):
- `domain/src/actions/extraction/condition-match.ts`: `webAutomationExtractConditionNumber` now applies a magnitude
  (`MAGNITUDE`, `CURRENCY_ATTACHED`, `scaled`). The logic is the same as Core's landed `read-number.ts`: the
  currency sign directly before the digits, or a `.` in the normalised digits, admits a letter `m`. A header paragraph covers the rule and ranges. This
  reader also feeds `runtime/llm-evidence/node-run/numeric-text-filter.ts` and the extension's `order-rows.ts`.
- `apps/extension/src/content/extraction/order-rows.ts`: header comment only. It reads numbers through the
  domain's reader, so its behaviour changed with it.

Tests (all written before the code they test, and observed failing first, except where noted):
- `output-nodes/extract-list/tests/declared-columns.test.ts`: 6 new t510 cases. A generic task list sorted by a due
  date that is not shown: the shorthand schema, the exclude-marked helper, a dedupe or where helper, and the
  read's own sort. The auction 0022/0024 outputs, and idempotence (dispatch, then dispatch the result again).
  Observed `not ok 8..13` before the fix.
- `output-nodes/extract-list/tests/process-issues.test.ts` (new): F4 and F5 through the dispatch and directly.
  Before the fix it failed to bundle because the module did not exist.
- `plan-resolution/extraction/tests/run-record-output.test.ts` (new): auction 0022/0024 at submit through the real
  runtime with a detected list. Saved record output equals the dispatch's; Core's issues are `[]` on it and
  `process_excluded_field` on the authored value. Also a generic shorthand at submit, and the submit refusal of a
  `direction` sort key carrying `{field, valid}`. Same pre-fix state as above.
- `tests/stored-columns.test.ts` and `tests/swapped-name.test.ts`: the pinned `process_unknown_field` issue now
  expects `valid`.
- `actions/extraction/tests/condition-match.test.ts`: a magnitude case table plus a bound. It was observed failing
  (`not ok 5`) before the reader changed, then rewritten to the final rule. That rule adds `£3m`, `1.5m`, `1,5m`
  and `€2M` as millions, and `3m ago`, `10m`, `10M followers` and `10 m` as unchanged. These letter-m rows were
  added together with the rule change, so they were not run against the earlier reader first.
- `actions/extraction/tests/value-reading-parity.test.ts` (new): runs every `kind: "number"` case of Core's
  `AUTOMATION_STUDIO_RECORD_VALUE_READING_CASES` against `webAutomationExtractConditionNumber`. It also pins the
  letter-m cases (`3m ago`, `10 m`, `$1.2m`, `£3m`) and checks that the table gives the same value wherever it has
  one of those rows. It passes against Core's updated table, which includes `3m ago`, `10m`, `10 m`, `£3m`,
  `€2M`, `1.5m` and `$1.2m`.
- `apps/extension/src/content/extraction/tests/order-rows.test.ts`: runs the same number cases, plus the four pinned
  letter-m cases, through a `{as: "number"}` sort. Each case's row must sort between plain numbers just under and just over the expected
  value, and a `null` case must be counted unsortable.
- How the table is loaded (both parity tests): the Core linked beside this checkout is found through
  `import.meta.resolve("fluxiq/automation-studio")`. The table comes from Core's source
  (`packages/contracts/src/record-sets/process/value-reading-cases.ts`, loaded with Node 22's type stripping) when
  that file exists, and otherwise from `@fluxiq/contracts`' built `dist/automation-studio.js`. The source is
  preferred because the built contracts in this tree are stale: they do not contain the t510 rows. The domain
  cannot import `@fluxiq/contracts` by name (it is not a domain dependency), and `fluxiq/automation-studio` does
  not re-export the table. Each test asserts that the `£72k` row is present, so a stale table cannot pass
  silently.

## Commands run and observed results

- Baseline, before any change:
  `DOMAIN_TEST_BUILD_LABEL=t510-domain node scripts/test-domain.mjs output-nodes/extract-list plan-resolution/extraction`
  -> `# tests 123 # pass 123 # fail 0`.
- Fail-first on the new extract-list cases -> `not ok 8` to `not ok 13`, `# pass 7 # fail 6`. The new
  `process-issues` and `run-record-output` tests failed to bundle (`Could not resolve "../record-output-issues"`,
  `"../run-record-output"`).
- Fail-first on the numbers: `node scripts/test-domain.mjs actions/extraction/tests/condition-match` ->
  `not ok 5 - a thousand or million written after the number scales it`, `# pass 11 # fail 1`.
- Final, on the final tree (after the rename):
  - `npx tsc -p tsconfig.json --noEmit` in `domain` -> rc 0, no output.
  - `npx tsc -p tsconfig.test.json --noEmit` in `domain` -> rc 0, no output.
  - `DOMAIN_TEST_BUILD_LABEL=t510-domain node scripts/test-domain.mjs output-nodes runtime/llm-evidence actions/extraction`
    -> `# tests 1377 # pass 1377 # fail 0`. This includes t489's "submit and dispatch agree on every record output
    of the run" (8 cases) and the rest of `plan-resolution/extraction/tests/stored-columns.test.ts`.
  - `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.test.json --noEmit` in `apps/extension` -> rc 0.
  - `EXTENSION_TEST_BUILD_LABEL=t510-numbers node scripts/test-extension.mjs src/content/extraction` ->
    `# tests 271 # pass 271 # fail 0`.
  - After the letter-m refinement and Core's landed table: `test-domain.mjs output-nodes runtime/llm-evidence
    actions/extraction` -> `# tests 1378 # pass 1378 # fail 0`. Then, against the updated table:
    `test-domain.mjs actions/extraction/tests/condition-match actions/extraction/tests/value-reading-parity`
    -> `# pass 14 # fail 0`, and `test-extension.mjs src/content/extraction/tests/order-rows` -> `# pass 12
    # fail 0`. Both typechecks in `domain` and both in `apps/extension` -> rc 0. Structure audit -> rc 0.
  - `node scripts/structure-audit.mjs` -> rc 0. The first run gave 2 FAILs, both mine: a call spread in
    `run-record-output.test.ts` (contract-spread), and three `record-` files in extract-list (naming). Both were
    fixed by rewriting the fixture and renaming the module to `process-issues.ts`. The audit then passed.

## Not verified

- **Core's plan validation on the written-back value inside a real submit.** I checked Core's
  `automationStudioFlowBootstrapRecordOutputIssues` on it directly, not `validateAutomationStudioFlowBootstrapPlan`
  after `resolveAutomationStudioFlowBootstrapPlanParameters`. That Core validates after resolving (so it sees the
  replaced value) is taken from the w1 report, not re-checked.
- That Core's other submit checks (dataset id, labels, record-output normalisation, warnings that compare against
  the authored value) are unaffected now that the saved value carries `recordsPath`, `maxRecords`, the read's
  `process` (`minRows`, `limit`, `sort`, `dedupe`) and the derived field types.
- The Playwright spec `apps/extension/e2e/content/tests/extraction/tests/record-output-schema.spec.ts`, which calls
  the dispatch: it was not run (e2e).
- No full suites, Lab, provider or browser runs, as the brief required.
- The parity tests ran against Core's in-progress **source** table (the other worker's uncommitted edits). If those
  rows change before Core merges, the tests follow them.

## Open questions or contradictions found

- **Letter m (resolved).** The supervisor's refinement makes a bare `3m ago` or `10m` read as 3 or 10; only a
  currency sign or a decimal separator makes it a million. Core's landed reader and table agree, and both parity
  tests pass. Core's table has no `1,5m` row: the domain pins it in `condition-match.test.ts`, and Core's logic
  reads it the same way.
- **Ranges still read their first end only.** `£60-72k` is 60, in Core and the domain alike. If 60000 is wanted,
  Core's table has to change first.
- **Built contracts are stale** in this tree (`packages/contracts/dist` lacks the t510 rows). The parity tests read
  the source, so they are correct here. Elsewhere, a consumer of the built `fluxiq` (the extension bundle, the
  panel) gets Core's old reader for `process.where`/`sort` until Core is rebuilt, while the page's `where` already
  reads magnitudes.
- **A schema `exclude` now drops a helper from storage** unless a process needs it. Before, the dispatch ignored the
  authored `exclude` and stored every field-map column. This answers the w1 report's last open question in favour
  of "exclude means never stored". A process that names an exclude-marked field still stores it: the process is
  taken as the stronger statement.
- `authoredFieldOrder` (unchanged) falls back to field-map order when the authored schema names a helper that left
  the read, as the exclude-marked helpers now do. Field order then follows the read, not the author. The auction
  case is unaffected because the two orders agree.
- `order-rows.ts` reads **dates** with its own reader, which lacks Core's new t510 date cases (time of day, "time
  left"). Only the table's number cases are run there, as the coordinator asked for numbers. Its date reader still
  differs from Core's.
