# t392 F2 effect check: worker report

Brief: task t392, unit F2. A lasting act whose outcome is uncertain goes through an effect check
before any retry, route or alternative (Core plan C6 step 4, C8). Trees `fxwork/t392/!FluxIQ` and
`fxwork/t392/!FluxIQWebExtension`, branch `task/t392-executor-integration`. Nothing committed.
AS = Core `packages/fluxiq/src/programs/automation-studio/`.

## Outcome

Done. One effect-check hook now serves graph runs and the outside-graph retries. In a graph run, the check runs
before the ladder, any retry, On Retry, On Fail, failed route, continuation or repair. A lost
`interrupted` command on a committing act now reaches the check; before this change it did not
(see "Item 3"). No new host API was added. Nothing outside my owned paths was edited.

## What changed and why

### 1. One hook: `AS/runtime/executor/defensive/effect-check.ts` (new)

- `AutomationStudioEffectCheckResult = "landed" | "not_landed" | "unknown"`.
- `AutomationStudioLastingActCheck<T>` moved here from `outside-graph/retries.ts` and kept the same shape
  (`(result: T, attempt: number) => Promise<result>`).
  - `retries.ts` re-exports it, so the explicit export in `executor/index.ts` and the domain's import from
    `fluxiq/automation-studio` are unchanged.
- `automationStudioRunEffectCheck(check, result, attempt)` is the one caller.
  - No check, a check that threw, or an answer outside the three words all give `unknown`.
  - A broken check therefore never reads as `not_landed`.
  - Outside-graph change: a throwing `checkEffect` used to reject the whole call. It now settles the act
    as `uncertain`.
- `defensive/not-landed.ts` (new), `automationStudioFaultNotLanded`: the outside-graph `notLanded`, moved so
  both paths use it. It drops `actUncertain` and sets `disposition: "retry"` and `effect: "unacted"`. The
  category and code are kept for the ledger.
- `defensive/index.ts`: both are added to the barrel.

### Graph-run check: `AS/runtime/executor/transition-comparison.ts`

`automationStudioHostEffectCheck(node, options): AutomationStudioLastingActCheck<AutomationStudioNodeAttemptTrace>`.

- **What it asks.** It uses the host's existing `expectationEvaluator` (`hostExpectationEvaluator`) and the
  existing `automationStudioExpectationRequest`.
  - The expected state is the attempt comparison's `expected.expectedState`, falling back to
    `expectedTransitionForNode`.
  - The evaluator is called with source `transition_comparison`, the attempt's state ref and the run signal,
    exactly as the success re-check above it is.
- **It waits.** The window is the longer of the node's readiness ceiling
  (`automationStudioReadinessCeilingMs`, at least the floor) and the expected state's own `timeoutMs`.
  - So a zero-wait `false` on a slow page cannot cause a second press. This follows the domain's choice in
    t393.
- **`landed` without asking again** when the attempt's own evaluation already saw the state hold
  (`expectationSatisfiedAfterFailure`). That is positive evidence. Only a zero-wait `false` is untrustworthy.
- **The verdict follows the count contract, as the domain's `webNodeEffectCheck` does.**
  - `landed`: every condition was judged and held (mode `any`: one held).
  - `not_landed`: a judged condition failed (`any`: every condition was judged and none held).
  - `unknown` in every other case:
    - no expected state, or one with no keys;
    - no evaluator;
    - `checkedConditionCount` of `0` or absent;
    - fewer conditions judged than declared, alongside held ones.
  - A missing acknowledgement is never `not_landed`.

### 2. The step: `AS/runtime/executor/step-loop/failed-attempt.ts`

- The check runs right after the fault is assessed and the step settles as recovering, and before
  `runAutomationStudioRecoveryLadder`. So it comes before:
  - the ladder (satisfied, await, clear, retry);
  - On Retry and On Fail dispatch;
  - the authored failed route and the continuation.

  State routing is not an issue here: it runs earlier in `graph-run.ts`, but only for an attempt that
  could not run (`automationStudioCouldNotRun`), and such an attempt is unacted, never `actUncertain`.
- `effectCheck: { result, checkedAt }` is stamped on the attempt. A cancel during the check ends the run
  `cancelled`.
- **`landed`** (`settledUncertainAct`):
  - `stateHeld: { rung: "skip_satisfied_node", route: "success" }`, as the ladder's satisfied rung sets it.
    The attempt keeps `status: "failed"`, and every reader of `stateHeld` reads the node as done.
  - Failure class `movedBy: "effect_landed"`, which is a `skip`.
  - Ledger: `continued`, with the reason extended.
  - A "The step had taken effect" thought.
  - Returns `proceed` on `success`.
- **`unknown`**:
  - Failure class `uncertainAct: true` (`outcome_uncertain`, never a true failure, so it never triggers
    in-run repair).
  - Ledger: `stopped`.
  - An "Outcome uncertain" thought.
  - Returns a failed trace whose message is `automationStudioStopMessage`, which starts `Outcome uncertain:`.
  - No ladder, no handler, no failed edge, no continuation. The attempt carries no `recoveryDecision`,
    because the ladder was never consulted.
- **`not_landed`**: the fault is re-assessed from the stamped attempt (below), so it is now an unacted
  retry. The ladder, the retry floor, On Retry and every later rung then apply exactly as for any unacted
  fault.

### Assessment: `AS/runtime/executor/defensive/assess.ts`

Two additions, both before the existing early return for refusals.

- **An attempt stamped `effectCheck.result === "not_landed"`** is assessed with
  `automationStudioFaultNotLanded`.
  - So the ladder (`automationStudioAttemptIsRetryable` and `mayRepeat`), the recovery-choice wording and the
    ledger all read it as unacted.
  - Without this, the stage gate (it falls back to `attempt.failure.stage`) or the record's
    `retryable: false` would refuse it again.
  - Only the new step stamps `effectCheck`.
- **`refusalWithUnknownOutcome`**: a refused fault becomes `actUncertain` (still a refusal) only when all of
  these hold:
  - the producer's record itself states `effect: "ambiguous"`;
  - the category is `ambiguous_or_unknown`;
  - the node is not repeat-safe.

  Every other refusal keeps the handling it had. That includes a page rejection, a dialog in the way and a
  sign-in wall, which the domain also marks ambiguous on a committing act, and a classified throw, which
  carries no record `effect`.

`defensive/lasting-act.ts`: only its header comment changed, to describe the check.

### 3. A lost command reaches the check

- For a committing act, the domain reports `interrupted` as `web.action.unknown`, which is
  `{ category: "ambiguous_or_unknown", retryable: false, stage: "execution", effect: "ambiguous" }`
  (downstream `client/interrupted-action/outcome.ts` and `failure/codes.ts:297`).
- **Before this unit, that record never reached any check.** `faultFromRecord` made it `refuse`, and
  `automationStudioAssessAttemptFault` returned at `if (fault.disposition === "refuse") return fault;`
  before gate 3. So it was a plain refusal with no `actUncertain`.
  - A Flow's web node is not marked `mutate`, so in a graph run `mayRepeat` stayed true. The ladder's
    await-recorded-state and clear-interference rungs could therefore make the press again.
  - On Fail handlers and failed routes also ran.
  - Outside a graph, `checkEffect` was never asked (the domain's t393 check was dead for this record).
- Now `refusalWithUnknownOutcome` marks it `actUncertain`, so the check runs on both paths.
- The new tests drive the exact record through a graph run with a fake host, and through the outside-graph
  retries.
- The non-committing form (`web.transport.transient`, `effect: "unacted"`, retryable) is still simply
  retried, with no check.

### 4. How graph-run's handling of `actUncertain` changed

**Before.** An `actUncertain` fault went through these steps in order:

1. The ladder. Retry, await and clear were refused (`retryable` and `mayRepeat` false).
   `skip_satisfied_node` carried the run on only if the attempt's single zero-wait evaluation had passed.
2. On Retry was never reached.
3. On Fail passed over its handlers (`on-fail.ts:33`).
4. An authored `failed` edge (or `error.<id>` port) was **followed**, through `deterministic_path`.
5. Otherwise the continuation refused, and the run stopped with `Outcome uncertain: …`.

**After.** The effect check comes first:

- **`landed` now continues on a waiting check**, where before only a zero-wait pass did. A slow page that
  used to stop the run "Outcome uncertain" now carries on, without a second press.
- **`not_landed` is new:** the act is retried under the floor.
- **`unknown` no longer follows an authored failed edge:** the run stops. This is the plan's "no rung below
  runs".

**A Flow whose acts never end uncertain behaves exactly as before.** The check runs only when
`fault.actUncertain`. The assessment changes only for two inputs:

- the refused `ambiguous_or_unknown` record with a stated `effect: "ambiguous"`, which today is the
  interrupted committing act;
- an attempt carrying `effectCheck`, which only the new step writes.

The existing `executor/tests`, `defensive`, `outside-graph` and `state-routing` suites pass unchanged
(numbers below).

### 5. One statement per line

New code keeps one statement per line. The audit reports no violation in my files.

### Tests (new)

- `AS/runtime/executor/tests/effect-check/tests/uncertain-act.test.ts` (8): graph runs with a fake host and a
  counting dispatcher.
  - **landed:** the press lands but its answer is lost, and the page is slow. The zero-wait look is asked
    with `0` and says no; the check waits (`> 0`) and sees the cart. `add` is dispatched **once**, `next`
    runs, the attempt has `effectCheck.landed` and `stateHeld`, and the run succeeds.
  - **not_landed:** `add` is dispatched twice. The first attempt is `not_landed` with `retry_node`, the
    second succeeds.
  - **not_landed every time:** exactly 4 dispatches. The run fails without the "Outcome uncertain" message.
  - **unknown** (the host judges nothing), with both an On Fail handler and a `failed` edge to `fallback`:
    the presses are exactly `["add"]`, `handlerExecutions` is undefined, and the message starts
    `Outcome uncertain:`.
  - **No expected state:** `unknown`, the evaluator is never asked, and the run stops.
  - **Lost commands:**
    - the interrupted committing record reaches the check;
    - the non-committing form is retried with no check;
    - a page refusal (`web.action.rejected`, ambiguous) still runs its On Fail handler.
- `AS/runtime/executor/defensive/tests/effect-check.test.ts` (11):
  - Assessment rules:
    - the uncertain refusal;
    - unchanged refusals, unchanged records with no stated effect, and unchanged throws;
    - the repeat-safe exemption;
    - `not_landed` read as unacted.
  - The hook's `unknown` defaults.
  - The host check's count contract in `all` and `any` modes, and its non-zero waiting window.
- `AS/runtime/executor/outside-graph/tests/interrupted-act.test.ts` (3): the interrupted committing record
  outside a graph.
  - `landed` is settled after 1 dispatch.
  - `not_landed` is made again.
  - With no check it ends `uncertain` with no second dispatch.

## Commands run and observed results

All commands were run from `fxwork/t392/!FluxIQ`.

- `cd packages/fluxiq && npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`
  -> no output (exit 0) on the final run.
  - One intermediate run printed
    `src/programs/automation-studio/runtime/executor/graph-run.ts(177,60): error TS2345 …`. That is D2's
    file, mid-edit, and it was gone on the next run.
- `npx vitest run <AS>/runtime/executor/outside-graph <AS>/runtime/executor/defensive <AS>/runtime/executor/tests/effect-check <AS>/runtime/executor/tests <AS>/runtime/executor/state-routing`
  -> `Test Files 48 passed (48)  Tests 499 passed (499)`.
- The wider run, adding `lifecycle-run`, `lifecycle`, `step-loop` and `frames`, gave
  `Test Files 2 failed | 63 passed (65)  Tests 2 failed | 598 passed (600)`. Both failures are in
  D2's `lifecycle-run/tests`, which D2 was editing during my run (step-loop files were modified at the minute
  of my run):
  - `incident.test.ts` "opens one incident per node arrival…": the incident now carries a `retries: 0` field
    the test does not expect. This is a pure ledger unit test, and none of my code is on its path.
  - `wiring-boundaries.test.ts` "routes to a checkpoint in the same frame…": `lifecycleNotes` is missing a
    note. The fixtures' failures are `unexpected_state` / `target_not_found` with `effect: "unacted"`, and
    Call Subflow failure records carry no `effect`. So neither the new assessment rule nor the check can
    fire there.
  - An earlier run also failed a third D2 test, "carries a child's unresolved failure…", which then passed
    with my code unchanged.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` -> `structure-audit: 1 violation(s) across 1 rule(s).`
  - The one violation is `statement-packing` in
    `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-adaptation/tests/interrupted-run.test.ts:24`.
    That file is not mine; it belongs to another worker.
  - My own earlier violations (`as never` and one packed line in `defensive/tests/effect-check.test.ts`) are
    fixed.
  - A baseline run before my edits printed `passed (309 warning(s), 1160 baselined)`.

## Not verified

- **End to end through the domain.** I did not run the downstream adapter turning a gateway `unknown` +
  `web.action.unknown` result into the Core node failure. The Core tests use the domain's exact record on the
  dispatcher's answer.
- **The durable (required-mode) path.** `node-execution/attempt.ts:263` throws
  `executor.required_result_unhandled` for a dispatched status other than success or failed. The domain's
  `gateway-output-dispatcher.ts:30` throws `web.required_<status>` for a non-completed durable outcome.
  Either way the attempt becomes a classified throw, which carries no record `effect`, so an interrupted
  command on a durable command does not reach the check. This is unchanged by this unit.
- **Domain and extension typechecks and tests.** The exported hook's shape is unchanged, so this should be
  compatible, but I did not run them.
- **Live browser behaviour**, and the chat wording of the two new thoughts in a real run.
- **No full suites**, per the brief.

## Open questions or contradictions found

1. **`stateHeld.rung`.** In `contracts.ts` (D2) it allows only `"skip_satisfied_node"`, so a `landed` check
   reuses it. The trace's `effectCheck.result: "landed"` and `failureClass` (`skip` via `effect_landed`)
   distinguish the two. If the two should be told apart in summaries, widen the type in `contracts.ts` and
   `model/flow-adaptation.ts:364` to include `"effect_landed"`, then set it in `settledUncertainAct`.
2. **`step-loop/lifecycle-route-guard.ts` (D2), `lastEndedUncertain`** reads `attempt.fault?.actUncertain`.
   `attempt.fault` is stamped only at the dispatch seam for throws, so it misses an uncertainty that the
   assessment derives from a record.
   - This is moot for the failing node now: an uncertain act never reaches a handler, because `unknown`
     stops the run first.
   - It matters for an earlier node on a route's path that stopped uncertain in a child frame. Reading
     `attempt.effectCheck?.result === "unknown"` as well would cover it.
3. **The durable path** (see "Not verified") loses the domain's committing statement before Core sees it.
   If interrupted durable commands should reach the check, the domain dispatcher must return the
   interrupted outcome rather than throw. Alternatively, Core's attempt seam must accept an `unknown` status
   and carry its failure record.
