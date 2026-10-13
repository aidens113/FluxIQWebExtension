# Matrix case 9 lost acknowledgement proof audit

Status: source/counter audit complete. Worker codex-t517, 2026-10-13. Frozen pair downstream6a46e66b/Core73550acb. Read-only current source and count-only receipt inspection; no source changes, tests/builds, browser/provider runs, process management, private payload output or commits. Only this report written.

## Verdict

The selected acknowledgement was the authoritative `client.action_result`, not its later recording/observational duplicate. The run succeeded through gateway-transparent cached-result reconciliation. A node retry, failure incident or lifecycle handler is not required for that path and was not claimed by the actual counters. Case9 is not a false pass caused by dropping only an observation.

Evidence level must stay precise: the existing relay log does not log server.reconcile_command/client.reconcile_result or Core command.reconciled audit. There is no standalone recorded reconciliation-handshake receipt in this case JSON. Mechanism is established by the correlated fault/one-command/one-result exclusion, the single approximately30s successful attempt, and the current awaited gateway/cache source path. Do not relabel this as a captured node lifecycle repair or actual durable learned adaptation.

## Receipt and safe correlation

Case receipt:

```text
C:/Users/osrs_/FluxStuff/fxwork/t418/!FluxIQWebExtension/test-runs/instances/t418-slot-3/recovery-matrix/rmx-2026-10-13T22-34-12-050Z-da2c11/case-9.json
```

External summary/logs supplied by preparation worker:

```text
C:/Users/osrs_/FluxStuff/lab-runs/2026-10-13/codex-continuation-crossborder-preparation/2026-10-13T22-09-18-095Z/matrix-counts.json
C:/Users/osrs_/FluxStuff/lab-runs/2026-10-13/codex-continuation-crossborder-preparation/2026-10-13T22-09-18-095Z/matrix-9-10-11.log
```

Command identifiers were correlated privately and never printed. Counts for exactly the selected command:

- command.sent1, fault.armed1, fault.fired1; dropped result closed status succeeded; dropped frame bytes112892.
- result.forwarded0 for that command, afterDrop duplicate0, additional execute command for that ID0.
- Exactly one attempt encloses the arm/drop and lasts30016ms, ending succeeded. Next command is29016ms after the dropped result.
- Entire case: run succeeded,13 attempts/13 successes, no attempt failures,4 lasting steps, provider calls0, retries0, incidents0, duplicatedActs0, falseSuccesses0, missingRecords empty; every lifecycle field null.
- Relay totals:25 execute messages,24 forwarded action results, one dropped action result. Extra execute messages include fact checks; these are not evidence of repeated lasting acts.

The approximately30s wait and lack of any forwarded result for the selected ID exclude an immediate observational acknowledgement bypass or a later duplicate action result supplying success. Node-level counts remain clean because the gateway completed its awaited result before the executor received an attempt failure.

## Exact source path

### 1. Relay chooses and drops the command result

Downstream `packages/test-runner/src/perturbations/drop-action-result-relay.ts:63-79` examines server.execute_action, chooses the exact named selector and records the selected commandId. `:84-95` only intercepts client.action_result; its first result for the chosen ID is suppressed and fault.fired recorded. client.recording_event is passed through unmodified. `:92` logs all other forwarded client.action_result messages, including any matching afterDrop duplicate; the correlated count is zero.

This result class is authoritative on first arrival to Core, even though Core also publishes action-result diagnostics after processing it. Do not confuse the post-settlement diagnostic event with the incoming command answer the relay suppresses.

### 2. Extension remembers the result even though the relay discards it

Downstream `apps/extension/src/runtime/command-router.ts:57-60` sends the actual browser result through the server channel. `background/connection/server-command-channel.ts:287` sends client.action_result; `:289` immediately calls reconciliation.settled for sent/queued completion, then `:290` sends the separate runtime recording confirmation. The relay is a live TCP connection, so an upstream drop cannot tell the extension's socket send that delivery failed.

`background/connection/in-flight/command-reconciliation.ts:99-103` remembers the completed result and removes the running/in-flight record. `:137-147` answers a reconciliation question from recent or queued results without executing the action. In this case the worker stayed alive and cached result remains in the16-result window.

`background/connection/server-command-channel.ts:231-236` answers server.reconcile_command using that reconciliation owner and sends client.reconcile_result. Its fallback remains unknown if the record cannot be read; it never invents successful effect or re-presses the lasting act.

### 3. Core waits for the command, then reconciles its missing answer

Core `packages/fluxiq/src/client-gateway/service/inbound.ts:103-112` parses incoming client.action_result and calls commands.settle for its actual pending command before publishing a diagnostic. `:115-119` binds a client.reconcile_result to a question Core already asked; unsolicited answers are ignored/audited.

Core `client-gateway/service/commands.ts:97-103` installs a timed pending command. `:112-121` settles only a matching pending session/result. `:166-176` handles a missing answer: asks reconcileAction for that command, converts the client's cached outcome, closes pending state, records command.reconciled when answered, and resolves the original awaited command. Durable commands use the same command-specific reconciliation at `:179-183`; source inspection does not falsely label the current row as a separately audited durable-ledger promotion.

Core `packages/fluxiq/src/runtime/client-gateway-transport.ts:64-70` obtains authoritative runtime completion only by awaiting the gateway dispatch result, whether context-owned durable or ordinary dispatch. `:116-118` expressly excludes compatibility action-result diagnostics from authoritative RuntimeService completion. A later client.recording_event/state observation is not a replacement for this awaited command result.

This is why a dropped succeeded result can still appear as one succeeded node attempt: gateway reconciliation returned the same cached result to the waiting transport. No node failure/retry/handler was necessary, and no lasting act was dispatched again.

## Checker limits and recommended proof classification

The current checker `packages/test-runner/src/recovery-matrix/checks/matrix-checks.ts`, outcomeReconciled:138-143, checks floor(site/model invariants), faultFired and succeeded-or-explicit uncertain stop. It does not demand a named gateway reconciliation audit. Those assertions alone are too coarse to prove which fault result was dropped or how success completed. This read-only audit adds the missing exact selected-command correlation and current source explanation for this run; it does not strengthen the checker by changing frozen source.

Record this case as **authoritative acknowledgement dropped; source-correlated transparent gateway reconciliation; no repeat/no model**. It is a free reliability preflight, not paid repair/adaptation qualification, not handler lifecycle recovery, and not learned reuse. The zero incident numerator/denominator is honest: deterministicRecoveryRate stays null rather than claiming a repaired incident.

Follow-up observability improvement, not a required source change before the current gate: log only command-correlated counts/closed states for server.reconcile_command/client.reconcile_result or retain Core command.reconciled audit in matrix proof. Require one matching question/answer or a truthful uncertain-outcome stop; never retain result/page/frame bodies or credentials. That would let future rows prove the mechanism without a manual source/timing audit. Preserve source freeze and do not rerun a browser case merely to manufacture that missing historical receipt.

## Reads and limitations

Initial bounded reads: matrix checker, drop relay, extension server command channel, command router, Core gateway commands. Supervisor authorized three additional narrow owner reads: Core gateway inbound (facade redirects to service/inbound.ts), runtime gateway transport, extension cached-result reconciliation. Receipt inspection emitted only safe counters/status/keys/timing; raw action/recording/page/result bodies and command/session ids were not exposed.

No new handshake packet/audit was fabricated or captured. No persisted adaptation/reuse assertion follows from this proof. Root retains independent review of frozen source, build identity and case counters before counting this boundary as satisfied.
