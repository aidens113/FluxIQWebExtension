# t197-w1: Core build loop hands a robot check to the person

Worker report. Core tree `fxwork/t197/!FluxIQ`, branch `task/t197-robot-check-handoff`. Nothing committed.
R = `packages/fluxiq/src/programs/automation-studio/runtime`.

## Outcome

Done. A build tool result with `personNeeded: true` no longer reaches the model. The build puts the
person-needed ask in the Flow's thread and waits. On `person_done` the call stands, and a fresh look replaces its
evidence. On Stop, a timeout, no thread, a thread that could not be read, or asks past the bound (3), the build
ends `flow_bootstrap.user_intervention_required`. The dry-run replay and `amend_draft` reruns go through the same
wrapper. The run side's activity hook exists in `activity/`, and w2 has already applied an inline equivalent.

## What changed and why

1. `R/llm/evidence-loop-decision.ts`: `personNeeded` is added to the parser's exact-key list. Only the literal
   `true` is kept; any other value is dropped (not fatal), as with the diagnostics beside it. Before this change,
   the exact key list refused the whole result as `tool_result_invalid`.
2. `R/flow-bootstrap/person-needed.ts` (new; exported from the `flow-bootstrap` barrel) defines
   `automationStudioFlowBootstrapPersonNeeded({ executeTool, tools, ask?, signal?, clearedResultCode?, maxAsks?, newAskId? })`,
   which returns `{ executeTool, signal, endedOnIntervention(progress?, accounting?) }`.
   - When a result has `personNeeded`, the wrapper builds the ask from `automationStudioPersonNeededAskDraft`
     (askId `person-needed.<uuid>`, raisedBy `authoring`). It opens the ask on the port and awaits the answer
     with `expiresAtMs = now + min(timeout, 300 s)` under the build's signal.
   - On `person_done`, the wrapper runs a fresh look with the tool that has `initialObservation`. If that look
     meets a check again, it asks again (this counts toward the bound). It then returns
     `{ evidence: { personCompletedCheck: true, note, now: <look evidence> }, effectApplied, targetsUnchanged, nodeId, draft, stateDigests: { before: call's, after: look's } }`.
     `resultCode` and `resultReason` are dropped (history records "ok"). A replay step gets `core.replay.replayed`
     through `clearedResultCode`.
   - The note tells the model that a person completed a check here, that the step stands, and that it must never
     press, type into or reload a check.
   - On any other outcome, the wrapper records the reason, aborts its controller and throws. The loop records a
     thrown call without showing any of its content, then stops `cancelled` at its next turn.
   - Issue codes on the ending: `person_needed.stopped`, `.timed_out`, `.no_thread` (covers no port, a port that
     cannot wait, and a thrown port), `.cancelled`, `.asks_exhausted`.
3. `R/service.ts` (build section only; +12 lines, now 4,487 lines against a budget of 4,558):
   - The wrapper composes over `permissions.executeTool`, using the same
     `conversations.parkingPort({ subject: { kind: "flow", id: flowId } })`.
   - The loop runs under `AbortSignal.any([permissions.signal, personNeeded.signal])`.
   - `endedOnIntervention` is added beside `endedOnRequest` in the `stalled` hook.
   - After the loop, `if (personStopped && !loop.ok) throw personStopped;` runs before the permission check.
   - The one-call path's throw also consults `endedOnIntervention`, for parity.
4. `generation-failure/codes.ts` adds `flow_bootstrap.user_intervention_required` under `provider_output_validation`.
   `evidence-failure.ts` adds `flowBootstrapUserInterventionRequiredFailure(reason, progress, accounting?)`
   (not retryable, and the issue code carries the reason). `failure-state.ts` and `diagnostic-parse.ts` needed no
   change: the default state for a code past the request is already not retryable, attempted and received, and a
   test confirms the round trip parses.
5. `R/parking/person-needed-ask.ts` (additive) adds three exports, re-exported from `parking/index.ts`:
   - `AutomationStudioPersonNeededOutcome`
   - `automationStudioPersonNeededAsk(draft & { askId }, raisedBy)`, which completes a draft into an ask
   - `automationStudioAskedPersonNeeded(ask, raised)`, which opens the ask, waits, and returns the outcome
6. `R/llm/node-tools/run-node.ts` replaces "…read it, change something, and run again. A failure ends nothing."
   with "A failed node says what went wrong and how things now stand. A page that needs a person goes to the
   person: never press, type into or reload a check." The description grows from 1,990 to 1,996 characters.
7. `R/llm/node-tools/replay-draft.ts` adds `automationStudioFlowDraftReplayClearedCode(value)`, which returns
   `core.replay.replayed` for a `{replay:"step"}` call and nothing for a reset. The service passes it to the
   wrapper. It lives here, not in `flow-bootstrap`, because `llm` already imports values from `flow-bootstrap`,
   and a value import back would close a module cycle.
8. `R/activity/ask.ts` (new; exported from the barrel) adds `emitAutomationStudioActivityWaitingOnAsk(ask, ref?)`.
   It emits `waiting_permission`, labelled with the ask's own text for a `person_check` ask and with the generic
   label otherwise. The build emits it while waiting, then emits `building` "The person completed the check;
   building goes on" after Continue.
   - Finding: the build never emitted `waiting_permission` for a permission ask either, so builds had no waiting
     phase at all. Only `executor/graph-run.ts` emitted one.
9. `apps/web` `BlankFlowAuthoringPanel.tsx` and `ImproveFlowPanel.tsx` each gain one message line for the new
   code. These are the only code-to-message tables. The other `permission_required` matches branch on that code
   specifically and need nothing.

Tests (new unless noted):

- `flow-bootstrap/tests/person-needed.test.ts` (11 tests): pass-through; ask shape and wait; Continue with a
  fresh look and the step kept; asking again; Stop, timeout and a throwing thread (each with a diagnostic round
  trip); no port; a port with no `awaitAnswer`; the timeout cap; the bound; the replay code.
- `flow-bootstrap/tests/person-needed-replay.test.ts`: the real evidence loop with a dry run whose replay step is
  `personNeeded`. On Continue the step is `replayed` and the result is accepted with 2 decisions. On Stop the loop
  ends `cancelled` and the ending is `user_intervention_required`, never counted unreproducible.
- `tests/service-bootstrap/tests/person-needed.test.ts` (4 tests), which runs the real service and store:
  - Continue: the build is proposed, the ask is answered in the thread, and no model request contains the check
    marker. The second request carries `personCompletedCheck` and the fresh look. The calls are look, act, look;
    the stored trace has the act at `effectApplied: true` with no code; activity shows `waiting_permission` with
    the ask text.
  - Stop, timeout and no thread each end with the new code, and the model is never asked again.
- `activity/tests/ask.test.ts`.
- `run-node.test.ts`: one test added.
- `llm/tests/evidence-loop-tool-failure.test.ts`: 3 parser tests appended. A new file would have pushed
  `llm/tests/` past the 25-file limit.

## Commands run and observed results

- From `packages/fluxiq`: `pnpm vitest run --maxWorkers=2 --minWorkers=1` over R/flow-bootstrap, R/flow-draft,
  R/parking, R/activity, R/llm/tests, R/llm/node-tools/tests, R/llm/evidence-loop/tests, the new service
  person-needed test and permission-ask.test.ts:
  `Test Files 93 passed (93)`.
- `pnpm vitest run --maxWorkers=2 --minWorkers=1 R/tests/service-bootstrap`: `Test Files 2 failed | 15 passed (17)`.
  - The failures are `rejections.test.ts` (6) and `adaptation.test.ts` "bridges a generated proposal ID…"
    (a 15 s timeout).
  - Both still fail with `service.ts` temporarily swapped back to HEAD (`git show HEAD:… > service.ts`, then
    restored from a scratch backup; the diff stat afterwards showed my 16 lines intact). With HEAD's service.ts:
    rejections `Tests 7 failed | 10 passed`, and "bridges…" `Test timed out in 15000ms`.
  - The rejections failures are unexpected `issueCodes: ["thrown.Error", "thrown.at:…"]` on pre-provider
    diagnostics, from `flowBootstrapThrownIssueCodes`. This is pre-existing and not in my area.
  - At default concurrency, 9 more service-bootstrap tests timed out at 15 s. Rerun at `--maxWorkers=2`, all of
    them passed.
- Fail-before check: with HEAD's `service.ts`, the new service test gave `Tests 4 failed (4)`. The Continue case
  timed out, and the other three came back with a diagnostic that did not parse (`expected null not to be null`).
  With the change, all 4 pass. The wrapper and replay tests import a module that did not exist before.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t197 w1 tsc" pnpm --filter fluxiq check`: `tsc --noEmit`
  exited 0 with no errors, including w2's concurrent `executor/**` edits at the time.
- `node scripts/structure-audit.mjs`: no violations after the fixes. It prints "1 baseline entries can be
  lowered", which I left for the supervisor.
  - The first run had 4 violations, all fixed: `llm/tests` at 26 files, `failure-as-empty` in the fresh look's
    catch, and deep imports of `llm/node-tools/replay.ts` from the module and its test.

## Not verified

- No live or browser run, and no Lab run (not in scope).
- The `apps/web` panels were neither type-checked nor tested; the change is one string line in each.
- The real conversation port's 300 s expiry was not run to its end. The timeout case replaces `awaitAnswer`
  with one that resolves `undefined`, which is the port's own contract for an expired ask.
- The "look threw" branch (`lookUnavailable: "look_threw"`) has no test.
- The incomplete-draft keeper does not keep a draft for a build that ended on intervention (the permission
  ending does not either). A later build starts afresh.

## Open questions or contradictions found

1. The run activity hook is already done inline by w2 at `executor/graph-run.ts:527`, with the title "Waiting
   for a person". To share one wording, that line could become
   `emitAutomationStudioActivityWaitingOnAsk(ask, currentNode.id)` (import from `../activity/index.ts`). My title
   for a person-needed ask is "Asked the person to complete a check". The supervisor should pick one.
2. The recovery path (`R/recovery/runtime-exploration.ts`) runs the same evidence loop with the harness
   executor, not this wrapper. The parser now keeps `personNeeded`, so a person-needed result there would reach
   the repair model as ordinary evidence. That is outside my files; wrapping it the same way would be the fix.
3. The evidence loop itself does not refuse a `personNeeded` result that arrives unwrapped. The rule holds for
   the build only because the service wraps it. A defensive guard in `R/llm/evidence-loop.ts` (not owned) would
   make it hold everywhere.
4. For a replayed *step*, Continue maps to `core.replay.replayed`, so the dry run makes no `produced`
   comparison for that step. This follows the design's "the call stands" and the domain describing the step as
   it stands once cleared.
5. A person-needed ask always waits up to 300 s, even for callers that pass no `permissionAskTimeoutMs`. I did
   not add a request field because `service/flow-bootstrap-commands/**` is not mine.
