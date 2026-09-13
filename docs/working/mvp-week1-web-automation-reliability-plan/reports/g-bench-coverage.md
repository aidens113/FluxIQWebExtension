# g-bench-coverage — the bench executes W01-W18 on the Flow lane

Worker report, 2026-09-13. The brief is `briefs/finish-week1.md`
"g-bench-coverage", as amended after the first attempt stopped Blocked. The base
was `HEAD 81d7186`, with other workers editing the tree at the same time.

## Outcome

**Done for item 1. Item 3 was withdrawn by the supervisor.**

A week1 bench now plans every unarmed workflow on both lanes, and every variant
on the Flow lane. That is **66 runnable results per repeat**: 23 on the
recording lane, and 43 on the Flow lane (23 unarmed plus 20 variants). W01-W18
and W24-W28 run on both lanes.

The two crashes the first attempt found are gone, because a result's lane is
now part of its identity:
- **Grouping.** `groupBenchResults` no longer merges one row's two lanes into a
  single result.
- **Report contract.** The validator accepts one row, scenario, workflow and
  variant on two lanes, and still rejects a true duplicate within one lane.

Every rate in `report.json` is per lane (`metrics.ratesByLane`), never combined.
A report with no Flow-lane row states only `recording` and is valid. The eight
pre-lane bench reports on disk still validate and still compare, as the
recording lane.

**What each proof shows:**
- A mutation of each of the three guards makes a named test fail. Each file was
  restored and matched its recorded SHA-256.
- test-contracts `check` and `test` pass: exit 0, 63 of 63.
- test-runner `check` and `test` pass: exit 0, 483 of 483, on a rerun (see
  below).

**One file outside the listed Owns was changed:**
`packages/test-runner/src/bench/tests/compare-reports.test.ts`. Three string
literals `"rate:initialExecutionSuccess"` became
`"rate:recording:initialExecutionSuccess"`. The comparison id is defined in
`bench-report.ts`, which I own, and it had to name the lane. Without this edit,
test-runner `test` failed 2 tests (9 and 11) on this change alone. No other
worker owns the file, and nothing else in it changed.

## What changed and why

### The contract: `packages/test-contracts/src/`

**`bench-report.ts`**
- `BenchWorkflowResult.lane?: EvaluationLane` is new. It is absent only in a
  report written before lanes.
- `BenchCorpusMetrics.ratesByLane?: Partial<Record<EvaluationLane, BenchRates>>`
  is new. It holds exactly the lanes the report lists results on.
- `rates?` stays, for pre-lane reports only; it is never written now. New type
  alias: `BenchRates`.
- Comparison ids are now `rate:<lane>:<metric>`. `compareBenchReports` compares
  each lane's rates, then action latencies, then run duration.
- A pre-lane report's `rates` compare as the recording lane only when it lists
  no variant. All eight on disk qualify: none of their `runs.json` files has a
  `lanes` key. A pre-lane report that lists a variant ran the Flow lane too, so
  its combined rates compare as neither lane.
- `compareBenchMetric` now takes `Pick<BenchReport, "metrics" | "workflows">`,
  because the legacy reading needs the results.
- The schema version stays `0.1`. Earlier optional additions (`notExecutedRuns`)
  set that precedent.

**`bench-report-validation.ts`**
- Result identity now includes `lane ?? null`.
- Every result must state a lane, or none may.
- `lane`, when present, must be one of `evaluationLanes`.
- **When the results state lanes:**
  - `rates` is refused.
  - `ratesByLane` must hold a set for each lane that has results, and none for a
    lane without.
  - Each set is bounded by that lane's own result count.
- **When they don't:** `rates` is required, and `ratesByLane` is refused.
- The comparison check passes the report's results to `compareBenchMetric`.

### The bench: `packages/test-runner/src/bench/`

**`aggregate-report.ts`**
- `BenchResultRuns.lane` is new.
- The `groupBenchResults` key includes the lane.
- `checkRuns` names the lane, and refuses a result holding a run from another
  lane.
- `workflowResult` writes `lane`.
- New export `benchResultsByLane`: the one place a bench's lanes are listed, in
  `evaluationLanes` order.
- Metrics carry `ratesByLane`, each lane counted over its own results.
  Distributions and the execution counts still cover every run.

**`expand-corpus.ts`**
- `laneForResult` is replaced by
  `lanesForResult(variantId) → null ? ["recording", "flow"] : ["flow"]`.
- A result is planned on each declared lane that can run it.
- A result that no declared lane can run is planned once, skipped with its
  reason. That keeps `smoke`'s plan exactly as before, and a variant on a
  recording-only corpus is still skipped with `VARIANT_NEEDS_FLOW_LANE`.
- `UNARMED_NEEDS_RECORDING_LANE` became `UNARMED_NEEDS_A_LANE`, since an unarmed
  workflow can now run on either lane. A grep found no consumer outside this
  file and its barrel.

**`run-bench.ts`**
- `resultKey` includes the lane, so the `runs.json` sort keeps an unarmed row's
  two lanes apart.
- Execution coverage is computed in total and per lane for the markdown.
- Doc and comment text now describe unarmed rows on both lanes.

**`render-markdown.ts`**
- A Lane column in Results.
- The Rates table has a Lane column and one row per lane × metric, with Not
  executed counted over that lane's population.
- A sentence under Rates says why rates are never combined.
- A "By lane:" line under FluxIQ execution.
- The coverage argument is now `BenchMarkdownCoverage { total, byLane }`.

**`corpus/bench-corpus.ts`, `corpus/week1.ts`**: doc comments only. The old
week1 comment said "Fourteen … are variants", which was stale; it is 20.

### Tests

- **`test-contracts/tests/bench-report-contracts.test.mjs`**
  - The fixture now has W05's workflow on both lanes.
  - New tests: "one result on two lanes is two results; the same result twice
    on one lane is still a duplicate" (proof B), "rates are per lane and never
    combined…", and "a report written before lanes still validates, and
    compares as the recording lane only when it lists no variant".
  - Existing tests moved to `rate:<lane>:<metric>` ids and per-lane bounds.
- **`bench/tests/aggregate-report.test.ts`**: new test "one unarmed row on both
  lanes is two results, each with its own rates; no rate is counted over both
  lanes" (proof A, plus the mixed-lane refusal). Existing tests read
  `ratesByLane`.
- **`bench/tests/run-bench.test.ts`**: the both-lanes bench now expects 7 runs
  (3 unarmed rows × 2 lanes, plus the variant) and 2 skipped. It asserts a
  report that validates with lanes, and per-lane rates: Flow
  `flowCreationSuccess` 4/4 and `initialExecutionSuccess` 4/4; recording 3/3.
  It also checks the markdown Lane columns. The recording-only tests assert a
  valid report stating `recording` alone.
- **`bench/tests/week1-corpus.test.ts`**: the count test asserts
  `[66, 23, 0, 23, 20]` (runnable; recording unarmed and variants; Flow unarmed
  and variants). It also checks that the Flow lane runs exactly the recording
  lane's unarmed workflows, in order W01-W18 then W24-W28.
- **`bench/tests/compare-reports.test.ts`**: the three id literals, as above.

## Commands run and observed results

**Before the change.** These are the pre-change observations:
- `node --test tests/bench-report-contracts.test.mjs` against the pre-change
  contracts dist: `exit=1`, `# tests 13 # pass 1 # fail 12`.
- Scratch proof over the pre-change test-runner dist (first attempt):
  - A: `THREW W01 basic-form/primary/unarmed has 2 runs, not the bench's 1`
  - B: `THREW … $.workflows[1]: repeats another result's scenario, workflow, and variant`

**Mutation proofs.** Each was run alone, with SHA-256 hashes recorded before.

| Mutation | Command | Observed |
| --- | --- | --- |
| M1: `lanesForResult` reverted to `["recording"]` for unarmed | test-runner `pnpm build`, then `node --test dist/bench/tests/week1-corpus.test.js dist/bench/tests/run-bench.test.js` | build exit 0; test exit 1; `# pass 10 # fail 2`. `not ok 12 - week1 plans 66 runnable results per repeat…` with diff `+ 43 - 66` and `+ 0` in place of 23. `# runnable: 43 (23 recording; 20 flow, 0 unarmed and 20 variants)`. `not ok 3 - a corpus that runs the Flow lane runs every unarmed row there…` |
| M2: `groupBenchResults` key without `evaluation.lane` | build, then `node --test dist/bench/tests/aggregate-report.test.js dist/bench/tests/run-bench.test.js` | build exit 0; test exit 1; `# pass 14 # fail 2`. `not ok 6 - one unarmed row on both lanes is two results…`, and `not ok 11` with `error: "W01 basic-form/primary/unarmed on the recording lane has 2 runs, not the bench's 1"` |
| M3: validator identity without the lane | test-contracts `pnpm build`, then `node --test tests/bench-report-contracts.test.mjs` | build exit 0; test exit 1; `# pass 4 # fail 9`. `not ok 3 - one result on two lanes is two results…`, where `issuesOf(report())` gave actual `['$.workflows[1]']` against expected `[]` |
| Restore check | `sha256sum -c g-bench-coverage-guards.sha256` | `expand-corpus.ts: OK`, `aggregate-report.ts: OK`, `bench-report-validation.ts: OK`; `restore-exit=0` |

**Final gates.** These ran after the restores, in order, so both dists are
rebuilt unmutated.

| Command | Observed |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-contracts check` | exit 0 |
| `pnpm --filter @fluxiq-web-extension/test-contracts test` | exit 0; `# tests 63 # pass 63 # fail 0` |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | exit 0; no `error TS` |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | exit 1; `# tests 483 # pass 481 # fail 2`: `not ok 139` (redaction-attestation) and `not ok 186` (create-run-manifest), both `+ 'pending' - 'not_applicable'` |
| same, rerun once alone (binding rule) | **exit 0; `# tests 483 # pass 483 # fail 0 # cancelled 0`**; `# runnable: 66 (23 recording; 43 flow, 23 unarmed and 20 variants); skipped: 0` |
| `node scripts/structure-audit.mjs` | exit 1. The one FAIL is `[working-docs] docs/working/README.md is out of date`, a shared doc that is not mine. No warning or failure names any file I changed. |

The two failures on the first final run were in files another worker is editing
right now (`redaction-attestation/`, `run-manifest/tests/`,
`test-contracts/src/run.ts` and `run-validation.ts`, all shown modified by
`git status`), and they cleared on the rerun. Earlier in this session the same
area failed tests 148, 149 and 182, which also cleared.

`git diff --stat` over my files: 13 files, 509 insertions, 176 deletions.

## Not verified

- **No Lab run** (dispatch rule). The Lab proof for item 1 is a
  `--corpus week1` bench whose outputs show three things:
  - `runs.json` / `report.md` Runs list a `flow` run beside the `recording` run
    for each of W01-W18 and W24-W28;
  - `report.json` validates, with `workflows[].lane` and `metrics.ratesByLane`
    holding `recording` and `flow`;
  - the Rates table has a Lane column.

  Per repeat, 66 runs. `--repeat 3` is 198 runs, about 3.4-5.2 h
  (`i-lab-campaign` design item 1).
- **Comparison against a real pre-lane report on disk.** I checked that none of
  the eight `test-runs/bench/*/runs.json` has a `lanes` key, and a contract
  fixture of that shape compares. I did not run `lab compare` against
  `bench-mtxoim0b-8ca4952c` itself.
- **Consumers outside the test packages.** `cli.ts` prints the outcome, which
  did not change shape. A grep found no other reader of `metrics.rates`, and no
  architecture page under `docs/architecture` describes the report fields.
- **Evidence-size rendering is untouched** (item 3 withdrawn). The amended brief
  says raw snapshot bytes should read as "not Week 1" rather than as an empty
  list. That text is not in `render-markdown.ts`; it belongs to the Flow-lane
  follow-up.

## Open questions or contradictions found

1. **The ownership widening:** `bench/tests/compare-reports.test.ts`, three id
   literals (see Outcome). Please confirm, or reassign it.
2. **Distributions are still combined over both lanes.** That covers action
   latency p95, which is a gating compare metric, and run duration. Only rates
   were decided per lane. A week1 bench's action latency mixes the recording
   lane's probe actions with Flow-lane actions. Two week1 benches mix them in
   the same proportion, so A-against-B stays comparable, but a reader cannot see
   the latency per lane. `smoke` is unaffected, since it runs the recording lane
   only.
3. **A new corpus row changes the 66.** The count test states it explicitly, and
   its comment names W29. The supervisor's W29 row will need the count updated
   in the same change.
4. **Two public renames in the bench barrel:** `laneForResult` became
   `lanesForResult`, and `UNARMED_NEEDS_RECORDING_LANE` became
   `UNARMED_NEEDS_A_LANE`. A grep over `packages`, `scripts` and `apps` found no
   consumer, but the brief's mutation wording names the old function.
