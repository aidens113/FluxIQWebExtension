# t758 pf-checks report (provider-free)

## Outcome
Done. Every check passed; no model call was made. Instance `t758-pf-checks`, headed (`FLUXIQ_DEMO_HEADLESS=false`), tree `fxwork/t758/!FluxIQWebExtension`. Nothing edited except this report.

## What changed
Only this file. The Lab wrote build output under `.lab-instances/t758-pf-checks` and runs under `test-runs/instances/t758-pf-checks` (ignored dirs).

## 1. Dry runs (project mode, `--model-reset-only`, `--dry-run`)
Env: `FLUXIQ_TEST_TARGET=persistent-isolated`, `FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25`. Exact flags per the brief. All three exited 0 and printed `"status":"ready","providerCallCount":0,"lane":"created-flow","buildEntry":"chat","target":"persistent-isolated"`. No refusals.
- crossborder-marketplace, task `...-hub-to-cart-basket-redesign-after-creation`: kind `form`, variantId `basket-redesign`, judgement `playback-goal` goalId `hub-in-cart`, instruction 219 chars, `permittedConsequences: []`.
- everything-store, task `...-first-page-plus-earbuds-deal-wheel`: kind `navigate-and-extract`, workflowId `first-page-earbuds`, variantId `deal-wheel`, judgement `expected-dataset` stepId `extract-first-page` stepIndex 12, instruction 472 chars.
- social-network-feed, task `...-group-post-regrouped-after-creation`: kind `form`, variantId `regrouped`, judgement `playback-goal` goalId `post-in-group`, instruction 231 chars. The dry-run printout does NOT show the permission point `send_or_publish`: `permittedConsequences` is `[]` and the request description has no permission field. The point is declared in `social-network-feed/live-tasks.ts:5` per the audit; not visible in dry-run output.
- Common: `live` = profile `lab-create-flow`, deepseek / `deepseek-flash` (= Core default), `coreAuthoringMode: project`, purpose `build_and_adapt`, maxCalls 250, maxTotalTokensPerRun 48000000, maxTotalEstimatedCostUsd 0.25, credentialSource `DEEPSEEK_API_KEY` from `.env.local` (value not printed).
- `candidateTrial`: `{"trialRunner":true,"startReset":false,"fixtureResetBetweenTrials":false,"source":"lab-plan"}`. This is the effect of `--model-reset-only`: Core's trial runs get no Lab fixture reset (see section 2).

## 2. Is `--model-reset-only` safe for the gate (from code)
Safe for the gate's post-build steps; it only removes the Lab reset between Core's own candidate/project trials.
- The flag feeds only `labCandidateTrialFixtureReset` (`packages/test-runner/src/flow-lane/creation/readiness.ts:73-74`, `return !run.modelResetOnly`), used at `run-scenario.ts:237` (Core topology start hook) and `run-scenario.ts:408` (`candidateTrialFixtureReset`). No other reader (grep of `modelResetOnly` in test-runner src).
- Before the post-build playback: `flow-lane/creation/lane.ts:454` `await resetScenarioLab(...)` unconditionally, then `lane.ts:455` `await input.prepareFlowPage("playback")`. In `run-scenario.ts:291-300`, `prepareFlowPage("playback")` arms the variant (`armScenarioVariant`, line 297; skipped only for the `build` moment when `variantArmedAfterBuild`) and asserts armed facts (line 310) after reloading the entry page.
- Before each repair-lane replay: `flow-lane/repair/run-repair-lane.ts:190` `prepare: async () => { await resetScenarioLab(...); await input.prepare(); }`, and `input.prepare` is `flowRunHooks(...).prepareFlowPage` (`run-scenario.ts:353`), so reset then arm then armed-fact assertion, each replay. The comment on line 189 says reset comes first so it does not discard the arm.
- Build's own lasting acts (e.g. a crossborder cart line): wiped by the `lane.ts:454` reset before playback, so they are not left on the site at playback. The reset is the Lab's, independent of the flag. What the flag changes is only that during the build's trials the model must undo its own acts (the product behaviour, `build-resets-site-state-before-rerun`); a model that fails to reset during trials is not rescued by the Lab. That is the intended measurement, not a gate hazard. Also note `readiness.ts:129`: for project mode with the flag, Core is started without the candidate start hook.
- Caveat: the earlier audit (launch-path.md section 3) said not to pass the flag as it is "not needed". It is accepted in project mode (dry runs ready) and does not affect playback or replays.

## 3. Fixture unit tests
`apps/scenario-lab` `test` script = build then `node --test dist/**/*.test.js` (`apps/scenario-lab/package.json:10`). I ran node's test runner on the compiled files in this instance's fresh build dir `apps/scenario-lab/.lab-instances/t758-pf-checks/dist/scenarios` (built by the dry run's prelude, from current source), not the shared `dist/`:
`node --test` on crossborder-marketplace/tests/*.test.js (8 files), everything-store/tests/*.test.js (10 files), social-network-feed/tests/*.test.js (5 files) and tests/live-instructions.test.js.
Observed: `# tests 192, # pass 192, # fail 0, # cancelled 0, # skipped 0`, exit 0, ~114 s. Includes scenario.test.js for all three (arm payload/state/facts) and the browser-paths files, which ran headed.

## 4. Recovery matrix
`FLUXIQ_TEST_ENV_FILES=none FLUXIQ_PROVIDER_KEY_FILES=none FLUXIQ_DEMO_HEADLESS=false`, `DEEPSEEK_API_KEY` unset, target/ceiling env unset.
- `recovery-matrix` with no selector is a usage error (`Usage: lab recovery-matrix --list | --case | --row | --ready`, exit 1). Not a defect; selectors are required.
- `--list`: 12 rows (1-11 and 13; no row 12), 14 cases (1, 2, 3, 4a, 4b, 5, 6, 7, 8, 9, 10, 11, 13a, 13b). `--list` marks only rows 1 and 13 `ready`; the others show `pending` with `needs` (entries, call-subflow, handlers, checkpoints, reconciliation) because `--ready` filters by that status, yet each runs with `--row`.
- `--ready`: cases 1, 13a, 13b all `passed` (run `rmx-2026-10-27T21-35-56-735Z-6143ed`). Case 1 and 13a measures: modelCalls 0, falseSuccesses 0, duplicatedActs 0, learningCostUsd 0.
- `--row 9 --row 10 --row 11` (the gate's required cases): 9, 10, 11 all `passed` (run `rmx-2026-10-27T21-50-14-035Z-ebb009`, no reasons).
- `--row 2` to `--row 8`: 2, 3, 4a, 4b, 5, 6, 7, 8 all `passed` (run `rmx-2026-10-27T21-59-27-757Z-45c81d`).
- Total: 14 of 14 cases passed, matching the plan's `{"passed":14}`. No flake, no rerun needed.

## Not verified
- A Flow through the three armed variants (no provider-free route; needs a paid build, per the audit).
- `send_or_publish` visibility: not in the dry-run output; relies on the audit's file:line only.
- The unit tests ran against the instance-built dist, not the shared `apps/scenario-lab/dist`.
- Key validity/funding (dry run reads the key only).

## Open questions
- `recovery-matrix --ready` only runs 3 of 14 cases; running the gate's "required cases" needs explicit `--row 9/10/11`. Worth stating in the gate's recipe.
