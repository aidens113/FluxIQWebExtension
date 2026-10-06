# t267 S1 — playback adaptation mode (blocker 2)

## Outcome

Done. A created Flow's `explore_and_adapt` playback no longer forces `manual_approval`. The run request carries no `adaptiveMode`, and the Flow stores `fully_adaptive`. Every other intent or purpose is unchanged.

## What changed and why

- `packages/test-runner/src/flow-lane/persisted-flow-run.ts`
  - Added the one rule, beside `PersistedFlowLlmExecution`: `export type LiveFlowAdaptationMode = "fully_adaptive" | "manual_approval"` and `export function liveFlowAdaptationModeOf(intent: PersistedFlowLlmExecution["intent"] | "build_and_adapt")`. It returns `fully_adaptive` for `explore_and_adapt` and `manual_approval` for everything else.
  - `runLiveFlow` sends `adaptiveMode: "manual_approval"` only when the rule says `manual_approval`. For `explore_and_adapt` it sends no `adaptiveMode`, so Core runs under the Flow's stored mode. `authorizedExternalSideEffects: false` is unchanged. The doc comment was rewritten.
- `packages/test-runner/src/live-llm/flow-settings.ts`
  - Stores `adaptationMode: liveFlowAdaptationModeOf(plan.purpose)`. It imports from flow-lane, the same direction live-llm already uses, and creates no import cycle because flow-lane imports nothing from live-llm.
  - The stale comment ("the runtime mode an explicit LLM run requires") was replaced with the real reason.
  - `assertSettingsPersisted` now refuses a read-back whose `metadata.adaptationMode` is not the mode that was written.
  - Before adding that check, I confirmed in Core how the mode is stored and read back:
    - `get-flow` (`api/handlers/flows.ts:66-75`) returns `service.getFlow`, which is the Flow document's metadata (`runtime/service/flows/store.ts:86-94`). The only rewrites on that path are `withoutAutomationStudioLockedDefaultSettings`, which matches only a fully locked `no_llm_intervention` block, and the tokens-per-run migration, which does not touch `adaptationMode`.
    - `update-flow-settings` spreads the patch into the metadata. It skips `withStatedInterventionMode` because `adaptationPolicySettings` is in the patch (`flows.ts:209-215`).
    - So the mode that was written comes back unchanged.

Modes stored per plan purpose (`adaptationMode` on the Flow, and `adaptiveMode` on `run-runtime-session` for run intents):

| Purpose / intent | Stored adaptationMode | run-runtime-session adaptiveMode |
| --- | --- | --- |
| explore_and_adapt | fully_adaptive | (omitted) |
| diagnose_and_adapt | manual_approval | manual_approval |
| diagnosis_only | manual_approval | manual_approval |
| verify_result | n/a (not a plan purpose) | manual_approval |
| build_and_adapt | manual_approval | n/a (not a run intent) |

Tests:
- `flow-lane/tests/persisted-flow-run.test.ts`: one new test. The `explore_and_adapt` payload has no `adaptiveMode`. The `diagnose_and_adapt`, `diagnosis_only` and `verify_result` payloads carry `"manual_approval"`. All of them carry `authorizedExternalSideEffects: false`.
- New `live-llm/tests/flow-settings.test.ts` with 3 tests:
  - A `repair` (`explore_and_adapt`) plan saves `fully_adaptive`.
  - The `adapt`, `diagnose` and `create-flow` plans save `manual_approval`.
  - A read-back with the wrong mode is refused, and so is one with no mode.
  - Plans are built with `planAtLabCeiling` and a profile shaped like the one in `live-llm-plan.test.ts`.

## Commands run and observed results

- Fail-first: I put the HEAD versions of the two source files back temporarily and bundled and ran the two test files. Result: `# tests 35 # pass 32 # fail 3`. The failing tests were the new persisted-flow-run test (not ok 4), the explore_and_adapt saves fully_adaptive test, and the mismatched read-back test. The manual_approval test passed, as expected. I then restored my sources.
- The bundler named in the brief, `t262-gate/run-subset.mjs`, failed in this worktree with `Cannot find module 'esbuild'`, because `packages/test-runner` cannot resolve esbuild.
  - I made my own copy at `<scratchpad>/t267-s1/run-subset.mjs`. It resolves esbuild from `domain/package.json`.
  - My copy also drops `@fluxiq/client-gateway-websocket` from `external`. Without that, `existing-fluxiq-control.test.mjs` failed at load with `ERR_MODULE_NOT_FOUND`, because the package can only be resolved from `domain`.
  - Command: `node <scratchpad>/t267-s1/run-subset.mjs <pkg> t267-s1-mode src/flow-lane/tests/persisted-flow-run.test.ts src/live-llm/tests/flow-settings.test.ts src/tests/existing-fluxiq-control.test.ts`, then `node --test` on the 3 bundles. Result: `# tests 58 # pass 58 # fail 0`.
  - Per file:
    - persisted-flow-run: 32 pass, 0 fail
    - flow-settings: 3 pass, 0 fail
    - existing-fluxiq-control: 23 pass, 0 fail
- Test files that mention `manual_approval` or `adaptiveMode` under `packages/test-runner/src/**/tests/`: only the three above.
- `pnpm.cmd --filter @fluxiq-web-extension/test-runner check` exited 0. The build cache reported `reuse` for test-runner:check, so I also ran `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` in the package. It also exited 0.
- I deleted `packages/test-runner/.test-build-scratch/t267-s1-mode`, and then the empty `.test-build-scratch`. Both are confirmed gone.

## Not verified

- No live, Lab or Core run. I did not exercise that Core actually auto-promotes, resumes and judges once the Flow is `fully_adaptive`.
- Structure audit not run: `persisted-flow-run.ts` gains another export (a type and a function), which may count against the one-exported-thing-per-file budget.
- Full test-runner suite not run.

## Open questions or contradictions found

- The brief's `run-subset.mjs` does not work for `packages/test-runner` in this worktree: esbuild cannot be resolved, and `@fluxiq/client-gateway-websocket` as an external cannot be resolved at run time. The supervisor may want to fix the shared script.
- `git status` shows edits in `flow-lane/repair/**` and `apps/scenario-lab/**` that are not mine. They came from other workers, and I did not touch them.
