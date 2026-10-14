# t553-w6-key-scope: report

Brief: `### Brief: W6-lab-key-scope-and-dead-flow-lane` (automation-project-agents-plan.md).
Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t553/!FluxIQWebExtension`, branch `task/t553-lab-key-scope-and-dead-flow-lane`. Not committed.
I made no live run, and no CLI probe that could reach a provider. No command I ran read the worktree's `.env.local`.

## Outcome

Done.

**Key scope.** `FLUXIQ_TEST_ENV_FILES=none` was never meant to cover the provider key.
- The resolver reads `DEEPSEEK_API_KEY` from `.env`/`.env.local` on purpose. Its own test pins that the key still arrives under `none`.
- The Lab's isolated live runs depend on that: `scripts/lab/live-isolated.mjs` and `scripts/lab/pair/campaign-environment.mjs` set `none` and still need the key.
- So I left `none` alone and added the explicit way to say "no key": `FLUXIQ_PROVIDER_KEY_FILES=none`.
- Separately, I added a fence so that no test can obtain a real key, whatever the switches say.

**Dead recorded-Flow code.** I removed every item the brief names, plus the code only those items fed. Every refusal a person can still meet keeps its message. One piece is now unreachable but I left it in place, because it sits in a file the brief does not name: the bench's Flow-lane evaluation in `run-bench.ts` (Open question 1).

## What changed and why

### Key scope

- **New `packages/test-runner/src/env-files/`** (`test-process.ts`, `test-read-guard.ts`, `index.ts`, `tests/test-read-guard.test.ts`).
  - `runningUnderTestRunner()` is true when `NODE_TEST_CONTEXT` is set (Node 22 sets `child-v8` in each `node --test` child, and a spawned CLI inherits it), when `--test` is in execArgv, or when the script is a `*.test.js` file.
  - `assertTestMayReadEnvFile(dir, file)`: inside a test, it refuses any directory that is not under `os.tmpdir()`, before a file is opened.
  - The first test case asserts the detection is true inside the test process. If a Node release renamed the variable, that case fails instead of the guard quietly switching off.
- **`target-config.ts`**
  - `loadTestEnvironment` and `loadAllowlistedTestEnvironment` call the guard before each file they read.
  - The comment on `environmentFileNames` now says that `none` governs configuration, not the key.
- **`live-llm/provider-credential.ts`**
  - **Switch.** `FLUXIQ_PROVIDER_KEY_FILES=none` reads no env file. A key that `loadTestEnvironment` folded in from a file is also ignored (found through `testEnvironmentValueSource`). The refusal names the switch, and any other value is refused.
  - **Fence.** Every file read goes through the guard. Inside a test, a key whose value equals the test process's own `process.env` key is refused, so a key inherited from the shell is never used. A test passes a stand-in key in the environment object it hands the runner.
  - **Source label.** A key that `.env.local` folded into the run's environment is now credited to `.env.local`, not to "the process environment".
- **`scripts/lab/pair/provider-key.mjs`**: it mirrors the runner and does not search files under `FLUXIQ_PROVIDER_KEY_FILES=none`.
- **Tests**:
  - `live-llm/tests/provider-credential.test.ts`, 5 new cases: the switch; a key folded in from a file; values other than `none`; a non-temporary root refused; an inherited key refused while a stand-in is accepted.
  - `tests/target-config.test.ts`: a new case where both loaders refuse the package directory, and `none` reads nothing.
  - `scripts/lab/pair/tests/provider-key.test.mjs`: one new case.

### Dead recorded-Flow code

- **`cli.ts`**: it no longer passes `flowLane` or `flow`, and no longer builds `matrixLive`.
- **`commands.ts`** (not named in the brief, but `cli.ts`'s `flowLane` read came from here):
  - The run type's never-set `flowLane` is gone.
  - A live `lab matrix` is now refused while the command is parsed, with the same `refuseRecordingOnlyFlow()` message it got before from `beginLiveLlmRun`.
  - The matrix type's `llm` field is gone, and so are the live-only "exactly one explicit scenario" and "--repeat 1" checks, which could only lead to that refusal.
  - The create-flow matrix message is kept.
- **`live-llm/live-llm-plan.ts`**: `assertLiveLlmLaunchable(plan)` lost its `flowLane` parameter and its lane refusal. The lane is refused at parse time.
- **`live-llm/live-llm-run.ts`** (799 to 723 lines):
  - Removed `authorizer()`, `settle()`, `settleUnfinished()`, the `prepared` field, and the `flowLane` input of `beginLiveLlmRun` and `assertLane`.
  - Removed `repairAuthorizer`'s non-create guard, whose message pointed at the removed `authorizer`.
  - `settleObserved` is now build-only and lost its unused `declared` and `withRunTotal` parameters. Its behavior is unchanged: it still publishes no `runTotal` and checks with a null declaration.
- **Deleted** `live-llm/lane-settlement.ts` and its test, and the export from `live-llm/index.ts`. `run-scenario.ts` imported it but never called it.
- **`run-scenario.ts`**:
  - Removed the `flow` option and every `options.flow` branch: the retirement refusal, the unarmed recording workflow, and the lane flags passed to `assertLane`, `resolveRunSecrets`, `withDeclaredFlowRepair` and `resolveWorkflow`. `recordingWorkflow` is now `workflow`.
  - `flowLane` is `creation !== undefined`.
- **Code only those branches fed** (not named in the brief; removing it avoids extract-and-drop):
  - `run-scenario/resolve-run-secrets.ts` lost the `recordedFlowLane` branch.
  - `run-scenario/workflow/scenario-arming.ts` lost the `flow` option.
  - Deleted `run-scenario/workflow/unarmed-workflow.ts` and its test.
  - Their tests were updated.
- **`flow-lane/recording-discards.ts`**: removed the `until` scope field, `window.until`, and the upper bound. The window is now open-ended and documented. Its test was rewritten for that.
- **`bench/expand-corpus.ts`**:
  - Every resolved Flow-lane result is planned skipped with the new `FLOW_LANE_RETIRED` reason, which names the instruction-led command.
  - Removed `VARIANT_NEEDS_FLOW_LANE` (variants now get the retirement reason), the `flowLaneExclusion` import, and the Flow branch of the lane exclusion.
  - `week1` now plans 21 runnable results, all on the recording lane, with 44 Flow-lane results retired. `week2` runs nothing.
- **Tests updated**:
  - `bench/tests/run-bench.test.ts`: the fake runners no longer read `flow`; the both-lanes, no-Flow-lane and campaign Flow-cell tests now expect retired skips.
  - `bench/tests/week1-corpus.test.ts` and `bench/tests/week2-corpus.test.ts`.
  - `live-llm/tests/live-llm-run.test.ts`: the recorded-Flow tests are removed. Their still-live assertions moved to the build and repair tests: settings saved, exploration and verification records absent.
  - `live-llm/tests/live-llm-plan.test.ts`, `core-default-model.test.ts` and `cost-ceiling-reach.test.ts`.
  - `tests/commands.test.ts`: live matrix refused in every shape, and the provider-free matrix unchanged.
  - `run-evaluation/tests/runner-wiring.test.ts`: the runScenario-with-`flow` test is replaced by source pins that no `flow` option, refusal, exclusion or `unarmedWorkflow` exists; the `recordingWorkflow` pins became `workflow`.
- **`docs/architecture/testing-facility.md`**:
  - The provider key under "Existing FluxIQ target": `FLUXIQ_PROVIDER_KEY_FILES`, a provider-free probe recipe, and the test fence.
  - A t553 paragraph in the retired-lane section.
  - The discard-audit window.
  - The bench corpora counts.
  - The `flowLaneExclusion` paragraph.
  - The note on `FLUXIQ_TEST_ENV_FILES` near the end now points to the key switch.

## Commands run and observed results

- **`pnpm --filter @fluxiq-web-extension/test-runner check`**
  - First run: it failed only in test files (stale `flow`, `flowLane`, `authorizer`, `settle` and `VARIANT_NEEDS_FLOW_LANE` uses).
  - After the fixes it passed: the build-cache line said "stored in the shared store", with no failure line. I ran it again after the last source edit, with the same result.
- **`pnpm --filter @fluxiq-web-extension/test-runner build`**: passed.
- **Narrow tests.** From `packages/test-runner`, I ran `node --test` on these files:
  - `dist/env-files/tests`, `dist/live-llm/tests`, `dist/bench/tests`, `dist/bench/campaign/tests`, `dist/flow-lane/tests`, `dist/run-evaluation/tests`, `dist/run-scenario/tests`, `dist/run-scenario/workflow/tests`, `dist/run-scenario/browser-session/*/tests`
  - `dist/tests/{target-config,commands,cli-llm,scenario-assertions,coordinator-existing,auth-cli,clone-cache,demo-llm-prepare,environment}.test.js`
  - `dist/guarded-browser/tests/launch-containment.test.js` and `dist/saved-flow-replay/tests/provider-absence.test.js`
- **Results.**
  - First run: `# tests 857`, `# pass 846`, `# fail 6`. The six were week1 and week2 counts, three runner-wiring source pins on `recordingWorkflow`, and the old matrix assertions in commands.
  - After the fixes: `# tests 857`, `# pass 852`, `# fail 0`, `# skipped 5`. The 5 are the opt-in native and identity tests, which skip by their own conditions.
- **Scripts tests.** `node --test scripts/lab/scenario-guard/tests/lab-scenario-refusal.test.mjs scripts/lab/core/build/tests/unbuilt.test.mjs scripts/lab/pair/tests/*.test.mjs` printed `# tests 34`, `# pass 34`, `# fail 0`. I ran them because they spawn `run-lab.mjs` with the test's environment, and both are refused before `cli.js` loads any env file.
- **`pnpm structure:check`** printed `structure-audit: passed (194 warning(s), 642 baselined).`, down from 644 baselined at t552.

## Not verified

- I did not run the full `packages/test-runner` suite or `pnpm check`, per the narrow-check rule.
- No CLI probe of a live command line. The new switch is proven by unit tests only. A live `lab run` dry run with `FLUXIQ_PROVIDER_KEY_FILES=none` should be refused as `environment.missing` naming the switch, but I did not run it.
- I did not check Node test isolation modes other than the default one. `--test-isolation=none` is not an option on this machine's Node 22.23. Under it, a test file run in-process is still caught by the `--test` execArgv and the `*.test.js` script-name checks; I did not test that case.
- I did not run `pnpm structure:baseline`. `.structure-baseline.json` is not mine to own, and 2 baselined entries may now be stale.

## Open questions or contradictions found

1. **The bench Flow-lane evaluation is now unreachable, in `run-bench.ts`, which the brief does not name.** I did not touch it:
   - `assertRunnableLane`
   - the `entry.lane === "flow" ? evaluateFlowRun(...)` branch
   - `flowPlanned`/`flowSources`, both always false now
   - `reconstructBenchEvaluation`'s Flow branch
   - `evaluate-run.ts`'s `evaluateFlowRun` and `FLOW_LANE_SOURCES`
   - `render-markdown.ts`'s `flowSources`

   They are unreachable because a new plan skips every Flow-lane cell, and resuming a campaign created before t553 is refused at the plan comparison: its saved cells have `skipReason: null`. The docs say so. One unit, one owner, could retire all of these together with the `week2` corpus.
2. **`flowLaneExclusion`** in `packages/test-contracts` (not mine) now has no consumer outside its own package.
3. **`proposesRepairOnly`** is always false for a launchable run, so `withDeclaredFlowRepair`'s proposal-only path (`flow-lane/repair/declared-repair.ts`, and scenario-lab `repair.ts` declarations) can never change a run. I kept the getter and its caller in `run-scenario.ts`, because removing it properly means removing that module and its plumbing into the creation lane, outside my ownership.
4. **The brief asked "a run or probe that says no env files reads no key from any env file".** Making `FLUXIQ_TEST_ENV_FILES=none` itself drop the key would break the Lab's documented isolated live runs, which depend on it. So I took the brief's fallback and added the explicit `FLUXIQ_PROVIDER_KEY_FILES=none`. If the supervisor wants `none` to drop the key instead, `live-isolated.mjs`, `campaign-environment.mjs` and `instructions.mjs` (and the user's habit) need an opt-in in its place.
5. **Unowned doc.** `docs/architecture/repository-layout.md:308` still describes `FLUXIQ_TEST_ENV_FILES=none` as "No target configuration comes from an env file." That is accurate, but it does not mention the new key switch.
6. **One test gap.** A test that spawns the CLI with a freshly built environment (not spreading `process.env`) loses `NODE_TEST_CONTEXT`, so the fence does not apply in that child. The temporary-root convention still keeps such a test away from a real `.env.local`, but nothing enforces it there. No existing test does this.
