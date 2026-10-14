# t559-w7-bench: report

Brief: `### Brief: W7-bench-dead-flow-lane` (automation-project-agents-plan.md).
Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t559/!FluxIQWebExtension`, branch `task/t559-bench-dead-flow-lane`. Not committed.
No live run, no CLI probe that could reach a provider, no Core file touched.

## Outcome

Done. Every item the brief names is removed, plus the code only those items fed (no extract-and-drop inside my ownership).
The refusals a person can still meet are kept: the pre-t553 campaign resume refusal ("Campaign plan does not match the
current corpus and manifests") is unchanged, Flow-lane results are still planned skipped with `FLOW_LANE_RETIRED`, and
`--corpus week2` now gets a retirement refusal instead of planning eight skips. A few stale comments and one orphaned data
module sit in files I do not own (Open questions).

## What changed and why

### Bench Flow-lane evaluation (`packages/test-runner/src/bench/`)
- `run-bench.ts`: removed `assertRunnableLane` (both call sites), the `evaluateFlowRun` branch in `runOnce`,
  `flowPlanned`/`flowSources` in both `runs.json` writers, and the Flow branch of `reconstructBenchEvaluation`. That branch
  carried the permission-stop invariant rebuild, which only applied to Flow cells, so it went too. The function now
  rebuilds a recording-lane evaluation only, and its doc comment says why no Flow cell can reach it (pre-t553 campaigns are
  refused at the plan comparison first). It no longer takes `bundlePath`. The `refuseRecordingOnlyFlow` and
  `PERMISSION_STOP_INVARIANT` imports are gone. The target refusal now reads "bench runs the recording lane on isolated or
  persistent-isolated targets; a X target runs a pre-existing Flow on no evaluation lane". It used to say "recording and
  Flow lanes".
- `evaluate-run.ts`: removed `FLOW_LANE_SOURCES`, `FlowRunInput` and `evaluateFlowRun`. `evaluateFailedAttempt` lost its
  `lane` input and always states the recording lane (`flowCreated: null`). Every attempt the bench runs is on that lane.
- `render-markdown.ts`: no "Flow lane" sources section. `report-store.ts`: `BenchRunsFile.flowSources` is removed, and its
  doc comment notes that an older `runs.json` may still hold it and that nothing reads it.

### week2 corpus
- Deleted `corpus/week2.ts` and `tests/week2-corpus.test.ts`.
- New `corpus/retired-bench-corpora.ts`: `RETIRED_BENCH_CORPORA`, which maps `week2` to why it was retired.
- `find-bench-corpus.ts`: `benchCorpora` is now `[week1, smoke]`. `findBenchCorpus("week2")` throws `fixture.invalid` with
  `Bench corpus week2 is retired: it measured adaptation drifts on the Flow lane alone, ... Known corpora: week1, smoke`,
  plus `details.retiredCorpus`. The message names the instruction-led command.
- `cli.ts` calls `findBenchCorpus` before the realistic-scenario guard, so this refusal reaches both a fresh
  `--corpus week2` and the resume of a campaign saved with it.
- The barrel is updated.

### flowLaneExclusion (`packages/test-contracts/`)
- Deleted `src/lane-exclusion/flow-lane-exclusion.ts`, and removed it from the barrel.
- `pagedExtractExclusion` stays. The bench and `extract-intent.ts` still use it. Its doc comment and the one in
  `scenario.ts` no longer cite the Flow lane.
- `tests/flow-lane-exclusion.test.mjs` is renamed to `tests/paged-extract-exclusion.test.mjs`. It keeps the paged-step,
  `recordableActionTypes` and operation-split coverage. The acting/non-acting split is now asserted on
  `recordableActionTypes` directly.

### Declared repair (`flow-lane/repair/` and its callers)
- Deleted `declared-repair.ts` and `judge-repair.ts`, with their tests. `judge-repair` existed only to judge the declared
  expectation, and once `withDeclaredFlowRepair` was gone no production path passed one.
- `run-repair-lane.ts`: removed the `expectation` input, the declared-repair judgement and early return, and
  `declaredRepair` from the gate, the snapshot and publish.
- `run-flow-lane.ts`: removed `repairExpectation`, `repair` on `FlowLaneEvidence` and `FlowLaneOutcome`, the snapshot's
  `repair` key, and the unused judge imports.
- `run-scenario.ts`: removed the `withDeclaredFlowRepair` call and its import. `flowWorkflow` is now `workflow`: it was
  always the same object, because the declaration never applied. The `expectation: repair` spread is gone too.
- `live-llm/live-llm-run.ts`: removed the `proposesRepairOnly` getter, whose only reader was that call.
- Tests:
  - `run-repair-lane.test.ts`: the wrong-target and no-proposal tests are removed. The created-Flow test now asserts it
    applies and replays with no `declaredRepair`, and the other `expectation: DECLARED` uses are dropped.
  - `live-llm-run.test.ts`: the `proposesRepairOnly` assertions are dropped.
- The barrel is updated.

### Other tests reading the changed sources
- `run-evaluation/tests/single-run-evaluation.test.ts`: the bench-row parity half (`benchRowOf`, built on `evaluateFlowRun`)
  is removed. The Flow-lane single run's evidence and recovery assertions are kept.
- `bench/tests/evaluate-run.test.ts`: the Flow-lane and permission-stop cases on `evaluateFlowRun` are removed.
  Permission stops stay covered by `run-evaluation/permission-stop/tests`.
- `bench/tests/run-bench.test.ts`: the `flowSources` checks are now `"flowSources" in runs === false`, and the target regex
  is updated.
- `bench/tests/render-markdown.test.ts`: the `flowSources: {}` fields are dropped.
- `bench/tests/week1-corpus.test.ts`: the corpus list is now week1 and smoke, and a new test pins the week2 refusal
  (category, message, details, and that `toString` is still an unknown corpus).
- `tests/cli-llm.test.ts`: the bench loop is now smoke and week1, plus a week2 CLI case expecting "Bench corpus week2 is
  retired".

### Docs and baseline
- `docs/architecture/testing-facility.md`:
  - The paged-exclusion paragraph replaces the `flowLaneExclusion` one.
  - A new t559 paragraph in the retired-lane section.
  - The campaign reconstruction paragraph is rewritten, because it claimed the bench preserves a Flow evaluation's
    permission stop.
  - The Corpora bullet says week2 is retired.
  - The `repair.js` mention in the person-check paragraph is gone.
- `.structure-baseline.json` (via `pnpm structure:baseline`): 3 entries removed, all for deleted files.

## Commands run and observed results

- **Line endings.** My first Python edits wrote CRLF into LF files, and a runner-wiring source pin failed because of it.
  I converted every touched file back to LF, checking the HEAD blob of each had no CR, then rebuilt and reran everything
  below. `git diff --check` is clean.
- **test-contracts.** `pnpm --filter @fluxiq-web-extension/test-contracts build` and `check` both passed (build-cache
  "stored in the shared store", no error). From `packages/test-contracts`, `node --test tests/*.test.mjs` printed
  `# tests 167`, `# pass 167`, `# fail 0`.
- **test-runner.** `pnpm --filter @fluxiq-web-extension/test-runner check` and `build` both passed.
- **Narrow tests.** From `packages/test-runner`, I ran `node --test` over these:
  - `dist/bench/tests/*`, `dist/bench/campaign/tests/*`
  - `dist/flow-lane/repair/tests/*`, `dist/flow-lane/tests/*`
  - `dist/live-llm/tests/*`
  - `dist/run-evaluation/tests/*`, `dist/run-evaluation/adaptation/tests/*`, `dist/run-evaluation/permission-stop/tests/*`
  - `dist/tests/cli-llm.test.js`, `dist/tests/commands.test.js`
  - `dist/run-scenario/tests/*`, `dist/scenario-steps/tests/*`

  They printed `# tests 848`, `# pass 848`, `# fail 0`, `# skipped 0`.
- **Lab scripts.** `node --test scripts/lab/live-campaign/row/tests/*.test.mjs` (readers of `declaredRepair` in old
  snapshots) printed `# tests 37`, `# pass 37`, `# fail 0`.
- **Structure.** `pnpm structure:baseline` printed `baseline written: 639 entries across 9 rules (0 lowered, 3 removed)`.
  `pnpm structure:check` then printed `structure-audit: passed (194 warning(s), 639 baselined).`

## Not verified

- I did not run the full test-runner suite, `pnpm check`, or the scenario-lab and extension suites, per the narrow-check
  rule. The scenario-lab `identity-drift` tests still import their own `repair.ts`, which I did not change.
- No CLI run of `lab bench --corpus week2` outside the unit test. The refusal is proven by `cli-llm.test.js` and
  `week1-corpus.test.js` only.
- No resume of a real pre-t553 campaign on disk. The refusal path is unchanged code and was not exercised against a
  saved campaign.

## Open questions or contradictions found

1. **Orphaned data outside my ownership.** `apps/scenario-lab/src/scenarios/identity-drift/repair.ts` (`SCENARIO_REPAIRS`,
   `ScenarioRepair`), its barrel export and `tests/scenario.test.ts` test 248 now have no reader. The runner no longer
   loads `repair.js`. One unit owning scenario-lab should delete them.
2. **The `declaredRepair` input to `classifyAdaptationGate` is now dead.** It lives in
   `run-evaluation/adaptation/gate.ts`, which I did not own. No caller passes it, so the `declared_repair_not_made`
   reason can never be produced. It is still pinned by `gate.test.ts:39`. It should go with item 1, unless the reason is
   part of a closed contract set elsewhere.
3. **Stale comments in files I did not own:**
   - `flow-lane/lane-observation.ts`, lines 18 and 137: cite `evaluateFlowRun`.
   - `run-evaluation/flow-lane-evidence-sizes.ts:39`, `run-evaluation/single-run-evaluation.ts:63` and
     `run-evaluation/tests/flow-lane-evidence-sizes.test.ts:8`: cite the bench as a second Flow-lane producer.
   - `person-simulation/check-module.ts:2`: cites `flow-lane/repair/declared-repair.ts`.
   - `scenario-steps/extract-intent.ts:28`: says "the recording and Flow lanes".
4. **Old historical readers.** `scripts/lab/live-campaign/row/repair-outcome.mjs` and `replay-summary.mjs` still read
   `flowLane.repair` and `declaredRepair` from old bundles, and treat them as null when absent. New runs never write
   them. I left this as is.
5. **More of the recorded-Flow lane is still in place.** `runFlowLane` (refused stub), `flowLaneSnapshot`, `FlowLaneInput`
   and `FlowLaneEvidence` in `flow-lane/run-flow-lane.ts` remain. Production code only calls them through the refusal,
   and `flowLaneSnapshot` is used only by tests. The brief did not name them. I only removed their repair fields.
