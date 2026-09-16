# x5-5-flow-lane-judging — the Flow lane judges extraction from Core's run datasets, and FluxBench publishes real extraction metrics

## Outcome

**Done.** X5.5 was **not blocked**: Core's K5 (`runDetail.datasets`) and K8
(`get-run-dataset-page`) both exist and are what the lane now reads. No interim
reader was built.

The Flow lane reads Core's run datasets, judges each recorded `extract` step
against them, publishes one counts-only measurement per step, and those
measurements flow through `RunEvaluation.extraction` into a new per-lane
`BenchReport.metrics.extractionByLane` built on `benchExtractionAccuracy` —
which was previously written and left unwired. FluxBench's extraction metrics
are real numbers rather than an absent block.

Validation: test-runner **904 tests, 904 pass, 0 fail**; test-contracts **92
pass, 0 fail**; both type checks clean; `structure-audit: passed (56
warning(s), 17 baselined)`.

## Whether it was blocked, and the evidence

The brief required this to be settled first. Read-only in `F:\!FluxIQ`:

- **K5.** `AutomationStudioFlowRunDetail` declares
  `datasets?: AutomationStudioRunDatasetSummary[]`
  (`packages/fluxiq/src/programs/automation-studio/model/flow-adaptation.ts:320`),
  and the runtime stream store attaches them
  (`storage/project/runtime-stream-store.ts:241,259`, `withRunDatasets`), absent
  when the run stored none.
- **K8.** `AUTOMATION_STUDIO_ENDPOINTS.getRunDatasetPage = "get-run-dataset-page"`
  (`api/contracts/endpoints.ts:149`), handled at
  `api/handlers/datasets.ts:36-52`, answering `{ dataset }` with an
  `AutomationStudioRunDatasetPage` (`summary`, `schema`, `rows`, `nextCursor`).

Both are reachable through the control client the lane already has
(`automationStudioCall`), so no new Core surface and no interim reader were
needed. The plan's reason for forbidding an interim reader was confirmed
while reading Core: a stored attempt never carries its rows at all. Core
replaces them with a `$dataset` marker and keeps only the count
(`runtime/service/summaries/conversions.ts`, `datasetMarkerRecordCount`), so
the pre-existing `extractedRecords(attempt)` reader in
`persisted-flow-run.ts` — which searched `structuredResult` and
`metadata.result` for an `extracted` array — could never have returned a
record from a real run. It is deleted.

## What changed and why

### 1. The reader: `flow-lane/run-datasets.ts` (new)

`readRunDatasets(control, { projectId, runId, summaries }, bounds)` pages
`get-run-dataset-page` with `limit: 200` until `nextCursor` is null, and:

- rebuilds each row over the page's `schema.fields`, restoring `null` for every
  field the row lacks (D16), because an expectation spells an optional miss as
  `null` and `matchesRecord` matches `null` only against `null`;
- keeps a key the schema does not name, so it reaches the measurement's
  `unexpectedFields` instead of being filed as a non-string value;
- leaves a cell that is neither a string nor null **out of the record** and
  counts it in `nonStringValues` — it is not restored as `null`, because `null`
  means "the page held no value" and a cell the reader could not carry is not
  that;
- ends on a cursor Core did not advance, rather than looping;
- **refuses** a dataset whose rows do not add up to the summary's
  `recordCount`: a short read would understate an extraction and turn a record
  regression into a missing one.

`storeTruncated` is named apart from the extraction's own `truncated`
deliberately: a dataset's `truncated` is Core dropping rows past its per-run
cap, not the page's item cap.

### 2. The lane: `persisted-flow-run.ts`, `expectations.ts`, `run-flow-lane.ts`

- `PersistedFlowRunOutcome.extracted` is now `FlowRunDataset[]` — the run's
  datasets — instead of records per extract attempt. The attempt reader gains
  `recordCount` from Core's `metadata.recordCount` (K5), and the outcome gains
  `extractionDurationsByNode`, summed from Core's raw attempts.
  **Node ids stay off `PersistedFlowAction`**: two existing tests assert that
  no node id survives `JSON.stringify(outcome)`, so the durations live in a
  `Map` keyed by node id, which serializes to `{}` and leaves the lane's
  published shape unchanged.
- `judgeFlowExtraction` (new) pairs datasets with the script's `extract` steps
  **by candidate order** — each dataset placed by the earliest position its
  writing nodes hold in the recording's candidate order, then zipped with the
  extract steps in script order — and produces one `RunExtractionMeasurement`
  per extract step (`judged`, `not_run`, or `not_expected`). It never throws:
  the measurements are published on the observation and in
  `snapshots/flow-lane.json` *before* any expectation is judged.
- `assertFlowExtraction(judgement)` then fails, in this order: fewer extract
  nodes than recorded extract steps (`recording.contract` — the
  `not_applicable` verdict is **gone**, since an `extract` step now records a
  data-extraction action); any non-string value; an expectation naming a step
  the script does not extract from (`fixture.invalid`, defence behind
  `checkExtractionReferences`); an expected step with no dataset; then the
  records, through the shared `assertExtraction`.
- `flowLaneSnapshot` publishes an `extraction` block: the expectation, extract
  nodes against extract steps, unpaired datasets, and per step its position,
  status, counts, what could not be judged, and Core's dataset flags. No step
  id, field name or value — a test asserts the step id does not appear.

### 3. `pages` and `truncated` are stated as unjudged, not refused and not passed

This is the one judgement call in the change, and the brief's accuracy contract
is what decided it.

The Flow lane **cannot observe** either. Core's run detail carries no page
count for an extraction and its datasets carry none; the dataset's `truncated`
is a different event from the extraction's. Three options existed:

1. hand the entry to `assertExtraction` as it is — it **refuses** an entry
   declaring `pages` with nothing reported (`fixture.invalid`), which would
   fail every paginated Flow-lane row (W05, W07, and product-catalog's
   `extract-all-pages`, `extract-in-stock`, `extract-numbered-pages`, plus
   infinite-feed) for a limit of the lane rather than a defect of the fixture;
2. drop the member silently — the thing X5.4 exists to prevent;
3. **remove it from the entry handed to the assertion, name it on the step as
   `unjudged`, keep the declared side in the measurement, and let the rate
   built on it publish `rate: null`.**

Option 3 is what landed. The records are still compared in full, which is the
stronger claim on this lane anyway — a step that read only page 1 cannot
produce page 3's records — and nothing reads as judged that was not. This is a
**deviation from nothing in the plan** (the plan does not address it) but it
does change what a paginated Flow row asserts, so it is called out here and in
the open questions.

### 4. `RunExtractionMeasurement.expectedPages` (contract change)

`paginationAccuracy` is "steps whose pages equal `expected.pages` ÷ paginated
steps" (`ex-d:225`). A measurement carrying only `pagesFollowed` has one side of
that comparison, so the metric could not exist. `expectedPages: number | null`
was added to the contract and validated like `pagesFollowed`; the rate's
population is the steps where **both** are stated. On the Flow lane today that
population is empty, so the rate is `null` — stated, not invented — and it
becomes real the moment any lane reports pages, with no further contract change.

### 5. Field completeness could only ever have read 1.000, and no longer can

With `null` restored for every schema field, `Object.hasOwn` is true for every
expected field on this lane, so `presentFields === expectedFields` always and
`extractionFieldCompleteness` would have published 1.000 for every bench while
measuring nothing — the same shape of defect as x5f's false 1.0.

`measureExtraction` now counts a field as present only when the record
**carried a value** for it: a field present with `null` carried none, unless the
expectation asked for `null` there, in which case the absence is exactly what
was expected. `assertExtraction` uses the same predicate for its failure (so the
two cannot disagree, and its `findIndex` can no longer return -1), and its
message changed from "record N is missing K required field(s)" to "record N
carried no value for K required field(s)", which is what actually happened.

### 6. The measurements reach the bench

`RunLaneObservation` gains `extraction`; `evaluateObservedRun` copies it instead
of writing `null`; `evaluateFlowRun` takes it from the lane's observation and
`reconstructBenchEvaluation` carries it out of the bundle's `evaluation.json`.
The recording lane states `null` — **unmeasured**, not "no extraction step" —
because it asserts each extract step as it runs and keeps no per-step
measurement.

### 7. `bench/extraction-metrics.ts` (new), wired into `aggregateBenchReport`

`benchExtractionMetrics(results)` returns a lane's `BenchExtractionMetrics`, or
`undefined` when no run on the lane measured extraction, so a bench that
measured none states no block at all (absent means unmeasured, never zero).
`corpusMetrics` states it per lane, like the rates, and omits
`extractionByLane` entirely when no lane measured.

Every rate obeys one rule — **a step that could not judge something enters no
rate for it** — and each states the workflows it stands on:

| Metric | Population | Hit |
| --- | --- | --- |
| `extractionRecordAccuracy` | compared steps' records (`benchExtractionAccuracy`) | Σ matched ÷ Σ max(expected, observed) |
| `extractionCountAccuracy` | count-only steps | observed count equals expected |
| `extractionFieldCompleteness` | judged steps' expected fields | the record carried a value |
| `paginationAccuracy` | judged steps stating **both** page counts | they are equal |
| `extractionExactSuccess` | runs with a judged step | every judged step matched |
| `extractionFalseSuccess` | positive runs with a judged step and a verdict | FluxIQ passed while a real comparison failed |

Two asymmetries are deliberate and documented in the code:

- a step that judged nothing is a **miss** for `extractionExactSuccess` (the
  claim "everything matched" cannot be made without a comparison — the rule
  `initialExecutionSuccess` applies to a run that executed nothing, and for the
  same reason: excluding it would shrink the denominator silently);
- the same step is **not** a hit for `extractionFalseSuccess`, because "FluxIQ
  said fine while the extraction was wrong" needs a comparison that actually
  failed. Neither rate claims more than was compared.

`report.md` gains an Extraction section stating each lane's basis in a sentence
("3 step(s) judged and 0 not: 1 compared their records, 1 stated a count alone
and compared no value, and 1 could judge neither"), the six rates with `n/a` for
an empty population, and the two distributions. `comparisonMetricRows` now
includes `extraction:<lane>:<metric>` ids, so a comparison lists them instead of
silently omitting them.

## Files changed

Owned by the brief:

- **New:** `packages/test-runner/src/flow-lane/run-datasets.ts`,
  `packages/test-runner/src/bench/extraction-metrics.ts`,
  `packages/test-runner/src/bench/tests/extraction-metrics.test.ts`
- `packages/test-runner/src/flow-lane/{expectations,persisted-flow-run,run-flow-lane,lane-observation,index}.ts`
  and `tests/{expectations,persisted-flow-run,run-flow-lane,lane-observation}.test.ts`
- `packages/test-runner/src/bench/{aggregate-report,evaluate-run,run-bench,render-markdown,comparison-details,index}.ts`
  and `tests/{evaluate-run,run-bench,render-markdown}.test.ts`
- `packages/test-contracts/src/{evaluation,evaluation-validation}.ts` and
  `tests/evaluation-contracts.test.mjs`

Outside the brief's list, each minimal and forced:

- `packages/test-runner/src/run-expectations/extraction.ts` and
  `tests/extraction.test.ts`. `ExtractionStepMeasurement` is
  `Omit<RunExtractionMeasurement, …>`, so a contract field is a compile error in
  the producer until it is produced; and this file is where a restored `null`
  would have made field completeness meaningless (§5). x5f edited the same file
  for the same structural reason.
- `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts`: one
  line. It is documented as "the one place a `RunEvaluation` is assembled and
  validated", so copying the lane's measurements there keeps both producers
  (`lab run` and `lab bench`) on one assembly point. Patching the evaluation
  afterwards inside `bench/` would have forked that.
- `packages/test-runner/src/run-evaluation/tests/{observed-run-evaluation,evidence-budget-invariant,single-run-evaluation}.test.ts`:
  one literal each, because `RunLaneObservation` now requires `extraction`.
  Required rather than optional deliberately: an optional field would let a
  future producer forget it and silently publish "unmeasured".

Nothing under `apps/extension/`, `domain/`, `apps/scenario-lab/` or FluxIQ Core
was touched; Core was read only.

## Commands run and observed results

All from `F:\!FluxIQWebExtension`.

1. `pnpm --filter @fluxiq-web-extension/test-runner test`
   (`pnpm build && node --test "dist/**/*.test.js"`) →
   `# tests 904 / # pass 904 / # fail 0 / # duration_ms 21080.8789`.
   Run twice whole after the last change; both green. (866 before this work.)
2. `pnpm --filter @fluxiq-web-extension/test-runner check`
   (`tsc -p tsconfig.json --noEmit`) → no diagnostics, exit 0.
3. `pnpm --filter @fluxiq-web-extension/test-contracts test` →
   `# tests 92 / # pass 92 / # fail 0`.
4. `pnpm --filter @fluxiq-web-extension/test-contracts check` → no diagnostics.
5. `node scripts/structure-audit.mjs` →
   `structure-audit: passed (56 warning(s), 17 baselined)`. The same 56 before
   and after the three new files were made visible to it, so none of them is
   mine. `packages/test-runner/src/bench/` is now **24 source files against the
   hard limit of 25**; the next file added there forces a subdirectory.
6. `pnpm --filter @fluxiq-web-extension/test-evidence check` and
   `... agent-orchestrator check` → no diagnostics. They are the other
   consumers of `@fluxiq-web-extension/test-contracts`.

Intermediate runs during the work found and fixed seven real failures (the
measurement narrowing `expectedPages` away, a fake control missing a second
dataset page, a pairing test whose Flow had one extract node for two steps, and
the node-id leak the two `must not travel` tests caught). No failure in any run
looked load-related, and none needed a rerun to pass.

**The structure audit reads `git ls-files`, so the three new files were made
visible to it with `git add -N`.** `git reset` is blocked for workers, so they
are still marked intent-to-add: `git add` their contents before committing, or
git will refuse the commit.

## Not verified

- **No Lab run and no bench run.** Everything here is unit-level against fakes.
  No real Core answered `get-run-dataset-page`, no real extract node wrote a
  dataset, and no `report.json` with an `extractionByLane` block has ever been
  produced. X5.7's four Lab runs and the A/B pair are what would exercise this.
- **The dataset page envelope is read from Core's source, not from a live
  call.** The handler returns `{ ok: true, payload: { dataset } }` and the lane's
  `automationStudioCall` unwraps to the payload, so the reader takes
  `payload.dataset`. That matches how `readRunDetail` takes `payload.runDetail`,
  but it has not been observed end to end.
- **Whether `metadata.recordCount` and the attempt durations line up with the
  datasets on a real run.** The duration attributed to a step is the sum of its
  node's attempt durations, which includes any retry of that node.
- **The recording lane still publishes no measurements** (`extraction: null`),
  so a bench states an extraction block for the Flow lane alone. Wiring the
  recording lane means publishing measurements from `run-scenario.ts`, which is
  X5-B's file and outside this brief.
- `pnpm check`, `pnpm test` and `pnpm build` were not run whole: another worker
  has files in flight in this tree (an untracked
  `docs/working/mvp-week2-automation-loop-plan/reports/w2-test-split.md`
  appeared during the work). The per-package gates above were run instead.

## Open questions or contradictions found

1. **`docs/architecture/testing-facility.md` is now stale in two places and
   X5.7 must fix it.** Line 945 says a workflow's extraction "is usually
   `not_applicable` on this lane and is judged on the recording lane alone";
   line 958 says the snapshot states "whether extraction was `judged`,
   `not_applicable` or `not_expected`". Both are wrong now: `not_applicable` no
   longer exists, the snapshot carries an `extraction` block, and the Flow lane
   judges the records while naming `pages` and `truncated` as unjudged.
2. **The `pages`/`truncated` decision (§3) is a lane-capability gap that will
   show up as `paginationAccuracy: null` forever** unless one of two things
   happens: Core carries an extraction's page count on the attempt (a Core
   change, K-side), or the recording lane publishes its own measurements, where
   the intent seam does report `pagesRead`. The second is the cheaper one and
   belongs with whoever wires the recording lane.
3. **A paginated Flow-lane row now asserts slightly less than the fixture
   wrote.** Its records are compared exactly, but its declared page count is
   not. A reviewer who wants the stricter behaviour — failing such a row as
   `fixture.invalid` until Core reports pages — can get it by not narrowing the
   entry; it is one function (`judgeableEntry`). I did not choose that because
   it fails runs in which FluxIQ demonstrably worked.
4. **`extractionFieldCompleteness` changed meaning for the recording lane too**
   (§5), since FluxIQ's own reader returns `null` for an optional miss through
   the intent seam. That is the correct meaning, but if any earlier measurement
   is ever compared against a new one, the two are not the same statistic. No
   such measurement exists on disk today.
5. **x5f's open question 1 still stands**: a `not_run` step is outside every
   rate, so a step that was expected and never ran leaves the denominator
   rather than contributing 0. `extractionExactSuccess` does not close it —
   its population is runs with at least one *judged* step, so a run whose only
   extract step never ran is outside it as well. Such a run fails anyway; the
   choice is recorded rather than changed.
6. **A restored `null` makes the Flow lane's records carry every schema field,**
   so an expectation whose `records` omit a field the step extracts will now
   fail as an unexpected field unless `optionalFields` names it. That is the
   intended strictness, and the X5.4 fixtures list their fields, but it is the
   most likely source of a first-run surprise in X5.7's Lab runs.
