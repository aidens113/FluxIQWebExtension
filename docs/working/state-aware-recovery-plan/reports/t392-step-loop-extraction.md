# t392 C0: step-loop extraction from graph-run.ts

## Outcome

Done. The four blocks of `executeAutomationStudioGraph` the brief named now live in
`AS/runtime/executor/step-loop/` as seams that return a discriminated outcome, which the loop applies.
Behaviour is unchanged. `graph-run.ts` went from 796 to 431 lines, and every new file is under 180 lines.

AS = Core `packages/fluxiq/src/programs/automation-studio/`.

## What changed and why

New directory `AS/runtime/executor/step-loop/` (`executor/` itself stays at 25 source files):

| File | Exports | Holds |
| --- | --- | --- |
| `loop-context.ts` (51) | type `AutomationStudioStepLoopContext` | the run's step-to-step data: flow, options, withholding, runState, now, startedAt, attempts, values, effects, regionTransitions, regionStartedAt, capabilities, nodesById, stepNumbers, loopWords, routeGuard, stopAfter, `nextAttemptNumber()`, `stoppedAt()`, and the mutable `maxSteps`, `arrival`, `pendingRetry` |
| `loop-outcome.ts` (18) | type `AutomationStudioStepOutcome` | `return {trace}` / `next {node}` / `retry` / `proceed {routeOverride?}` |
| `ended-trace.ts` (12) | `automationStudioEndedTrace` | the cancelled/failed trace shape every early return built inline, with the same keys in the same order |
| `defended-fault.ts` (36) | `automationStudioRecordDefendedFault` | `recordDefendedFault`, moved verbatim (internal; not in the barrel) |
| `arrival.ts` (61) | `automationStudioStepArrival` | (a) region capability and timeout checks, arrival reset plus `defence.leaveNode()`, `arrival.attempts += 1`, retry policy, recorded state, pace hold, readiness gate, checkpoint, abort check. Returns `return` or `arrived {remainingMs, retryPolicy, recordedState, paced, readiness}` |
| `ask-or-park.ts` (175) | `automationStudioStepAskOrPark` | (b) from `automationStudioAskInEffects` through both `waiting` returns, including person-needed exhaustion, park, settle in place, the timed pause; with `openAutomationStudioAsk`, `settleAskInPlace` and `settledAskRecord` moved verbatim as private helpers. Returns `return` or `proceed {routeOverride?}` |
| `state-route.ts` (49) | `automationStudioStepStateRoute` | (c) state routing for a step that could not run. Returns `return`, `next` or `proceed` (no way on, so the ladder runs) |
| `failed-attempt.ts` (179) | `automationStudioStepFailedAttempt` | (d) fault assessment, pace learn, recovering activity, ladder (with its `executeNode` closure), planned wait, recovery thought, retry, satisfied, continuation, failed route, stop; `continuationFault` moved as a private helper. Returns all four outcome kinds |
| `index.ts` (9) | barrel | the five seam functions, the context type and the outcome type |

`graph-run.ts`: the import block was rewritten, `recordDefendedFault`, `continuationFault` and the three ask helpers moved out,
and `executeAutomationStudioGraph` now builds the context once and applies each seam's outcome:
`return` returns the trace, `next` sets `currentNode` and continues, `retry` continues on the same node, and `proceed`
carries `routeOverride` on. Lines 23-249 (everything from `withheldBySavedTrace` to `stepsPerIteration`, A's frame lines
included) are byte-identical to the file before this change (checked with `diff`).

Preserved deliberately:
- **Checkpoints:** the same `commandRun.checkpoint()` calls in the same order. Seams call them at the original points: after readiness, before opening an ask, after an in-place settlement, before the ladder, inside the ladder's `executeNode`, and before and after the retry wait.
- **Activities, ledger and aborts:** every emitted activity, every `recordDefendedFault` (with the same outcome and waitedMs), and every abort check.
- **Attempt mutations:** the same `attempts[attemptIndex]` rewrites in the same order.
- **Early-return traces:** each builds the same shape. The cancelled/failed ones with a message go through `automationStudioEndedTrace` and keep their key order. The two `waiting` traces, the recovery-stop trace (message conditional), `stoppedAt` and `missingTargetTrace` are built exactly as before.
- **Message order:** the recovery-stop message is still computed after the "stopped" ledger entry.
- **`runGraphFromSeed`** is untouched, so its never-rejects `try/catch` still wraps the whole loop. The one rethrow (`settleAskInPlace` failing) still rethrows from inside the seam, so it is still caught there.

Two dead assignments in the original were dropped:
- `route = "success"` in the continuation branch. It was only ever followed by `continue` or `return`, so the literal `"success"` is now passed to `chooseAutomationStudioEdge` directly.
- `routing ??= ...` in the state-route block. `routing` was never read after that block, so the seam now uses a local `step.routing ?? await decide...`.

## Commands run and observed results

All in the Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`.

- `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo` (in `packages/fluxiq`): no output, exit 0.
- `npx vitest run` (in `packages/fluxiq`) over `AS/runtime/executor` (all of it), `AS/runtime/tests/composite-executor.test.ts`,
  `tests/router-runtime.test.ts`, `tests/service-flows`, `tests/live-patch.test.ts`, `service/runtime-session`, `parking/`,
  and the pattern matches `flow-bootstrap/script-statements/tests/repeat-pace.test.ts`, `flow-bootstrap/tests/pace.test.ts`,
  `flow-change/tests/resume.test.ts`, `llm/evidence-loop/tests/resume.test.ts`, `recovery/repair-context/tests/flow-graph.test.ts`,
  `service/candidate-trial/tests/learned-paces.test.ts`, `tests/service-adaptation/tests/adaptive-retry-resume.test.ts`,
  `tests/service-bootstrap/tests/apply-graph-index.test.ts`:
  `Test Files 101 passed (101)`, `Tests 855 passed (855)`, duration 83.5s.
- `node scripts/structure-audit.mjs 2>&1 | tail -1`: `structure-audit: 6 violation(s) across 2 rule(s).` (it said 5 on the
  run before, because other workers are editing at the same time). None is in a file I own:
  - `[directory-files] AS/runtime/tests/: 26 source files exceeds the 25-file limit` (I added nothing there);
  - `[imports]` deep imports into `../lifecycle/` from `executor/lifecycle-run/fact-observation.ts`, `host-fact-result.ts`,
    `registry.ts`, `run-state.ts`, and from `AS/runtime/host-runtime.ts`.
  The audit also says "1 baseline entries can be lowered"; I did not run `pnpm structure:baseline` (not my file).
  Only warnings name my files: `graph-run.ts: 431 lines is past the 400-line advisory threshold` (advisory, under the 560 target)
  and the `executor/: 25 source files` advisory, which was already there.

## Not verified

- No live browser or Lab run (none was asked for; the change is a pure refactor).
- I did not run the whole package suite (the brief said not to).
- Object key order in returned traces was kept by construction, not by a test. Tests compare with `toEqual`.

## C3 wiring points after this change

Line numbers are in the Core worktree as of this report.

- **`start`**: in `graph-run.ts` `executeAutomationStudioGraph`, after the context is built (`const ctx` at line 282)
  and before `let resumedRoute` (line 310), guarded by `!seed` so a resume does not fire it. C3's table says "before
  entry selection". If that means before `chooseAutomationStudioStartNode` (line 267), it goes just above line 266,
  before the context exists. Either way it is once per frame, because each frame runs `executeAutomationStudioGraph` once.
- **`before`**: in `step-loop/arrival.ts` `automationStudioStepArrival`, between the pace hold (`const paced`, line 49)
  and the readiness gate (`const readiness = await automationStudioAwaitNodeReadiness`, line 55). This runs on every
  attempt, retries included, because a retry re-enters the loop through the arrival seam. It is never reached on a
  resumed pass (`route !== undefined` skips the seam).
- **`retry`**: in `step-loop/failed-attempt.ts` `automationStudioStepFailedAttempt`, inside
  `if (ladder.kind === "retry" && wait)`, after `ctx.pendingRetry = ...` (line 97) and before
  `await automationStudioRunWait(options, wait.waitMs)` (line 99), between the two checkpoints there.
- **`fail`**: in `step-loop/failed-attempt.ts`, after the `satisfied` branch (line 104) has returned and immediately
  before `const executableFailedEdge = automationStudioRecoveryPathEdge(...)` (line 115). This is the single point
  where the ladder neither retried nor found the state held, and where both the failed route and the continuation
  (line 122) are taken from. If the event should also fire on a person-needed exhaustion stop, that is a separate point in
  `step-loop/ask-or-park.ts` (the `personStep.kind === "exhausted"` branch).
- **`before_next`**: in `graph-run.ts`, between `route = routeOverride ?? attempt.route ?? "success"` (line 399) and
  `const nextEdge = chooseAutomationStudioEdge(...)` (line 402). Line 402 is also reached by a resumed pass, a satisfied
  ladder and an answered ask. Guard on `attempt.status === "succeeded"`, the attempt not having been skipped as an
  optional step, and route `success`, so the event fires only on a verified success. A skip already leaves through
  `state-route.ts` as `next`, so it never reaches line 402.

## Open questions or contradictions found

- C3's table puts `start` "before entry selection", while the brief says "before the first attempt". The two points
  differ by the start-node choice and the context build. I named both above.
- `graph-run.ts` is 431 lines, past the 400-line advisory warning but well under the 560 target and the 800-line cap.
  Moving the top-of-loop pause hold (lines 316-328) or the attempt-stamping block into another seam would bring it under 400 if wanted.
