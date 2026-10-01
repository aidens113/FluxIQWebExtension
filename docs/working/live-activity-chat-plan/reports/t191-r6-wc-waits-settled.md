# t191-r6-wc: Core settles a check that cleared by itself and a parked run that is cancelled

Tree: `C:/Users/osrs_/FluxStuff/fxwork/t191/!FluxIQ`, branch `task/t191-extension-chat-ui`.
- Nothing was staged, committed, aborted or reset; the staged dev merge is untouched.
- R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. Both gaps are closed, and their tests pass.
- `fluxiq check`, the dist rebuild, `docs:check` and the structure audit pass.
- The brief's wide vitest run, with `runtime/tests/service-flows` and `runtime/executor` added, had 11 failures. Every one is a `Test timed out in 15000ms` in service-flows tests that do not reach the changed code; see Commands, item 2.

## What changed and why

### Gap 1, waited_out (robot check cleared by itself)

- **New `R/activity/ask/waited-out.ts`: `emitAutomationStudioActivityWaitedOut(callId, result, phase)`.**
  - It reads `clearedWait.waitedMs` defensively from an unknown result. Core's `AutomationStudioLlmEvidenceToolExecutionResult` type in `runtime/llm/**` is not touched.
  - The field is accepted only when all of these hold:
    - the result is a non-array object with `kind: "llm_evidence_tool_execution"`;
    - `clearedWait` is a non-array object;
    - `waitedMs` is a safe integer from 0 to 86 400 000 (one day).
  - Anything else emits nothing.
  - When the field is accepted, it emits two rows with the same `ref`, `waited-out.<callId>`, and the same title, "Waited for a check to clear":
    1. Phase `waiting_permission`, label "Waiting for a check on the page to clear", `kind: ask`, `status: started`.
    2. Phase `phase` (the tool call's own phase), `kind: ask`, `status: succeeded`, `resolution: "waited_out"`. The label and text are "The check cleared on its own after N s.", where N is `max(1, round(ms/1000))`.
- **New `R/activity/ask/cleared-text.ts`** (internal, not in the barrel). It holds that one sentence. With no ms, it gives the old "The check cleared by itself."
- **`R/activity/ask/resolved.ts`.** `emitAutomationStudioActivityAskResolved` takes an optional 4th argument, `waitedMs`. The `waited_out` sentence now comes from `cleared-text.ts`, so it says N s whenever the ms are known. Existing callers are unchanged.
- **`R/activity/observer.ts`.** One emission call at tool end, after `executeTool` returns and before the tool's own `succeeded` row. Its phase comes from `automationStudioActivityToolCall(call).phase`. The doc comment says so.
- **Barrels.** `ask/index.ts` and `activity/index.ts` export `emitAutomationStudioActivityWaitedOut`.
- **The title is classified as a check.** `activityActionOf` gives `person_check` for it (PERSON_TITLE `/\bcheck\b/`):
  - outcome `waiting` on the first row;
  - outcome `done`, why null, on the resolved row.

  `activityActionKey` gives one key for both rows. The tests assert all of this.
- **Flow runs:** I did not emit anywhere else. A Flow run's web node result travels as `AutomationNodeExecutionResult` (`programs/automation-studio/nodes/contracts.ts:154`), turned into an attempt in `R/executor/node-execution.ts` (`nodeAttemptFromResult`).
  - That type is closed: outputs, route, status, effects, message, failure and targetResolution. It has no place for `clearedWait`, and nothing in it is read for one.
  - To report the same thing for runs, the downstream would have to carry the field there, for example as a new optional field on that type. Core would then emit from `R/executor/graph-run.ts` after the node executes. That file is 772 lines, against an 800-line limit.

### Gap 2, cancelled parked runs

- **New `R/service/runtime-session/parked-wait.ts`: `settleAutomationStudioParkedRunWait(projectId, session, resolution: "cancelled" | "timed_out")`.**
  - When `session.status === "waiting"` and `session.trace.parked` is present, it calls `runWithAutomationStudioActivity({kind:"run", id: runId, projectId, flowId})`.
  - Inside that scope it emits `emitAutomationStudioActivityAskResolved(parked.ask, resolution, "failed")`. The `ref` is the parked ask id, the title comes from `automationStudioActivityAskTitle`, and the status is `failed`.
  - No `conversationId` is passed: the run session has none, and `emit.ts` already falls back to the project's current conversation.
  - Phase `failed` matches what `activity/run.ts` says for a cancelled run.
  - Exported from the `runtime-session` barrel.
- **`R/service.ts`.**
  - `cancelRuntimeSession` calls it with the session read before the cancel, right after `writeRuntimeSession` (one line, plus the import).
  - A run that is running, including one waiting in place inside `awaitAnswer`, has status `running`, so this says nothing. `graph-run.ts` already emits `cancelled` for that case, so there is no double row.
  - An already-terminal run returns early, before the call.
- **Other functions that end a parked run without an answer.** None needs this:
  - **Expiry past `expiresAtMs`.** No service code sweeps or times out a parked run. `resumeAutomationStudioGraph` with `{kind:"timeout"}` is the only expiry path, it is called by nothing in the service, and it already emits `timed_out` itself (`R/executor/resume.ts`). The `timed_out` member of the helper's parameter is there for a future sweep, and nothing calls it today.
  - **`endAutomationStudioRuntimeSessionAfterThrow`** (`service/runtime-session/ending.ts`). It ends only `queued` or `running` sessions and leaves `waiting` alone.
  - **`service/runtime-adaptation/repair-rerun.ts`.** It replaces failed runs only.
  - **`deleteProject`.** It deletes the whole project directory, parked runs included, without settling them. I left it alone: the activity subject's project no longer exists. The supervisor may want to decide on this.
  - **`deleteFlow`.** It goes through `flowWriter.deleteFlowArtifact` and does not touch run sessions.

### Tests

- **`R/activity/ask/tests/waited-out.test.ts` (new):**
  - The pair: phases, refs, resolution and the same title, with text "after 4 s". `activityActionOf` gives person_check waiting, then person_check done, and both rows have the same `activityActionKey`.
  - Rounding: 0 and 499 ms give 1 s, 1500 ms gives 2 s, 61000 ms gives 61 s.
  - An absent field gives nothing.
  - Nine malformed shapes give nothing: a string, an array, `{}`, a string ms, a fraction, a negative, more than a day, NaN, Infinity.
  - A result that is not a tool execution, or null, or an array gives nothing.
  - Nothing outside a scope.
- **`R/activity/tests/observer.test.ts`:**
  - `clearedWait {waitedMs: 12300}` gives the rows tool started, ask waiting, ask waited_out ("after 12 s"), tool succeeded, and the result is returned unchanged.
  - A malformed `waitedMs` gives only the two tool rows.
- **`R/activity/ask/tests/resolved.test.ts`.** `waited_out` with 7600 ms says "after 8 s".
- **`R/service/runtime-session/tests/parked-wait.test.ts` (new):**
  - Exactly one row: scope `run:<runId>`, subject flowId, ref = parked ask id, `failed`/`cancelled`, and `activityActionOf` gives person_check failed, "the work stopped first".
  - Nothing for running or cancelled status.
  - Nothing for a waiting session with no `parked`, or with no trace.
- **`R/tests/service-flows/tests/cancel-parked-run.test.ts` (new, real `AutomationStudioService`, `mkdtemp` root):**
  - Setup: a queued run's session file is rewritten as parked (`waiting` + `trace.parked`) or `running`.
  - `cancelRuntimeSession` on a parked run emits exactly one resolution row, `cancelled`, with the parked ask's ref.
  - On a running, unparked run it emits no ask row.
  - A second cancel emits nothing.
  - Negative control: with the `service.ts` call commented out, the first case failed (1 failed, 2 passed). I restored the call afterwards and checked it at line 2849.

## Commands run and observed results

1. **Targeted vitest.** `cd packages/fluxiq && npx vitest run src/ui src/programs/automation-studio/runtime/activity src/programs/automation-studio/runtime/service/runtime-session src/programs/automation-studio/runtime/tests/service-flows/tests/cancel-parked-run.test.ts --minWorkers=1 --maxWorkers=2` gave `Test Files 28 passed (28)`, `Tests 266 passed (266)`. This is the final run, after the stage fix in item 4.
2. **The wider run.** The same command with `runtime/tests/service-flows` and `runtime/executor` instead gave `Test Files 6 failed | 56 passed (62)`, `Tests 11 failed | 624 passed (635)`, 562 s.
   - All 11 failures are `Test timed out in 15000ms`. They are in `execution-digest`, `instruction-readiness`, `representation`, `runs` (canonical subflow routing), `subflow-pagination` and `scale-pages`.
   - None of these calls `cancelRuntimeSession` or produces `clearedWait`.
   - Re-running `runs.test.ts` and `execution-digest.test.ts` alone with `--maxWorkers=1`: `runs.test.ts` passed. `execution-digest` failed 2 tests, again on the 15 s timeout, and a different pair from the first run.
   - At that moment the machine showed CPU LoadPercentage 100 and 18 node processes. I did not prove these failures pre-date my change, because I cannot stash in this tree. The executor tests all passed.
3. **First type check.** `bash .../heavy.sh "t191 r6 core check" pnpm --filter fluxiq check` failed first: TS2322 `"run"` is not assignable to `AutomationStudioAskStage`, in my two new tests. I fixed both to `"execution"`.
4. **Second type check.** The same command then gave `fluxiq:check` built in 20889 ms with no errors.
5. **Dist rebuild.** `bash .../heavy.sh "t191 r6 build" node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build`:
   - contracts reused;
   - fluxiq built (4657 files, 285909 ms);
   - websocket reused.

   `dist/.../activity/ask/waited-out.js`, `dist/.../service/runtime-session/parked-wait.js` and `dist/.../service.js` all contain the new names.
6. **`pnpm docs:reference`.** It wrote both copies (2850 public declarations). The diff is +1 row, `emitAutomationStudioActivityWaitedOut`, plus shifted line numbers for `emitAutomationStudioActivityAskResolved` and `observeAutomationStudioEvidenceLoop`. Not staged.
7. **`pnpm docs:check`.** "structure-audit: passed", then "Deterministic framework reference is current."
8. **`node scripts/structure-audit.mjs`.** "structure-audit: passed (203 warning(s), 354 baselined)". It also printed "1 baseline entries can be lowered"; I did not run `structure:baseline`. No warnings on my paths. The `evidence-loop/` failure the r5 report named is gone.

## Not verified

- No browser, no Lab, no live run, as the brief said.
- The downstream emitter of `clearedWait` does not exist yet in this tree. The pair is tested only with a hand-built result.
- The 11 timed-out service-flows tests were not shown to pass or fail without my change.
- Full `pnpm check`, `pnpm test` and `pnpm build` for Core were not run.
- `apps/web` was not run. Its panel already handles `waited_out` (r5).
- Authored architecture docs were not updated. No docs path was named as mine.

## Open questions or contradictions found

1. **A cancelled parked run emits no run-end row.** `cancelRuntimeSession` emits no "Run cancelled" final row for a parked run. Its run unit's last row before this change was "Run is waiting for an answer". The new `cancelled` ask row is phase `failed` but not `final`. If a client needs the run unit to end, a final "Run cancelled" step row could be emitted in the same scope. I did not add it: the brief asked for exactly one row.
2. **`deleteProject` deletes parked runs without settling their waits.** The project is gone, so I left it alone.
3. **Integer `waitedMs`.** The brief said "integer ms", so a fractional `waitedMs` (for example from `performance.now()` arithmetic) is dropped as malformed. The downstream worker must send a whole number.
4. **Flow runs have no carrier for `clearedWait`.** See Gap 1, Flow runs.

## Run path (t191-r6-wc3): Flow runs emit `waited_out` too

Outcome: Done. Nothing was staged, committed, aborted or reset. P = `packages/fluxiq/src`.

### The types the domain fills (both public through `fluxiq` / `fluxiq/runtime`)

There are two dispatch paths in a Flow run, and both need the field:
- **`OutputDispatchResult`**, `P/io/index.ts:48`, `clearedWait?: { waitedMs: number }`. The domain imports it from `"fluxiq"`, as `dispatchWebAutomationOutput` already does. Core reads it in `dispatchPolicyOutput` (the IO path).
- **`FluxIQRuntimeCommandResult`**, `P/runtime/contracts.ts:100`, the same field. The domain imports it from `"fluxiq/runtime"`. A web Flow run goes this way: `createRuntimePolicyEffectDispatcher` calls `runtime.dispatch`, which reaches the domain runtime adapter (`domain/src/runtime/adapter.ts`, `executeWebAutomationRuntimeCommand`). `RuntimeService.dispatch` returns the adapter's result object unchanged, so the field gets through.
- Both have the same doc comment: a wait on the target that cleared by itself, how long it stood, in whole ms, absent when there was none. The adapter lifts it from its own shape. Core reads nothing off the payload for it.
- **Downstream must do both.** `dispatchWebAutomationOutput` lifts `payload.result.checkWait.waitedMs` into `OutputDispatchResult.clearedWait`. Then `executeWebAutomationRuntimeCommand` copies `result.clearedWait` onto the `FluxIQRuntimeCommandResult` it builds. Without that copy, the runtime path never carries it. `waitedMs` must be a whole number from 0 to 86 400 000.
- **Internal carrier.** `AutomationNodeExecutionResult.clearedWait` at `P/programs/automation-studio/nodes/contracts.ts:171`, the same shape.
  - `P/programs/automation-studio/runtime/io-policy.ts` copies it from either result onto the node result, on success and on failure (`:51`, `:56`, `:119`, `:124`; helper `clearedWaitField` at `:202`).
  - It is not kept on the attempt. `nodeAttemptFromResult` does not copy it, and a test asserts this.

### Emission

- **New `R/activity/ask/cleared-wait.ts`: `emitAutomationStudioActivityClearedWait(ref, clearedWait: unknown, phase)`.** It holds the validation and the two rows that used to be in `waited-out.ts`.
- **`waited-out.ts`** now only checks `kind: "llm_evidence_tool_execution"` and delegates with ref `waited-out.<callId>`. Its behaviour is unchanged, and its 17 tests still pass.
- **Barrels.** Exported from `ask/index.ts` and `activity/index.ts`.
- **`cleared-text.ts`.** Comment only.
- **Emission site: `R/executor/node-execution.ts:261`, in `dispatchAutomationStudioEffects`.**
  - It runs right after `options.effectDispatcher` answers and before records are captured.
  - It emits `emitAutomationStudioActivityClearedWait(clearedWaitRef(...), answer.clearedWait, "running")`.
  - It is inside the run's activity scope, which `graph-run.ts` already runs under. Its rows land after the node's "Running step N" row.
- **The ref (`clearedWaitRef`, `:288`)** is `waited-out.<callFlowAttemptPath.../>attemptId`, for example `waited-out.output.attempt.1`. A Call Flow child gets `waited-out.call.attempt.2/output.attempt.1`. A second dispatch effect in the same attempt gets the suffix `.<effectIndex>`.
- **Phase "running"** is the phase of run step rows (`activity/step.ts`).

### Tests

- **`R/executor/tests/cleared-wait-activity.test.ts` (new, 13 tests).** It uses a real `runAutomationStudioGraph` in a `run` scope.
  - With `clearedWait {waitedMs: 3200}` there is exactly one ask pair: `waiting_permission`/started, then `running`/succeeded/`waited_out`, with the same ref `waited-out.output.attempt.1`, `activityId: run:run.1` and text "after 3 s". `activityActionOf` gives person_check waiting, then done (why null), and both rows have the same `activityActionKey`. The attempt has no `clearedWait`.
  - A failed dispatch still emits the pair.
  - The Call Flow ref is as above.
  - Absent gives nothing.
  - Nine malformed values give nothing: a number, an array, `{}`, a string ms, a fraction, a negative, more than a day, NaN, null.
- **`R/activity/ask/tests/cleared-wait.test.ts` (new, 5 tests).** It covers the caller's ref and phase, and absent or malformed input giving nothing.
- **`R/tests/io-policy.test.ts`, 3 new tests.**
  - The IO path carries it on success and on failure.
  - The runtime path carries it.
  - It stays absent on both paths when no result reports it.
- **Negative control.** I commented out the emission at `node-execution.ts:261`. `cleared-wait-activity.test.ts` then gave 3 failed and 10 passed. I restored the line from a scratch copy and confirmed it is back at `:261`.

### Commands and observed output

1. `cd packages/fluxiq && npx vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/activity --minWorkers=1 --maxWorkers=2` gave `Test Files 37 passed (37)`, `Tests 441 passed (441)`, 53 s.
2. `npx vitest run src/programs/automation-studio/runtime/tests/io-policy.test.ts --minWorkers=1 --maxWorkers=2` gave `Test Files 1 passed (1)`, `Tests 17 passed (17)`.
3. `bash .../heavy.sh "t191 wc3 check" pnpm --filter fluxiq check`:
   - The first run failed with TS2379 (exactOptionalPropertyTypes) in my new test's malformed-case cast. I fixed the cast.
   - The second run gave `fluxiq:check` built in 15328 ms with no errors.
4. `bash .../heavy.sh "t191 wc3 build" node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` exited 0:
   - contracts reused;
   - fluxiq built (4661 files, 167529 ms);
   - websocket reused.

   `dist/io/index.d.ts` and `dist/runtime/contracts.d.ts` contain `clearedWait`. `dist/.../activity/ask/cleared-wait.js` and `dist/.../executor/node-execution.js` contain the emitter.
5. `pnpm docs:reference` wrote both copies with 2851 public declarations. Against the index, the new rows are `emitAutomationStudioActivityClearedWait` and r6's `emitAutomationStudioActivityWaitedOut`; the rest is shifted line numbers. Not staged.
6. `pnpm docs:check` gave "structure-audit: passed (0 warning(s), 0 baselined)", then "Deterministic framework reference is current."
7. `node scripts/structure-audit.mjs` gave "structure-audit: passed (203 warning(s), 354 baselined)" and "1 baseline entries can be lowered" (not run). On my paths it printed only the existing advisory warning that `io/index.ts` is past 400 lines (it was 538, now 546).

### Not verified (run path)

- The downstream lift does not exist yet, in either `dispatchWebAutomationOutput` or `executeWebAutomationRuntimeCommand`. So no real Flow run has carried the field; it is tested with hand-built dispatcher results.
- The client-gateway transport path (a runtime command answered by a transport client rather than an adapter) does not parse `clearedWait` from the client's answer. A web run goes through the domain adapter, so I left it alone.
- No browser, no Lab. Full Core `pnpm check`/`test`/`build` were not run. Architecture docs were not updated.
