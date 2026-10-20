# lane-t-p4a-virtual-timers report

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t746/!FluxIQ` (branch task/t746-offline-trials-tier1). Nothing committed.

## Outcome

Partial. Everything in the brief's owned paths is done and validated. One wiring step is missing because it sits
outside the owned paths: `runtime/executor/graph-run.ts` calls `executeWithRegionTimeout(...)` without passing
`options.startTimer`. So a real graph run does not yet use the new option. The function itself takes and honours
it (it is tested directly). The fix is a one-argument change (see Open questions).

## What changed and why

- `runtime/environment/virtual-clock.ts`: `AutomationStudioVirtualClock` gains virtual timers.
  - `startTimer(wait, delayMs, fire) => { cancel }` has the `ClientGatewayTimerSource` shape. It is an arrow property,
    so it can be handed on unbound. It accepts any `{ kind: string }`, so it fits both the gateway's source and the
    executor's option.
  - `advance(ms)` fires every timer whose deadline it reaches, in deadline order. Ties fire in the order the timers
    were started, and `now` is set to each deadline while it fires. A timer started while firing also fires if its
    deadline falls inside the same advance.
  - `delay(ms, signal)` keeps its behaviour (an aborted wait does not advance; zero, negative and non-finite waits do
    not move time) and now fires the timers it passes.
  - Zero, negative and non-finite timer waits are due now and fire on the next move (`advance(0)` included).
  - There is no idle detection: time never moves by itself.
- `runtime/environment/channel-scope.ts`: the AsyncLocalStorage frame is now `{ scopeId, timers }`.
  - `run(scopeId, work, timers?)`: the third argument is optional, so existing callers are unchanged.
  - `gatewaySource.timers()` returns the frame's timer source.
- `runtime/environment/environment.ts`: the port gains an optional `startTimer`. When it is absent, real timers are
  used; the live environment leaves it absent.
- `runtime/environment/scoped.ts`: sets `startTimer: clock.startTimer`, and `within` passes it to the scope.
- `runtime/environment/executor-options.ts`: a non-live environment's `startTimer` is placed on the options. The live
  environment returns early, so neither `random` nor `startTimer` is set (the existing behaviour, restructured).
- `runtime/executor/contracts.ts`: new option `startTimer?: (wait: { readonly kind: "region_timeout" }, delayMs,
  fire) => { cancel(): void }`. It has a two-line doc comment, kept short because the file must stay within the
  800-line limit (it is now 796 lines).
- `runtime/executor/region-execution.ts`: `executeWithRegionTimeout` gains an optional sixth parameter `startTimer`.
  When it is absent, a local `startRealRegionTimer` (setTimeout/clearTimeout) does what the old code did.
- `client-gateway/service/channel-scope/source.ts`: new optional `timers?(): ClientGatewayTimerSource | undefined`.
- `client-gateway/service/commands.ts`:
  - `executeAction` reads the scope's timers once, at dispatch, and starts the answer wait on them; when there are
    none it uses `config.startTimer`, as before.
  - The fire closure carries those timers into `answerNeverCame` and then `reconcileWith(commandId, timers)`.
  - The public `reconcileAction` uses the current scope's timers.
  - The durable `reconcile` port passes the timers through.
- `client-gateway/service/command-ledger/dispatch.ts`: `Entry.timers` is read once in `execute()` from
  `ports.channelScope?.timers?.()`. Both answer-wait starts use `entry.timers ?? config.startTimer`, and
  `reconcile(commandId, entry.timers)`. `Ports` gains `channelScope` (it was already passed in by the spread).
- `client-gateway/service/command-reconcile/reconciler.ts`:
  - `reconcile`, `ask`, `send` and `pause` take optional `timers`.
  - With timers, both the answer window and the `running` pause run on them.
  - Without timers, the old path runs: setTimeout, with `unref` on the pause.
  - `Waiter.timer` is now a `ClientGatewayTimer`.
- Timers are captured at dispatch rather than read when a deadline fires. A deadline fired by `clock.advance()` from
  outside the scope therefore still reconciles on the scope's timers (tested).

Tests (new files; no existing test edited):
- `runtime/environment/tests/virtual-timers.test.ts` (8): covers
  - firing order and ties on advance;
  - timers started while firing;
  - firing through delay, and that a cancelled timer never fires;
  - time never moving by itself;
  - zero, negative and NaN waits;
  - the scope carrying its timers inside and none outside;
  - a scope entered without timers carrying none;
  - executor options: offline sets `startTimer`, live leaves it unset.
- `runtime/environment/tests/scoped-deadlines.test.ts` (3, T13). These use a real `ClientGatewayService` with the
  AS scope source and a 60 s answer wait.
  - An answer arriving at a virtual +1.5 s settles succeeded. A command whose answer would arrive at +61 s resolves
    `timed_out` ("Client action timed out after 60000ms.") through `answerNeverCame` and
    `clientGatewayReconciledResult`. The late answer arriving afterwards does not change that result.
  - With a reconcile-answering session, the reconcile question's 45 s wait also runs in virtual time, and the result
    is `timed_out` with `reconciled: "unknown"`.
  - Each test asserts that the gateway's own timer was never used and that wall time was under 2 s.
  - A live command still uses the gateway's own timer.
- `client-gateway/service/tests/scope-timers.test.ts` (5): uses hand-fired timers and a manual scope, with no AS
  imports. Covers:
  - the answer wait on scope timers, read at dispatch;
  - cancel when the answer comes first;
  - the reconcile wait on scope timers when the deadline fires outside the scope;
  - a scope without timers, and live commands, using `config.startTimer`;
  - a durable command's answer wait and reconcile wait on scope timers, ending `outcome_unknown`.
- `runtime/executor/tests/region-timeout/tests/region-execution.test.ts` (3). The options come from the environment:
  - offline: work outlasting a 60 s timeout in virtual time times out through the production region path, the signal
    aborts, and wall time stays under 1 s;
  - offline: work that ends in time keeps its result, and the timer is cancelled;
  - live: the options have no `startTimer`, and a real 30 ms timeout fires.
  - The file sits in a feature subfolder because `executor/tests/` was at its 25-file limit; this follows the existing
    `tests/<feature>/tests/` pattern.

## Commands run and observed results

All commands were run from `packages/fluxiq` unless noted.
- `pnpm exec vitest run src/programs/automation-studio/runtime/environment src/programs/automation-studio/executor src/client-gateway src/programs/automation-studio/runtime/service/candidate-trial src/programs/automation-studio/runtime/executor/tests/region-timeout`
  -> `Test Files 79 passed (79)`, `Tests 528 passed (528)`.
  - The brief's path `src/programs/automation-studio/executor` does not exist, so it matched nothing. The executor
    lives at `runtime/executor`.
- `pnpm exec vitest run src/programs/automation-studio/runtime/executor` -> `Test Files 107 passed (107)`,
  `Tests 914 passed (914)`. That run did not yet include the moved region test, which passed in the run above.
- `pnpm exec tsc --noEmit` -> printed nothing; `tsc exit 0`.
- `node scripts/structure-audit.mjs` (from the Core worktree root) -> `structure-audit: passed (430 warning(s), 1152
  baselined).`
  - An earlier run failed on my files: `executor/tests` had 26 files and `contracts.ts` had 804 lines. Both are fixed.
  - It also reported a barrel-bypass import, now resolved by the move.
  - The trace-matcher failures seen in that earlier run were the other worker's, and they are gone now.

## Not verified

- No graph-level test of a region timeout in virtual time: it cannot pass until `graph-run.ts` forwards the option.
- No live or browser run. The full Core suite was not run (per the narrow-checks rule).
- No real-clock behaviour was changed: live paths take the same setTimeout calls. Only existing tests show this; no
  separate timing comparison was made.

## Open questions or contradictions found

1. Required wiring outside my ownership, in `runtime/executor/graph-run.ts` at about line 412 (the
   `executeWithRegionTimeout(` call). Change its final argument from `options.commandRun` to
   `options.commandRun, options.startTimer`. Until this lands, an offline run's region timeout still uses the real
   setTimeout.
2. `ClientGatewayTimedWait` (types.ts, not owned) only has `kind: "answer"`, so the reconcile answer window and the
   `running` pause start scope timers with `{ kind: "answer", commandId }`. That is accurate (it is the wait for the
   client's answer about that command), but a replay's `startTimer` option cannot tell those waits apart. A
   `"reconcile"` kind would need a types.ts change. This affects only scoped commands: live reconcile waits still use
   setTimeout and never reach `config.startTimer`.
3. The brief's validation path `src/programs/automation-studio/executor` is stale. The real path is
   `src/programs/automation-studio/runtime/executor`.
