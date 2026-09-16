# x5a-evaluation-contracts report

## Outcome

**Done.** X5.1's evaluation and bench-report contracts are in place, with tests.
All three mutations were observed red and reverted. Every named check passes:
test-contracts 89/89, the test-runner build clean, and 133/133 test-runner unit
tests for the files touched here.

The supervisor amended the brief after the first pass. The version token was
the supervisor's omission, so ownership was extended to the seven fixtures that
hard-code a 0.2 `RunEvaluation`. Each is now `"0.3"` with `extraction: null`,
and nothing else about them changed. That cleared the only two failures this
report previously listed.

The supervisor also confirmed all three interpretations: record, count, and
pagination accuracy compare within one record of the population; exact and
false success use the workflow-rate tolerance; extraction distributions are
reported, not compared.

## What changed and why

### `packages/test-contracts/src/evaluation.ts`

- `EVALUATION_SCHEMA_VERSION` is now `"0.3"`.
- New exported list `extractionMeasurementStatuses` (`judged`, `not_run`,
  `not_expected`) and its type `ExtractionMeasurementStatus`.
- New type `RunExtractionMeasurement` with exactly the members report X5.1
  lists: numbers, booleans and nullables, plus `status` from the closed list.
- `RunEvaluation.extraction: RunExtractionMeasurement[] | null`.
  - `null` means extraction was not measured.
  - `[]` means extraction was measured and the run had no extraction step.

### `packages/test-contracts/src/evaluation-validation.ts`

- **Version and required member.** It accepts only 0.3 (compared against the
  constant), adds `extraction` to the allowed keys, and requires it.
- **Legacy reads.**
  - 0.2 is read as 0.3 with `extraction: null`.
  - 0.1 without `facilityFailure` is read as 0.3 with
    `facilityFailure: null, extraction: null`.
  - An old version that states a member it never had is not normalized, so it
    fails. That covers a 0.2 with `extraction`, and a 0.1 with
    `facilityFailure` or `extraction`.
  - `assertRunEvaluation` still refuses unnormalized legacy input.
- **String refusal (D6).** `checkExtractionMeasurement` first refuses any
  string member, except a `status` from the closed list. It does this by name,
  with its own message, before the key and type checks. A planted value is
  therefore refused whether it lands in a known number member, the status, or
  an unknown key.
- **Other bounds.**
  - Every count is a whole number ≥ 0.
  - `pagesFollowed` is null or a whole number ≥ 0.
  - `truncated` is null or a boolean.
  - `durationMs` is null or a finite number ≥ 0.
- **Count bounds.**
  - `matchedRecords ≤ expectedRecords`
  - `matchedRecords ≤ observedRecords`
  - `presentFields ≤ expectedFields`

### `packages/test-contracts/src/bench-report.ts`

- New exported list `benchExtractionRateMetrics` with the six rates.
- New type `BenchExtractionMetrics`:
  - `judgedSteps` and `unjudgedSteps`;
  - the six rates, each a `BenchRate`;
  - the distributions `extractionDurationMs` and `extractionMsPerPage`.
- `BenchCorpusMetrics.extractionByLane?: Partial<Record<EvaluationLane, BenchExtractionMetrics>>`.
  The schema version stays 0.1.
- **Comparison ids.**
  - `compareBenchReports` emits `extraction:<lane>:<metric>` after the
    Metrics-table rates and before the action latencies.
  - `measure` resolves these ids through `measureExtraction`.
- **Tolerances (confirmed by the supervisor).**
  - Accuracy and completeness rates are equivalent within one unit of their
    total: `1 / total`, which is one record for record accuracy.
  - `extractionExactSuccess` and `extractionFalseSuccess` use
    `BENCH_TOLERANCE.rateWorkflows / workflows`.
  - `extractionFalseSuccess` is lower-better.
  - The distributions are reported, not compared.

### `packages/test-contracts/src/bench-report-validation.ts`

- `extractionByLane` is added to the allowed metrics keys.
- `checkExtractionByLane` rules:
  - Absent is valid and means unmeasured.
  - It is refused in a report whose results state no lane.
  - An unknown lane key is refused.
  - A lane block is refused when the report lists no result on that lane.
  - An empty block `{}` is valid.
- `checkExtractionMetrics` requires exact keys, step counts that are whole
  numbers ≥ 0, and a valid `checkDistribution` for each distribution.
- `checkExtractionRate` rules:
  - `count ≤ total`, which in record units means matched ≤ expected;
  - `workflows ≤` the lane's results;
  - `total > 0` requires `workflows > 0`;
  - the rate must equal count / total, or be null when total is 0.
- `checkExtractionRate` deliberately does **not** apply
  `total ≤ workflows × repeatCount`: records and fields can outnumber runs.
- The shared rate-value check was pulled out of `checkRate` into
  `checkRateValue`, so `checkRate` behaves as before.

### Tests written here

`tests/evaluation-contracts.test.mjs`:
- The fixture is now 0.3 with `extraction: null`; measurement fixtures were
  added.
- Rows added:
  - 0.3 accepted and round-tripped, including a `not_run` measurement and `[]`;
  - 0.1 read as 0.3;
  - 0.2 read back with `extraction: null`, and a 0.2 stating `extraction`
    refused;
  - the planted `"4242424242424242"` refused as a string in every member, in
    unknown keys, and as the status;
  - the count bounds at and beyond each limit, plus type bounds;
  - `extraction` added to the missing-member list.

`tests/bench-report-contracts.test.mjs`, rows added:
- A block validates and round-trips; an absent block is valid and reads as
  unmeasured, in a laned report, a pre-lanes report, the smoke report, and the
  report with coverage counts.
- `matched > expected` (count above total) is refused, plus other rate,
  distribution, and unknown-member bounds.
- Lane scoping.
- Tolerance boundaries for accuracy, success, and lower-better false success.
- Order of comparison ids, and the validator refusing a wrong tolerance.

The file was compressed to stay under the 400-line advisory: the audit no
longer warns on it.

### Producer, and the seven fixtures (the amendment)

`extraction: null` added, nothing else changed:

- `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts:97`, the
  one real producer (TS2741 at 68:9 before the change).
- `packages/test-runner/src/flow-lane/tests/lane-observation.test.ts:20`, which
  already used `EVALUATION_SCHEMA_VERSION`, so the missing member was its only
  error.

Version set to `"0.3"` and `extraction: null` added, nothing else changed:

| File | Version line |
| --- | --- |
| `packages/test-contracts/tests/runtime-contracts.test.mjs` | 130 |
| `packages/test-runner/src/bench/tests/aggregate-report.test.ts` | 9 |
| `packages/test-runner/src/bench/tests/compare-reports.test.ts` | 18 |
| `packages/test-runner/src/bench/tests/render-markdown.test.ts` | 11 |
| `packages/test-runner/src/bench/tests/run-bench.test.ts` | 103 |
| `packages/test-runner/src/bench/tests/shard-merge.test.ts` | 55 |
| `packages/test-runner/src/bench/tests/sharded-bench.test.ts` | 29 |

## Commands run and observed results

All commands were run one at a time, never concurrently.

**Final runs, after the amendment:**

1. `pnpm --filter @fluxiq-web-extension/test-contracts test`:
   `# tests 89`, `# pass 89`, `# fail 0`, exit 0.
2. `pnpm --filter @fluxiq-web-extension/test-runner build`: exit 0, no
   diagnostics.
3. Test-runner unit tests for every file touched here, run through
   `pnpm --filter @fluxiq-web-extension/test-runner exec node --test` on the
   built `dist`: the six bench fixtures, `flow-lane/tests/lane-observation`,
   and the six `run-evaluation/tests` files that exercise the producer
   (`observed-run-evaluation`, `single-run-evaluation`, `bench-parity`,
   `runner-wiring`, `evidence-budget-invariant`, `flow-lane-evidence-sizes`):
   `# tests 133`, `# pass 133`, `# fail 0`, exit 0.
4. `node scripts/structure-audit.mjs`: 1 violation, `[working-docs]
   docs/working/README.md is out of date`, which is not a file this brief owns.
   My files raise advisory warnings only:
   - `evaluation.ts`: 11 exported values (advisory 8, hard limit 15);
   - `packages/test-contracts/src/`: 19 files, and `evidence-validation.ts` and
     `runtime-validation.ts`, all three pre-existing.
   - No warning remains for `bench-report-contracts.test.mjs`.
   - The `first-class-data-extraction-plan.md` 820-line compaction failure seen
     in the earlier run is **gone**, so someone else compacted that document
     between the two runs.

**Earlier runs, before the amendment** (kept because they are the evidence for
the mutations):

5. First `test-contracts test`: `tsc` clean, 89 tests, 88 pass, 1 fail — the
   then-unowned `runtime-contracts.test.mjs:129` row, "legacy evaluations must
   be parsed and normalized before use".
6. First `test-runner build`: exit 2, eight errors — six TS2322
   `Type '"0.2"' is not assignable to type '"0.3"'`, plus TS2741 at
   `lane-observation.test.ts(15,3)` and `observed-run-evaluation.ts(68,9)`.
7. The same build after the two `extraction: null` lines: exit 2, exactly the
   six TS2322 errors, which the amendment then cleared.

**Mutations, each observed red and then reverted:**

8. D6 string-refusal loop removed: `not ok 26 - a string planted anywhere in an
   extraction measurement is refused as a page value (D6)`.
9. The `matchedRecords ≤ expectedRecords` line removed: `not ok 27 - extraction
   counts are bounded ...`, with no compile error.
10. `count > total` removed from `checkExtractionRate`: `not ok 15 - extraction
    rates are counts over totals: matched records never outnumber expected
    ones`.
11. After the reverts, a search of `packages/test-contracts/src` confirmed all
    three guarded lines are present: `evaluation-validation.ts:152`, `:162`,
    `:163`, `:165`, and `bench-report-validation.ts:227`.

## Not verified

- **The rest of the test-runner suite.** Only the files touched here were run
  (133 tests). `pnpm --filter @fluxiq-web-extension/test-runner test` over the
  whole package was not run.
- **`durable-file.test.ts:328`.** It casts a `"0.2"` object
  `as unknown as RunEvaluation`, so it compiles and was left alone. It is
  outside the touched set, so its runtime behaviour was not exercised.
- **Real bench files.** 0.2 evaluation files written by real benches on disk
  were not read back; only unit fixtures were.
- **Wider checks.** Root `pnpm check`, `pnpm test`, and `pnpm build` were not
  run, and other consumers of test-contracts (scenario-lab, scripts) were not
  built.
- **No browser and no Lab**, per the brief.

## Open questions

The first-pass contradiction about fixture ownership is resolved: the
supervisor extended ownership and the fixtures are fixed. The tolerance
classes and the uncompared distributions are confirmed, so they are no longer
open. What remains:

1. **Units left to the aggregator.** The units of the count, pagination,
   exact-success, and false-success rates, and their relation to `judgedSteps`,
   belong to X5.2 and X5.6's aggregator. The validator therefore bounds them
   only structurally.
2. **Constraints not added.** The brief named only the two count bounds, so
   none of these is enforced:
   - status-dependent rules, such as `not_run` with records observed;
   - a unique `stepIndex`;
   - a bound on `nonStringValues`;
   - a required lane block when results exist.
3. **Export count.** `extractionMeasurementStatuses` takes `evaluation.ts` from
   10 to 11 exported values: an advisory warning, under the hard limit of 15.
   `bench-report.ts` is at 8.
4. **Still for X5.3.** Per the brief this worker touched neither
   `recordable-actions.ts` nor `flow-lane-exclusion.ts`, so X5.1's W04 and W08
   rows and its "revert `extract` to `[]`" mutation remain undone.
