# lane-t-p3-b-start-hook report

## Outcome

Done. The trial's traced episode now opens inside both trial runners. It opens after the affordability check and the start, around the trial's own run, its end and its judgement. A start hook that the gate did not prepare now runs in the build's context, so its `start_hook_answer` lands in the build's trace. The trial's trace no longer gets it.

## What changed and why

All paths are in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t742/!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/`.

- `service/candidate-trial/run.ts`: `trialIn` now covers the abort check, the affordability check and the start. It then calls `withAutomationStudioGatewayTraceTrial` with prefix `trial`, the ports' `newRunId`, the trial's environment, and a context of `candidate_trial` with candidateId, revision, digest and `start: start.status`. The rest of the old body becomes `runIn(environment, request, ports, start, runId)`, which covers the session, the detached run, the end and the judgement. The run id is `traced?.() ?? ports.newRunId?.() ?? environment.newRunId("trial")`. That is the same shape as before, minted once, and minted exactly as before when tracing is off. Everything still runs inside `environment.within`. The header records the new placement.
- `service/subflow-trial/run.ts`: the same split, placed after the identity, predecessor, affordability and start checks. The context is `subflow_trial`, and `runIn` receives `{ start, predecessors, identity }`. The id is still `subflow-trial.<unique>`.
- `service/candidate-trial/port.ts` and `service/subflow-trial/port.ts`: the ports now call the runners directly. They no longer wrap the call or copy the ports with an overridden `newRunId`, and the unused wiring imports are gone. Headers updated.
- `gateway-trace/wiring/trial.ts`: header comment only. Its signature and behaviour are unchanged, and so is the `AutomationStudioGatewayTraceTrial` type in `wiring/types.ts`, which I did not touch.
- `service/tests/trial-episodes.test.ts`: header updated, and four tests added:
  - candidate, unprepared hook: the answer is in the build's trace, not the trial's. The trial's context has `start: "reset"`. Its session and its judge run under episode `trial.1`.
  - candidate, failing unprepared hook: the verdict is `execution_failed`, no session is opened, the failure answer is in the build's trace, and no trial trace is created.
  - subflow, unprepared hook: the same checks as the first candidate test.
  - subflow, hook prepared by the gate: the hook is called once, its answer is in the build's trace, and the trial's context has `start: "reset"`.

  All existing tests are unedited and still pass, including the candidate test for a start the gate prepared and both tests with tracing off.

Why I moved the opening into the runners instead of keeping it in the ports with the start moved ahead: the affordability check and the unprepared start both live in the runner, inside `environment.within`. A subflow trial's start also follows predecessor and identity checks that only the runner makes. Keeping the opening in the ports would have meant copying or exporting all of that. In the runner it is one wrapper call at the point where the start is known. The ports got smaller, and `trial.ts` and its type needed no change.

Behaviour change to note: a trial refused before it runs now opens no trial episode. That covers a failed start, an unaffordable trial, and a subflow trial with an identity mismatch, a missing predecessor or a gone build. Before, the port opened an empty episode for each of these. The manifest's `start` is now always the real status. Before, it was `null` whenever the gate had not prepared the start.

## Commands run and observed results

From `packages/fluxiq`:

- Before the change, with only the new tests added: `pnpm exec vitest run src/programs/automation-studio/runtime/service/tests/trial-episodes.test.ts`. Result: `Tests 3 failed | 6 passed (9)`. The 3 failures were the two candidate tests and the subflow unprepared test, all for the expected reason: the build's trace was missing `control.start_hook_answer`. The prepared-subflow test passed, as it should under either placement.
- After the change: `pnpm exec vitest run src/programs/automation-studio/runtime/service/candidate-trial src/programs/automation-studio/runtime/service/subflow-trial src/programs/automation-studio/runtime/service/tests/trial-episodes.test.ts src/programs/automation-studio/runtime/gateway-trace src/programs/automation-studio/runtime/environment`. Exit 0, with `Test Files 47 passed (47)` and `Tests 327 passed (327)`.
  - The first run of this set had 1 failure in my own new test. The judge was never called because the fixture's press node has no executor. I fixed the test by giving it the native executor that the existing re-judgement test uses. No implementation change was needed.
- After unpacking statements in the test file: `pnpm exec vitest run src/programs/automation-studio/runtime/service/tests/trial-episodes.test.ts` gave `Tests 9 passed (9)`.
- `pnpm exec tsc --noEmit`: exit 0 on the final run. One earlier run exited 2 with a single error in `storage/project/gateway-trace/tests/store-persistence.test.ts` (TS2724, `AUTOMATION_STUDIO_CLIENT_GATEWAY_TRACE_CHUNK_MIGRATION`). That file belongs to the other worker, and the error had cleared on the rerun.
- `node scripts/structure-audit.mjs`, run from the worktree root: exit 1 with `10 violation(s) across 1 rule(s)`. All 10 are `[naming]` depth violations in `storage/project/gateway-trace/event-chunks/*`, which another worker owns. None are in my files.
  - An earlier run also flagged `[statement-packing]` on 4 lines of my test file. I fixed those, and that rule no longer reports anything.
  - The audit also prints "1 baseline entries can be lowered". I did not run `pnpm structure:baseline`.

## Not verified

- Live Lab runs or real-gateway runs of a trial with a start hook.
- Behaviour against a real database. None of my tests open one, so none carry `// @fluxiq-test-group real-sql`.
- The audit passing end to end, which is blocked only by the other worker's `event-chunks` depth violations.

## Open questions or contradictions found

- The old headers of `trial.ts` and both ports said "The start hook and the site reset run before [the port is called], in the build's trace". That was true only for a start the gate prepared. The headers now describe both cases.
- Trials refused before they run no longer produce an empty trial episode. If something downstream, such as the Lab's trace inspection, expects one episode per trial request, it needs to know this.
