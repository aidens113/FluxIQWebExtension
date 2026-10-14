# t552-w5-live-adapt-launch: report

Brief: `### Brief: W5-live-adapt-launch` (automation-project-agents-plan.md).
Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t552/!FluxIQWebExtension`, branch `task/t552-live-adapt-launch`. Not committed.
No live or paid run was made.

## Outcome

Done. I retired live `diagnose`, `adapt` and `repair` cleanly. I did not give them a new launch.

**What the adaptation gate runs today.** The gate does not need a separate diagnose, repair or adapt launch.
`adaptation-and-breadth-plan.md` Current State and `codex-continuation-live-readiness.md:99-110` agree on what a
counted run is: one `lab run <site> --live-llm ... --authoring-mode candidate --llm-task create-flow --instruction-task
<drift task> --target persistent-isolated --workspace <name> --replays 1`. That one run:

- builds the Flow on the unchanged site
- arms the drift for playback
- diagnoses and repairs inside the same run (`explore_and_adapt`)
- applies the repair and replays it with no model

A separate model-free `lab replay` then proves the repair is reused. The drift tasks are not all named
`-after-creation`: `everything-store-first-page-plus-earbuds-deal-wheel` is one of the gate's three. So the refusal
says "a task whose variant drifts after creation" rather than naming a suffix.

**Why retire and not re-launch.** The three tasks authorized a provider against a Flow built from the run's recording,
and that lane is gone. An instruction-led launch would mean a live run of a saved Flow named by its workspace. That
would be a live `lab replay`, which needs new wiring in `cli.ts` and in `flow-lane/` (replay and persisted-run). Both
are outside my ownership, and the gate does not need it.

## What changed and why

- `packages/test-runner/src/live-llm/live-llm-plan.ts`
  - `assertLiveLlmLaneFlag` (whose messages were the dead "drop --flow" and the misleading "pass --flow") is replaced
    by `assertLiveLlmLaunchable(plan, flowLane)`.
  - A requested recording-built lane is refused via `refuseRecordingOnlyFlow()`.
  - `diagnose`, `adapt` and `repair` are refused by name as `recording.contract`, with
    `details: { code: "automation.instruction_led_authoring_required", retiredTask }`. The message names the
    create-flow `--replays 1` command and the `lab replay` command.
  - `purposeOf`'s refusal for tasks with no runner no longer recommends the retired tasks: "a live Lab run builds with
    create-flow".
  - The plan still plans all four intents, so every intent's bounds come from one function. Many budget tests use
    `adapt` plans.
- `packages/test-runner/src/live-llm/live-llm-run.ts`
  - `beginLiveLlmRun` and `LiveLlmRun.assertLane` call `assertLiveLlmLaunchable`.
  - `assertLane` lost its unreachable "An instruction task is built only by --llm-task create-flow, not X" branch.
  - Docs updated. The file is 799 lines, under the 800 limit.
- `packages/test-runner/src/commands.ts`
  - Removed the dead "drop --flow" check in `creationOptions`.
  - Removed the dead `--flow` with existing/clone check after the retirement refusal.
  - Removed the dead "pass --flow" in `replaysOption`. `--replays` now says it requires `--llm-task create-flow`.
  - The variant refusal now names `--live-llm --llm-task create-flow` instead of `--flow`.
  - Usage text and comments updated.
  - The `flowLane?: true` field stays in the `LabCommand` type because `cli.ts`, which I do not own, reads it. A comment
    says it is never set.
- `packages/test-runner/src/run-scenario.ts`
  - Removed the `flowLaneExclusion` refusal in `resolveWorkflow` and its import. Nothing reached it, because the t519
    refusal at line 122 runs first.
  - Removed the never-assigned `discardWindowUntil`. The second discard read now passes `firstDiscardRead.scope`
    unchanged.
  - Comments updated.
- `packages/test-runner/src/bench/run-bench.ts`
  - Stopped passing `flow: true` (and the Flow-lane `variantId`) at both call sites.
  - A new `assertRunnableLane(entry)` refuses a Flow-lane entry via `refuseRecordingOnlyFlow()`, inside each existing
    `try`, before the runner is asked. The attempt is recorded as an `inconclusive` `recording.contract` evaluation,
    which matches what `runScenario` already did with `flow: true` since t519.
  - The bench planner is unchanged.
- Tests (beside the changed files):
  - `live-llm/tests/live-llm-plan.test.ts`: new `assertLiveLlmLaunchable` test and the new `purposeOf` message.
  - `live-llm/tests/live-llm-run.test.ts`: refusal matrix for every task and lane flag; `assertLane`.
  - `live-llm/tests/cost-ceiling-reach.test.ts`: it began an `adapt` run on the lane, and now uses `create-flow`
    without the lane.
  - `tests/commands.test.ts`: variant and replays messages, plus a new case where `--replays` with repair, adapt or
    diagnose is refused.
  - `tests/cli-llm.test.ts`: the diagnose case now expects the retirement.
  - `run-evaluation/tests/runner-wiring.test.ts`: the source pins now assert that `flowLaneExclusion` and
    `discardWindowUntil` are gone, and the second read's exact call.
  - `bench/tests/run-bench.test.ts`:
    - The both-lanes test now asserts that the runner is asked only for the recording lane, and that the 4 Flow-lane
      results are `inconclusive` `recording.contract` evaluations.
    - The permission-stop campaign test is replaced (see Open question 4). It needed a Flow-lane bundle, which no
      runner call can produce any more. In its place, a new test pins that a campaign's Flow-lane cell is refused on
      create and on resume, and the runner is never called.
- `docs/architecture/testing-facility.md`
  - New paragraph in "The retired recording-derived Flow lane": the three tasks are retired, with the replacing path
    and why no separate launch is needed.
  - Corrected the playback-adapts paragraph, which said a recorded Flow's `--llm-task repair` runs.
  - Corrected the bench corpora text (the stale "`lab run --flow` ... refused as `fixture.invalid`", which was line
    2571 here and 2521 on main). It now says that the bench refuses Flow-lane results as `recording.contract`.
  - Removed `pnpm lab run basic-form --flow` from the finite command list.
  - Fixed the Live LLM envelope's "`lab run ... --flow --live-llm`", and removed the task names from the
    calls-per-intent sentence.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check` -> exit 0 (rechecked after the final edits).
- `pnpm --filter @fluxiq-web-extension/test-runner build` -> exit 0 (rebuilt after the final edits).
- `node --test` from `packages/test-runner`, on the tests beside each changed file plus every test that reads the
  changed sources -> `# tests 510`, `# pass 510`, `# fail 0`. Files:
  - `dist/bench/tests/*.test.js`
  - `dist/live-llm/tests/*.test.js`
  - `dist/tests/{commands,cli-llm,environment,scenario-assertions,coordinator-existing}.test.js`
  - `dist/run-evaluation/tests/{runner-wiring,single-run-evaluation,person-hand-off-invariant}.test.js`
  - `dist/flow-lane/tests/lane-observation.test.js`
  - `dist/guarded-browser/tests/launch-containment.test.js`
  - `dist/run-scenario/browser-session/*/tests/identity.test.js`
  - `dist/run-scenario/tests/{playback-skips-wiring,product-failure}.test.js`
- An earlier intermediate run (before the bench tests were rewritten) showed exactly the 2 expected bench failures and
  271 passes.
- `pnpm structure:check`:
  - The first try failed on two rules: `live-llm/` had 26 files (over the 25-file limit) and `live-llm-run.ts` had 807
    lines (over the 800-line limit). Both came from a separate `launchable-live-task.ts` module.
  - I folded the check into `live-llm-plan.ts`, in the slot of the function it replaces.
  - The rerun printed `structure-audit: passed (194 warning(s), 644 baselined).`
- CLI probes against `dist/cli.js` with `DEEPSEEK_API_KEY` unset in the shell and `FLUXIQ_TEST_ENV_FILES=none`:
  - `run company-website --live-llm ... --llm-task repair` -> `{"status":"failed","category":"recording.contract","message":"--llm-task repair ran against a Flow built from the run's recording ... --llm-task create-flow --instruction-task <task> --target persistent-isolated --workspace <name> --replays 1 ... pnpm lab replay ..."}`, exit 1.
  - `matrix --scenarios-json '["company-website"]' --live-llm ... --llm-task adapt` -> `recording.contract`
    "Recording-only Flow creation is retired ...", exit 1. The matrix always passes the lane flag, so its live mode is
    refused this way.
  - `run company-website --live-llm ... --llm-task create-flow --replays 1 --variant x` -> it parsed, then was refused
    as `fixture.invalid` "names no variant, so --variant x does not apply", exit 1. No `test-runs/` directory was
    created. **Caution:** this run got past the credential check. That means the credential resolver found a key in
    the worktree's `.env.local`, which it reads for the provider key whatever `FLUXIQ_TEST_ENV_FILES` says
    (`provider-credential.ts`). It stopped at the task's variant check, before any topology or provider call, so
    nothing was spent. A valid variant would have gone on to start a real run. I made no further probes of that shape.

## Not verified

- I did not run the full `packages/test-runner` suite, only the tests beside the changed files and those that read
  the changed sources, per the narrow-check rule.
- No live or paid run, and no browser run. Whether the gate's create-flow `--replays` path repairs as described comes
  from the documents, not from a run of mine.
- I did not check the parent bench-campaign shard path (`createShardedBench`) for a Flow-lane cell end to end. It
  calls the same `scenarioOptions` in `executeCampaign` that the new campaign test covers.

## Open questions or contradictions found

1. **Now unreachable but outside my ownership:**
   - `cli.ts:116` still passes `flowLane: command.flowLane === true` (always false), and `cli.ts:146-147` still builds
     `matrixLive` and passes `flow: true`. A live matrix can now only be refused.
   - `run-scenario.ts`'s other `options.flow` branches (lines 122-131, 153, 772) are still there. The runner refuses
     every isolated-target `flow` run first.
   - `LiveLlmRun`'s recorded-Flow machinery is unreachable from the CLI: `authorizer()`, `settle()`,
     `proposesRepairOnly`, `repairAuthorizer`'s non-create message, and `lane-settlement.ts`'s `live.settle`. Its tests
     still exercise it. A follow-up could remove it with `cli.ts`, under one owner.
   - `flow-lane/recording-discards.ts`'s optional `until` scope field has no caller that sets it now (W4's directory;
     not touched).
2. **The bench Flow lane is half-retired.** The planner (`bench/expand-corpus.ts`, which still uses
   `flowLaneExclusion`) still plans Flow-lane results, so the `week1` and `week2` corpora plan results that are now
   always refused. A cleaner end state would be one of:
   - the planner skips the Flow lane with a "retired" `skipReason`, or
   - the `week2` corpus (all Flow lane) and the Flow-lane rates are retired.

   I did not do this. It ripples through about six bench test files, and the realistic-scenario rule refuses these
   corpora at `lab bench` anyway.
3. `run-bench.ts`'s `reconstructBenchEvaluation` Flow-lane branch, including its permission-stop invariant
   preservation, can now be reached only when resuming a campaign created before t519 whose active Flow-lane attempt
   already has a finalized bundle.
4. The removed test, "a finalized permission stop survives reconciliation...", was the only bench-campaign test of
   that branch. Its permission-stop logic is still covered at evaluation level in `bench/tests/evaluate-run.test.ts`.
   The supervisor may want that branch retired together with item 2.
5. The credential resolver reads `.env.local` for the provider key even under `FLUXIQ_TEST_ENV_FILES=none`. A
   "provider-free" CLI probe of a valid create-flow command line on this machine is therefore not provider-free. This
   is by design per `provider-credential.ts:32`, but it is worth knowing before anyone probes again.
