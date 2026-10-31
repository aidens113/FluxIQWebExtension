# t799 w2-handlers report

## Outcome
Done for items 1-3, with two gaps outside my paths (below).

## What changed and why
RT = Core `packages/fluxiq/src/programs/automation-studio/runtime`.
- `flow-bootstrap/explored-interruptions.ts`: `AutomationStudioExploredInterruption` is now a union of the explored press (unchanged, `kind` absent) and `AutomationStudioTrialInterruption` (`kind: "trial_close"`, `id?`, `name`, `wayOutDefinitionId`, `controlRef`). New `trial(attempts, graph?)` records each cleared layer of a non-skipped attempt that has name + wayOutDefinitionId + a non-empty controlRef under 8 KB (others ignored), deduped by `id ?? name`. New static `of(environment)` gives one shared record per build environment (WeakMap, as the toggles record does). The union keeps `candidate/submission.ts` (not mine) compiling and reading `list()` unchanged.
- `flow-bootstrap/layer-handlers/trial.ts` (new): `automationStudioLayerFact` (obstruction if `id`, else dialog) and `automationStudioTrialLayerHandlerPatch` (scope subflow, `when` the fact visible by name, no completionCheck, press `wayOutDefinitionId` with `{ target: controlRef }`, no consequences, metadata `learnedFrom: "trial_close"`, `layerId`). `waits-for-layer.ts` (new): a part already waits for a layer if a handler's `when` asks either fact about that name. `patch.ts`: `gone` is optional. `explored.ts`: lowers trial records after explored ones, one per layer per part, skipping a part that already waits; explored handlers unchanged. `index.ts` exports both.
- `service/runtime-session/interruption-handler.ts`: fact per I3; `alreadyHandled` matches both facts and `node.metadata.layerId`; patch metadata gains `layerId`.
- Wiring: `exploredInterruptions?.trial(...)` beside `exploredToggles?.trial(...)` in `candidate-trial/run.ts` and `subflow-trial/run.ts`; port field in `candidate-trial/contracts.ts`; `project-build/subflow-trials.ts` passes `AutomationStudioExploredInterruptions.of(environment)`; `project-build/brief-ports.ts` uses `.of(project.trialEnvironment)` instead of `new`, so briefs and subflow trials of a project build share one record.
- Validators: no edit needed. Handler `when`/`completionCheck` parse any non-empty `fact` string (`executor/lifecycle/fact-conditions-parse.ts`); `obstruction` is accepted wherever `dialog` is. An empty completionCheck holds as true (`fact-conditions-hold.ts`). The model-output validator `llm/harness/output-validation.ts:96` demands a completionCheck on `before` handlers, but only for model-written patches; Core's own plan path does not use it (not in my paths).

## Commands run and observed
- tsc `--noEmit -p .`: only errors in others' files: `activity/step/tests/interference.test.ts` (5) and `service/candidate-trial/tests/interruptions.test.ts` (5), both still use the old kind words `dialog`/`consent`/`promotion` against the new I1 kind type, and `executor/node-execution/obstruction-way-out.ts` (1). None in my files.
- `pnpm test -- .../flow-bootstrap/layer-handlers .../service/runtime-session`: 21 files, 139 tests passed (includes new `trial-interruptions.test.ts` and the extended `interruption-handler-layer-scope.test.ts`).
- `pnpm test -- .../service/candidate-trial .../service/subflow-trial .../service/project-build .../flow-bootstrap/tests`: 86 files, 628 tests passed.

## Not verified
- Fail-first order was not run (tests were written after the code).
- `structure-audit` not run (new exported type `AutomationStudioTrialInterruption` shares a file with the record class; may need splitting if it flags).

## Open questions / gaps for the supervisor
1. `service.ts:1584` (single-flow build) builds the trial environment with `exploredToggles: permissions.exploredToggles`; it must also pass `exploredInterruptions: permissions.exploredInterruptions` or candidate trials there record nothing. Not my path. (The project-build path is wired.)
2. Persisting trial layers across a project build reload needs a record-format change in `project-agents/record/**`; not done. In-memory sharing across briefs works.
3. The `layerId` skip against plan nodes cannot be checked: plan nodes (`AutomationStudioFlowBootstrapNode`) carry no metadata, so in a plan the skip is by name only (either fact). In a graph (`interruption-handler.ts`) `node.metadata.layerId` is honoured if the graph writer sets it; I did not confirm the add_handler adaptation writes patch metadata onto the node.
