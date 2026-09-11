# w1-eval-contracts report

Worker `w1-eval-contracts`, Phase 1.6a step 3, evaluation and benchmark
contracts in `packages/test-contracts`.

## Outcome

**Partial.** The contract work is complete:

- `RunEvaluation` now carries every per-run field the Metrics table needs.
- `BenchReport`, `BenchComparison`, the tolerance rule, and their validators
  are in place.
- 17 new tests pass, both RunEvaluation consumers still type-check, and the
  structure audit passes.

One Definition-of-done item is not met, because the file it needs is outside
my ownership. `pnpm --filter @fluxiq-web-extension/test-contracts test` reports
46 of 47. The existing test at `tests/runtime-contracts.test.mjs:129-134`
builds a `RunEvaluation` without the new required fields. The one-line fixture
patch is under
[Fixture patch for the supervisor](#fixture-patch-for-the-supervisor). With it
applied to a scratch copy, that file passes 11 of 11.

## What changed and why

### `src/evaluation.ts`

`RunEvaluation` keeps its test fields (`verdict`, `failureCategory`,
`invariants`, `metrics`). It gains these fields, all required:

| Field | Type | Metrics row served |
| --- | --- | --- |
| `scenarioId`, `workflowId`, `variantId` | kebab id; workflow/variant `null` = primary / unarmed | all (grouping) |
| `repeatIndex` | integer ≥ 0 | 0 = initial execution; ≥ 1 = deterministic replay |
| `lane` | `"recording" \| "flow"` (`evaluationLanes`) | Flow creation, all |
| `flowCreated` | `boolean` on the flow lane, `null` on the recording lane | Flow creation success |
| `oracleVerdict`, `reportedVerdict` | `"passed" \| "failed" \| null` | false failure / false success |
| `automationFailureReported` | `{ category: ScenarioFailureCategory; code? } \| null` | classification accuracy |
| `automationFailureExpected` | `ExpectedFailure \| null` (the resolved `expected.failure`) | classification accuracy |
| `harnessActivations` | integer ≥ 0 | harness activation rate |
| `durationMs` | number ≥ 0 | run duration |
| `actions` | `{ actionType; durationMs }[]` (`RunActionLatency`) | action latency p50/p95 |
| `evidence` | `{ sanitizedPacketBytes: number[]; rawSnapshotBytes: number[]; truncationCount }` | evidence size |
| `llm` | `LlmUsage` = `{ mode: "disabled" \| "deterministic-dry" \| "live"; profileId; calls }` | provider state |
| `harnessRecovery`, `adaptationCost`, `adaptationValidation`, `adaptationPersistence`, `adaptationReuse` | typed `null` | Week 2 fields |

- **Two failure fields.** The test-rig taxonomy `failureCategory` is
  unchanged. The new fields are `automationFailureReported` and
  `automationFailureExpected`. Both the `RunEvaluation` comment and the
  `failureCategories` comment say which field means what. The validator makes
  each field accept only its own taxonomy, and tests check both directions.
- **False failure and false success** can be derived as
  `oracle passed / reported failed` and its inverse, as the type comment states.
  A test demonstrates the derivation.
- **Inlined types.** The reported-failure and verdict types are written inline
  rather than as new exported names. The runner worker is adding
  automation-failure fields to `run.ts` at the same time, and two modules
  exporting the same name break `export *` in the barrel.
- **Schema version.** `EVALUATION_SCHEMA_VERSION` stays `"0.1"`. `CandidateComparison`
  shares it, and its producer (`packages/test-runner/src/cli.ts:66`) hard-codes
  `"0.1"`. Nothing produces a `RunEvaluation` today (audit (d)), so no stored
  0.1 document is invalidated.

### `src/evaluation-validation.ts`

The existing rules are unchanged. The added rules:

- **Ids and lane.** Ids are kebab-case; `repeatIndex` is an integer; `lane`
  is one of the enumerated lanes.
- **Flow creation.** `flowCreated` is a boolean on the flow lane and `null` on
  the recording lane. `flowCreated: false` requires `reportedVerdict: null`.
- **Reported failure.** `automationFailureReported` is present exactly when
  `reportedVerdict` is `failed`, using `UNKNOWN` when FluxIQ gave no category.
  This keeps "no failure" and "unclassified failure" distinct when accuracy is
  computed.
- **Measurements.** Measurements must be finite and non-negative. Byte counts
  and truncations are integers. `actions` and `evidence` entries reject unknown
  keys.
- **Week 2 keys.** They must be present and `null`.
- **New `validateLlmUsage` export.**
  - A disabled provider requires `profileId: null` and `calls: 0`.
  - `deterministic-dry` requires `calls: 0`.
  - Any other mode requires a kebab `profileId`.
  - When `llm` is nested, its issues are reported under `$.llm.*`.
- **Not enforced: `harnessActivations === 0` with the provider disabled.**
  That is the Week 1 metric under measurement, so a run that violates it must
  still be recordable. A test covers this.

### `src/bench-report.ts` (new)

- **`BenchReport` fields:**
  - identity and scope: `schemaVersion`, `reportId`, `generatedAt`,
    `corpusId` (for example `fluxbench-week1`), `repeatCount`
  - `target`: `benchTargets`, checked at compile time against
    `FluxIQExecutionMetadata["targetMode"]`
  - `workflows`: `BenchWorkflowResult[]`, each with `corpusRowId` (for example
    `W05`), `scenarioId`, `workflowId`, `variantId`, `runs`, `passRate`, and
    `flakeClass` (`stable-pass | stable-fail | flaky`)
  - `metrics`, `llm`, and `comparison: BenchComparison | null`
- **`BenchCorpusMetrics`:**
  - Eight rates, one per Metrics rate row: `flowCreationSuccess`,
    `initialExecutionSuccess`, `deterministicReplaySuccess`, `fuzzyRecovery`,
    `falseFailure`, `falseSuccess` (the inverse, reported separately),
    `failureClassificationAccuracy`, and `harnessActivation`. Each is a
    `BenchRate { count, total, workflows, rate }`.
  - Distributions, each a `BenchDistribution { samples, p50, p95 }`:
    `actionLatencyMs` keyed by action type, `runDurationMs`,
    `sanitizedPacketBytes`, and `rawSnapshotBytes`.
  - `truncationCount`, plus the five Week 2 fields as `null`.
- **Tolerance.** `BENCH_TOLERANCE` is `{ rateWorkflows: 1, latencyP95Ratio: 0.25 }`
  and frozen.
  - A rate counts as `equivalent` when it is within `1 / workflows` of the
    candidate's rate population, that is, one workflow.
  - A p95 latency counts as `equivalent` when it is within 25% of the baseline
    p95.
  - Lower is better for `falseFailure`, `falseSuccess`, `harnessActivation`,
    and all latency.
- **`compareBenchMetric(metric, baseline, candidate)`** judges one metric.
  **`compareBenchReports(baseline, candidate)`** compares every metric both
  reports measured: rates in table order, then action types by name, then run
  duration. It throws on different corpora or when a report is compared with
  itself.
- **Metric ids:** `rate:<name>`, `action-latency-p95:<actionType>`, and
  `run-duration-p95`.
- The validator recomputes entries with the same function, so producers and
  the validator cannot drift.

### `src/bench-report-validation.ts` (new)

Exports `validateBenchReport`, `assertBenchReport`, and `parseBenchReportJson`.
The rules:

- **Runs and flake class.** `runs` equals `repeatCount`, which is capped at
  1..100 (the runner's `--repeat` bound). `passRate × runs` is a whole number.
  `flakeClass` is derived from `passRate`.
- **Result identity.** Each (scenario, workflow, variant) appears once. A
  corpus row maps to one (scenario, workflow), but several rows may share one;
  W20–W23 are variants of a single workflow.
- **Rates.** `count ≤ total`, and `workflows ≤ total ≤ workflows × repeatCount`.
  `workflows` cannot exceed the number of results. `rate` equals `count/total`,
  or is `null` exactly when `total` is 0.
- **Distributions.** They are `null` when there are no samples, and p50 is at
  most p95.
- **Comparison.** Every comparison entry must match `compareBenchMetric`
  recomputed against this report: candidate value, tolerance, and outcome.
  `baselineReportId` must differ from `reportId`, and metrics must be unique.

### `src/index.ts`

Two barrel lines: `./bench-report.js` and `./bench-report-validation.js`.

### Tests (new)

- `tests/evaluation-contracts.test.mjs`: 9 tests.
- `tests/bench-report-contracts.test.mjs`: 8 tests. They cover tolerance
  boundaries, including an exact 25% boundary and a one-workflow rate delta,
  plus the direction rules and validator recomputation.

## Commands run and observed results

1. `pnpm --filter @fluxiq-web-extension/test-contracts test`: the tsc build
   succeeded, and the run ended with `# tests 47`, `# pass 46`, `# fail 1`. The
   one failure is
   `not ok 36 - run evaluations enforce failure classification, finite metrics, unique invariants, and verdict consistency`
   at `runtime-contracts.test.mjs:129`, with `Got unwanted exception ... RunEvaluation validation failed: $.scenarioId ... $.adaptationReuse`.
   That fixture predates the new fields.
2. `node --test tests/evaluation-contracts.test.mjs tests/bench-report-contracts.test.mjs`
   ended with `# tests 17`, `# pass 17`, `# fail 0`.
3. A scratch copy of `runtime-contracts.test.mjs`, with only line 130's
   fixture completed and the import made absolute:
   `node --test <scratch>` ended with `# tests 11`, `# pass 11`, `# fail 0`.
4. `pnpm --filter @fluxiq-web-extension/test-runner check`
   (`tsc -p tsconfig.json --noEmit`) exited 0.
5. `pnpm --filter @fluxiq-web-extension/agent-orchestrator check`, the other
   `RunEvaluation` consumer, exited 0.
6. `pnpm --filter @fluxiq-web-extension/agent-orchestrator test`:
   - First run: `# tests 16`, `# pass 15`, `# fail 1`. The failure was
     `not ok 1 - CLI creates, validates, and renders a bounded packet as JSON`,
     a test that does not use `RunEvaluation`.
   - `node --test tests/cli.test.mjs` alone showed no failure.
   - A rerun of the same pnpm command: `# tests 16`, `# pass 16`, `# fail 0`,
     exit 0.
   - I treat the first failure as transient interference from parallel work,
     per the concurrency note.
7. `node scripts/structure-audit.mjs`:
   - Before my edits it printed `passed (27 warning(s), 19 baselined)` and
     `structure-audit: 1 baseline entries can be lowered.`
   - After my edits the output was identical. The audit reads only
     `git ls-files`, and my new files are untracked.
   - **The "can be lowered" line appears in every run, including before my
     edits. It is not from my files.**
8. The audit rerun with a scratch copy of the git index (`GIT_INDEX_FILE`; the
   real index was never touched):
   - With my four new files staged: `passed (27 warning(s), 19 baselined)`.
     There was no test-contracts finding beyond the two pre-existing
     exported-values warnings.
   - Also staging the supervisor's untracked `failure-category.ts` and
     `scenario-workflow.ts`, which simulates the committed state:
     `passed (28 warning(s), 19 baselined)`.
   - The one extra line is
     `warn [directory-files] packages/test-contracts/src/: 17 source files is past the 15-file advisory threshold.`
     It is advisory and not ratcheted; the hard limit is 25.
9. Size of each file I changed or created:

   | File | Lines | Exported values |
   | --- | --- | --- |
   | `evaluation.ts` | 113 | 4 |
   | `evaluation-validation.ts` | 144 | 7 |
   | `bench-report.ts` | 153 | 7 |
   | `bench-report-validation.ts` | 143 | 3 |

   All are under the advisory limits of 400 lines and 8 exported values.

## Fixture patch for the supervisor

In `packages/test-contracts/tests/runtime-contracts.test.mjs:130`, replace the
fixture's ending `metrics: { latencyMs: 12 } };` with:

```js
metrics: { latencyMs: 12 }, scenarioId: "basic-form", workflowId: null, variantId: null, repeatIndex: 0, lane: "flow", flowCreated: true, oracleVerdict: "failed", reportedVerdict: "failed", automationFailureReported: { category: "TARGET_NOT_FOUND" }, automationFailureExpected: null, harnessActivations: 0, durationMs: 12, actions: [], evidence: { sanitizedPacketBytes: [], rawSnapshotBytes: [], truncationCount: 0 }, llm: { mode: "disabled", profileId: null, calls: 0 }, harnessRecovery: null, adaptationCost: null, adaptationValidation: null, adaptationPersistence: null, adaptationReuse: null };
```

The test's other assertions are unchanged and pass: NaN metric rejection,
duplicate invariant rejection, and parse of a failed verdict.

## Not verified

- No producer exists yet for `RunEvaluation` or `BenchReport`; the contracts
  are exercised only with hand-built fixtures.
- The agent-orchestrator `.mjs` tests (`cli.test.mjs:92-93`,
  `orchestrator.test.mjs:72-73`) build minimal 0.1-shaped `RunEvaluation`
  objects. They pass because the orchestrator never validates evaluations, but
  they no longer match the type. They would fail if the orchestrator started
  calling `assertRunEvaluation`.
- The percentile method (nearest-rank or interpolated) is left to the bench
  producer. The contract checks only `p50 ≤ p95`.
- I did not run `pnpm check`, `pnpm test`, or `pnpm build` at the repository
  root.

## Open questions or contradictions found

1. **Brief contradiction.** The Definition of done requires the test-contracts
   test suite to pass. Ownership covers only new test files, and the existing
   `runtime-contracts.test.mjs:129-134` constructs a minimal `RunEvaluation`.
   The patch above resolves it.
2. **Lane values were my choice.** They are `recording | flow`: the "Testing Lab
   recording lane" (runner brief) and the Metrics table's "Flow lane". The
   runner does not name lanes today. Extend `evaluationLanes` if the plan
   intends others, such as a content-harness lane.
3. **The `llm` shape was my choice.** The brief names the field only. It is
   `{ mode, profileId, calls }`. `profileId` is checked as kebab-case. The
   stricter secret-like screen, `safeIdentifier` in `llm-validation.ts:171`, is
   private; exporting it would let `LlmUsage` reuse it.
4. **Two "corpus id" fields.** The brief uses "corpus id" for both the report's
   corpus and the row. I named the row id `corpusRowId` (`W05`) and the report's
   id `corpusId` (`fluxbench-week1`) so they cannot be confused.
5. **Metrics not compared.** The comparison covers rates and p95 latencies only.
   Evidence sizes and the truncation count are reported but not compared,
   because the plan sets no tolerance for them.
6. **Rate units.** `BenchRate.count/total` is in "the unit its metric defines,
   workflows or runs". For example, harness activation is naturally per run and
   initial execution per workflow. The aggregator brief should fix the unit for
   each metric. The ±1-workflow tolerance is `1 / workflows` either way.
7. **Unarmed identity-drift workflow.** It has no corpus row: W20–W23 are its
   variants. A bench that includes the unarmed run must assign it a
   `corpusRowId`, which is required.
8. **Duplicated id pattern.** The kebab-id regex now exists privately in
   `validation.ts`, `evaluation-validation.ts`, and
   `bench-report-validation.ts`. Exporting it from `validation.ts`, which the
   supervisor owns, would remove the copies.
9. **Advisory warning on commit.** Committing the Batch B files will add the
   directory-files advisory for `packages/test-contracts/src/` (17 files; the
   hard limit is 25).
