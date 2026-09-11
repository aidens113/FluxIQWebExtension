# w1-bench report

Worker `w1-bench`, Phase 1.6a step 5: the `bench` verb and corpus metrics in
`packages/test-runner`.

## Outcome

**Done.** Every Definition-of-done item was observed:

- **Test suite.** `pnpm --filter @fluxiq-web-extension/test-runner test`
  passes: `# tests 356`, `# pass 356`, `# fail 0`, exit 0. The 19
  pre-existing failures no longer occur; w1-runner-test-repair's test files
  show as modified. My 21 new or changed tests are among the passes.
- **Bench run.** The literal command
  `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus smoke --repeat 2 --target isolated`
  wrote `test-runs/bench/bench-mtxh7z0e-7cc58fff/`. All 4 runs passed.
- **Halves.** `pnpm lab compare bench-mtxh7z0e-7cc58fff --halves` returned
  `equivalent`.
- **Two reports.** Comparing that report with another clean smoke report also
  returned `equivalent`.
- **Corpus resolution.** The `week1` rows that resolve today are listed
  below.

The supervisor's `FLUXIQ_TEST_ENV_FILES=none` is what made the literal
command possible. Overriding `FLUXIQ_TEST_TARGET` alone is refused;
see Open questions 1.

## What changed and why

### `packages/test-runner/src/bench/` (new; barrel `index.ts`)

- **`corpus/`** holds the corpora as data.
  - `bench-corpus.ts` holds the types.
  - `week1.ts` maps W01–W28 to scenario, workflow, and variant as the plan's
    corpus table lists them.
  - `smoke.ts` holds W01 basic-form and W28 iframe-checkout. Both are taken
    from `week1Corpus`, so their mapping cannot drift, and both have no
    variants.
  - `find-bench-corpus.ts` holds `benchCorpora` and `findBenchCorpus`.
  - Two ids are my readings of the table:
    - **W23** is the fixture's single `wrapped-aria` variant, for the table's
      "`wrapped` + `aria-variant`".
    - **W27** names its surfaces `disabled`, `detached`, and `blocked-url`,
      after the table's "disabled, detached, blocked URL". No fixture
      defines them yet.
  - W19–W23 exist only as variants, so they run no unarmed workflow.
- **`expand-corpus.ts`** turns each row into results: the unarmed workflow
  first, then each variant.
  - Each result is resolved through `resolveScenarioWorkflow`.
  - A resolved variant is skipped with `VARIANT_NEEDS_FLOW_LANE`, because
    only the Wave 2 Flow lane arms variants.
  - A result that does not resolve is skipped as `unresolved: <error>`.
- **`evaluate-run.ts`** builds one validated `RunEvaluation` per recording-lane
  run. `RECORDING_LANE_SOURCES` records where each value comes from and is
  written into `runs.json` and `report.md`.

  | Field | Value |
  | --- | --- |
  | `lane` | `recording` |
  | `flowCreated` | `null` |
  | `oracleVerdict` | `passed` on a pass; `failed` on a `runtime.behavior` failure (the category every page-fact, final-state, extraction, and console-error assertion throws); otherwise `null` |
  | `reportedVerdict`, `automationFailureReported` | From `run.json` `actions[].status` and `automationFailure` of the Core probe. `null` when FluxIQ ran no action or the lane could not observe it. `UNKNOWN` when an action failed without a category |
  | `durationMs` | `run.json` `finishedAt` minus `startedAt`; the bench's wall clock as a fallback |
  | `actions` | Per-action `durationMs` from `run.json`; unfinished actions are left out |
  | `harnessActivations` | `0`, source recorded: the recording lane runs no Flow |
  | Evidence sizes | Empty, and `truncationCount` `0`, source recorded: the bundle holds no packets or snapshots |
  | `llm` | `disabled` |
  | Week 2 fields | `null` |

  When `runScenario` throws, the run is recorded as `inconclusive` with the
  test-rig category, never as a pass.
- **`read-run-bundle.ts`** reads `run.json` (through
  `parseRunManifestJson`), the `summary.json` metrics, and the sequences of the
  final and error evidence events. A file it cannot read becomes a recorded
  problem, not a crash.
- **`aggregate-report.ts`** builds and validates the `BenchReport`.
  - **Per result:** pass rate and flake class.
  - **Rates:** one per Metrics-table row. `BENCH_RATE_DEFINITIONS` fixes each
    rate's unit and population:
    - initial execution counts workflows, from each result's earliest repeat;
    - the other rates count runs;
    - a false failure or false success is counted over positive runs only;
    - negative runs, those with `expected.failure`, count toward
      classification accuracy.
  - **Distributions:** nearest-rank p50 and p95 per action type, plus run
    duration and the two evidence sizes.
  - `groupBenchResults` groups evaluated runs into results.
- **`distribution.ts`** computes nearest-rank p50 and p95.
- **`render-markdown.ts`** writes `report.md`. It contains the results, the
  skipped results with their reasons, every run's verdict and problems, the
  rates with their units and populations, the distributions, and the
  measurement sources.
- **`report-store.ts` and `load-report.ts`** handle the bench directory,
  `<runs dir>/bench/<bench id>/`, which holds:
  - `report.json`
  - `report.md`
  - `runs.json`, which lists every planned run, skipped runs and their
    reasons included, and is rewritten after each run
  - `evaluations/<run id>.json`

  A report can be referenced by bench id, by the path to its `report.json`,
  or by its directory.
- **`run-bench.ts`** (`runBench`) makes one pass over the corpus per repeat,
  so each repeat is a whole pass. It checks every bundle with `inspectRun`.
  - It refuses `existing` and `clone` targets (Open questions 4).
  - Its status is `passed` only when at least one run was evaluated and every
    evaluated run passed.
- **`compare-reports.ts`** is the new `compare`, replacing the hard-coded
  two-gate `compareRuns`.
  - It reports `improved`, `regressed`, or `equivalent` for each metric, using
    the contract's `compareBenchReports` tolerances, plus an overall outcome.
  - `--halves` splits one report's repeats into two halves and aggregates each
    as a bench of its own. Each half's earliest repeat counts as its initial
    execution.
- **`describe-error.ts`** turns an error into a one-line problem message.

### `commands.ts`

- New `bench --corpus ID [--repeat N] [--target isolated|persistent-isolated] [--workspace NAME] [--evidence MODE]`.
  - `--repeat` accepts 1 to 100.
  - `--target existing` and `--target clone` are refused.
  - Positional arguments are refused.
- New `compare <baseline-report> <candidate-report>` and `compare <report> --halves`.
- `evidence` is now optional on `run` and `matrix`: without `--evidence`, the
  manifest's `evidencePolicy` drives capture.
- Added `KEBAB_ID` and a `positionalValues` helper.

### `cli.ts`

- `--workflow` is now passed to `runScenario` (the old `cli.ts:46`), and
  `evidence` is passed only when given.
- Added `bench` and `compare` branches. `compare` exits 1 only when the
  outcome is `regressed`.
- Removed `compareRuns` and its imports (`readFile`,
  `parseCandidateComparisonJson`).

### `src/tests/commands.test.ts` (existing file)

- Removed `evidence: "failure"` from the 6 expectations that assumed the old
  default, which the brief removes.
- Added 3 tests: the evidence default, `bench` parsing, and `compare` parsing.

### Tests

- The new tests are in `src/bench/tests/`: `evaluate-run`, `aggregate-report`,
  `compare-reports`, `run-bench`, and `week1-corpus`.
- The brief said `src/tests/`. That directory is at its file ratchet (51),
  and AGENTS.md puts tests in the owning directory's `tests/`.
- `week1-corpus.test.ts` resolves the repository root from its own location
  and loads the built registry.
  - It asserts the exact list of results that do not resolve today, as a
    ratchet in both directions: a fixture that adds a variant fails the test
    until the entry is removed, and so does a result that stops resolving.
  - It checks the plan's negative and positive variant outcomes.

## Commands run and observed results

**Type check.** `pnpm --filter @fluxiq-web-extension/test-runner check`
printed only the tsc banner, with no errors.

**Structure audit**, run three times, the last after the final edit.
`node scripts/structure-audit.mjs` ran against a scratch copy of the git index
(`GIT_INDEX_FILE`) with my files staged; the real index was never touched.

- It printed `structure-audit: passed (27 warning(s), 19 baselined).`
- No finding names a bench, `cli.ts`, or `commands.ts` path.
- It also printed `structure-audit: 1 baseline entries can be lowered.`, which
  earlier reports already saw before my edits.
- The largest new file is `aggregate-report.ts` at 167 lines.

**Test suite.** `pnpm --filter @fluxiq-web-extension/test-runner test` exited
0 every time:

| Run | Result |
| --- | --- |
| First | `# tests 355`, `# pass 355`, `# fail 0` |
| After the supervisor's `target-config.ts` change | `# tests 356`, `# pass 356`, `# fail 0` |
| After my last edit | `# tests 356`, `# pass 356`, `# fail 0`; 21 of the passes are mine |

Diagnostics from `week1-corpus.test.ts`:

```text
# rows with every result resolved: W01, W02, W03, W04, W05, W06, W07, W08, W09, W11, W12, W13, W14, W15, W16, W17, W18, W19, W20, W21, W22, W23, W24, W28
# unresolved results: W10 navigation/primary/broken-link, W25 delayed-ui/primary/too-slow, W26 ambiguous-targets/primary/no-context, W27 failure-surfaces/primary/disabled, W27 failure-surfaces/primary/detached, W27 failure-surfaces/primary/blocked-url
```

**Which `week1` rows resolve today.**

- 24 rows resolve fully.
- W10, W25, W26, and W27 resolve unarmed, but their plan variants do not
  exist in the Scenario Lab yet.
- Of 43 results in total, 23 are unarmed and would run on the recording lane.
  The other 20 are variants: 14 resolve and are skipped until the Flow lane
  arms them, and 6 do not resolve.

**Refusals without the supervisor's switch.**

- `node packages/test-runner/dist/cli.js bench --corpus smoke --repeat 2 --target isolated`
  exited 1 with
  `{"status":"failed","category":"unknown","message":"--target isolated conflicts with FLUXIQ_TEST_TARGET=existing"}`.
- `FLUXIQ_TEST_TARGET=isolated pnpm lab bench --corpus smoke --repeat 2 --target isolated`
  also exited 1. The builds completed, then it printed
  `{"status":"failed","category":"unknown","message":"isolated target cannot use existing-install configuration: FLUXIQ_TEST_BASE_URL, FLUXIQ_TEST_GATEWAY_URL"}`.

**Scratch driver.** Before the supervisor's switch, I ran a scratch driver.
It calls `runBench` exactly as `cli.ts` does after target resolution, with
`FLUXIQ_TEST_*` removed from its environment.

1. **`bench-mtxgozcb-fbc5f35c`: 2 of 4 runs passed.**
   - W28 passed both runs. W01 failed both with `recording.persistence`,
     "The extension recording did not start". No script step ran, and the
     probe's two actions succeeded.
   - `apps/scenario-lab/dist/registry.js` and `packages/test-runner/dist` were
     rebuilt by another process at 21:22:28 and 21:22:39 UTC, during W01's
     first run (21:22:01–21:23:00).
   - Its halves compare gave `regressed`, only on `run-duration-p95`:
     60244 against 91457, tolerance 15061. The rates and action latencies
     were `equivalent`.
2. **`bench-mtxgwjhb-ef82e30e`: 4 of 4 passed**, which served as the rerun the
   concurrency note asks for. Its halves compare gave `equivalent`:
   - `initialExecutionSuccess` 1 and 1
   - `web.browser.navigate` p95 1651 and 1654
   - `web.dom.type` p95 1423 and 1387
   - `run-duration-p95` 56431 and 55685
3. **`bench-mtxh27sa-992979f5`: 4 of 4 passed.**
   `compare <bench 2 report.json> <bench 3 report.json>` gave
   `"outcome":"equivalent"`, with every metric equivalent.

**Literal DoD command.**
`FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus smoke --repeat 2 --target isolated`
exited 0 after 259 s and printed:

```text
{"status":"passed","benchId":"bench-mtxh7z0e-7cc58fff",...,"results":2,"runs":4,"passed":4,"skipped":0}
```

From its `report.md`:

- W01 basic-form: pass rate 1.000, stable-pass.
- W28 iframe-checkout: pass rate 1.000, stable-pass.
- Action latency: `web.browser.navigate` p50 1697, p95 1798; `web.dom.type`
  p50 1404, p95 1626.
- Run duration: p50 55034, p95 67894.
- Sanitized-packet and raw-snapshot distributions have no samples;
  truncation count 0.
- The report lists `llm` as `disabled`.

**Halves of the DoD report.**
`FLUXIQ_TEST_ENV_FILES=none pnpm lab compare bench-mtxh7z0e-7cc58fff --halves`
exited 0 and printed:

```text
{"baselineReportId":"bench-mtxh7z0e-7cc58fff-first-half","candidateReportId":"bench-mtxh7z0e-7cc58fff-second-half","outcome":"equivalent","metrics":[{"metric":"rate:initialExecutionSuccess","baseline":1,"candidate":1,"tolerance":0.5,"outcome":"equivalent"},{"metric":"rate:falseFailure","baseline":0,"candidate":0,"tolerance":1,"outcome":"equivalent"},{"metric":"rate:harnessActivation","baseline":0,"candidate":0,"tolerance":0.5,"outcome":"equivalent"},{"metric":"action-latency-p95:web.browser.navigate","baseline":1697,"candidate":1798,"tolerance":424.25,"outcome":"equivalent"},{"metric":"action-latency-p95:web.dom.type","baseline":1404,"candidate":1626,"tolerance":351,"outcome":"equivalent"},{"metric":"run-duration-p95","baseline":55034,"candidate":67894,"tolerance":13758.5,"outcome":"equivalent"}]}
```

**Two reports.**
`FLUXIQ_TEST_ENV_FILES=none node packages/test-runner/dist/cli.js compare bench-mtxh27sa-992979f5 bench-mtxh7z0e-7cc58fff`
exited 0 with `"outcome":"equivalent"`, every metric equivalent.
`deterministicReplaySuccess` was 1 in both.

## Not verified

- **Most of the corpus.** `--corpus week1` was never run live; only smoke was,
  and I did not run the week1 unarmed workflows other than W01 and W28.
  Several of them use steps that w1-runner-asserts also did not verify live:
  `switchTab`, `upload`, `waitForDownload`, `press`, and `check`.
- **Other targets and flags.**
  - The `persistent-isolated` target was not run.
  - `lab run --workflow` and `lab run` without `--evidence` were not run live.
    The bench exercised the default manifest evidence policy, since it passes
    no `--evidence`.
- **Measurements the recording lane cannot observe.** `harnessActivations` 0,
  the evidence sizes, and `truncationCount` 0 are recorded values, not
  measurements, and their sources say so. `oracleVerdict` is inferred from the
  failure category.
- **Flow-lane rates.** Flow creation, fuzzy recovery, and classification
  accuracy are unit-tested with hand-built evaluations only; no producer
  exists yet.
- **Cause of the first bench's W01 failures.** I attributed them to the
  parallel rebuild from timing alone and did not prove it. The next 6 W01 runs
  all passed.
- **Repository-wide checks.** I did not run root `pnpm check`, `pnpm test`, or
  `pnpm build`.

## Open questions or contradictions found

1. **`.env.local`.** As the refusals above show, overriding
   `FLUXIQ_TEST_TARGET` is not enough: the existing-install URLs still block
   the isolated target, and an empty override is rejected with "must not be
   empty". The supervisor's `FLUXIQ_TEST_ENV_FILES=none` resolved it. The
   Current State should record it as the way to run isolated lab commands on
   this machine.
2. **The contract has no field for skipped results.** A `BenchReport` result
   must have `runs == repeatCount` and a pass rate. A skipped result would
   therefore read as a stable fail or a pass, so skipped results are left out
   of `report.json` and recorded only in `runs.json` and `report.md`.
   Consider adding a `skipped` list to `BenchReport` in `test-contracts`.
3. **Hooks needed in `run-scenario.ts`**, which I must not touch:
   - **Evidence sizes:** record sanitized-packet bytes, raw-snapshot bytes, and
     `truncated` per probe action, in `run.json` or the bundle.
   - **Oracle verdict:** publish whether the oracle passed, failed, or was not
     reached, instead of inferring it from `runtime.behavior`. That category
     also covers the probe's input check and download and tab waits.
   - **Harness activations:** expose them from Core's run detail on the Flow
     lanes.
4. **`existing` and `clone` are refused.** They run a pre-existing Flow, so
   `flowCreated` would be false. The contract's `flow` lane means "a Flow
   created from the recording", so these targets wait for the Wave 2 Flow
   lane.
5. **Corpus id readings to confirm when the fixtures land:**
   - W23 `wrapped-aria`.
   - W27 `disabled`, `detached`, and `blocked-url`.
   - W15 `popup-blocked`: the registry expects `OUTPUT_NOT_OBSERVED`; the plan
     names no category.
6. **Stale documentation.** `docs/architecture/testing-facility.md:947` and
   `docs/working/automated-testing-facility-plan.md:1197` still describe
   `lab compare <baseline-run-id> <candidate-run-id>`. `compare` now takes
   bench reports.
7. **`CandidateComparison` has no producer.** The contract and
   `packages/agent-orchestrator/src/types.ts` still reference it, but nothing
   in the test-runner produces one now.
8. **Not re-exported.** `src/bench/` is not re-exported from
   `packages/test-runner/src/index.ts`, which is not mine.
9. **Definitions I chose; please confirm.**
   - **Success with no FluxIQ verdict.** Initial and replay success count
     `reportedVerdict: null` as "no failure reported". Product-catalog and
     data-table run no Core probe on this lane.
   - **Halves.** With `--repeat 2`, the replay rate is `null` in both halves
     and is not compared.
   - **Exit code.** `compare` exits 1 on `regressed`.
