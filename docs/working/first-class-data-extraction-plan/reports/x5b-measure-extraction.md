# x5b-measure-extraction

## Outcome

**Done.** `measureExtraction` exists in
`packages/test-runner/src/run-expectations/extraction.ts`, `assertExtraction`
is rebuilt on it and newly asserts `pages`, `truncated`, and the presence of a
field outside `optionalFields`, and both mutation targets were observed red and
reverted. The package's full suite passes at 857 tests.

One caveat the supervisor must act on: because the two callers of
`assertExtraction` are must-not-touch files, `pages` and `truncated` are judged
only when the step reports them, so X5.3 must pass `observed` or x5d's
`pages: 3` on W05/W07 will be silently unasserted. See Open questions 1 and 3.

## What changed and why

### `run-expectations/extraction.ts` (rewritten, 148 lines)

New exports:

- `measureExtraction(entry, records, observed)` returning
  `ExtractionStepMeasurement` = `Omit<RunExtractionMeasurement, "stepIndex" | "status">`.
  Those two members are the caller's: only the run knows a step's position, and
  only it can distinguish `not_run` from `not_expected`.
- `ObservedExtraction` = `{ pagesRead?; truncated?; durationMs?; nonStringValues }`,
  matching the report's Part 4 X5.2 shape.
- `ExtractionRecord` is now exported, since it appears in a public signature.

Counts and booleans only (D6): no step id, field name, selector, or page value
enters the returned measurement. The only strings in the module are in
`RunnerFailure` messages and details, which is pre-existing behaviour — the old
code already put whole expected/actual records into `details`.

Measurement semantics, chosen against the metric definitions in
`ex-d-test-facility.md:223-227` so the bench can aggregate them:

- **`expectedFields` / `presentFields`** are summed over the aligned positions
  `i < min(expected, observed)`, counting each expected record's fields that
  `optionalFields` does not name, and whether the observed record at that
  position carries the key. This is exactly the `extractionFieldCompleteness`
  formula at `ex-d:224` ("Σ expected non-optional fields present ÷ Σ expected
  non-optional fields"). Presence, not value equality — value equality is record
  accuracy's job.
- **`matchedRecords`** is positional identity for an entry that lists `records`.
  For a count-only entry there is no expected record to compare, so it is
  `min(expectedRecords, observedRecords)`, which pools to exactly 1.0 per record
  when the count is right and avoids reporting a false 0 for a step that met its
  stated expectation. See Open question 1.
- An entry that states neither `count` nor `records` cannot contradict the
  records, so the observed count stands as `expectedRecords`. With no entry at
  all (`not_expected`), every expectation-derived count is 0.
- **`unexpectedFields`** counts, over every observed record, the keys the
  expectation names nowhere — neither in any expected record nor in
  `optionalFields`. It is 0 when the expectation names no fields, because
  nothing can then be known to be unexpected. Counted, never asserted directly,
  per `ex-d:224` ("counted separately").
- `pagesFollowed`, `truncated`, `durationMs` are `null` when the step did not
  report them; `nonStringValues` is passed through from the caller that read it.

The x5a bounds (`x5a-evaluation-contracts.md:56-59`) hold by construction:
`matchedRecords ≤ expectedRecords`, `matchedRecords ≤ observedRecords`,
`presentFields ≤ expectedFields`.

`assertExtraction` now takes an optional fourth parameter `observed`, defaulting
to nothing reported, and asserts in order: `count`; `pages` against
`observed.pagesRead`; `truncated`; then, for entries listing `records`, the
length, a dedicated missing-required-field failure derived from
`presentFields < expectedFields`, and finally the positional mismatch. Both
functions share one `matchesRecord` helper, so a measurement and an assertion
cannot disagree — the property `ex-d:223` asks for.

`optionalFields` handling: a field it names may be absent from either side (the
observed item may lack it, or carry it where the expectation omits it). A field
outside it must be present on every item the expectation names it on. With no
`optionalFields` the comparison is exact key-set and value equality, identical
to the old behaviour, which is why every pre-existing test still passes
unchanged. D16's rule is preserved: an expected `null` matches only a field
present with `null`, never a missing key or an empty string.

### Signature compatibility, which constrained the design

`observed` had to be an **optional fourth parameter** rather than part of a
reshaped signature, because the two callers are must-not-touch files:

- `run-scenario.ts:310` — and `run-evaluation/tests/runner-wiring.test.ts:228`
  asserts that file's source contains the exact three-argument call text
  `if (extracted) assertExtraction(recordingWorkflow.expected.extracted, step.id, extracted);`
- `flow-lane/expectations.ts:104` — `assertExtraction([entry], entry.step, extracted[index]!)`

The consequence, documented in the file's doc comment: a caller that cannot
observe a step's pagination does not fail its `pages` expectation. An
expectation is checked against a reported value, never against a missing one.

### `run-expectations/tests/extraction.test.ts`

The four existing tests are kept verbatim as the regression net. Eight added,
covering every row the report's X5.2 test list names: order matters; an extra
field counts in `unexpectedFields` and fails; an optional field may be absent
(from either side); `null` matches only `null`; `pages: 3` against 2 fails;
`truncated: true` against false fails. Plus direct `measureExtraction` coverage
of the full count set, the optional-field exclusion from `expectedFields`, the
count-only entry, the absent entry, and `null` for what the step did not report.

## Commands run and observed results

All run from `F:\!FluxIQWebExtension`.

1. `pnpm --filter @fluxiq-web-extension/test-runner build` — clean, exit 0. This
   is itself meaningful: it type-checks the two untouched callers against the new
   signature.
2. `node --test packages/test-runner/dist/run-expectations/tests/extraction.test.js`
   — `# tests 12 # pass 12 # fail 0`.
3. `pnpm --filter @fluxiq-web-extension/test-runner test` — **first attempt
   failed**, exit 2, inside its own rebuild, with ~40 `TS2307: Cannot find module
   'fluxiq' / 'fluxiq/core' / 'fluxiq/automation-studio'` errors against
   `../../domain/dist/*.d.ts` and `src/coordinator.ts`. Not my change: the
   identical build had just succeeded in step 1, and `failure.ts:44-50` documents
   this exact transient — Core lives in a sibling checkout whose build cleans and
   re-emits `dist`, so a run importing Core mid-rebuild fails on files that exist
   again seconds later. Rerun alone, with `F:\!FluxIQ\packages\fluxiq\dist` and
   `dist\index.d.ts` both confirmed present: **`# tests 857 # pass 857 # fail 0`**.
   That run includes `runner-wiring.test.ts` and the flow-lane tests, so both
   three-argument callers still behave.
4. `node scripts/structure-audit.mjs` — exit 1, **1 violation, not mine**:
   `[working-docs] docs/working/README.md is out of date with the documents'
   header blocks`. `git status` shows `docs/working/README.md` itself unmodified
   while the plan document and eleven untracked report files changed around it,
   and my edits are confined to `packages/test-runner/src`, which that rule
   cannot see. Left for the supervisor (`pnpm structure:baseline`); editing a
   shared working document is outside my brief. No new `file-lines` warning:
   `extraction.ts` is 148 lines, well under the 400-line advisory threshold.
5. Mutation targets, each applied, rebuilt, run, and reverted from a scratchpad
   backup inside a `finally`:
   - **Compare as a set** (positional match replaced by
     `records.some(...)`): `not ok 1 - count is exact and records are the
     complete list in order` — `# pass 11 # fail 1`. The order row fails, as
     predicted.
   - **Drop the key-set check** (the old `:33` key-length check, now the final
     line of `matchesRecord`, replaced by `return true`): `not ok 2 - a record
     with a missing or extra field does not match` and `not ok 7 - a field the
     expectation names nowhere counts in unexpectedFields and fails` —
     `# pass 10 # fail 2`. The extra-field rows fail, as predicted.
   - **Restored**: `# pass 12 # fail 0`, source SHA-256 verified identical to the
     pre-mutation backup, both anchors present, mutation text absent.

## Not verified

- **No browser, e2e, or Playwright run.** Per the brief this is source and unit
  tests only; nothing here exercises a real page, the recording lane, or the
  Flow lane end to end.
- **Nothing consumes `measureExtraction` yet.** X5.3 wires it into
  `run-scenario.ts` and the extraction snapshot; until then no `RunEvaluation`
  carries an `extraction` block produced by this code, and the
  measurement-to-bench path is unexercised.
- **Bench aggregation semantics are untested against real data.** My
  `matchedRecords` choice for count-only entries (Open question 1) is not
  validated by any aggregate; no bench report was produced or compared.
- The `pages`/`truncated` assertions are verified only through the unit tests'
  synthetic `observed`, never against a value a real paginated read reported.
- I did not run `pnpm check`, `pnpm test`, or `pnpm build` at the repository
  root; other workers hold files in this package concurrently
  (`bench/tests/*`, `run-evaluation/observed-run-evaluation.ts`,
  `flow-lane/tests/lane-observation.test.ts` were all modified outside my edit).

## Open questions or contradictions found

1. **The bench cannot tell a count-only entry from a records entry.**
   `ex-d:223` says only entries with `records` feed `extractionRecordAccuracy`,
   while count-only entries feed `extractionCountAccuracy`. But
   `RunExtractionMeasurement` is counts-only, so nothing in it discriminates the
   two, and the aggregator does not see the workflow expectation. I made
   count-only entries report `matchedRecords = min(expected, observed)`, so
   pooling them into record accuracy yields 1.0 exactly when the count is right
   rather than a false 0. **X5.5 should confirm this or add a discriminator** — a
   separate counter, or widening `status`. This is the one place where my output
   could silently mis-feed a published metric.
2. **"Asserts that a field outside `optionalFields` is present" is implemented
   only where the expectation names fields** (entries listing `records`). For a
   count-only entry I deliberately did *not* check raggedness across observed
   records, because inferring a required field set from the observed data
   fabricates an expectation the workflow never stated and could fail existing
   fixtures (for example admin-console rows) that no one has declared
   `optionalFields` for. If the intent was a raggedness check, say so and I will
   add it — but it should land with a fixture sweep, not blind.
3. **`pages: 3` on W05/W07 is unasserted until X5.3 passes `observed`.** x5d is
   adding those expectations now; on the recording lane they will be measured as
   `pagesFollowed: null` and judged by nothing until the intent seam supplies
   `pagesRead`. This is forced by the untouchable three-argument callers, and it
   is the one way this change could read as "green" while judging less than the
   plan intends. Worth a ledger line.
4. **`nonStringValues` is measured, not asserted.** The Flow lane already
   refuses a run carrying any before comparing records
   (`flow-lane/expectations.ts:98`), and the report did not list it among the new
   assertions, so I left `assertExtraction` silent on it. If the recording lane
   needs the same refusal, X5.3 should add it at the seam.
5. **`extract-records.ts` reports no pagination today.** The recording lane's
   reader returns records only, so `ObservedExtraction` is satisfiable in full
   only through X5.3's intent result. Noted so X5.3 does not assume otherwise.
