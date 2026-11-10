# Run of an answer-first task's Flow, and the chat's routing of the same words (t885)

Worker report for live run run-mw9xfwvd-ccc692b2 (Haiku 5.5, company-website-apprentices, `--attempts 2`). All edits are in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ`, left uncommitted.

## Outcome

Done. Both causes are traced and fixed, each with tests beside it. Each new test was run with its fix reverted and failed. The typecheck, the structure audit, 1,313 tests across the named directories and `pnpm build` all pass.

## Causes

### Cause 1: Run on a task's saved Flow ends at once in "Run failed"

- An answer-first attempt keeps its steps in the task's memory, as `best` and `latest` (`answer-first/task-memory/memory.ts`). It does not write them into the Flow.
- The Flow's steps are applied only after a later attempt proves them. That attempt must run the saved steps whole, unchanged, and be judged yes (`answer-first/apply-proven/proven-run.ts:8-13`, `apply-proven.ts:41-52`).
- So after attempt 1, the task's Flow is the blank orchestration Flow that `create-flow` made, with no Router and no Subflow. This is by design.
- `run.execute` (`runtime/conversations/commands/run-flow.ts`, the `run-runtime-session` call) sends that Flow down the project run path.
- In `framework/automation-service/service.ts` the steps are:
  - `:2518-2519` finds no Router.
  - The code falls to the direct branch.
  - `:2619-2629` ends the trace as failed with "Top-level orchestration Flow has no Router-selected Subflow execution path."
- The chat then says "The run failed: ...".
- Even after a Flow is proven and applied, the project run path is not the task's road. It does not judge the result or answer with it, and it does not keep going until the result.

**Fix: Run of a task's Flow takes the attempt road, in answer-first mode only.** I chose this over any change to `service.ts`, for two reasons:

- The attempt road is reached through the generation endpoint, and its answer has a different shape from a runtime session.
- `flow.explore` in answer-first mode already does exactly this: one attempt on the Flow's saved goal.

The attempt road then:

- finds the saved Flow (route `use`, `repair` or `build`),
- carries every act that earlier attempts landed,
- judges the result, and
- answers with it, or with budget-out.

The changes:

- `runtime/conversations/commands/run-flow.ts:67` asks whether a task lives under the Flow. If one does, `taskRun` (`:100`) starts one attempt through `automationStudioConversationAnswerFirstAttempt`, from where the task starts, and reports it in create-here's and explore's words. A model key that this caller cannot open gives the same setup step that create-here gives, and nothing starts. A Flow that no task lives under, any other mode, and a failed lookup all run as before.
- `runtime/conversations/commands/answer-first/task-of-flow.ts` (new) is the command-side lookup. It goes through the existing read endpoint `get-task-known-flow`, now asked by `flowId`. I added no new endpoint because a new one would need the generated IAM action catalogs in `packages/contracts`, which this brief does not own.
- `framework/automation-service/service/answer-first/route/task-of-flow.ts` (new) is the Core lookup:
  - It answers whether a task's memory has this Flow as its home.
  - It gives the start place of the task that the Flow's goal names now, or of the only task under the Flow, or none.
  - A Flow that is gone, or memory that cannot be read, throws. The structure audit's failure-as-empty rule requires this, and the command then falls back to the ordinary run.
- `programs/automation-studio/api/handlers/task/known-flow.ts` adds the by-`flowId` branch. The ports are now read when a request arrives, not at registration, because the `llm-generation` test forbids touching service properties at registration.
- `api-contracts/automation/task-attempt.ts`: `GetTaskKnownFlowRequest` is now a union of the old shape and `{ projectId, flowId }`, and the response gains an optional `startLocation`.
- `runtime/conversations/commands/build.ts`: `automationStudioConversationAnswerFirstAttempt` accepts an optional `startLocation` that overrides the page on screen. Run names a Flow, not a page, so it starts where the task starts, as Run again does. That keeps the same task key whatever page the person is on.

### Cause 2: the chat's system text sent the same words to Run

- Old text (`runtime/conversations/instructions/prompt.ts`, `describedJobLine`): "A job they describe ... that no Flow above already does is a request to make a new automation from this page: choose flow.createHere".
- The task's own Flow is listed under "The Flows in this project". Haiku took that to mean a Flow above already does the job, so it chose Run (step 0036). Sonnet chose `flow.createHere` on the same text (run-mw9x529c-557f5402, step 0023).
- **Fix:** in answer-first mode only (`prompt.ts:143`, `answerFirstJobLine` at `:155`), the line now reads:

  > A job they describe for this site -- something to find, list, collect, fill in or buy on it -- is a task to do from this page: choose flow.createHere and pass their whole message, in their own words, as its instruction. That holds just the same when a Flow above was made from the same words before: flow.createHere finds that Flow, does the task with what it kept, and returns the result. A job described again is never a request to run a Flow; run one only when they ask for a Flow to be run without describing a job.

- The text names no scenario, site, product or task. Other modes keep the old line unchanged.
- The only place that pinned this text was `instructions/tests/prompt.test.ts`. I searched the Core and Extension source for the old sentence and found no other copy and no digest; build outputs aside, it appears only in this note's debug file.

## What changed (all under `packages/fluxiq/src/`)

Modified:
- `api-contracts/automation/task-attempt.ts`
- `framework/automation-service/service/answer-first/route/index.ts`
- `programs/automation-studio/api/handlers/task/known-flow.ts`
- `runtime/conversations/commands/answer-first/index.ts`
- `runtime/conversations/commands/build.ts`
- `runtime/conversations/commands/run-flow.ts`
- `runtime/conversations/instructions/prompt.ts`
- `runtime/conversations/instructions/tests/prompt.test.ts`

New:
- `framework/automation-service/service/answer-first/route/task-of-flow.ts`
- `framework/automation-service/service/answer-first/route/tests/task-of-flow.test.ts`
- `programs/automation-studio/api/tests/answer-first-run-task-flow.test.ts`
- `runtime/conversations/commands/answer-first/task-of-flow.ts`
- `runtime/conversations/commands/tests/answer-first-run-flow.test.ts`

## Commands run and observed results

All commands ran from `C:/Users/osrs_/FluxStuff/fxwork/t885/!FluxIQ`.

**Cause 1 reproduced, with the fix disabled.** `programs/automation-studio/api/tests/answer-first-run-task-flow.test.ts` uses a real service and registry. Only `generateFlowBootstrapAdaptation` is stubbed. The task's memory is left as attempt 1 leaves it, and the Flow is blank.

- With the routing line disabled: `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/api/tests/answer-first-run-task-flow.test.ts` gave 2 failed and 2 passed. The thread turn received was "The run failed: Top-level orchestration Flow has no Router-selected Subflow execution path. This run did not keep a change for future runs.", which is the live failure word for word.
- With the fix restored: 4 passed.

**Unit tests with each fix reverted:**
- `commands/tests/answer-first-run-flow.test.ts` gave 5 failed of 7.
- `prompt.test.ts` gave 1 failed of 9.
- With both fixes restored, both files passed.

**Lookup test:** `route/tests/task-of-flow.test.ts` passed 5 of 5. Its subject is a new module, so there is nothing to revert.

**`pnpm --filter fluxiq check`:** exit 0, after the final edits.

**`pnpm structure:check`:**
- The first run failed with 3 violations from my change: failure-as-empty in `task-of-flow.ts` and `known-flow.ts`, and the controller in `known-flow.ts` was 25 lines against a 20-line budget.
- I fixed all three: the lookup now throws, and the logic moved into the framework.
- Re-run: "structure-audit: passed (536 warning(s), 1095 baselined)".

**Vitest over the named directories:** `pnpm --filter fluxiq exec vitest run src/framework/automation-service/service/answer-first src/runtime/conversations src/programs/automation-studio/api src/api-contracts/automation`.
- First run: 2 failed.
  - `handlers/tests/llm-generation.test.ts` was mine: the ports were read at registration. I fixed it.
  - `tests/project-task-routes.test.ts` ("removes the task's memory...") failed under load, then passed alone.
- Final run: 171 files and 1,313 tests passed, exit 0, 401 s.

**`pnpm build`:** exit 0.
- `fluxiq:build`, `ui-components:build` and `web:build` were rebuilt because their inputs changed.
- `contracts`, `client-gateway-websocket` and `sdk` were reused.

## Not verified

- No Lab run and no paid model call, as the brief said. Whether Haiku now picks `flow.createHere` for the same words is unproven until the Haiku pair is rerun. Cause 1's fix makes attempt 2 reach the result either way.
- The real attempt road behind a Run of a task's Flow is not exercised end to end. The attempt is stubbed where the service runs it. What the tests prove is that Run reaches the same generation request that create-here and explore send. The road itself is covered by the existing answer-first tests, which passed.
- A direct `run-runtime-session` call (the extension's relay, the web panel, the Lab's own runs) still takes the project run path. On a task's Flow that is still blank, it still fails with the same message. Only the chat's `run.execute` is rerouted.
- `flow.improve` chosen on a task's Flow was not examined.
- The `run.execute` announce line still says "Running ... now." in answer-first mode before the attempt's own reply.

## Open questions or contradictions found

- `docs/architecture/automation-studio/llm-flow-bootstrap.md` names `get-task-known-flow`, and now needs a line for the by-`flowId` form and for Run of a task's Flow. It is outside my owned paths, so I did not change it.
- Any change to the `fluxiq` package version is the supervisor's decision.
