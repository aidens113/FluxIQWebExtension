# Lane T, unit 1: build-time baseline from Lab step files

## Outcome

Done. A new Lab script measures where a live build's wall time goes. I ran it over the 25 newest live runs that have steps: 219.8 build minutes and 129 trials in total.

Time-weighted across those runs:

- **Live trials: 49.8%**
- **Site resets: 0.6%.** This counts only the resets the model did itself; see Not verified.
- **Model calls: 24.3%**
- **Exploration: 22.3%**
- **Other/idle: 3.0%**

The unweighted mean of the per-run shares is trial 35.6%, reset 0.9%, model 30.8%, exploration 28.3%, other 4.3%. A few long, trial-heavy builds pull the pooled figure up.

The 2026-10-19 social build matches the supervisor's figure exactly.

## What changed and why

The only change is the new directory `packages/test-runner/src/build-time/`. Each file exports one thing, the directory has an `index.ts` barrel, and the tests are in `build-time/tests/`. The structure audit did not need a re-export in `packages/test-runner/src/index.ts`, so none was added.

- `types.ts`: types only (`Interval`, `BuildCategory`, `StepClass`, `StepTiming`, `CategoryRule`, `RunFolder`, `RunBuildTime`, `RunBuildTimeRow`, `BuildTimeTotals`).
- `interval-set.ts`: `IntervalSet`, an immutable set of sorted, disjoint intervals with union, intersect and subtract.
- `category-rules.ts`: `CATEGORY_RULES`, the ordered classification table. The first matching rule wins, and the table is printed with every report.
- `classify-step.ts`: `classifyStep`.
- `read-step-timings.ts`: `readStepTimings`.
  - Reads only `steps/NNNN-*/meta.json`.
  - From each file it takes only kind, toolId, callId, phase, part, provider, round, status, startedAt and finishedAt.
  - A step folder with no meta, or without a valid start and finish, is listed as incomplete and left out of the measurement.
- `measure-build-time.ts`: `measureBuildTime`, which splits one run's build time into the shares.
- `find-recent-runs.ts`: `findRecentRuns`.
  - Finds the newest runs whose `steps/` holds at least one step, newest first by `entry.json` startedAt.
  - Reuses `countSteps` and `readRunEntry` from the `lab-runs` barrel.
- `aggregate-build-times.ts`: `aggregateBuildTimes`, which computes the pooled (time-weighted) and mean shares.
- `render-build-time-table.ts`: `renderBuildTimeTable`, which writes the Markdown report.
- `cli.ts`: `node packages/test-runner/dist/build-time/cli.js [--runs-root <dir>] [--limit 25] [--json]`. The runs root defaults to `labRunsRoot()`. The script only reads; it writes nothing.

### Definitions

**Build wall time**
- Starts at the earliest start of any non-playback step, which is the build's opening chat step.
- Ends at the latest finish of any non-playback step.
- Any playback window inside that span is subtracted.
- Lab setup before the first step does not count. In the social run that was about 6 minutes: run.json startedAt is 20:49:11 and the first step starts at 20:55:33.

**Playback window**
- A playback window is the Lab's replay of the applied Flow, plus the judging of that replay. It is excluded from build time.
- It is a maximal run of consecutive steps (by step number) made of `run`/`playback` steps and part-less `judge` steps, holding at least one playback step. It spans the first start to the last end.
- A repair or reauthor build that follows a playback still counts as build time; only the playback between is subtracted. In run-mvddx6wf-17e9eab0 the span is 306.3 s, the playback is 53.0 s, and 253.3 s of build remain.
- A part-less judge that is not next to a playback counts as model time.

**Trials**
- Each `core.test_subflow` or `core.test_candidate` tool window is one trial.
- The reauthor round-test's dry-run nodes (`NNNN-test-core.run_node`, kind `test`) also count. Consecutive nodes of the same `round` form one trial window, including the gaps between them.

**Resets**
- A `project.dispatch` whose callId names a reset (a reset brief) counts as reset for its whole window.
- So does any step whose callId matches `/(^|[^a-z])reset/i`. Examples: `reset.cart.1`, `reset2`, `dispatch.reset.1`, `dryrun.1.reset`.

**Model**
- Any step with a provider, or of kind decide, judge or chat.

**Exploration**
- Tool steps for `web.*` and `core.run_node`.
- In these runs, every `core.run_node` tool step was in the explore or repair phase. Dry-run nodes are kind `test`, so they count as trials.

**Container**
- A non-reset `project.dispatch` only wraps the brief's own steps, so it counts for nothing itself. Any gap it covers that no inner step covers shows up as idle.

**Other**
- Bookkeeping tools.
- `answer` steps (all 0 ms).
- Unknown steps.
- Idle: build time covered by no step.

**Overlaps**
- Each category is an interval union, clipped to build wall time.
- Exclusive shares follow the precedence trial > reset > model > exploration > other: each category takes only the time not already claimed by an earlier one. So a judge call inside a trial counts as trial, and a decide call inside a reset brief counts as reset.
- The five shares therefore sum exactly to build wall time; a test asserts this.

**Reported separately**
- Model time inside trials.
- Reset-labelled time inside trials.
- Each category's raw union.
- Idle time, trial count, longest trial, and playback time.

### What `core.submit_subflow` does in time

In the social run it takes 12-118 ms and runs nothing on the page. Trials happen only in the `core.test_subflow` call that follows it, so submit counts as bookkeeping, not a trial.

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t729/!FluxIQWebExtension`.

1. **Compile:** `pnpm --filter @fluxiq-web-extension/test-runner exec tsc -p tsconfig.json; echo "TSC EXIT $?"`. Printed `TSC EXIT 0` with no diagnostics. This was the final run, after the last edit.
2. **Tests:** `node --test packages/test-runner/dist/build-time/tests/*.test.js`. Final run printed `# tests 8`, `# pass 8`, `# fail 0`.
   - interval-set: merging and dropping empty intervals, nested intervals, intersect and subtract partitioning a set.
   - measure-build-time, main case: a synthetic run of 25 step folders. It covers judges nested in a trial, a reset brief owning a decide, a failed exploration step, two unknown kinds, a folder with no meta, a playback with its part-less judge, and a repair after playback whose dry-run nodes span two rounds. The test asserts exact wall, share, idle and union figures, and that the shares sum to wall time.
   - measure-build-time, edge cases: a null finishedAt makes a step incomplete; a playback-only run has 0 wall time; a lone part-less judge counts as model time; pooled totals and table rendering are correct.
   - find-recent-runs: newest first, skips runs without steps and non-date folders, honours the limit.
3. **Structure audit:** `node scripts/structure-audit.mjs`. Printed `structure-audit: passed (213 warning(s), 638 baselined).` with no findings under build-time.
   - The first run failed on two `[imports]` findings: `cli.ts` and `find-recent-runs.ts` imported `../lab-runs/<file>.js` directly.
   - Switching both to the `../lab-runs/index.js` barrel fixed it.
4. **Baseline run:** `node packages/test-runner/dist/build-time/cli.js --limit 25` exited 0. The output is below; I dropped the Task column for width (the CLI prints it).
5. **Dry-run check:** `node packages/test-runner/dist/build-time/cli.js --limit 32`, run to exercise the dry-run rule, which none of the 25 newest runs use.
   - Totals: 32 runs, 266.5 build minutes, 155 trials.
   - Shares: trial 49.2%, reset 0.5%, model 24.8%, exploration 22.1%, other 3.5%.
   - The trial-node rule matched 28 steps, and 6.5 min of playback was excluded.
6. **Spot checks:** `node packages/test-runner/dist/build-time/cli.js --limit 32 --json`, written to a scratch file, was used for the social-run comparison and the 17e9eab0 playback check below.

### Per-run table, 25 newest runs with steps

| Run | Verdict | Build min | Trial | Reset | Model | Explore | Other (idle) | Trials | Longest trial s | Model in trials s | Playback s | Incomplete |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| run-mvfq959u-b7afdf80 | failed | 5.7 | 2.2% | 0.0% | 33.5% | 59.1% | 5.1% (5.0%) | 1 | 8 | 0 | 0 | 0 |
| run-mvfq957o-40103539 | failed | 25.0 | 81.8% | 0.0% | 7.5% | 9.9% | 0.8% (0.8%) | 7 | 337 | 27 | 0 | 0 |
| run-mvfq94fg-64e82826 | failed | 8.6 | 33.9% | 2.9% | 37.0% | 22.8% | 3.5% (3.4%) | 5 | 78 | 0 | 0 | 0 |
| run-mvfq94ff-c8c21493 | failed | 6.6 | 6.9% | 12.1% | 36.1% | 40.4% | 4.5% (4.4%) | 10 | 27 | 6 | 0 | 0 |
| run-mved5pro-91998cc2 | failed | 2.4 | 5.6% | 2.0% | 44.2% | 44.1% | 4.2% (3.9%) | 3 | 4 | 0 | 0 | 0 |
| run-mvecxeci-1c2cc227 | failed | 9.3 | 79.4% | 0.0% | 8.3% | 10.6% | 1.7% (1.6%) | 1 | 442 | 10 | 0 | 0 |
| run-mvecxd6w-ed72a1ca | passed | 6.9 | 51.0% | 0.0% | 23.0% | 6.9% | 19.2% (18.9%) | 8 | 37 | 20 | 19 | 0 |
| run-mvectfld-c2f5d958 | failed | 10.9 | 33.1% | 0.0% | 37.0% | 26.8% | 3.1% (3.0%) | 5 | 60 | 0 | 0 | 0 |
| run-mvebqbm4-b3f3b742 | passed | 6.0 | 36.3% | 0.0% | 31.5% | 29.8% | 2.4% (2.3%) | 7 | 48 | 13 | 30 | 0 |
| run-mvebbnwm-47169b0d | passed | 6.6 | 47.6% | 0.0% | 27.0% | 23.1% | 2.3% (2.2%) | 6 | 46 | 16 | 27 | 0 |
| run-mvebbeom-a60886e1 | failed | 13.1 | 54.1% | 0.0% | 24.5% | 19.1% | 2.2% (2.2%) | 8 | 70 | 18 | 0 | 0 |
| run-mveba82m-fd0616dc | failed | 1.6 | 23.9% | 0.0% | 42.4% | 28.2% | 5.5% (5.2%) | 1 | 23 | 5 | 21 | 0 |
| run-mveaglx4-22f23baf | failed | 0.9 | 0.0% | 0.0% | 46.7% | 41.7% | 11.6% (9.6%) | 0 | 0 | 0 | 0 | 0 |
| run-mveaaqxn-d0be9888 | failed | 10.8 | 38.5% | 0.0% | 25.3% | 32.7% | 3.5% (3.3%) | 3 | 93 | 16 | 0 | 0 |
| run-mve8vn94-023a5213 | failed | 4.8 | 9.8% | 1.8% | 42.7% | 41.6% | 4.2% (4.0%) | 3 | 12 | 0 | 0 | 0 |
| run-mvdln2dd-6bc98e25 | failed | 20.2 | 81.6% | 0.0% | 7.1% | 10.7% | 0.6% (0.5%) | 6 | 412 | 39 | 0 | 0 |
| run-mvdl5eg0-a56fdad7 | failed | 3.2 | 2.1% | 1.5% | 48.7% | 43.3% | 4.4% (4.2%) | 3 | 4 | 0 | 0 | 0 |
| run-mvdism0y-ba67f226 | passed | 2.3 | 41.9% | 0.0% | 25.1% | 25.3% | 7.7% (7.3%) | 1 | 57 | 13 | 43 | 0 |
| run-mvdi9e8u-678c35df | passed | 3.5 | 42.2% | 0.0% | 38.6% | 15.3% | 4.0% (3.6%) | 4 | 25 | 24 | 18 | 0 |
| run-mvdi88yz-e444d594 | failed | 20.8 | 37.7% | 0.0% | 23.4% | 37.0% | 1.9% (1.8%) | 11 | 84 | 18 | 0 | 0 |
| run-mvdi0946-d897f3cb | failed | 18.8 | 60.4% | 0.0% | 28.9% | 8.3% | 2.4% (2.3%) | 15 | 54 | 105 | 0 | 0 |
| run-mvdhyf9k-3afd7eb6 | failed | 4.0 | 1.9% | 1.4% | 41.1% | 50.7% | 5.0% (4.8%) | 1 | 5 | 0 | 0 | 0 |
| run-mvdghd7e-267bcda3 | failed | 17.2 | 71.8% | 0.0% | 19.4% | 7.1% | 1.7% (1.5%) | 13 | 65 | 95 | 0 | 0 |
| run-mvdgaz8z-27ff3d1b | passed | 6.5 | 35.1% | 0.0% | 30.0% | 31.8% | 3.1% (2.9%) | 4 | 38 | 20 | 36 | 0 |
| run-mvdflu8o-d99d3100 | failed | 3.9 | 11.8% | 1.2% | 41.3% | 41.9% | 3.8% (3.6%) | 3 | 12 | 0 | 0 | 0 |

Overall, 25 runs, 219.8 build minutes, 129 trials:

| Category | Minutes | Pooled share | Mean per-run share |
| --- | --- | --- | --- |
| trial | 109.4 | 49.8% | 35.6% |
| reset | 1.3 | 0.6% | 0.9% |
| model | 53.4 | 24.3% | 30.8% |
| exploration | 49.0 | 22.3% | 28.3% |
| other | 6.6 | 3.0% | 4.3% |

Of other: idle (no step running) 6.4 min. Model time inside trials (counted as trial): 7.4 min (6.7% of trial time). Reset-labelled time inside trials: 0.0 min. Playback excluded: 3.2 min. Incomplete steps skipped: 0.
Unknown kinds (in other): none.

Precedence for overlaps: trial > reset > model > exploration > other.

| Rule | Category | Matches | Steps |
| --- | --- | --- | --- |
| playback-run | playback | kind run, phase playback: the Lab's replay of the applied Flow | 50 |
| playback-judge | playback-judge | kind judge with no part: judges a playback when next to one, else model | 10 |
| reset-dispatch | reset | project.dispatch whose callId names a reset: the whole reset brief's window | 6 |
| dispatch | container | project.dispatch: wraps a brief's own steps, counts nothing itself | 48 |
| reset-labelled | reset | any step whose callId names a reset (model-chosen label) | 28 |
| trial-tool | trial | kind tool, core.test_subflow or core.test_candidate (judged candidate trial) | 129 |
| trial-node | trial | kind test: a dry-run node of a round-test; consecutive nodes of one round form one trial | 0 |
| model | model | a provider call: kind decide, judge or chat, or any step naming a provider | 1658 |
| loop-answer | other | kind answer: the loop's own refusal or recall, no work (0 ms) | 188 |
| exploration | exploration | kind tool, web.* or core.run_node: acting on or reading the live page | 877 |
| bookkeeping | other | kind tool, project.read_task, project.write_plan, project.amend_plan, project.assemble, core.submit_subflow, core.describe_nodes, core.recall_result: planning and candidate bookkeeping, no page | 274 |
| unknown | other | anything else | 0 |

The table above is the toolId/kind-to-category mapping the script used, with the number of steps each rule matched across the 25 runs.

### The 2026-10-19 social build (run-mvfq957o-40103539)

The supervisor's figure: "20.5 of its 25 working minutes in 7 whole trials, one took 337 s". The script gives:

- Build wall time: 1,502.8 s = 25.05 min (20:55:33.217 to 21:20:36.058, no playback).
- Trial time: 1,229.9 s = 20.50 min, 81.8% of the build.
- 7 trials, all `core.test_subflow`. The longest took 336.8 s.

**The two agree exactly.** The rest of that build:

- Model: 7.5% (112 s).
- Exploration: 9.9% (148 s).
- Other: 0.8% (12.5 s, of which 11.7 s idle).
- Judge calls inside trial windows took 27 s; these are counted in the trial share.

## Not verified

- **Resets that Core runs inside a trial cannot be measured.**
  - No step or log span marks them. The newer runs have no reset trace lines at all. The older reauthor dry-runs log only `dry-run end ... reset=ok`, with no separate timing.
  - That time is counted as trial. The 0.6% reset share is therefore only the resets the model did itself (labelled callIds or a dispatched reset brief), and it is a lower bound.
  - How much of the 80-442 s trials is reset is unknown.
- **Reset detection depends on how the model named its calls.** A reset the model did not label "reset" counts as exploration or model time.
- **The measurement does not use `logs/core.log` build-trace spans** (build start/end, dry-run, apply, judge). Steps alone set the windows. In the one run I compared (17e9eab0), the logged dry-run window and the dry-run node steps agreed to within about 0.5 s.
- **lab-slots/slot-1..4 hold only an `owner` file, with no run data.** Every run came from `C:/Users/osrs_/FluxStuff/lab-runs`.
- **I did not check that `ms` in meta.json equals finishedAt minus startedAt.** The script uses the timestamps.
- **run-mvecxd6w-ed72a1ca is 18.9% idle, and I did not trace which gap causes it.** Likely candidates are dispatch overhead or the gaps between supervisor rounds.

## Open questions or contradictions

1. **Reset time inside trials needs a Core span.** Core would have to emit a step, or a build-trace `reset start/end` line, inside `core.test_subflow` and `core.test_candidate`. Until then the trial share includes those resets, so the offline-trial plan cannot split trial time into reset and replay. That split matters because resets stay live even when trials go offline.
2. **The pooled and mean shares differ a lot** (trial 49.8% pooled against 35.6% mean). Two social builds and one photo build spent 79-82% of their time in trials, with single trials of 337-442 s, and these dominate the pooled figure. Which figure the plan quotes is the supervisor's call.
3. **Judge calls stay even if trials go offline.** Model calls inside trials are 6.7% of trial time (7.4 of 109.4 min).
