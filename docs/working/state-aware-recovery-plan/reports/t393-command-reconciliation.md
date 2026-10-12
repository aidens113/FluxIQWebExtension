# t393 command reconciliation: worker report

Brief: the browser half of B3 (in-flight command record and reconciliation), plus B4's
`web.actions.reconcile` declaration. Tree `fxwork/t393-command-reconciliation`, branch
`task/t393-command-reconciliation`. Nothing committed.

## Outcome

Done. All five items are implemented and unit-tested. Live behaviour (a real service worker
restarting mid-action) was not exercised.

| Item | State |
| --- | --- |
| 1. Record written before `executeAction`, cleared on result | Done |
| 2. Leftover reported after `session_ready` as interrupted, effect unknown, then cleared | Done |
| 3. A repeated command id is answered with the queued or just-sent result, not run again | Done |
| 4. Effect check on the exploration and replay paths | Done (expectation evaluator, see below) |
| 5. `web.actions.reconcile@1` declared; `interrupted` mapped in the domain | Done |

## What changed and why

### Extension: `apps/extension/src/background/connection/in-flight/` (new)

- `record-store.ts`, `InFlightRecordStore`: one `chrome.storage.session` key per command
  (`fluxiq.inFlight.<commandId>`). This avoids a read-modify-write race between two commands. The
  record is `{ commandId, actionType, committing, startedAt, tabId?, documentId? }` and never
  holds a value the action carries (a test checks this).
- `record-area.ts`: `chrome.storage.session`, or a memory stand-in when it is absent (Firefox
  before 115). The stand-in follows the same pattern as `session-disconnect-memory.ts`.
- `frame-document.ts`: Chrome's `webNavigation.getFrame().documentId`. On Firefox, or when the
  call fails, the value is undefined.
- `command-reconciliation.ts`, `CommandReconciliation`:
  - `begin`: writes the record when the command is accepted.
  - `dispatched`: adds the tab and documentId just before the send.
  - `settled`: clears the record and remembers the result.
  - `release`: runs when a handler throws. The record is kept, because nothing answered it.
  - `answerRepeat`: answers a repeated id in this order: still running (do nothing; its own result
    answers), a result just sent (the last 16 are kept), a record an earlier worker left (sent as
    interrupted), or a result in the offline queue. A new id returns `undefined`.
  - `reportLeftovers`: reports every stored record that no running command owns, then clears it.
- `server-command-channel.ts`:
  - On `execute_action`, it calls `answerRepeat` first and returns if that answers. Otherwise it
    calls `begin`, then runs the action inside `try/finally release`.
  - `handleSessionReady` calls `reportLeftovers()` after `flushQueue()`.
  - `sendActionResult` calls `settled()` after the send or queue.
  - The router gets a `noteDispatch` hook.
  - If a record write fails, the action still runs and a warning goes to the activity log (it is
    not dropped silently).
  - There is a new optional dependency, `reconciliation`. Without it, the channel builds its own,
    so `background/connection.ts` is untouched.
- `gateway-session.ts`: new `queuedActionResult(commandId)` reads the offline queue.
- `runtime/command-router.ts` and `runtime/action-runner.ts`: `noteDispatch(tabId, frameId)` is
  awaited in `runActionInFrame` immediately before `sendClickCheckingLanding`, which is the only
  place `executeAction` is sent to a tab.

### Domain: `domain/src/client/interrupted-action/` (new, exported from `client/index.ts`)

- `commits.ts`, `webAutomationActionCommits(actionType, parameters)`: true for click, keypress,
  dialog, and type with `submit: true`.
  - This restates `webPlanStepMustDeclare` as plain values, because `step-permission.ts` pulls in
    Core's permission runtime through `permission.ts`, and it lives in `plan-resolution/`, which I
    must not edit.
  - `tests/commits.test.ts` checks that the two answer the same for every action type and five
    parameter variants.
- `outcome.ts`: the wire outcome.
  - Committing act: status `unknown`, code `web.action.unknown`, effect `ambiguous`.
  - Any other act: status `failed`, code `web.transport.transient`, effect `unacted`, retryable.
- `result.ts`, `webAutomationInterruptedActionResult(record, now)`: the payload is
  `{ commandId, actionType, status: "interrupted", effect: "unknown", startedAt }`. It carries no
  tab, frame, document or URL.
- `dispatch-reading.ts`: used by `io/gateway-output-dispatcher.ts`. When the result's payload says
  `interrupted`, the dispatcher decides committing again from the command it sent and replaces the
  status, failure and message. The domain's rule therefore wins over the client's record.

**Why the wire status is not literally `interrupted`.** Core's `ClientGatewayActionResult.status`
has no such value. Core's durable ledger (`command-ledger/dispatch.ts:150`) throws
`durable_command.invalid_result` on any status outside
`succeeded | failed | unknown | timed_out | cancelled`, and on any field outside its list. So
`interrupted` and `effect: "unknown"` ride in the payload, and the wire status is `unknown` for a
committing act or `failed` for any other.

### Domain: effect check

- `runtime/llm-evidence/node-run/retries/effect-check.ts`, `webNodeEffectCheck(run, parameters)`:
  reads the node's `parameters.expectedState` and judges it through the existing
  `createWebAutomationExpectationEvaluator`, using the run's gateway.
  - `landed`: every condition was judged and held (mode `any`: at least one held).
  - `not_landed`: a judged condition failed (mode `any`: every condition was judged and none held).
  - Otherwise `unknown`.
  - No expected state, or no answer from the page, is `unknown` and asks the page nothing.
- I chose the waiting expectation evaluator over the zero-wait `web.page.facts`. The question is
  "did it land?", and a zero-wait false on a slow page would trigger a second press.
- `run.ts:368` and `replay.ts:362` now pass the check.
  - Both now treat `lastingAct === "landed"` as done (`result.status !== "succeeded" && lastingAct !== "landed"`).
  - Without that, a press the check showed had landed would still be refused as a failure. This
    case could not happen before, because no check was ever passed.

### Capability and docs

- `runtime/capabilities.ts`: `WEB_AUTOMATION_RECONCILE_CAPABILITY_ID = "web.actions.reconcile"`.
  - Metadata: `{ domainId, version: 1, interruptedStatus: "interrupted", dedupe: "commandId" }`.
  - Added to both the gateway list (the hello) and the runtime list.
  - It lists no action types or output ids, so nothing new becomes executable.
- `docs/architecture/extension-client.md`: added "A command in flight" under Staying Connected.
- `docs/architecture/web-capabilities.md`: added the section "Commands In Flight
  (`web.actions.reconcile`)".

## Commands run and observed results

- `cd domain && npx tsc -p tsconfig.json --noEmit` -> exit 0.
- `cd domain && npx tsc -p tsconfig.test.json --noEmit` -> exit 0.
- `cd domain && DOMAIN_TEST_BUILD_LABEL=t393 node scripts/test-domain.mjs node-run/tests node-run/retries/tests src/io/tests src/client/ runtime/tests/capabilities runtime/tests/adapter lasting-act`
  -> `# tests 397  # pass 397  # fail 0`.
  - The new rows are `commits.test.ts` (2), `result.test.ts` (4),
    `gateway-output-dispatcher-interrupted.test.ts` (3), `effect-check.test.ts` (8) and one in
    `capabilities.test.ts`.
- `cd apps/extension && node scripts/check-extension.mjs` -> exit 0 (source and test typecheck).
- `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t393 node scripts/test-extension.mjs in-flight server-command-channel gateway-session command-router action-runner`
  -> `# tests 61  # pass 61  # fail 0`.
  - These include the required proofs:
    - "a record is written before the command is sent, names where it went, and is cleared when
      its result is sent"
    - "the result sent for a command clears its record"
    - "after a restart, a leftover record is reported as interrupted with its effect unknown, then
      cleared"
    - "a session becoming ready reports what an earlier worker lost, after the offline queue is
      flushed"
    - "an execute_action repeating a command id whose result is queued re-sends that result and is
      not executed"
    - "... whose result was just sent re-sends it and is not executed"
- `pnpm --filter @fluxiq-web-extension/extension build` -> exit 0. It printed
  `chrome: verified 22 files`, `firefox: verified 22 files` and `e2e-chromium: verified 22 files`.
  `fluxiq.inFlight.` is present in `build/background/index.js` and in `dist/*/background/index.js`.
- `node scripts/structure-audit.mjs 2>&1 | tail -1` -> `structure-audit: passed (184 warning(s), 257 baselined).`
  The warning count is 184, the same as before my change.
  - Two violations were fixed along the way:
    - An `as never` in my gateway-session test stub was replaced with typed
      `createClientGatewayMessage` values.
    - `connection/tests/` went over its 25-file limit, so the channel test moved to
      `in-flight/tests/channel-wiring.test.ts`.

## Not verified

- **No live browser check.** A real MV3 worker stopped mid-action (for example with
  `chrome://serviceworker-internals` "Stop" during a press), then a reconnect, the leftover report,
  and Core's handling of it. B6's perturbation "service worker stopped mid-action" is the Lab hook
  for this.
- **Core's reception of a late interrupted result.** After a worker restart the session usually
  disconnected first, and Core's durable ledger marks pending commands uncertain on
  `session.disconnected` (`command-ledger/dispatch.ts:39`). A late report then settles as
  `unknown_command` and is emitted only as an event. The record mainly protects a repeat of the
  same id and makes the log honest; whether Core's R5 sweep or C8 reads the event is on Core's
  side.
- **Firefox.** `chrome.storage.session` exists from Firefox 115. `documentId` is absent there by
  design. Neither was exercised.
- **Duplicate result events in Core.** A re-sent result for a command Core already settled reaches
  Core as `unknown_command` and is emitted as a `client.action_result` event. I did not check that
  no Core listener misreads that duplicate.
- **No full suites** were run, per the brief.

## Open questions or contradictions found

1. The brief says the leftover is reported "with `{ status: "interrupted" }`". Core's wire contract
   cannot carry that status, and its ledger refuses unknown fields. I put `interrupted` in the
   payload and mapped the wire status to `unknown` or `failed` (see above). If Core wants a real
   `interrupted` status, `packages/contracts/src/client-gateway.ts` and the ledger's `parseResult`
   need it first.
2. The commit rule is now written in two places: `step-permission.ts` and the new
   `client/interrupted-action/commits.ts`. A test holds them equal. The owner of `plan-resolution/`
   could make `step-permission.ts` import the light module, which would leave a single definition.
3. A record written by this worker whose handler threw (`release` without `settled`) is reported
   as interrupted on the next repeat or at the next `session_ready`. That is conservative (unknown
   for a committing act) even when the throw happened before anything reached the page, for
   example `captureActionBoundary` throwing.
4. `gateway-mapping.ts` itself is unchanged: it is already 549 lines. The interrupted mapping
   lives beside it in `client/interrupted-action/` and is exported through the same `client`
   barrel.
