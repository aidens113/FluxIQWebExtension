# P0 command result session binding

Status: Worker complete; source/report frozen, awaiting independent supervisor verification and integration.
Worker: p0_build_identity
Date: 2026-10-07
Scope: Paired t311 command/session trust fix; no provider, panel, full suite, git mutation or shared-document edit.

## Current State

A known pending action result is now bound to the transport session that received its command. ClientGatewayCommands.settle(senderSessionId,result) looks up the pending command and checks pending.sessionId before clearing the timer, deleting the entry or resolving the promise. It returns an internal disposition: settled, unknown_command or wrong_session. Inbound passes the authoritative receive argument sessionId and suppresses action-result publication for wrong_session. No client-authored identity field supplies that check.

Real service regressions passed after failing first: another paired ready client cannot settle the owner's promise or publish the counterfeit result event; the original owner can answer before its deadline, and a rejected foreign answer cannot shorten or reset the original timeout. Existing unknown/late event behavior remains unchanged and explicitly unbound. Those events must not be used for authoritative candidate verification or represented as durable performed-command receipts.

## Exact changed files

Core:

- packages/fluxiq/src/client-gateway/service/commands.ts
- packages/fluxiq/src/client-gateway/service/inbound.ts
- packages/fluxiq/src/client-gateway/tests/service.test.ts
- docs/architecture/automation-studio/client-gateway.md

Downstream: docs/working/mvp-final-month-plan/reports/p0-command-session-binding.md only.

No service.ts, protocol, types.ts, session lifecycle, runtime transport or t310 identity owner changed. The existing service delegates expose the required testing seam. The focused architecture paragraph documents pending-only binding and durable/late limitations.

## Discovery and implementation ledger

1. Main source confirmed the defect: executeAction stores sessionId with each pending promise; former settle(result) used only commandId. Inbound requires a ready sender but formerly dropped its identity during settlement, then published the result regardless of owner. Runtime client-gateway-transport forwards action results as command.result without session identity, so promise-only guarding would leave a false event path.
2. Knowledge of another command ID is a prerequisite. No source inspection or test demonstrated random-ID leakage; the regression intentionally supplies the returned owner's ID to the second ready client.
3. Supervisor assigned isolated paired t311 and approved the exact owners. Three test-only cases were authored before product edits: two foreign-session regressions and one unknown/late compatibility case. Provision3184 completed0; its Core cache build was not stamped because test inputs changed during provisioning. That output was not a frozen-source validation gate or a product failure.
4. Worker fail-first command selected the two another-ready-session tests against unchanged product. Both failed: the tracked owner's pending result already contained counterfeit succeeded from the other client. Vitest2.1.9: 2 failed/14 skipped,23ms tests,972ms total. This executed real service handshake, pairing, dispatch, inbound and pending promises rather than mocks/private-map assertions.
5. Applied owner-session check and wrong-session event suppression; unknown and expired IDs retain their prior event behavior. No random-ID, timeout, answer-margin or journal change.
6. Frozen-source owning tests passed23/23 (service16 + runtime transport7),344ms tests,1.52s total. Both sessions are genuinely ready, share an operator, and have distinct client/session identities. The command queues only to its owner. The first regression checks pending/no event after counterfeit, legitimate owner resolution and exactly one owner event; the second checks timeout at the original100ms deadline. Fake timers are drained/restored in finally. Compatibility case proves unknown and post-timeout foreign events still publish without changing the timed-out promise.
7. Core package check passed0, executed33,505ms. Owning Core package build passed0, executed40,599ms and stored5,970 generated files in the shared cache. Core structure audit passed280warnings/349baselined; downstream report-only audit passed176warnings/117baselined. No baseline edits. Both diff checks passed and status showed only the approved files.

## Exact reproduction commands

From the assigned Core packages/fluxiq directory:

```powershell
pnpm.cmd exec vitest run src/client-gateway/tests/service.test.ts --testNamePattern "another ready session"
pnpm.cmd exec vitest run src/client-gateway/tests/service.test.ts src/runtime/tests/client-gateway-transport.test.ts
pnpm.cmd run check
pnpm.cmd run build
```

The first command was run before the product fix and failed2/2. The second command was run after the fix and passed all23, including those same regressions. No test source changed afterward.

From each paired repository root:

```powershell
node scripts/structure-audit.mjs
git diff --check
```

No browser or external server is needed for this generic transport-session flaw. Validation uses real ClientGatewayService and existing pairClient/clientMessage/settledValue/onEvent seams. No HTTP/WebSocket authentication end-to-end or production server startup claim is made.

## Tested identity

- Core task base: c2ea1e5dce112f5f12d8fce816210e5ee2505b5d, plus the four approved uncommitted changes.
- Downstream task base: 425441a104695adf59cc4195dc4203997598c11a, plus this report.
- commands.ts SHA256: B89B564F9353BAC1FAB6741FC584F26CFB626E7DB6D83ED6FC9C5F77CD945B9E.
- inbound.ts SHA256: C0FBFEC2CD5CCDD5C97B96E215222BA3EE496F165B49DE75BB9B3F8189F48A86.

These identify tested disk sources, not a running server attestation. Generated artifacts remain untracked. Supervisor owns merging current dev, independent reruns, integration and commits/pushes.

## Deferred durable command journal and receipt gap

executeAction still creates a fresh random UUID, keeps pending entries only in process memory and deletes them on timeout. Results for IDs no longer present cannot settle the expired promise, but inbound still emits unknown/late action-result events under the pre-existing contract. A late result from a different session is therefore still an unbound client report; the compatibility test deliberately preserves that limitation. Future authoritative late acknowledgements require durable command identity, persistent client/session attribution and reconciliation across restart. This slice does not establish restart recovery, idempotent retry, at-most-once side effects or receipt retention.

## Read inventory and limits

Read downstream MVP Current State and written bounded brief; own proposal; Core MVP Current State and relevant Core AGENTS role/boundary/structure/documentation/validation guidance; commands.ts; inbound.ts; types.ts PendingCommand; service.ts public receive/executeAction/onEvent delegates; full service.test.ts and existing pairing/promise/message helpers; event-bus.ts; runtime/client-gateway-transport.ts action-result forwarding; existing runtime transport test; Core client-gateway architecture paragraph/context; packages/fluxiq/package.json scripts. Source search identified inbound as command settlement caller and the runtime event consumer. An initially guessed automation-studio/runtime/client-gateway directory does not exist; no source owner was invented there. An initial report read used the Core cwd instead of downstream and found no report; the correct downstream report was then updated.

No wire protocol, owner reconnect migration, revocation lifecycle, provider/model execution, browser behavior, durable journal, production candidate acceptance or full-suite validation was exercised. This is a complete bounded pending-session fix; the broader P0 receipt/qualification work remains open.

## Supervisor verification

Root reviewed commands/inbound before committing ca00dd35; current Core dev already matched. Independent real service/runtime transport23/23 zero skips1.85s; Core typecheck/build both validated current matching input/output stamps (cached0, not a new compiler execution). Root Coreaudit0. Downstream initially failed15 archive-relative links after memory compaction; root rebased the authored archive links, merged current dev, and reran audit0. Product source unchanged during those doc repairs. This fixes known pending sender ownership only; unknown/late events remain unbound and ineligible for authoritative candidate receipts. No live browser/socket/restart/paid proof or provider/user-panel management. Integration follows.
