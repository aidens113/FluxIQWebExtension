# t427 durable command reconcile: worker report

Brief: t427. A durable (required-mode) browser command that is interrupted or never answered
should be handled the way an ordinary one is. Route guard open question 2 was also in scope.
Trees are `fxwork/t427/!FluxIQWebExtension` and `fxwork/t427/!FluxIQ`, both on branch
`task/t427-durable-command-reconcile`. Nothing is committed.

## Outcome

**Done**, after the follow-up below.

- The coordinator chose **(a)** for open question 1, and it is now implemented.
- Open question 3 is settled: the `consume_failed` was already there before my change, and is
  noted for a follow-up.

The first pass, described in the rest of this report, was Partial: it was waiting on that
decision.

## Follow-up: decision (a) implemented, open question 3 settled

The required-mode latch stays. Its only new job is to word the stop: the page check runs, and the
run then stops honestly as Outcome uncertain.

**What a required run does now when its command's outcome stays unknown:**

- The act is never pressed again.
- No checkpoint is asked after the latch.
- The run ends `failed` with the trace failure `run.outcome_uncertain`.
- The message reads "Outcome uncertain: The step's answer never came back, and a run that must
  prove every act stops when one cannot be proved." It is followed by one of:
  - "The page shows the step took effect; it was not done again."
  - "The page shows the step did not take effect; it was not tried again, because this run makes
    each act at most once."
  - "Nothing on the page shows whether the step took effect; it was not done again."
- The attempt keeps `failure.code: "executor.required_outcome_unknown"` and
  `effectCheck: { result }`.
- No retry, handler, failed route, continuation or repair runs.
- The session is written with this trace. It no longer ends with a thrown
  `command_execution.consume_failed` or an "unhandled fault" trace with no attempts.

### Changes (Core, `packages/fluxiq/src/programs/automation-studio/runtime/`)

**The latch query and the stop itself:**

- `service/command-run/controller.ts`: added `receipted(context)`, which is true only once the
  effect has a committed receipt (its ticket).
- `service/command-execution/controller.ts`: the executor port exposes `receipted`, limited to its
  own contexts.
- `executor/command-scope/contracts.ts`: `receipted(context): boolean` added to
  `AutomationStudioExecutorCommandRun`.
- `executor/command-scope/outcome-unknown.ts` (new), exported from the barrel: the record
  `AUTOMATION_STUDIO_REQUIRED_OUTCOME_UNKNOWN` (`executor.required_outcome_unknown`, ambiguous).
- `executor/node-execution/attempt.ts`: when a required dispatch answers without a receipt, the
  attempt fails with that record and keeps the dispatcher's message, outputs and target
  resolution. Nothing is consumed and the seam does not throw. Before, `consume` threw and the
  run's signal was aborted.
- `executor/step-loop/uncertain-stop.ts`: new `automationStudioStepRequiredOutcomeStop`. It runs
  the page effect check, stamps `effectCheck`, the uncertain failure class and the ledger fault,
  and returns `automationStudioOutcomeUncertainTrace`.
  - It sits beside the other two uncertain stops. A separate file would have pushed `step-loop/`
    to 26 files, past the 25-file limit.
  - It is exported from `step-loop/index.ts`.

**Keeping the trace when the run ends:**

- `executor/graph-run.ts`, after a node runs:
  - an `executor.required_outcome_unknown` attempt skips the checkpoint;
  - the attempt is pushed with its stamps;
  - the step stops through the new function.
- `executor/graph-run.ts`, the end checkpoint: skipped when the trace ended
  `run.outcome_uncertain`, so the trace is kept instead of being replaced by "unhandled fault".
- `service/command-execution/lifecycle.ts`: `checkpoint(ended?)` makes the same exception.
- `service.ts`: its two `await commands.checkpoint()` calls now pass the trace.

### Changes (downstream)

- `domain/src/io/gateway-output-dispatcher.ts`: a durable `outcome_unknown` still stops the
  required context. It now returns `unansweredResult` instead of throwing:
  - status `unknown`, `web.action.unknown`, effect `ambiguous`, plus a plain message;
  - `result_unavailable` still throws.
- `domain/src/client/interrupted-action/unanswered-outcome.ts` (new),
  `webAutomationUnansweredOutcome`, exported from the barrel.

### Tests (follow-up)

- Core `executor/tests/effect-check/tests/required-outcome.test.ts` (new, 4). It uses a fake
  required command-run port that latches like the real one: checkpoints and `consume` throw after
  the latch.
  - Page check `landed`, `not_landed` and `unknown`, each:
    - status `failed`, `run.outcome_uncertain`, and the matching sentence;
    - presses exactly `["add"]`, and 0 checkpoints after the latch;
    - the `add` attempt carries `executor.required_outcome_unknown` and `effectCheck.result`;
    - no `stateHeld` and no `recoveryDecision`;
    - the authored failed route to `fallback` is not taken.
  - A receipted earlier step is consumed once, and the run still stops uncertain.
- Downstream e2e test 3 (`gateway-output-dispatcher-durable-reconcile.test.ts`) uses the real
  service, SQL and gateway on the runtime path. It now asserts:
  - session `failed` and `run.outcome_uncertain`;
  - the message starts "Outcome uncertain:" and says nothing on the page showed it;
  - pressed `["first"]`;
  - the `first` attempt shows `executor.required_outcome_unknown` with page check `unknown`.

### Open question 3: `command_execution.consume_failed` on Core's own runtime transport

Reproduced with a temporary domain probe. Setup:

- a required run;
- no domain runtime adapter;
- a client that declares `actionTypes`, so Core's `ClientGatewayRuntimeTransport` path is used;
- once with every answer sent, once with the first answer lost.

- **Base (my changes reverted with `git apply -R` in both trees, Core rebuilt):** both cases threw
  `command_execution.consume_failed`, raised at `AutomationStudioRequiredCommandRun.checkpoint`.
  **No `server.execute_action` was ever sent** (pressed `[]`), even when the client answers
  everything.
- **With my change:** the probe still sends nothing (pressed `[]`). The run now ends `failed` /
  `run.outcome_uncertain`, with the attempt `executor.required_outcome_unknown` and page check
  `unknown`.

**My change does not cause it.** On that path the durable command's outcome is unknown before
anything is sent, so the fault was already there. I did not fix it; it is noted for a follow-up.

- Likely place to start: whether that transport's durable dispatch resolves a command ledger.
- My stop wording ("answer never came back") does not fit a command that was never sent.

I then put my changes back with `git apply` and compared every modified file against a tar
backup: all identical. The probe file was deleted.

### Commands run (follow-up) and observed results

- Core `cd packages/fluxiq && pnpm run check`: build-cache `fluxiq:check` line, exit 0.
- Core `npx vitest run src/client-gateway src/runtime/tests <AS>/executor <AS>/service/command-execution <AS>/service/command-run <AS>/service/runtime-session <AS>/composite-execution src/programs/automation-studio/client-gateway/tests`
  printed `Test Files 127 passed (127)  Tests 1090 passed (1090)`. That was the final run.
- Core `node scripts/structure-audit.mjs` printed `structure-audit: passed (323 warning(s), 1160 baselined).`
  - The earlier `directory-files` failure (26 files in `step-loop/`) was fixed by merging the stop
    into `uncertain-stop.ts`.
  - Advisory warnings: `AutomationStudioCommandRunController` has 26 methods; `graph-run.ts` is
    514 lines; `attempt.ts` is 432 lines.
- `pnpm --filter fluxiq build` exited 0. The final build is of my tree.
- Domain `npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json --noEmit`: exit 0 and 0.
- `DOMAIN_TEST_BUILD_LABEL=t427 node scripts/test-domain.mjs src/io/tests src/runtime/tests/adapter src/client/ src/output-nodes/extract-list/tests/dispatch-timeout`
  printed `# tests 143 # pass 143 # fail 0`.
- Downstream `node scripts/structure-audit.mjs` printed `passed (184 warning(s), 651 baselined)`,
  plus "1 baseline entries can be lowered" (the dispatcher lost a packed line). I did not run
  `pnpm structure:baseline`; that writes a shared file.

### Not verified (follow-up)

- **A required stop inside a Call Subflow or Call Flow child frame.** The parent's later
  checkpoints would still meet the latch.
- **A required-unknown attempt made inside the ladder's interference re-execution.** That path
  checkpoints straight after.
- **A unit test for the domain dispatcher's new return.** `ClientGatewayCommandOutcome.require`
  is not exported from `fluxiq/client-gateway`, so the e2e test is the test beside it.
- **Line endings in `packages/fluxiq/src/client-gateway/service/index.ts`.** Git lists it as
  modified with no content change: an export was added, then removed. Only the line endings
  differ.

**Done:**

- **Reconcile by command id for durable commands.** A durable command whose answer never came is
  now asked about by command id before its ledger entry is called unknown. This is the same t409
  question that ordinary commands already get. The answer is handled like this:
  - Kept result: committed as the command's answer. The run carries on and the act is not pressed
    again.
  - `not_seen`: committed as a failure that did nothing. A new attempt presses it again.
  - Anything else: stays `outcome_unknown`. The ledger is `unknown` and the required context is
    stopped, exactly as before.
- **Dropped session.** When the session drops and the client is one that answers reconcile
  questions, the command now waits out its answer window and asks the reconnected session.
  Before, it was called unknown immediately. This is the service-worker-restart case.
- **Runtime-path race, which blocked all of the above.** `RuntimeService` gave up on a command at
  exactly the moment the gateway started asking. So the reconcile never reached the run on the
  runtime path that web Flows take. This affected ordinary (t409) commands too, whenever the node
  sent a `timeoutMs`. Fixed with a reconcile allowance.
- **Route guard (open question 2).** The fix was already in `lifecycle-route-guard.ts` from t411:
  it reads `effectCheck?.result === "unknown"`. It had no test for an attempt that has an
  `effectCheck` but no `fault`, or for the calling-frame case. I added one.

**Not done:** an interrupted lasting act whose outcome stays truly unknown in a *required* run
still never reaches the executor's effect check. Required mode's command-run latch makes every
continuation impossible, so that run still stops as before. See "Open questions" 1.

## What changed and why

### Core: durable reconcile (`packages/fluxiq/src/client-gateway/service/`)

**`command-ledger/dispatch.ts`**

- Both answer timers now call `answerNeverCame` instead of `uncertain`:
  - the observer-mode timer set in `execute`;
  - the non-observer timer set at send.
- `answerNeverCame` works like this:
  - If the command is not in the `waiting` phase, or there is no reconcile port, it is uncertain,
    as before.
  - Otherwise it asks `ports.reconcile(commandId)`. It does nothing if the command's own answer
    arrived in the meantime.
  - It settles through the same acceptance path a live answer takes. The new `accept` was split
    out of `settle`, which still checks the sender's session first.
  - It uses the t409 mapping `clientGatewayReconciledResult`. Its `timed_out` goes to
    `uncertain`, as `unknown`, `timed_out` and `cancelled` results always have.
  - A kept result that is itself an interrupted lasting act reads as `unknown` through
    `readClientGatewayActionResult`, so it stays `outcome_unknown`.
- `disconnected(entry, answersReconcile)`: a dropped session defers to the timer only when all of
  these hold:
  - the command was sent (`waiting`);
  - the client declared `answersReconcile`;
  - a reconcile port exists.

  Otherwise the command is unknown at once, as before.
- `answerWaitMs` replaces the two copies of the wait formula.
- The receipt carries the claim's own `sessionId`, even when the answer came from the reconnected
  session.
- A result that arrives after the command closed is still late and is never committed.

**`commands.ts`**

- Passes `reconcile` to the durable dispatch, as a new private method `reconcileDurable`. It reuses
  `reconcileAction`, because command history already records durable commands.
- Records `command.reconciled` in the audit log, with `durable: true`.

**`command-reconcile/allowance.ts`** (new), exported from the `command-reconcile` barrel

- `COMMAND_RECONCILE_ALLOWANCE_MS = 15_000`. That is three reconcile answer windows: one ask, the
  `running` pause, and a second ask.

### Core: runtime bound (`packages/fluxiq/src/runtime/service.ts`)

- `withRuntimeBounds` now waits `timeoutMs + COMMAND_ANSWER_MARGIN_MS + COMMAND_RECONCILE_ALLOWANCE_MS`,
  and its message names all three parts.
- Before, the bound was `timeoutMs + margin`, the same as the gateway's wait. The runtime's timer
  was armed first, so it fired first. In a required run it called `stop("runtime.timeout")`, which
  latched the run before the client could answer. Observed: domain tests 1 and 2 below came back
  `status: "stopped"` before this change, and `succeeded` after it.
- A target that answers on time, or a gateway with nobody to ask, settles before the bound. So the
  allowance only delays a target that hangs outright.
- `runtime/tests/service.test.ts`: the silent-target test now expects the new deadline.

### Core: route guard test (`.../executor/step-loop/tests/already-done.test.ts`)

One new case covering an attempt with `effectCheck: { result: "unknown" }` and no `fault`:

- In the node's own frame it refuses the route. `not_landed` does not refuse.
- In a child frame whose checkpoint is in the calling frame, past that node, it also refuses.
  `not_landed` does not refuse.

The guard source is unchanged; t411 had already added the read.

### Tests (new)

- Core `client-gateway/tests/durable-reconcile.test.ts`, 7 tests, all with a required observer and
  an in-memory ledger:
  - landed: completed, receipt committed, `completed` observed, never `uncertain`, one send, audit
    `durable: true`;
  - `not_seen`: completed as failed with `client_gateway.command_not_seen`, effect `unacted`,
    committed;
  - `unknown`: `outcome_unknown`, ledger `unknown`, `uncertain` called once;
  - a kept result that is an interrupted lasting act (`ambiguous`): `outcome_unknown`;
  - the command's own answer during the question wins;
  - a dropped session of an answering client is asked again on reconnect, and its kept
    interrupted, `unacted` result is committed as failed;
  - a dropped session of a client that does not answer is unknown at once.
- Downstream `domain/src/io/tests/gateway-output-dispatcher-durable-reconcile.test.ts`, 4 tests.
  - Setup: the real FluxIQ service, SQL and gateway, on the runtime adapter path. The Flow is
    `first -> second`; the browser loses its first answer.
  - Required run, kept result: succeeded, pressed `[first, second]`, asked once. There is no
    second press.
  - Required run, `not_seen`: succeeded, pressed `[first, first, second]`, so the retry ran under a
    new attempt.
  - Required run, `unknown`: stopped (the run throws), pressed `[first]`.
  - Ordinary run, kept result, same runtime path: succeeded, pressed `[first, second]`.
- No domain source changed. `io/gateway-output-dispatcher.ts` keeps its `web.required_<status>`
  throw for a non-completed durable outcome. That throw is the required stop. See "Open
  questions" 1.

## Commands run and observed results

Core (`fxwork/t427/!FluxIQ`):

- `cd packages/fluxiq && pnpm run check`: build-cache `fluxiq:check` line, exit 0. `npx tsc --noEmit …`
  also gave no output.
- `npx vitest run src/client-gateway src/runtime/tests <AS>/executor <AS>/service/command-execution <AS>/service/command-run <AS>/service/runtime-session src/programs/automation-studio/client-gateway/tests`
  printed `Test Files 126 passed (126)  Tests 1086 passed (1086)`. That was the final run, after
  every edit.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (322 warning(s), 1160 baselined).`
  Earlier runs failed three times, each fixed:
  - `naming`: three `command-` files in `service/`. I moved the constant to
    `command-reconcile/allowance.ts`.
  - `failure-as-empty`: a `.catch(() => undefined)` on the question. I removed it.
  - `swallowed-failure`: fixed with a `best-effort` comment. The catch still makes the command
    `uncertain`.
- `pnpm --filter fluxiq build` exited 0 (build-cache `build` line). I ran it three times so the
  domain saw the new dist.

Downstream (`fxwork/t427/!FluxIQWebExtension`):

- `cd domain && npx tsc -p tsconfig.json --noEmit` and `-p tsconfig.test.json --noEmit`: both exit 0.
- `DOMAIN_TEST_BUILD_LABEL=t427 node scripts/test-domain.mjs src/io/tests src/runtime/tests/adapter src/client/ src/output-nodes/extract-list/tests/dispatch-timeout`
  printed `# tests 143  # pass 143  # fail 0`.
- A final `src/io/tests` run after the last edit printed `# tests 33 # pass 33`.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (184 warning(s), 651 baselined).`
  The first run flagged an `as never` in my test, which I replaced with a typed message.

## Not verified

- **Live browser behaviour.** No Lab run, and no real service-worker restart against a durable
  command. No web Flow uses required mode today; only `commandOutcomeMode: "required"` callers do.
- **The ordinary-path domain test before the runtime fix.** I showed the race on the required
  path only, where the tests came back `stopped` before the fix. I infer, but did not observe,
  that live ordinary runs with a node timeout lost t409's reconcile the same way. t409's row 9
  reported "Client action timed out after 30000ms", so that run sent no `timeoutMs` and did not
  race.
- **Observer completion is no longer time-bounded after a reconciled `landed` result.** The
  observer-mode timer, which used to bound both the answer and the observer, has already fired by
  then.
- **Architecture docs** were not updated (not named in the brief):
  - Core `docs/architecture/automation-studio/client-gateway.md`, the durable commands and the
    runtime deadline;
  - downstream `web-capabilities.md`, "Commands In Flight".
- **No full suites**, per the brief.

## Open questions or contradictions found

1. **Required mode cannot do "landed → continue" or "not_landed → retry" after a truly unknown
   outcome without lifting a latch that is there on purpose.** In
   `runtime/service/command-run/controller.ts`, every unknown outcome sets
   `state.blocked = "command_run.outcome_unknown"`. That happens through both `markUnknown` and
   the observer's `uncertain`. The comment there says: "a new scope cannot clear private
   uncertainty". After that:
   - every `commandRun.checkpoint()` throws (`available`);
   - so does every new claim;
   - so does `consume`.

   As a result:
   - If the domain returned the record instead of throwing, the seam's `consume` would throw
     anyway.
   - If the seam skipped `consume`, the effect check would run, but the next checkpoint would
     throw. `graph-run.ts`'s catch then replaces the trace with
     `The run stopped on an unhandled fault (…)` and `attempts: []`. Today's ending has the same
     shape.

   So in a required run, an effect check can only explain why the run stops, never let it go on.
   The reconcile I added settles the reconcilable cases *before* the latch. That is the part of
   "handled exactly like an ordinary one" that the latch allows. The supervisor must choose one of
   these:
   - **(a)** Keep the latch, and in required mode run the effect check only to word the stop. This
     needs `graph-run.ts`'s end checkpoint to keep the trace, plus `run.outcome_uncertain`.
   - **(b)** Let a page effect check clear the latch for that one effect. This changes the
     exactly-once invariant of `command-run/controller.ts`.

   I recommend (a): required mode exists to prove outcomes, and a page check is evidence, not a
   receipt.
2. **An idle wait does not keep the process alive.** A run waiting in the executor's retry pause
   keeps no ref'd timer. The domain test needed a `setInterval` keep-alive, or `node:test`
   cancelled with "Promise resolution is still pending but the event loop has already resolved".
   This is harmless in a server and only matters for scripts and tests.
3. **One run I did not investigate.** In one ad-hoc run I registered no domain adapter, but the
   client declared `actionTypes`, so Core's own `ClientGatewayRuntimeTransport` path was used. The
   required run failed in about 0.9 s with `command_execution.consume_failed`, before any command
   was sent. I did not investigate it or compare it against the code without my change. My change
   only alters timer callbacks and the disconnect handling, and nothing fired that early.
