# t512 gate-run-counting-and-copies: worker report

## Outcome

Done, with one scope note. The gate classification is recorded in `snapshots/repair-lane.json` and in the repair lane's published event. It is not in `evaluation.json`: putting it there needs a `RunEvaluation` contract change in `packages/test-contracts` plus the `single-run-evaluation.ts` wiring, and neither is in this brief's ownership (see Open questions).

## What changed and why

All changes are in `packages/test-runner/src`.

1. **Gate classification (goal 1).**
   - New `run-evaluation/adaptation/gate.ts`, exported from the barrel. `classifyAdaptationGate` returns `{ counted, reason }`.
   - The reasons form a closed list, checked in this order: `oracle_failed`, `reauthor_not_kept`, `declared_repair_not_made`, `no_recovery_attempted` or `no_proposal` (nothing proposed, split by `harnessRecovery.attempted`), `not_applied`, `steps_unchanged` (the Flow change is not `changed` or `changed_in_run`, so t506's steps hash did not move), `no_replay`, `replay_not_model_free` (not ran, `providerCalls !== 0` including null, activations above 0, or `modelCalled`), `replay_failed`, and `counted`.
   - "Attempted" also accepts a re-author Core applied in the run (`resultReauthor.applied`), because that route does not set `attempted`.
   - The input is structural, so `run-evaluation` does not import `flow-lane`.
   - `flow-lane/repair/run-repair-lane.ts` writes `adaptationGate` into every `repair-lane.json` it writes and into every publish. That covers four paths: unkept re-author, declared repair not made, the normal proof, and the new failed-lane path.
   - New `flow-lane/repair/lane-summary.ts` (`repairLaneSummary`) sets the event text. The event used to say "The live repair was applied and replayed" even on `no_proposal`. It now reads, for example, "The repair lane ran and applied nothing; the run does not count toward the adaptation gate (no_recovery_attempted)".
   - The run verdict is unchanged. A `no_proposal` run still passes, but no longer quietly.
2. **Repair lane after a failed oracle (goal 2).**
   - `LiveRepairLaneInput.laneFailure` (`{ category, code }`, closed words only, never the message) is a new input. When it is set, the lane writes `repair-lane.json` with:
     - `laneFailure`, `recoveryAttempted`, `adaptationIds` and `changeProposalIds`;
     - `application: null` and `replays: []`;
     - `adaptationGate: { counted: false, reason: "oracle_failed" }`.
   - It also writes `adaptation.json` from the lane run alone (reuse is null, because no replay ran), publishes, and returns without throwing.
   - Design choice: nothing is approved onto a Flow whose result was judged wrong. This follows the lane's existing rule for a declared repair that was not made.
   - New `flow-lane/repair/lane-failure.ts` (`liveRepairLaneFailure`) maps the thrown error to `{ category, code }`.
   - New `flow-lane/repair/failed-judgement.ts` (`recordFailedJudgement`) wraps the created-Flow lane. It remembers the run the lane published, which happens before the lane judges it. If the lane then throws, it calls the repair lane with `laneFailure` and rethrows the original error unchanged. A failed record write is best-effort and never replaces the finding. A lane that throws before publishing a run records nothing.
   - In `run-scenario.ts`, the created-Flow call is wrapped in `recordFailedJudgement`, the publish hook is wrapped in `seen(...)`, and `proveRepair` takes an optional `laneFailure` and uses `repairLaneSummary`.
   - Inside the new closure, `topology.projectId`, `topology.authorizationPin` and `topology.scenarioOrigin` became `createdProjectId`, `activeTopology.authorizationPin!` and `activeTopology.*`, because a closure loses TypeScript's narrowing. The `!` is backed by the guard at the top of the branch.
   - The file stays at exactly 800 lines, its limit.
3. **Central copy (goal 3).** `lab-runs/copy-key-files.ts` `KEY_FILES` now adds `snapshots/repair-lane.json`, `snapshots/adaptation.json` and `snapshots/creation-context.json`.
4. **Pre-flight (goal 4).**
   - `lab replay` now accepts `--variant <id>`. It is parsed in `commands.ts` with the existing `optionalVariant` validation, added to the usage text, and passed through `cli.ts`.
   - `SavedFlowReplayOptions.variantId` arms that variant in place of the task's own variant, on the task's workflow. This goes through the new `saved-flow-replay/workflow-selection.ts` (`replayWorkflowSelection`), named without the `replay-` prefix to satisfy the audit's naming rule.
   - The receipt's `task.variantId` names the variant that was armed.
5. **Tests.**
   - New tests: `run-evaluation/adaptation/tests/gate.test.ts`, `lab-runs/tests/copy-key-files.test.ts`, `flow-lane/repair/tests/{failed-judgement,lane-failure,lane-summary}.test.ts`, `saved-flow-replay/tests/workflow-selection.test.ts`.
   - Six new cases in `flow-lane/repair/tests/run-repair-lane.test.ts`, and one in `tests/commands.test.ts`.
   - Three existing exact-record assertions in `run-repair-lane.test.ts` now include `adaptationGate`.
   - `run-evaluation/tests/runner-wiring.test.ts` reads `run-scenario.ts` as source text. Its regex now accepts `activeTopology.scenarioOrigin` as well as `topology.scenarioOrigin`.

## Commands run and observed results

- **Fail-first.**
  - Command: `node_modules/.bin/tsc -p tsconfig.json` (emits despite errors), then `node --test` over the new and touched dist tests.
  - Result: TS2307 for the missing `../gate.js` and `../replay-workflow-selection.js`.
  - Failing tests: `not ok 25`-`30` (the six new repair-lane gate and oracle-failure cases), `not ok 31` (copy-key-files), and the gate and selection test files.
  - Before that, the 24 existing repair-lane tests passed.
- **Typecheck.** `pnpm --filter @fluxiq-web-extension/test-runner check` printed "core-build: ... current", and `test-runner:check` built with no errors. A later `tsc -p tsconfig.json --noEmit` exited 0.
- **Touched tests.** `node --test dist/lab-runs/tests/*.test.js dist/tests/commands.test.js dist/flow-lane/repair/tests/*.test.js dist/run-evaluation/adaptation/tests/*.test.js dist/saved-flow-replay/tests/*.test.js` printed `# tests 208 # pass 208 # fail 0`.
- **Touched tests plus neighbours.** The same set plus `dist/run-evaluation/tests/*.test.js dist/flow-lane/tests/*.test.js dist/guarded-browser/tests/launch-containment.test.js dist/run-scenario/tests/*.test.js` printed `# tests 574 # pass 574 # fail 0`. Before the regex update, one test failed: runner-wiring test 311, "the runner tells the created-Flow lane where the Flow starts".
- **Structure audit.** `node scripts/structure-audit.mjs` printed `structure-audit: passed (193 warning(s), 646 baselined)`.
  - Earlier attempts failed on `file-lines` (`run-scenario.ts` reached 810 and then 801 lines), on `naming` (three `replay-` prefixed files), and on `statement-packing`.
  - Each was fixed structurally. Nothing was baselined.
- **Pre-flight (model-free, no spend).** Run from B's tree directory, executing this tree's built CLI against B's instance builds, workspace and nested Core:

  ```text
  cd "C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQWebExtension" && env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t262-slot-3 FLUXIQ_LAB_CORE_BRANCH=task/t262-mvp-live-continuation FLUXIQ_WEB_EXTENSION_ROOT="$PWD" FLUXIQ_CORE_ROOT="C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQ" FLUXIQ_LAB_EXTENSION_PATH="$PWD/apps/extension/.lab-instances/t262-slot-3/dist/e2e-chromium" FLUXIQ_LAB_SCENARIO_ENTRYPOINT="$PWD/apps/scenario-lab/.lab-instances/t262-slot-3/dist/server.js" FLUXIQ_LAB_HOST_MODULE="$PWD/domain/.lab-instances/t262-slot-3/host/web-panel-host.mjs" node "C:/Users/osrs_/FluxStuff/fxwork/t512-gate-run-counting-and-copies/packages/test-runner/dist/cli.js" replay bigbox-retail --workspace t262-b --project 6fd89620-3aa3-4d2c-b777-8d3eb51bd021 --flow flow.1ad09671-663f-444b-8cc6-4f98e1c8bea5 --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation --variant redesigned-buy-box
  ```

  - The project and Flow come from `run-mv6p76yw-701793d0/snapshots/creation-context.json`, the latest run with workspace `t262-b`. Its task is `bigbox-retail-pickup-cart-store-remembered-after-creation`.
  - Exit 0. Receipt `replay-mv6wsw8g-ea232288`:
    - verdict `passed`, `task.variantId: "redesigned-buy-box"`;
    - `coreProviderCallCount 0`, `calls 0`, `harnessActivations 0`;
    - `flowContentHash` before and after both `7e7d715b…`;
    - 17 actions, all succeeded, and `playbackGoalHeld: true`.
  - The receipt is at `fxwork/t262/!FluxIQWebExtension/test-runs/instances/t262-slot-3/replays/replay-mv6wsw8g-ea232288.json`.
  - **Meaning:** with `redesigned-buy-box` armed, this saved Flow passes with no model. The drift does not force a failure, which is the same absorption the run-mv6v2g3l debug found. So the bigbox variant cannot count toward the gate as it stands.
  - **After this task is merged and B's tree is synced,** the launcher form is: `pnpm lab replay bigbox-retail --workspace t262-b --project 6fd89620-3aa3-4d2c-b777-8d3eb51bd021 --flow flow.1ad09671-663f-444b-8cc6-4f98e1c8bea5 --instruction-task bigbox-retail-pickup-cart-store-remembered-after-creation --variant redesigned-buy-box`, under the same `env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none FLUXIQ_LAB_INSTANCE=t262-slot-3 FLUXIQ_LAB_CORE_BRANCH=task/t262-mvp-live-continuation` prefix.

## Not verified

- No live or paid run. The `run-scenario.ts` wiring (`recordFailedJudgement` around the created lane, the `laneFailure` path, the new event text) is covered by unit tests of the helper and the lane, not by an end-to-end Lab run.
- The pre-flight did not check facts against the armed page, because `lab replay` asserts no armed facts. The arm call succeeded and the receipt names the variant. That the product page actually rendered the redesign is inferred, not observed.
- The pre-flight used this tree's test-runner (dev `ada5aca7` plus t512) against B's builds and Core (`task/t262-mvp-live-continuation`), not B's own launcher. The launcher's build-phase and staleness guards did not run.
- I did not run full package suites, by rule.

## Open questions or contradictions found

1. **`evaluation.json`.** The brief asks for the classification "in its evaluation". `RunEvaluation` is a test-contracts type with a JSON parser (`parseRunEvaluationJson`), and `single-run-evaluation.ts` builds it. Neither is owned. A follow-up could read `adaptationGate` from `snapshots/repair-lane.json` in `singleRunEvaluation`, the way `flowLaneAdaptationMeasurements` reads `adaptation.json`, and add an optional `adaptationGate` to the contract. The record and the event carry it now, and the central copy keeps `repair-lane.json`.
2. **Failed oracle: apply or not.** I chose to record and not apply. The everything-store debug's fix 3 also proposed `application: null` with the reason. If the supervisor wants the repair applied and replayed anyway, that is a one-branch change in `recordFailedLane`.
3. **P3 `validationOk`** is not part of the classifier, because the brief named P2, P4 and P5. P1, P3's conduct half, P6 and P7 still need checking by hand for a counted run.
4. **Documentation.** `docs/architecture/testing-facility.md` (or wherever `lab replay` is documented) should mention `--variant` and `adaptationGate`. It is not owned and was not edited.
5. **Pre-flight finding.** The bigbox `redesigned-buy-box` drift is absorbed model-free by the t262-b Flow. This supports the debug's option (a): move the target-override slot to crossborder `basket-redesign`. It also suggests running the same pre-flight on a crossborder Flow before paying.
