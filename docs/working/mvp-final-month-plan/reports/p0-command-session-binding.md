# P0 command result session binding

Status: Proposal complete; source-confirmed defect, executable fail-first pending task assignment.
Worker: p0_build_identity
Date: 2026-10-07
Scope: Main Core read-only inspection; only this downstream report written. No source, build, test, provider, panel or git mutation.

## Current State

A ready client can settle another ready client's pending command if it knows the command ID. packages/fluxiq/src/client-gateway/service/commands.ts executeAction records { sessionId, resolve, timeout }, but settle(result) looks up only result.commandId and clears/deletes/resolves without checking the recorded sessionId. service/inbound.ts receives the authoritative transport sessionId and requires that session to be ready, but calls commands.settle(message.payload), dropping that identity. This is confirmed by source, not yet executed as a regression. Knowledge or leakage of the target command ID is a prerequisite; this inspection does not claim a mechanism that reveals random IDs to another client.

A related path within the same owners must be included: inbound also publishes client.action_result regardless of settlement. runtime/client-gateway-transport.ts forwards that event as command.result, omitting the gateway event's session identity. Guarding the promise alone would still let the mismatched known-pending result reach observers. The proposed inbound change suppresses that specific wrong-session event. Unknown-command/late-result event semantics should remain unchanged in this bounded unit; durable receipt/journal behavior is separate.

## Exact proposed owners

Core source:

- packages/fluxiq/src/client-gateway/service/commands.ts: require sender sessionId in settle, compare it to pending.sessionId before clearTimeout/delete/resolve, and return an explicit internal disposition (settled, unknown_command, wrong_session).
- packages/fluxiq/src/client-gateway/service/inbound.ts: supply the actual receive argument sessionId, not a payload field; return without publishing client.action_result when disposition is wrong_session. Preserve existing readiness gate and unmatched/late-event behavior.
- packages/fluxiq/src/client-gateway/tests/service.test.ts: real service integration tests through existing pairClient, clientMessage, settledValue and onEvent helpers/API.

Downstream documentation: this report only. No service.ts edit: its public receive/executeAction/onEvent delegators already expose the required seam; t310 owns that file's identity work. No types.ts/contracts/runtime transport edit is required. Proposed dispositions are internal to the existing class method, not a new wire protocol. Supervisor should approve the small event suppression explicitly before execution.

## Concrete fail-first regression

Use ClientGatewayService, not mocked commands or a direct private map assertion.

1. Pair two distinct clients A and B using existing pairClient; assert both snapshot sessions are ready. Both can share an operator so the test isolates exact transport-session binding rather than different-user policy. Do not log readyToken values.
2. Under fake timers in try/finally, dispatch an action to A using executeAction(A.sessionId, ...). Track response.result with settledValue. Subscribe via onEvent, collecting only client.action_result. Assert the command is queued to A, not B.
3. B sends client.action_result through gateway.receive(B.sessionId, clientMessage(...)) using the returned command ID and a recognizable counterfeit result. Flush promise microtasks using the existing async timer helper or explicit Promise.resolve. Assert tracked result is undefined and no action-result event was published. On current source this fails because B settles A's promise and emits the result.
4. Advance to one millisecond before the configured default command deadline; still pending. A sends the same command ID with a distinct authentic result. Assert promise resolves to A's exact payload and one event with A.sessionId appears. Advance beyond deadline and ensure the authentic result remains unchanged. This proves rejection leaves the pending entry/timer alive and the legitimate owner can finish.
5. Separate timeout regression: B's attempted settlement does not stop the command's original deadline; advance to deadline and require normal timed_out. Drain fake timers and restore real timers in finally, even when fail-first assertions throw.
6. Preserve the existing same-session correlation, answer-margin/default-timeout, readiness/pairing, reconnect and recording tests. A narrow unknown-command event regression can pin unchanged compatibility if the implementation uses dispositions; no durable correctness claim follows from it.

No long wall-clock wait, browser, model or server process is required for this transport/session bug. These tests exercise the real Core service, handshake, pairing, dispatch, inbound routing, pending promise and event fan-out. They do not prove HTTP/WebSocket authentication end to end.

## Proposed validation commands after assignment

From the assigned paired Core packages/fluxiq directory:

```powershell
pnpm.cmd exec vitest run src/client-gateway/tests/service.test.ts --testNamePattern "another ready session"
pnpm.cmd exec vitest run src/client-gateway/tests/service.test.ts
pnpm.cmd run check
```

From assigned Core repository root:

```powershell
node scripts/structure-audit.mjs
git diff --check
```

Run the first regression command before product edits and record the exact observed counterfeit settlement failure. After the bounded fix, rerun that command then the owning service file, package typecheck and structure audit. No full suite. Build only if supervisor requires it for integration/dependent checks. These are proposed commands, none executed during this investigation. Report current pair revisions and observed counts after provisioning, not guessed from main's ongoing task work.

## Distinct deferred durable command journal gap

executeAction generates a fresh random UUID, keeps its pending map in process memory, and deletes entries when its timeout resolves. settle ignores results for IDs no longer present. There is no durable command identity/outcome receipt in this inspected owner. Inbound currently still emits unknown/late results, so the precise statement is that late results cannot settle the expired pending promise; not that every downstream observer drops them. This unit must not claim restart recovery, idempotent retry, at-most-once side effects, uncertain-outcome reconciliation or late-result journal retention. Those require a separately designed durable contract.

## Read inventory and limits

Read downstream MVP Current State; Core MVP Current State; Core AGENTS relevant role, boundary, structure/validation guidance; commands.ts; inbound.ts; types.ts PendingCommand; service.ts receive/executeAction/onEvent delegators (read-only); full owning service.test.ts and existing helper implementations; event-bus.ts; runtime/client-gateway-transport.ts result forwarding branch; packages/fluxiq/package.json check/test commands. Source searches found commands settlement called by inbound and identified the runtime event consumer; an initially guessed automation-studio/runtime/client-gateway directory does not exist and was not treated as an owner.

No execution, production behavior proof, source change, task branch creation, commit or push occurred. The supervisor must assign a task and authorize exact owners before implementation. Native gateway identity and durable journal work remain separate.
