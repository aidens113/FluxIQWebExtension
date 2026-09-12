# Report: v-bench-contract

Worker: `v-bench-contract`. Closes the one ownership gap `v-bench-honesty`
reported: `report.json` now states the not-executed count and the executed
action total, and the eight bench reports already on disk still load and still
compare. No Lab command and no `pnpm build` were run.

## Outcome

**Done.**

## What changed and why

Two fields on `BenchCorpusMetrics`, made **optional**, and populated by the
aggregator so every report the runner writes from now on carries them.

| File | Change |
| --- | --- |
| `packages/test-contracts/src/bench-report.ts` | `notExecutedRuns?: number` and `actionsExecuted?: number` on `BenchCorpusMetrics`, each documented as *absent means unmeasured, never zero* |
| `packages/test-contracts/src/bench-report-validation.ts` | `coverageKeys` added to the strict `keys(...)` list; new `checkExecutionCoverage` — absence accepted, a stated `notExecutedRuns` bounded by the evaluated population, a stated `actionsExecuted` required to equal the samples the latency distributions carry |
| `packages/test-contracts/tests/bench-report-contracts.test.mjs` | two tests: the round trip, and the older report (below) |
| `packages/test-runner/src/bench/aggregate-report.ts` | `executedNothing` and `actionsExecuted` moved in from `execution-coverage.ts`; `corpusMetrics` states both totals |
| `packages/test-runner/src/bench/execution-coverage.ts` | imports those two rules instead of owning them |
| `packages/test-runner/src/bench/run-bench.ts` | one import line repointed; no behaviour change |
| `packages/test-runner/src/bench/tests/{aggregate-report,run-bench}.test.ts` | import line, plus assertions that `report.json` states the counts and that they equal what `benchExecutionCoverage` and the CLI outcome say |

`packages/test-runner/src/bench/compare-reports.ts` needed no change:
`benchHalves` builds each half through `aggregateBenchReport`, so both halves
now carry the counts automatically.

### The decision the brief asked for: optional, meaning unmeasured

**I made the fields optional rather than required-with-a-default.** A report
written before they existed omits them, and a reader gets `undefined`, not `0`.

The alternative — required, defaulting to `0` when absent — would have made
every historical bench assert *"FluxIQ executed nothing anywhere, and no run
failed to execute"*, two contradictory claims, both fabricated. That is the
same class of error as the predicate `v-bench-honesty` fixed: manufacturing a
confident number where there is no measurement. TypeScript now forces the
distinction at every read site — the type is `number | undefined`, and the only
way to conflate them is to write `?? 0`, which the field's doc comment names
and forbids.

Nothing is back-filled. The eight reports on disk stay honestly unmeasured; the
count they lack is not recoverable from `report.json` (the action total is, as
the sum of `actionLatencyMs[*].samples`, but the not-executed count is not), so
inventing one would be worse than leaving it absent.

### The validator earns its place rather than just allowing the keys

Two invariants, because a count that can lie is not much better than a count
that is missing:

- `notExecutedRuns` may not exceed the evaluated population, `workflows.length
  × repeatCount`. A bench cannot have executed nothing in more runs than it ran.
- `actionsExecuted` must equal the sum of `actionLatencyMs[*].samples`. One
  sample is recorded per executed action (`benchDistribution` returns
  `samples: sorted.length`), so the two count the same thing and a report that
  states both must state them consistently. This is what makes the wiring
  provable rather than merely present: if the aggregator ever stopped agreeing
  with its own latency data, `assertBenchReport` would reject the report it
  just built.

Both are skipped when the field is absent, so historical reports are unaffected.

### One structural change inside test-runner, and why it was necessary

`corpusMetrics` must derive the two totals from the same results it aggregates,
and it must use the **same rule** `report.md` uses, or the two disclosures could
drift apart — which would recreate the original defect in a subtler form. But
`execution-coverage.ts` already imports `BENCH_RATE_DEFINITIONS` and
`benchRatePopulation` from `aggregate-report.ts`, so having the aggregator
import back would have made the two modules mutually dependent.

I moved the two per-run predicates — `executedNothing` and `actionsExecuted`,
verbatim with their doc comments — into `aggregate-report.ts`, which is the
module that already owns "how a run is counted" (`executed`, `positive`,
`BENCH_RATE_DEFINITIONS`). `execution-coverage.ts` keeps the per-rate breakdown
and imports the rules. Dependency direction stays one-way, and the rule is
stated once. No behaviour changed; the three import sites were updated
(`execution-coverage.ts`, `run-bench.ts`, `tests/aggregate-report.test.ts`).

I considered passing the coverage into `aggregateBenchReport` as an argument
instead. I rejected it: the coverage is a pure function of `results`, which the
aggregator already receives, so a caller could hand it a coverage that
disagreed with the runs — two sources of truth for one derived number, and the
validator could not catch the mismatch.

## Commands run and observed results

Every exit status captured by redirecting to a file and echoing `$?`; no pipes.
`EXTENSION_TEST_BUILD_LABEL=v-bench-contract` set throughout. No `pnpm lab`
command and no `pnpm build` at the repository root.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-contracts check` | **0** | clean |
| `pnpm --filter @fluxiq-web-extension/test-contracts test` | **0** | `# tests 55 / # pass 55 / # fail 0 / # cancelled 0 / # skipped 0` (53 before; the two new tests) |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | **0** | clean |
| `pnpm --filter @fluxiq-web-extension/test-runner test` | **0** | `# tests 405 / # pass 405 / # fail 0 / # cancelled 0 / # skipped 0` — the same 405 `v-bench-honesty` finished on, because I extended its tests rather than adding files |
| `node <scratchpad>/vbc-historical.mjs` — the eight real reports | **0** | `8 historical report(s) checked, 0 failure(s)` (full output below) |
| `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs` | **0** | `structure-audit: passed (30 warning(s), 19 baselined)`; no warning names any file I touched |

Both `check`/`test` pairs and both proofs were re-run after the last edit; the
figures above are from that final pass.

### The historical-report proof, against the real files

`test-runs/bench/` holds eight `report.json` files, every one of them written
before these fields existed. The scratch script parses each with the built
contract, asserts the counts read as absent rather than zero, upgrades a copy
with the counts a bench written today would state, and compares the real report
against that copy:

```text
ok bench-mtxgozcb-fbc5f35c  corpus=smoke workflows=2 repeats=2 evaluatedRuns=4 latencySamples=4 notExecutedRuns=undefined actionsExecuted=undefined comparedMetrics=6
ok bench-mtxgwjhb-ef82e30e  corpus=smoke workflows=2 repeats=2 evaluatedRuns=4 latencySamples=4 notExecutedRuns=undefined actionsExecuted=undefined comparedMetrics=7
ok bench-mtxh27sa-992979f5  corpus=smoke workflows=2 repeats=2 evaluatedRuns=4 latencySamples=4 notExecutedRuns=undefined actionsExecuted=undefined comparedMetrics=7
ok bench-mtxh7z0e-7cc58fff  corpus=smoke workflows=2 repeats=2 evaluatedRuns=4 latencySamples=4 notExecutedRuns=undefined actionsExecuted=undefined comparedMetrics=7
ok bench-mtxigc2s-2cbf19a0  corpus=smoke workflows=2 repeats=2 evaluatedRuns=4 latencySamples=4 notExecutedRuns=undefined actionsExecuted=undefined comparedMetrics=7
ok bench-mtxjo1kt-f8a12eca  corpus=smoke workflows=2 repeats=2 evaluatedRuns=4 latencySamples=4 notExecutedRuns=undefined actionsExecuted=undefined comparedMetrics=7
ok bench-mtxju6eb-7aacdf7a  corpus=smoke workflows=2 repeats=2 evaluatedRuns=4 latencySamples=4 notExecutedRuns=undefined actionsExecuted=undefined comparedMetrics=7
ok bench-mtxoim0b-8ca4952c  corpus=smoke workflows=2 repeats=2 evaluatedRuns=4 latencySamples=4 notExecutedRuns=undefined actionsExecuted=undefined comparedMetrics=7

8 historical report(s) checked, 0 failure(s)
```

Each `ok` line asserts, and the script fails on any of: the file parses;
`Object.hasOwn(metrics, "notExecutedRuns")` is `false` and the read is
`undefined`, not `0`; the upgraded copy validates; `compareBenchReports(old,
new)` returns metrics without throwing and without treating either count as a
compared metric; `notExecutedRuns = evaluatedRuns + 1` is **rejected**; and
`actionsExecuted = latencySamples + 1` is **rejected**. The script is in the
scratchpad (`vbc-historical.mjs`) and wrote nothing to the repository.

Incidental measurement from those files, which the supervisor may want: each
smoke bench evaluated 4 runs and recorded **4 executed actions in total** —
consistent with `v-bench-honesty`'s account of a two-action Core round-trip
probe applying to some rows and not others. How many of the 4 runs executed
nothing is not recoverable from `report.json`; that is exactly the figure these
fields now record.

### Tests added

In `packages/test-contracts/tests/bench-report-contracts.test.mjs`:

- **"a bench report round-trips the execution-coverage counts, and states them
  consistently"** — a report stating `notExecutedRuns: 4`, `actionsExecuted:
  20` survives `JSON.stringify` → `parseBenchReportJson` → `deepEqual`, and the
  validator rejects a fractional or negative count, a count exceeding the nine
  runs the report evaluated, and an action total of 19 against 20 latency
  samples.
- **"a bench report written before the execution-coverage counts still loads,
  and its counts read as unmeasured rather than zero"** — pins the exact
  eleven-key `metrics` shape of the reports on disk, parses it, asserts both
  reads are `undefined` and `Object.hasOwn` is `false` for both, and asserts
  such a report is still a usable comparison baseline for one that states them.

In `packages/test-runner/src/bench/tests/`:

- `aggregate-report.test.ts` — the report's two fields equal
  `benchExecutionCoverage`'s, and the action total equals the latency samples.
  This is the anti-drift guard for `report.md` against `report.json`.
- `run-bench.test.ts` — the end-to-end honesty test now reads `report.json`
  off disk and asserts it states `notExecutedRuns: 2`, `actionsExecuted: 1`,
  the same numbers the CLI outcome and the rendered `report.md` state.

## Not verified

- **No Lab command, no root `pnpm check`/`pnpm test`/`pnpm build`.** Only the
  two packages' own `check` and `test`. `BenchCorpusMetrics` has no consumer
  outside `packages/test-runner` and `packages/test-contracts` — `grep` over
  `apps/`, `domain/` and the other packages for `BenchCorpusMetrics`,
  `BenchReport` and `parseBenchReportJson` returns nothing outside those two —
  so the blast radius is contained, but I did not compile the rest.
- **No bench has been run with these fields.** The first real `report.json`
  carrying them will be written by the supervisor's next `pnpm lab bench`. The
  path is covered by the end-to-end unit test, which writes and re-reads a real
  `report.json`, not by a live bench.
- **`report.md` still renders from `BenchExecutionCoverage`, not from
  `report.json`.** The two are now pinned equal by test, but they remain two
  code paths. Unifying them was outside "populate the new fields".
- **The historical reports are left unmeasured, not back-filled.** Their
  per-run evaluations are still on disk under each bench directory, so a
  back-fill is possible; I did not do one, and no code reads a count for them.
- **`packages/test-runner/package.json` shows as modified** in `git status`. It
  was already modified when I started (`w3-runner-alignment` owns it) and I did
  not touch it; the same is true of the rest of `v-bench-honesty`'s
  still-uncommitted `bench/` work, which my diff sits on top of.

## Open questions or contradictions found

1. **A structure-audit failure that is not mine, and not a real violation.**
   Running the audit with a scratch index built by `git add -A` reports
   `FAIL [test-placement] apps/extension/.wire-contract-capture/: 1 test file
   sits beside its source`. That directory is **untracked** (created today at
   13:18 by a parallel worker: `capture.spec.ts`, `playwright.config.ts`,
   `artifacts/`), so `git add -A` is what made the audit see it; the real
   `pnpm check` will not, and neither does a scratch index scoped to my own
   paths, which passes with exit 0. The supervisor should make sure that
   directory is either ignored or removed before committing, or `git add -A`
   would sweep a browser-capture artifact into the repository.
2. **Should `BenchRate` carry a per-rate `notExecuted`?** `v-bench-honesty`
   proposed it alongside the two corpus-level fields; my brief named only the
   two, so I stopped there. The per-rate breakdown reaches the reader through
   `report.md` but is still absent from `report.json`, so a tool comparing two
   reports can say how much of the *corpus* executed nothing but not how much
   of a *particular rate's* population did. That is a smaller gap than the one
   just closed, and the same optional-means-unmeasured treatment would apply;
   it is a one-brief follow-up if the supervisor wants it.
3. **Neither count is a compared metric.** `compareBenchReports` still compares
   only rates, action-latency p95s and run duration, so two benches can differ
   in `notExecutedRuns` and compare `equivalent`. That is defensible — a count
   has no tolerance defined by the plan — but it means the repeatability check
   in criterion 5 will not notice if a future bench executes far less than its
   baseline did. Deciding whether a coverage regression should be an outcome of
   `lab compare` is a metric-definition call for the supervisor, not a defect.
4. **The action total was already derivable; the not-executed count was not.**
   Worth remembering when reading old benches: for the eight on disk,
   `actionsExecuted` can be reconstructed as the sum of
   `actionLatencyMs[*].samples` (4 for each of them), but nothing in those
   files says how many runs executed nothing. Only benches run from here on
   answer that question.
