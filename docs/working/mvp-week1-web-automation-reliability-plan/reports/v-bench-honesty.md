# Report: v-bench-honesty

Worker: `v-bench-honesty`. FluxBench reported a run in which FluxIQ executed
nothing as a success. Defects 1 and 2 are fixed; defect 3 is made visible, not
fixed. No Lab command was run; every claim below is a unit test over the bench
modules, a structure-audit run, or a quoted measurement from another report.

## Outcome

**Done**, with one ownership gap I could not close and did not widen into
(`packages/test-contracts`, below).

### The number the supervisor has to report upward

`initialExecutionSuccess` on the `week1` corpus, using v-criteria's corpus
expansion (23 runnable rows, all positive — `runnable with expectedFailure: 0`
— of which 7 run the Core round-trip probe and 16 execute nothing):

| | Population | Hits | Reads |
| --- | --- | --- | --- |
| **Before**, recording lane only | 23 first runs | every row that passed as a test | **1.000** (23/23) |
| **After defect 1**, recording lane only | 23 first runs | the 7 rows that executed and reported success | **0.304** (7/23), printed beside "Not executed: 16" |
| **After defects 1 and 2**, both lanes | 33 first runs (23 unarmed + 10 positive variants) | 7 recording rows + however many Flow-lane variants execute and report success | **0.212 (7/33) to 0.515 (17/33)** — unmeasured, because no Flow-lane variant run is known to have passed |

**The corpus grew under me while I worked**, and the figures above are stated
against the tree I finished on. A parallel worker landed the six missing
fixture variants (`navigation/broken-link`, `delayed-ui/too-slow`,
`ambiguous-targets/no-context`, and `failure-surfaces`'
`disabled`/`detached`/`blocked-url`) between my first and last test run, so
**every one of the corpus's 43 results now resolves and none is skipped**. The
`initialExecutionSuccess` population is unaffected — all six new variants carry
an `expected.failure`, so the positive population is still 33 — but the run
count is not: see the timing note under defect 2.

The "before" figure of 1.000 assumes every runnable row passes runner and
oracle, which is what the old predicate rewarded: `reportedVerdict !== "failed"`
is satisfied by `null`, so a row FluxIQ never touched scored a hit. A bench in
which some rows flaked would have read below 1.000 for reasons that had nothing
to do with FluxIQ executing anything.

The post-change figure is a **floor, not a forecast**: it is what the corpus
would read if the seven probed rows all succeed and nothing else executes. The
honest sentence for a ledger entry is: *"initialExecutionSuccess N of 33, with
K of that population executing no FluxIQ action at all"* — both numbers, always
together.

---

## Defect 1 — a run that executed nothing counted as a success

`aggregate-report.ts:41` was
`reportedVerdict !== "failed"`. It is now `reportedVerdict === "passed"`.

### The choice, and why

The brief asked me to decide between counting such a row as a **failure** and
**excluding it from the population**, and to test the supervisor's view rather
than adopt it. I counted it as a **miss**, and the supervisor's view is right,
for a reason worth stating precisely.

Excluding is the more literally accurate reading — the metric is named
*execution* success, and a row where nothing executed contains no execution to
judge, so arguably it has no place in the population. But that argument is
exactly the argument that produced the defect. `executed()` was not written to
lie; it was written by someone reasoning "FluxIQ reported no failure, so do not
penalise the row", which is excluding-by-another-name, applied at the predicate
instead of the population. The failure mode of an exclusion is that the reader
sees `1.000` and a denominator they do not check; the failure mode of a miss is
that the reader sees `0.304` and asks why. One of those failure modes is safe.

Two further reasons decided it:

- **The denominator carries the corpus's meaning.** With exclusion,
  `initialExecutionSuccess` over `week1` would have `total: 7` — and the
  ±1-workflow tolerance in `compareBenchReports` is `1 / workflows`, so a
  seven-row population gets a tolerance of 0.143. Two consecutive benches could
  differ by a full workflow and still compare `equivalent`. Shrinking the
  denominator does not only hide the gap, it degrades the repeatability check
  the plan's criterion 5 depends on.
- **The conditional rate is still recoverable, from stated numbers.** The
  report prints, beside every rate, how many runs of *that rate's own
  population* executed nothing. A reader who wants "of the rows that executed,
  how many succeeded" computes `count / (total − notExecuted)` from figures on
  the page. The reverse is not true: an exclusion cannot be undone by a reader.

So: counted as a miss, and the not-executed count printed next to it, in three
places (below).

### The audit of the other predicates

| Rate | Guarded before? | Changed |
| --- | --- | --- |
| `flowCreationSuccess` | n/a — `hit` is `flowCreated === true`, independent of execution | No |
| `initialExecutionSuccess` | **No** — used `executed()` | **Yes**, via `executed()` |
| `deterministicReplaySuccess` | **No** — used `executed()` | **Yes**, via `executed()` |
| `fuzzyRecovery` | **No** — `hit` is `executed() && harnessActivations === 0` | **Yes**, via `executed()` |
| `falseFailure` | Yes — `applies` requires `reportedVerdict !== null` | No |
| `falseSuccess` | Yes — same guard | No |
| `failureClassificationAccuracy` | Partly | **Yes**, hardened |
| `harnessActivation` | n/a — counts activations | No; see below |

`failureClassificationAccuracy` was correct today but on a trap.
`reported?.category === expected?.category` is only ever evaluated where
`expected` is non-null, so a run that reported nothing compared
`undefined === "auth_required"` and correctly missed — but v-criteria flagged
that widening the population would make `undefined === undefined` score as a
hit. Both sides are now required to be present explicitly. The behaviour is
unchanged and a test pins it; the trap is gone.

`harnessActivation` I did **not** change, and it is worth the supervisor
knowing why. Its population is every run, including `inconclusive` runs where
the runner threw before anything was observed and including the 16 rows where
FluxIQ ran nothing — for all of which `harnessActivations` is 0 by
construction. "Week 1 requires none with the provider disabled" is therefore
close to a tautology on this lane, as `RECORDING_LANE_SOURCES.harnessActivations`
already says in words. It is not a false-success defect (it cannot report
success for absence of work — 0 activations is the desired reading), so I left
the measurement alone rather than change a number the eight historical benches
carry. Its Not-executed column now shows how much of its population never
executed, which is the disclosure it was missing.

---

## Defect 2 — the bench ran one lane, so most of the corpus never ran

### What I chose: a per-result lane, declared by the corpus

`BenchCorpus` now carries `lanes`, and `expandCorpus` gives every plan entry a
`lane`. Each result runs on the **one lane that can run it**: an unarmed
workflow on `recording`, a variant on `flow`, which is the only lane that arms
one. A result whose lane the corpus does not declare is skipped with that
reason, exactly as before. `week1` declares `["recording", "flow"]`; `smoke`
declares `["recording"]`.

Why this and not a CLI flag or running both lanes over everything:

- **A flag would have to live in `commands.ts` and `cli.ts`, neither of which I
  own.** Adding lane support to `runBench` alone and asking for a flag later is
  the "lands inert" failure the wave-3 brief warns about. Declaring the lane in
  the corpus makes the capability reachable through the CLI the supervisor
  already has — `pnpm lab bench --corpus week1` — with no change outside
  `bench/**`.
- **The lane is not really a user choice.** A variant cannot run on the
  recording lane at all; `run-scenario.ts:494` and `commands.ts:41` both refuse
  `--variant` without `--flow`. Encoding "which lane can run this result" as a
  flag would let a user ask for something impossible.
- **Running both lanes over every result** would roughly double an already
  70–110-minute bench and light up `flowCreationSuccess` over the 23 unarmed
  rows too. Defensible, and the supervisor may want it later; I judged the time
  cost too high to impose without evidence the lane works.
- **`smoke` is unchanged, byte for byte in its plan.** Both its rows (W01, W28)
  have no variants, so the Flow lane would have nothing to run there anyway;
  declaring `["recording"]` states that as intent rather than accident, and a
  test now asserts it, so the eight historical benches stay comparable.

### Measured effect on the plan

`week1-corpus.test.ts` diagnostic lines, on the tree I finished on (that is,
after the parallel fixture landing):

```text
# unresolved results: none
# runnable: 43 (23 recording, 20 flow); skipped: 0
# flow-lane results with an expected failure: 10 (W10=navigation_unexpected,
  W14=user_intervention_required, W15=output_not_observed, W19=auth_required,
  W24=output_not_observed, W25=timeout, W26=target_ambiguous,
  W27/disabled=blocked_by_capability_or_policy, W27/detached=target_not_found,
  W27/blocked-url=navigation_unexpected)
```

Before: **23 runnable, 20 skipped** (14 of them resolved variants, 6
unresolved). After, on the same tree the fixtures landed in: **43 runnable, 0
skipped**. Measured on the tree as it was two hours earlier, before those
fixtures — the state v-criteria and v-facility describe — this change alone took
it from 23 runnable / 20 skipped to **37 runnable / 6 skipped**, the six being
exactly the variants no fixture then defined.

`failureClassificationAccuracy` therefore has a population of **10** for the
first time; `fuzzyRecovery` has **10**; `flowCreationSuccess` has **20**. All
three were provably 0 before. Whether they carry a *good* number is a different
question, below.

### Does the Flow lane actually work? Unknown, and I did not make the bench claim it does

I could not run a Lab command, so I have no first-hand evidence. What the
existing reports say:

- **No green Flow-lane variant run is on record.** `v-facility` says it
  outright: *"I have not verified that any of these seven pass today. The Flow
  lane is implemented and wired (`flow-lane/run-flow-lane.ts`), and the corpus
  test confirms each variant resolves, but no report I read records a green
  Flow-lane variant run."*
- **One variant has been observed reaching a verdict.** v-criteria quotes
  `w2-flow-lane` observing `lab run identity-drift --flow --variant
  selector-only` at `verdict: "passed"`, exit 0 — and `w2-flow-lane`'s own
  caveat that this *"is consistent with fingerprint fallback recovery, not proof
  of it"*.
- **The lane is known to be intermittent.** `w2-flow-lane` Finding 5: four Flow
  runs of `basic-form` produced 5, 5, 5 and **4** Flow candidates; the
  four-candidate run dropped the recorded click and failed.
- **One corpus row is known to be structurally unable to pass.**
  `w2-flow-lane` Finding 3: W19's generated Flow contains no step requesting
  `/account`, so it can never report `auth_required`.

What I did with that. The bench now **attempts** the Flow lane and **reports
what happened**; it claims nothing. A Flow-lane result that fails is recorded
as a failing run with its category, and a run planned on the Flow lane that
never reached it is recorded as `flowCreated: false` with nothing executed —
which makes `flowCreationSuccess` count it as a miss instead of losing it. A
skip, by contrast, silently removes a third of the corpus from every metric.
Attempting and failing is the more honest of the two, and it is the only way
the supervisor finds out whether the lane works.

**Two consequences the supervisor should plan for.**

1. **`pnpm lab bench --corpus week1 --repeat 3` will likely exit 1.** The bench
   passes only when every evaluated run passes, and 20 Flow-lane results per
   repeat are now evaluated, ten of which expect a failure the Flow lane has
   never been observed to report. That is a true signal, not a regression, but
   it changes the exit status of a command the plan quotes.
2. **It is roughly 87% longer.** 43 runnable × 3 repeats = **129 runs** against
   the old 69. At v-facility's 70–110 minute estimate for 69 runs, budget
   **130–205 minutes**, headed, machine occupied, and Flow-lane runs carry Flow
   proposal and approval on top of a recording, so they are the slower half.
   **If the supervisor has one bench-length slot this week, `--repeat 2` over
   the full corpus (86 runs) is a better use of it than `--repeat 3` over a
   corpus that skips a third of itself.**

**The one-line fallback**, if the Flow lane turns out to be unrunnable and the
supervisor needs the old bench back today: change `lanes` in
`packages/test-runner/src/bench/corpus/week1.ts:19` to `["recording"]`. The
plan reverts to 23 runnable / 20 skipped exactly as before, and the defect-1 fix
stays. I deliberately did not add a `--lanes` flag or a second corpus to make
that switch cheaper: both would need files I do not own, or would multiply the
corpus surface.

---

## Defect 3 — the recording lane executes two probe actions, never the workflow

Not fixed, as instructed. Made visible in four places:

| Where | What it now says |
| --- | --- |
| `report.md`, a **`## FluxIQ execution` section above the results** | "FluxIQ executed **N actions** across M evaluated runs, and **executed nothing at all in K of those M**", followed by a paragraph stating that a recording-lane pass means the Testing Lab drove the fixture, that FluxIQ executes at most a two-action Core round-trip probe there and never the workflow, and that the action count is the only figure on the page that says what FluxIQ did |
| `report.md`, **Rates table** | a **Not executed** column on every rate, over that rate's own population, plus a line saying a rate whose Not executed approaches its Total is a statement about the Testing Lab, not about FluxIQ |
| `report.md`, **Runs table** | an **Actions FluxIQ executed** column per run, and a **Lane** column |
| `runs.json` and the **CLI's JSON line** | `actionsExecuted` per run record; `notExecuted` and `actionsExecuted` on `RunBenchOutcome`, which `cli.ts:51` prints verbatim |

A rendered sample (scratch script over the built `dist`, three runs of which one
probed):

```text
FluxIQ executed **2 actions** across 3 evaluated runs, and **executed nothing
at all in 2 of those 3**. Runs in which it executed at least one action: 1.

| Metric                  | Unit      | Count | Total | Not executed | Workflows | Rate  |
| initialExecutionSuccess | workflows | 1     | 3     | 2            | 3         | 0.333 |
```

### The one place it is not stated, and why — an ownership gap

**`report.json` cannot carry it.** The brief says "add that to the report
schema", and the report schema is `BenchCorpusMetrics` in
`packages/test-contracts/src/bench-report.ts`, which my brief does not list
under Owns. `assertBenchReport` validates keys strictly
(`bench-report-validation.ts:78`), so a new field would be rejected until the
contract and its validator both change. Per the wave-3 rule I report this rather
than widening silently.

The change the brief should have included, precisely:

- `packages/test-contracts/src/bench-report.ts`: add `notExecutedRuns: number`
  and `actionsExecuted: number` to `BenchCorpusMetrics`, and a `notExecuted`
  field to `BenchRate`.
- `packages/test-contracts/src/bench-report-validation.ts`: add both to the
  `keys(...)` list at line 78 and to `checkRate`'s list at line 91, with the
  invariant `notExecuted <= total`.
- `packages/test-runner/src/bench/aggregate-report.ts` would then populate them
  from `benchExecutionCoverage`, which already computes exactly these values.

This is a **completeness** gap, not an inert change: the count reaches the
reader through `report.md`, `runs.json` and the CLI. What is missing is the
machine-readable form, so a later tool reading `report.json` alone would still
see a rate with no disclosure beside it. Note that the executed-action *total*
is already implicitly derivable from `report.json` as the sum of
`metrics.actionLatencyMs[*].samples`; the not-executed count is not derivable at
all.

---

## What changed and why

All under `packages/test-runner/src/bench/`. One new file, ten modified, five
test files updated.

| File | Change |
| --- | --- |
| `aggregate-report.ts` | `executed()` requires `reportedVerdict === "passed"`; `failureClassificationAccuracy` requires both failures present; extracted `benchRatePopulation` so the not-executed count is measured over exactly the runs a rate counts, rather than a re-derived population |
| `execution-coverage.ts` **(new)** | `executedNothing`, `actionsExecuted`, `benchExecutionCoverage` — total runs, executed runs, not-executed runs, total actions, and not-executed per rate metric |
| `corpus/bench-corpus.ts` | `BenchCorpus.lanes` |
| `corpus/week1.ts`, `corpus/smoke.ts` | `["recording", "flow"]` and `["recording"]`, each with the reason in the doc comment |
| `expand-corpus.ts` | `BenchPlanEntry.lane`; `laneForResult`; skip only when the corpus does not run the result's lane; added `UNARMED_NEEDS_RECORDING_LANE` |
| `evaluate-run.ts` | `evaluateFlowRun` reading `RunScenarioResult.observation`; `FLOW_LANE_SOURCES`; `evaluateFailedAttempt` takes the lane; `assemble` takes lane, `flowCreated` and `harnessActivations` instead of hard-coding them |
| `report-store.ts` | `BenchRunsFile.lanes` and `flowSources?`; `BenchRunRecord.lane` and `actionsExecuted?` |
| `render-markdown.ts` | the execution section, the Not-executed column, the Lane and Actions columns, per-lane measurement sources; takes the coverage as a third argument |
| `run-bench.ts` | passes `flow` and `variantId` for a Flow-lane entry; routes to `evaluateFlowRun`; records the lane and action count; `notExecuted` and `actionsExecuted` on the outcome |
| `index.ts` | barrel line for the new module |

### One decision inside defect 2 worth flagging

**The bench now consumes `RunScenarioResult.observation`, but only on the Flow
lane.** v-criteria's open question 5 asks who should own that; the Flow lane
forced my hand, because `flowCreated`, the persisted Core run's verdict and its
harness activations exist nowhere else. I deliberately left the **recording**
lane on its existing manifest-derived inference: switching it would change
`oracleVerdict` for every historical comparison, and comparability with the
eight existing benches is something the brief asked me to protect. So the
supervisor's decision on the recording lane is still open, and is now a smaller
change than it was — the plumbing exists.

---

## Commands run and observed results

Every exit status captured by redirecting to a file and echoing `$?`; no pipes.
`EXTENSION_TEST_BUILD_LABEL=v-bench-honesty` set throughout.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-runner check` (first attempt) | **2** | 4 errors, all in test files not yet updated for the new lane fields; no source error |
| `pnpm --filter @fluxiq-web-extension/test-runner check` (final) | **0** | clean |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (first attempt) | **1** | `# tests 404 / # pass 403 / # fail 1` — the pre-existing "refuses a target that runs a pre-existing Flow" test asserted `/recording lane/` against my reworded error; regex updated to the new wording |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (third attempt) | **1** | `# tests 405 / # pass 403 / # fail 2` — both failures in `week1-corpus.test.ts`, and **not caused by my change**: a parallel worker had just landed the six missing fixture variants, so `UNRESOLVED_TODAY` was stale. That constant's own doc comment prescribes this ("when a fixture adds one, this test fails until its entry is removed"); the file is under my ownership, so I emptied it and recorded why |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (final) | **0** | `# tests 405 / # pass 405 / # fail 0 / # cancelled 0 / # skipped 0`, with `# unresolved results: none` and `# runnable: 43 (23 recording, 20 flow); skipped: 0` |
| `pnpm --filter @fluxiq-web-extension/test-runner check` (after that) | **0** | clean |
| `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs` | **0** | `structure-audit: passed (30 warning(s), 19 baselined)`; no warning names any `bench/` file. The single warning added against an earlier run in this session is `domain/src/client/tests/gateway-mapping.test.ts: 417 lines`, a parallel worker's file, and it is advisory |
| `node <scratchpad>/vbh-render.mjs` — renders a sample `report.md` from the built `dist` | **0** | the execution section, Not-executed column and Actions column quoted above; wrote nothing to the repository |

Tests added or extended (all in `src/bench/tests/`):

- `aggregate-report.test.ts` — **"a run in which FluxIQ executed nothing is an
  execution-success miss, not a success and not an exclusion"**: three results,
  two with `reportedVerdict: null`, every one passing as a test;
  `initialExecutionSuccess` is `{count: 1, total: 3, workflows: 3, rate: 1/3}`
  — the count moved and the denominator did not. This is the test that fails
  against the old predicate.
- `aggregate-report.test.ts` — **"the not-executed count is reported: in total,
  per run, and per rate population"**: coverage totals and
  `notExecutedByMetric` per rate.
- `aggregate-report.test.ts` — classification accuracy misses when FluxIQ
  reported no failure, and never scores absent against absent.
- `run-bench.test.ts` — **lane selection**: a corpus declaring both lanes sends
  its variant to the runner with `flow: true` and its variant id while unarmed
  rows record; `runs.json` records the lane per run; `flowCreationSuccess` and
  `fuzzyRecovery` gain a population. Its sibling asserts the same corpus without
  the Flow lane skips the variant with `VARIANT_NEEDS_FLOW_LANE` and writes no
  `flowSources`.
- `run-bench.test.ts` — **end-to-end honesty**: three runs all passing, two with
  an empty manifest `actions` list; outcome `notExecuted: 2`,
  `actionsExecuted: 1`; `report.json` rate 1/3; `report.md` carries the
  execution section, the Not-executed column and the per-run action count.
- `evaluate-run.test.ts` — a Flow-lane run reads the lane's observation and not
  the manifest's probe action; a Flow-lane run that never reached the Flow lane
  is `flowCreated: false` with nothing executed; a created Flow that failed
  carries the reported category alongside the corpus's expected one.
- `week1-corpus.test.ts` — week1 plans its unarmed workflows on the recording
  lane and every resolved variant on the Flow lane, with a diagnostic naming
  each Flow-lane result and each expected failure category; no resolved result
  is skipped; smoke's plan and its `["recording"]` declaration are asserted
  unchanged. `UNRESOLVED_TODAY` emptied, per its own contract, after the
  parallel fixture landing.

## Not verified

- **No Lab command and no build were run**, as instructed. Nothing here is
  evidence that a Flow-lane bench run works end to end. The first
  `pnpm lab bench --corpus week1` after this change is discovery.
- **The 7-of-23 probe figure is v-criteria's measurement, quoted, not
  re-measured.** It depends on `cssSelectorForTarget(parseScenarioTarget(...))`
  inside `run-scenario.ts`, which I do not own and did not re-run. If a
  concurrent worker changed a corpus fixture's recording script, the split
  moves and so does the post-change rate.
- **The 0.212–0.515 range for the both-lanes rate is arithmetic over an
  unmeasured quantity.** I know the population is 33; I do not know how many
  Flow-lane variants execute.
- **`pnpm check` and `pnpm test` at the repository root were not run** — only
  the test-runner package's own `check` and `test`, per the brief. The bench
  modules have no consumer outside `packages/test-runner` (`grep` over
  `src/**` for `BenchRunsFile`, `renderBenchMarkdown`, `evaluateRecordingRun`,
  `evaluateFailedAttempt`, `expandCorpus` and `BenchCorpus` returns only
  `cli.ts`, and only for `findBenchCorpus` and `runBench`), so the blast radius
  is contained — but I did not compile the other packages.
- **Timing estimates are extrapolated** from v-facility's 70–110 minutes for 69
  runs, scaled to 129. Flow-lane runs include Flow proposal and approval, so
  they are probably slower per run than a recording-lane one; treat 205 minutes
  as a floor, not a forecast.
- **I did not run the Scenario Lab's own tests** after the parallel fixture
  landing, so I have not verified those six new variants beyond the fact that
  `resolveScenarioWorkflow` resolves each of them against the built registry.
- **`packages/test-runner/package.json` shows as modified** in `git status`. It
  was already modified when I started (`w3-runner-alignment` owns it) and I did
  not touch it.

## Open questions or contradictions found

1. **The report schema gap above.** `report.json` cannot state the not-executed
   count without a `packages/test-contracts` change I do not own. The exact
   edits are listed under defect 3.
2. **`lab bench --corpus week1` will now probably exit 1, and takes ~60%
   longer.** Both are correct consequences, but the plan's criterion 5 quotes
   this command, and its proof text should say what a non-zero exit means:
   "at least one of 37 results failed", not "the bench is broken".
3. **W19 is a known-unpassable Flow-lane row** (`w2-flow-lane` Finding 3: the
   mapper makes a navigation executable only for `metadata.transition ===
   "typed"`, so the generated Flow never requests `/account`). It is now planned
   and will run, and will fail. That is the right outcome — it converts a
   silent skip into a measured failure — but the supervisor should expect it and
   not read it as a regression from this change.
4. **Should the recording lane also consume `observation`?** Still open
   (v-criteria's question 5). I consumed it on the Flow lane only, to protect
   comparability. The remaining change is a few lines in `evaluate-run.ts`.
5. **`harnessActivation`'s population includes runs where nothing could
   activate** — inconclusive runs, and the 16 rows that execute nothing. The
   rate is not wrong, but "0.000 harness activation" over that population is
   close to a tautology, as the measurement-source line already admits. Whether
   the population should be narrowed to runs that executed is a metric-definition
   call, not a defect, so I left it and printed its Not-executed count instead.
6. **Evidence size is still dead on both lanes.** `evaluate-run.ts:104`
   hard-codes empty lists in `assemble()`, which both lanes go through, so
   adding the Flow lane does **not** fix metric #9 — v-criteria said so and
   building the lane confirmed it. It remains the one missing metric that needs
   no lane work.
7. **The six missing fixture variants landed while I worked, so a week1 bench
   now skips nothing at all.** v-criteria's and v-facility's "23 runnable / 20
   skipped" is superseded: it is 43 runnable, 0 skipped. Every statement in
   those two reports that rests on a variant being skipped should be re-read
   against this tree — in particular v-criteria's criterion 3 and 4 verdicts,
   which turn on populations that are no longer empty. Whether the runs *pass*
   is of course still unmeasured.
8. **I emptied `UNRESOLVED_TODAY` in `week1-corpus.test.ts`.** If the worker who
   added those fixtures also edited that file, the supervisor will get a trivial
   conflict there; both edits say the same thing.
