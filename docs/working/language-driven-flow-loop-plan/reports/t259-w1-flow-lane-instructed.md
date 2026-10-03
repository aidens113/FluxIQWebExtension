# t259-w1: flow-lane.json carries the build's instructed consequences

Tree: `fxwork/t259-flow-lane-instructed-consequences`, branch `task/t259-flow-lane-instructed-consequences`. Nothing is staged or committed.

## Outcome

Done for the case the brief describes: a build that left no proposal and whose settlement succeeded. The lane now keeps the build that the live settlement hands back, so `flow-lane.json` carries the same `instructedConsequences` record as `live-llm.json`. `flow-lane.json` also carries `instructedConsequencesFrom`. The step log is read once, in `LiveLlmRun.withInstructedFromStepLog`, and nowhere else.

## What changed and why

- `packages/test-runner/src/live-llm/live-llm-run.ts` (settle only):
  - `settleBuild` now returns `CreatedFlowSettledBuild` (`{ build, instructedConsequencesFrom }`) instead of `void`.
  - `build` is the same object stored as `buildRecord` and written to `live-llm.json`, and `instructedConsequencesFrom` is the same value.
  - `run-scenario.ts` needed no edit: its hook `build => live.settleBuild(build, bundle, ...)` passes the return value through.
- `packages/test-runner/src/flow-lane/creation/lane.ts`:
  - New exported type `CreatedFlowSettledBuild`. The hook is now `settleBuild: (build) => Promise<CreatedFlowSettledBuild>`, and its doc comment explains why.
  - `startDirectBuild` holds Core's build in `progress.build` before settling, as before. It then replaces that record and the returned build with the settled build, and records the source.
  - `startChatBuild` does the same in the success branch of the existing `.then/.catch`. A settlement error that the chat path swallows leaves Core's own build in place.
  - `CreatedFlowLaneIncomplete` (the `flow-lane.json` of a lane that could not finish) gets `instructedConsequencesFrom`. It is `null` when the settlement answered nothing.
  - A build that left no proposal always ends in this incomplete snapshot, so this is where the field matters.
- Tests:
  - `flow-lane/creation/tests/lane.test.ts`:
    - The fake settlement now returns the settled build. By default it returns Core's own record with `"proposal"` or `null`. An `options.settle` may return a replacement.
    - New test: a refused direct build whose settlement fills murzln6g's real S/0015 list. `incomplete[0].build.instructedConsequences` equals the list and `instructedConsequencesFrom` is `"step_log"`, while the build handed to the settlement was `null`. A settlement that throws leaves `instructedConsequencesFrom: null`.
    - New test: a chat build is judged and published on the settled build, including through `createdFlowLaneSnapshot(...).build`. A direct build whose settlement changed nothing keeps Core's very object.
  - `live-llm/tests/live-llm-run.test.ts`: the existing step-log test now uses the full two-entry S/0015 list. It asserts that `settleBuild`'s answer is the same object as `live-llm.json`'s `build`, with `"step_log"`. For a proposal, it asserts the answer is `{ build: proposedBuild, instructedConsequencesFrom: "proposal" }`.
- Item 2 (fixed tmp path for `FLUXIQ_LLM_STEP_LOG_DIR`): no change was needed.
  - No test-runner test sets that variable. The only test-runner test that mentions it is `src/tests/environment.test.ts`, which passes strings to `buildFluxIQEnvironment` and creates no directory. `run-spend.test.ts` matched only on a constant name.
  - The fixed path t255 noted is in Core's `phases.test.ts`, which this brief excludes.
  - The new tests create no directories. The edited live-llm-run test already uses `mkdtemp` plus `t.after(rm)`.

## Commands run and observed results

- `bash .../heavy.sh "t259 check" pnpm --filter @fluxiq-web-extension/test-runner check`: domain build reused, then `test-runner:check` ran tsc (30.6 s). No errors were printed.
- `bash .../heavy.sh "t259 build" pnpm run build` (in packages/test-runner): exit 0, and tsc emitted dist.
- `node --test dist/flow-lane/creation/tests/lane.test.js dist/live-llm/tests/live-llm-run.test.js dist/live-llm/tests/step-log-instructed.test.js`: tests 56, pass 56, fail 0. The new lane tests are `ok 28` and `ok 29`, and the updated live-llm-run step-log test is `ok 11`.
- `node scripts/structure-audit.mjs` (repository root): `structure-audit: passed (162 warning(s), 118 baselined).` The advisories on my files are line counts only: live-llm-run.ts at 795 lines and live-llm-run.test.ts at 737. Both were already over the threshold.

## Not verified

- No Lab live run and no full suite (as instructed). Nothing re-derived a real run's `flow-lane.json`.
- When the live settlement itself throws (a budget breach, or no provider reached on a direct build), it hands nothing back. In that case `flow-lane.json` keeps Core's unsettled build with `instructedConsequencesFrom: null`, but `live-llm.json` still holds the filled record.
  - Carrying the record through a throw needs either a second hook argument wired in `run-scenario.ts` (not owned) or tagging the thrown failure. I did neither.
  - Core stopping a build at its own spending limit does not throw here. Only the Lab's own breach does.
- The complete `flow-lane.json` (`snapshot.ts`, not owned) has no `instructedConsequencesFrom` field. It is written only for a build that proposed a Flow, where the record is always Core's own (`"proposal"`). Adding the field there would be one line in `snapshot.ts`.

## Open questions or contradictions found

- None blocking. The supervisor should decide whether a breach-throwing settlement should also carry the filled record into `flow-lane.json`. If so, that would be a `run-scenario.ts` change.

## Follow-up (coordinator: close both holes; snapshot.ts now owned)

Outcome: Done. Both holes from "Not verified" above are closed. `live-llm.json` and `flow-lane.json` now hold the same build record and `instructedConsequencesFrom` in every ending: a proposal, no proposal, and a settlement that throws.

### Changes

1. Complete `flow-lane.json`:
   - `CreatedFlowLaneEvidence` gets `instructedConsequencesFrom`, taken from the lane's settled record (`progress`).
   - `snapshot.ts` writes it beside `build`.
2. Throwing settlement:
   - `LiveLlmRun.settleBuild` already read the step log before anything that can throw. It now builds its answer at that point.
   - On a budget breach, no provider reached, or another provider or model, it throws `withSettledBuild(error, answer)`. That function returns the same error object (same category, message, details and cause), with the answer attached as a non-enumerable Symbol property, so `JSON.stringify` and the bundle never write it.
   - The lane reads it with `settledBuildOf(error)` in both the direct path and the chat path, then keeps that record as `progress.build` and `progress.instructedConsequencesFrom`. The incomplete `flow-lane.json` therefore gets the filled build.
   - Both helpers live in `lane.ts` and reach `live-llm-run.ts` through the existing barrel. `lane.ts` now exports 3 values, which is under the audit's warning threshold of 8.
   - `run-scenario.ts` is unchanged.
3. Line endings: my first edit had written CRLF into lane.ts, live-llm-run.ts and both test files. All files are now LF again: `git diff --stat` shows 0 CRLF warnings.

### Tests

- `lane.test.ts`:
  - The proposal-path test now also asserts `createdFlowLaneSnapshot(...).instructedConsequencesFrom`: "step_log" for the chat build and "proposal" for the direct build.
  - New test "a settlement that throws still hands the lane the build it filled from the step log, and the error is unchanged":
    - A direct refused build whose settlement throws a `performance.budget` failure carrying murzln6g's S/0015 list. The rejection is the same error object. `incomplete[0].build.instructedConsequences` is the list and `instructedConsequencesFrom` is "step_log". The rest of the record is Core's own. `JSON.stringify(error)` holds none of it.
    - A chat build whose settlement throws "reached no provider", carrying the same record.
- `live-llm-run.test.ts`: the step-log test now also runs two real throwing settlements, one that reached no provider and one over the run token budget. For each it asserts:
  - the call throws a RunnerFailure;
  - `live-llm.json` has the filled build with "step_log";
  - `settledBuildOf(error).build` is the very object `live-llm.json` holds.

### Commands and observed results

- `heavy.sh "t259 check" pnpm run check` (in packages/test-runner): exit 0, and tsc printed no errors. This ran before a one-line assertion fix in lane.test.ts. The rebuild below type-checked that change through the full tsc emit.
- `heavy.sh "t259 build" pnpm run build`: exit 0. It ran twice, the second time after the assertion fix.
- `node --test dist/flow-lane/creation/tests/lane.test.js dist/live-llm/tests/live-llm-run.test.js dist/live-llm/tests/step-log-instructed.test.js`:
  - First run: 57 tests, 56 pass, 1 fail. My new test assumed the fake Core maps the refused diagnostic to `flow_bootstrap.evidence_budget_exhausted`, but the fake reports `lab.generation_http_400`. I changed the assertion to compare against the build Core handed the settlement.
  - Rerun: 57 tests, 57 pass, 0 fail.
  - The snapshot tests live in lane.test.ts, because `createdFlowLaneSnapshot` has no test file of its own, so this run covers them.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (162 warning(s), 118 baselined).`

### Not verified

- No live Lab run and no full suite.
- `run-scenario.ts`'s real hook was not exercised end to end. It passes `live.settleBuild`'s promise through unchanged, which I read but did not test.
- A non-RunnerFailure thrown inside `settleObserved` (for example a bundle write error) also gets the answer attached, and the lane keeps it. That is intended, but untested.
