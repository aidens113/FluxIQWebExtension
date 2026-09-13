# Report: p-run-evaluation

Worker: `p-run-evaluation`. Give a single scenario run the same evaluation the
bench computes, and make the lane observation reach it. No `pnpm lab` command
was run.

## Outcome

**Done.** `runScenario` now produces a validated `RunEvaluation` for every run
it observes, built from the `RunLaneObservation` the lane publishes. It is
written into the run bundle as `evaluation.json` before finalization (so
`lab inspect` hashes and verifies it) and returned on `RunScenarioResult` (so
`lab run` prints it — `cli.ts` already prints the whole result, and I did not
have to touch it).

The bench and the single run now share one assembler and one run-as-a-test
judgement. **The bench reports exactly what it reported before**: a
differential harness compared 2,316 evaluations between the pre-change
implementation and the new one across the full input matrix, and found zero
differences.

---

## The design question, answered

> Extract the bench's evaluation so both callers share it, or have a single run
> emit the inputs and let the bench keep its aggregation?

**Extract — but extract the *assembly*, not the derivation, and make the
`RunLaneObservation` the one input shape both callers hand it.**

The framing in the brief has a false premise worth naming: `evaluate-run.ts`
was never the bench's aggregation. Aggregation is `aggregate-report.ts`
(`BENCH_RATE_DEFINITIONS`, `aggregateBenchReport`), and I did not touch it.
`evaluate-run.ts` is a *per-run* function that happened to live under `bench/`.
Moving the per-run half out bends nothing toward a second caller, because the
second caller wants exactly the same per-run object.

So the shape is:

- `run-evaluation/observed-run-evaluation.ts` — `evaluateObservedRun`, the one
  place a `RunEvaluation` is assembled and `assertRunEvaluation`-validated.
  Every automation field comes from the observation it is given.
- `run-evaluation/run-outcome.ts` — `runOutcome`, the run-as-a-test half both
  callers compute identically: the verdict, the test-rig category coercion, the
  `runner-verdict` invariant, the closing evidence sequence, the duration.
- `run-evaluation/single-run-evaluation.ts` — `singleRunEvaluation`, the
  `lab run` adapter. Passes the lane's own observation straight through.
- `bench/evaluate-run.ts` — keeps its three entry points and their exact
  signatures, and now delegates to those.

**Why not "emit the inputs and let the bench aggregate".** That is what already
exists: `run-scenario.ts` has published a `RunLaneObservation` since Wave 2 and
the recording lane never read it, which is the unread-evidence defect this
brief was written about. Adding a second emitted-input shape beside it would
have reproduced the defect one level up.

**Why not a full extraction that also unifies the derivation.** Because it
moves a bench number, and rule 1 forbids that. Detail below.

### The one place the two producers differ, and why it stays

`evaluateRecordingRun` does **not** read the lane's observation. It builds a
substitute from the persisted `run.json` — `benchRecordingObservation` — which
reproduces today's derivation exactly.

Two of its three observed fields agree with the lane by construction:
`reportedVerdict` and `automationFailureReported` are read from the same
actions and the same `automationFailure` the lane saw, after a round trip
through `run.json`. (`probeOutcome` in `run-scenario.ts` and `reportedOutcome`
in `bench/evaluate-run.ts` are the same three rules over the same data; I
verified `createRunManifest` preserves `automationFailure: null` and only omits
`undefined`, which is what makes them agree.)

`oracleVerdict` does **not** agree, and this is the number-moving case:

```
bench:  passed ? "passed" : category === "runtime.behavior" ? "failed" : null
lane:   the value assertFinalState actually produced
```

`runtime.behavior` is raised by far more than the fixture oracle, and three of
those raisers fire **after** `assertFinalState` has already succeeded:
`ConsoleErrorWatch.assertOnlyAllowed` (`run-expectations/console-errors.ts:32`),
`DeterministicNetworkGuard` (`network-guard.ts:27`), and the Core probe's
page-state check (`run-scenario.ts:446`, "Core action result did not reach page
state"). For such a run the bench records `oracleVerdict: "failed"` while the
oracle passed. That changes which runs enter the `falseFailure` and
`falseSuccess` populations (`aggregate-report.ts:102,106`), so adopting the
lane's observation on the bench's recording lane **would move a bench number**.
Per rule 1 I stopped and am reporting it rather than doing it.

Consequence, stated plainly: **for a recording-lane run that failed after its
oracle had already passed, `lab run` and `lab bench` now disagree about
`oracleVerdict`, and `lab run` is the correct one.** Everything else is
identical. That is pinned by
`run-evaluation/tests/bench-parity.test.ts`, which asserts the difference set
between the two producers is empty in three cases and exactly `["oracleVerdict"]`
in the fourth. If either side moves, that test fails — which is the anti-drift
device the brief asked for, in place of a comment nobody re-reads.

There is a second, benign divergence the same test pins: when `run.json` is
unreadable the bench loses `reportedVerdict` and `actions` while the single run
still has them, because the lane never lost them. That is the round trip, not a
difference in judgement.

---

## "A new evaluation must not become another thing nothing reads"

Two consumers, both live, neither hypothetical:

1. **`lab run` stdout.** `cli.ts:58` prints `JSON.stringify(result)` for a
   `run`, and `cli.ts:65` prints every result of a `matrix`. Returning
   `evaluation` on `RunScenarioResult` puts the judgement in front of whoever
   ran the scenario, with no change to `cli.ts` (which is outside my owned
   paths — I did not edit it). This is precisely the workflow `v-criteria`
   named as the nearest honest proof for criteria 1, 3 and 4: a handful of
   `lab run <id> --flow --variant <v> --target isolated` invocations reported
   as "N of 4 negative variants reported the manifest's expected category".
   Today that sentence has to be assembled by hand out of `run.json`; now it is
   `automationFailureReported.category` against `automationFailureExpected.category`
   in one printed object.
2. **`evaluation.json` in the run bundle.** Written via
   `bundle.writeStructured` *before* `bundle.finalize`, so it lands in
   `artifact-index.json` and `lab inspect` re-hashes it like every other
   artifact. Written after finalization it would have been an unlisted file
   nothing verifies; `run-evaluation/tests/runner-wiring.test.ts` asserts the
   ordering for exactly that reason.

The runner-wiring test also asserts there is exactly one `singleRunEvaluation(`
call site and that the result carries the evaluation, because "the runner calls
the evaluator" is not something a unit of the evaluator can show and running
`runScenario` needs the whole Lab.

**Not evaluated:** the `existing` and `clone` targets. They run a pre-existing
Flow on no `EvaluationLane`, publish no observation, and so get no evaluation —
`evaluation` and `observation` are both absent there, as before.

---

## What changed

| File | Change |
| --- | --- |
| `packages/test-runner/src/run-evaluation/observed-run-evaluation.ts` (new, 79) | `evaluateObservedRun` + `RunEvaluationIdentity`. The single assembler and contract check. |
| `packages/test-runner/src/run-evaluation/run-outcome.ts` (new, 72) | `runOutcome`, `runDurationMs`. The run-as-a-test half, moved verbatim from `bench/evaluate-run.ts`'s `common()`/`runDurationMs`/`testRigCategory`. |
| `packages/test-runner/src/run-evaluation/single-run-evaluation.ts` (new, 81) | `singleRunEvaluation`. The `lab run` adapter: identity from the resolved workflow, closing sequences from the in-memory events, observation passed through. |
| `packages/test-runner/src/run-evaluation/index.ts` (new, 5) | Barrel. |
| `packages/test-runner/src/run-evaluation/tests/{single-run-evaluation,bench-parity,runner-wiring}.test.ts` (new, 99/106/43) | 14 tests. |
| `packages/test-runner/src/bench/evaluate-run.ts` (edited, 229 → 209) | **Edited under the brief's permission.** Three entry points and their signatures unchanged; they now delegate. `RunEvaluationIdentity` re-exported from `run-evaluation`. `benchRecordingObservation` names the legacy recording-lane derivation and documents why it stays. `RECORDING_LANE_SOURCES` / `FLOW_LANE_SOURCES` byte-identical. |
| `packages/test-runner/src/run-scenario.ts` (edited, 3 hunks) | `RunEvaluation` type import; `singleRunEvaluation` import; `RunScenarioResult.evaluation?`; and the tail: hoist `metrics`, move the `observation` construction above finalization, build the evaluation, write `evaluation.json`, return it. |

`packages/test-runner/src/flow-lane/lane-observation.ts` — **unchanged**. The
brief names it as `packages/test-runner/src/lane-observation.ts`; the real path
is under `flow-lane/`. It needed no edit: `RunLaneObservation` already carried
every field the evaluation needs, including `automationFailureExpected`, which
is what lets a single run score itself against the resolved workflow's own
`expected.failure`.

`packages/test-contracts/**`, `apps/`, `domain/` — **untouched**. No contract
change was needed.

---

## Commands run and observed results

Exit statuses captured by redirect, never a pipe.

| Command | Exit | Observed |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-runner check` | **0** | `tsc --noEmit` clean. (First attempt exit 2, one `exactOptionalPropertyTypes` error in a test fixture of mine; fixed and re-run.) |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (first run) | **0** | `# tests 431 / # pass 431 / # fail 0`, `duration_ms 18410.96`. Includes all 9 bench `evaluate-run` tests and all 14 of mine. |
| `node scripts/structure-audit.mjs` | **0** | `structure-audit: passed (31 warning(s), 19 baselined)`. New advisory: `packages/test-runner/src/run-scenario.ts: 583 lines is past the 400-line advisory threshold` (now 606; the file was 564 before this work and another worker is also adding to it). |
| `node <scratchpad>/bench-diff.mjs` | **0** | `compared 2316 evaluations` / `IDENTICAL: the bench reports exactly what it reported before`. Re-run after the final rebuild: same. |
| `pnpm --filter @fluxiq-web-extension/test-runner check` (re-run after concurrent edits landed) | **0** | clean |
| `pnpm --filter @fluxiq-web-extension/test-runner test` (re-run) | **1** | `# pass 429 / # fail 2` — **both failures are another worker's in-flight work, not mine** (see below) |
| `node --test "dist/**/*.test.js"` (third run, per the faulty-RAM instruction) | **1** | identical: the same 2 failures, deterministic |

### The 2 failures are not mine

```
not ok 63 - auth-gate's Flow run is given the declared secret, never the value its recording script holds
not ok 65 - a scenario that declares no secret sends the inputs it always did
  error: 'unexpected Core call list-recordings'
  at readRecording (dist/flow-lane/finalized-recording.js:74)
     awaitFinalizedRecording (dist/flow-lane/finalized-recording.js:22)
     runFlowLane (dist/flow-lane/run-flow-lane.js:25)
```

Both live in `flow-lane/tests/run-flow-lane.test.ts` and are caused by
`flow-lane/finalized-recording.ts` — an **untracked** file (`git status`: `??`)
that appeared in the working tree between my first and second test runs, along
with an `awaitFinalizedRecording` import added to `run-scenario.ts:29` by
another worker. My first full run, before those landed, was **431/431 green**.
I touched neither file. The concurrent worker's mock does not yet answer
`list-recordings`.

### The differential harness

`<scratchpad>/bench-diff.mjs` holds a verbatim JS transcription of
`bench/evaluate-run.ts` as it stood when I started (the working-tree version, not
`HEAD` — the tree already had uncommitted changes), imports the built new
implementation from `dist/`, and runs both over the cross product of 2 identities
× 8 manifests (absent, empty, mixed action statuses, categorised failure, absent
`automationFailure`, unfinished, inverted timestamps) × 6 runner results × 4
sequence pairs × 5 observations, plus 12 thrown-attempt cases. It lives only in
the scratchpad and writes nothing to the repository.

---

## Not verified

- **No `lab` command was run**, as the brief requires. So the evaluation has
  never been produced by a real run: everything is unit-level plus a
  source-shape check of the call site. What a live `lab run --target isolated`
  would prove and I cannot: that `evaluation.json` survives finalization into
  `artifact-index.json`, that `lab inspect` verifies it, and that
  `lab run`'s printed JSON reads well. The first two follow from
  `writeStructured` running before `finalize` and from `buildArtifactIndex`
  walking the staging directory, which I read, not ran.
- **`structure-audit` did not judge the new directory.** `context.mjs:89-95`
  enumerates `git ls-files`, so untracked files are invisible to it; the audit's
  exit 0 says nothing about `run-evaluation/`. Hand-checked against
  `.structure-baseline.json`: 3 source files + 3 tests in a new directory (limit
  25), longest file 81 lines (limit 800), at most 2 exported values per file
  (limit 15), 6 path segments (limit 9), distinct filename prefixes, a barrel
  present, no import reaching past another directory's barrel, tests in a
  `tests/` folder under the directory that owns them. **The supervisor should
  re-run the audit after staging.**
- **`structure-audit` reports "1 baseline entries can be lowered".** Not caused
  by this work: the only lowerable key is
  `directory-files: packages/test-runner/src/tests` (baseline 51, now 50
  tracked), which moved because another worker deleted
  `src/tests/demo-llm-create-ui.test.ts`. I did not run
  `pnpm structure:baseline`; `.structure-baseline.json` is not mine and the tree
  is still moving.
- **`pnpm check` / `pnpm test` / `pnpm build` at the repository root were not
  run** — only the `test-runner` package's. Nothing outside that package
  imports `bench/evaluate-run.ts` or `run-scenario.ts` except `cli.ts`, which is
  in the package and typechecks.
- **The bench differential proves the pure function, not the bench end to end.**
  `runBench`, `aggregateBenchReport`, `render-markdown` and `compare-reports`
  were not re-run against a real corpus; their unit tests pass unchanged.
- **`run-scenario.ts` is being edited concurrently.** My three hunks were intact
  at the last check, but the file is shared with at least one other worker and
  the supervisor should re-read it before committing.

---

## Open questions or contradictions found

1. **The brief's owned path does not exist.** It names
   `packages/test-runner/src/lane-observation.ts`; the file is
   `packages/test-runner/src/flow-lane/lane-observation.ts`. Harmless here, but
   the same stale path is in `v-criteria` and may be copied into later briefs.
2. **`v-criteria` is out of date on the central fact of this brief.** It says
   "`RunEvaluation` is constructed only in `bench/evaluate-run.ts`" and
   "`grep observation packages/test-runner/src/bench/` returns one hit, in a
   comment". Both were already false when I read the tree: `evaluateFlowRun`
   exists, consumes `result.observation`, and `run-bench.ts:153` dispatches to
   it for every Flow-lane row. So the observation was already read on **one** of
   the two lanes. What was actually unread was the **recording-lane**
   observation, which is still unread by the bench and now read by `lab run`.
3. **The recording-lane oracle inference is a live honesty defect, and it is
   now isolated but not fixed.** `benchRecordingObservation`'s `oracleVerdict`
   line is the last inference in the bench. Correcting it is one line plus one
   test, and it moves `falseFailure` / `falseSuccess` against the eight reports
   on disk. Recommended sequencing: make it part of the same change that adds
   the Flow lane to the week1 corpus, so one report-schema break covers both,
   and record the break explicitly rather than letting the numbers drift
   quietly. That is a supervisor decision, not a worker one.
4. **`docs/architecture/testing-facility.md:807-816` lists a bundle's completed
   output and does not mention `evaluation.json`.** It also already omits
   `run.json`, `evidence-policy.json` and `snapshots/`, so the list is stale
   independently of me. `docs/` is outside my owned paths, so I did not edit it;
   the one-line addition is `evaluation.json` in that fenced block plus a
   sentence saying it is present exactly when the run had an evaluation lane.
5. **`probeOutcome` (`run-scenario.ts:556`) and `reportedOutcome`
   (`bench/evaluate-run.ts`) are still two copies of the same three rules.**
   They agree today and `bench-parity.test.ts` would catch them parting, but the
   honest end state is one function. I left it alone because merging them means
   the bench reading the lane's observation, which is item 3.
6. **A single run's evaluation carries `repeatIndex: 0` and no corpus row id.**
   That is correct for what it is, but it means a directory of `evaluation.json`
   files from ad-hoc `lab run`s cannot be fed to `aggregateBenchReport` as-is —
   `groupBenchResults` keys on `corpusRowId`. If someone later wants
   "N of 4 negative variants" computed rather than read off by eye, that is the
   seam to add, and it belongs beside `aggregate-report.ts`, not here.
