# Lane T, U6: environment port and channel scope

## Outcome

Done. Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t729/!FluxIQ`, branch `task/t729-traces-offline-trials`,
nothing committed. All three definition-of-done checks pass: the brief's vitest set (37 files, 263 tests), the
package typecheck (exit 0) and the structure audit (exit 0). Tests were written before the implementation in each part.

## What changed and why

All paths are under `packages/fluxiq/src`.

### 1. Kernel: `client-gateway/service/channel-scope/` (new, domain-neutral)

- `source.ts`: `ClientGatewayChannelScopeSource = { current(): string | undefined }`. It returns the scope the
  dispatching async context runs in; `undefined` means live. It mirrors `host-lease/source.ts`.
- `visibility.ts`: `clientGatewayChannelScopeVisible(sessionScope, currentScope)` returns
  `sessionScope === currentScope`. That is the whole rule:
  - inside a scope, only that scope's sessions are visible;
  - outside every scope, only live sessions are.
- `admission.ts`: `clientGatewayChannelScopeAdmission` returns `undefined` when the target is visible. Otherwise it
  returns one of two codes:
  - `channel_scope.outside_scope`: sent from inside a scope to a live session or to another scope's session;
  - `channel_scope.scoped_session`: sent from outside every scope to a scoped session.
- `codes.ts`: `CLIENT_GATEWAY_CHANNEL_SCOPE_REFUSAL_CODES` and the matching type.
- `refusal.ts`: the refused action result. It has the same shape as a host-lease refusal: `failed`, category
  `blocked_by_capability_or_policy`, `retryable: false`, stage `dispatch`, effect `unacted`.
- `refused-error.ts`: `ClientGatewayChannelScopeRefusedError` carrying `.code`, for the calls that have no result to
  refuse with.
- `index.ts`: the barrel. It is re-exported from `service/index.ts`.

### Gateway changes

- **`service/types.ts`**: `channelScope?` added to `ClientGatewayServiceOptions`, next to `hostLease`.
  `InternalSession` gains `channelScope?: string`.
- **`service/sessions.ts`**: `toPublic` strips `channelScope`, so the public session contract is unchanged.
- **`service/views.ts`**: `snapshot().sessions`, `summary().counts.sessions` and `listSummaryItems({kind:"sessions"})`
  list only the sessions visible from the current scope. The brief named only `snapshot()`. I applied the same rule
  to the operator listings so that they never show replay sessions.
- **`service/commands.ts`**: a target across a scope is refused before anything is sent, and audited as
  `command.channel_scope_refused`.
  - `executeAction` returns a refused response. The check runs before the host-lease stamp.
  - `executeDurable` throws `ClientGatewayChannelScopeRefusedError` with message
    `durable_command.channel_scope.<code>` before anything is claimed, the same way a durable host-lease refusal
    throws.
  - `captureSnapshot` throws `ClientGatewayChannelScopeRefusedError`.
- **`service/lifecycle.ts`**:
  - `attachScoped({ scopeId, socket, hello })` makes the session `ready` with no pairing and never touches the
    trusted-client registry or store. It always mints `client.scoped.<uuid>` as the client id, whatever the hello
    claims, so the session can never share a live client's id. That rules out a reconnect replacement, a reconcile
    route or a durable `clientId` match crossing over. The hello's `token` is ignored, and an empty `scopeId` throws
    `client_gateway.channel_scope_required`. Hello fields are copied by name. No `session.ready` event is emitted,
    so no global listener learns that the session exists.
  - `isScoped(sessionId)`.
- **`service.ts` (facade)**:
  - `channelScope` is passed to `ClientGatewayCommands` and `ClientGatewayViews`.
  - New facade methods: `attachScopedSession(...)` and `isScopedSession(sessionId)` (see the open questions).

### 2. `programs/automation-studio/client-gateway/bridge.ts`

Nothing from a scoped session ever becomes a recording or a recording entry:

- `handleGatewayEvent` returns at once for any event from a scoped session.
- `executeAction`, on both the plain and the durable path, skips `appendActionResult` for a scoped session.
- `startRecording` on a scoped session throws `recording.scoped_session_refused`.

### 3. `programs/automation-studio/runtime/environment/` (new)

- `environment.ts`: `AutomationStudioRunEnvironment` with these fields:
  - `kind`: `"live" | "trace" | "fixture"`;
  - `now`, `delay` and `random`, typed as `NonNullable<AutomationStudioGraphExecutionOptions[...]>`, so they are the
    executor's own shapes;
  - `newRunId(prefix)`;
  - `within(work)`.
- `live.ts`: `automationStudioLiveRunEnvironment` is exactly today's fallbacks:
  - `Date.now()`;
  - `automationStudioRunWait(signal ? { signal } : {}, ms)`, which is the real unreferenced, abortable timer from
    `executor/pacing/run-wait.ts`;
  - `Math.random()`;
  - `` `${prefix}.${randomUUID()}` ``;
  - `within = work()`.
- `virtual-clock.ts`: `AutomationStudioVirtualClock`. `now` advances only through `delay(ms)`, which resolves on a
  microtask without any wall wait. An already-aborted wait ends at once without advancing the clock.
- `channel-scope.ts`: `AutomationStudioChannelScope`, backed by `AsyncLocalStorage`. It has a static
  `gatewaySource: ClientGatewayChannelScopeSource`, a static `current()` and `run(scopeId, work)`. It mirrors
  `lease-scope.ts`.
- `scoped.ts`: `createAutomationStudioScopedRunEnvironment({ kind, clock, scopeId?, random?, newRunId? })`.
  - It returns the port plus `scopeId`, and `within` runs work inside that scope.
  - `random` and `newRunId` default to the live ones, so a caller that needs reproducible values must pass its own.
- `index.ts`: the barrel.

### 4. `programs/_shared/runtime.ts`

`channelScope: AutomationStudioChannelScope.gatewaySource` is passed to `new ClientGatewayService(...)` next to
`hostLease`. No scope is entered anywhere in production yet, so `current()` is always `undefined` and every caller is
live. The only change for a live run is that a scoped session, which nothing creates yet, would be hidden.

The import is `../automation-studio/runtime/environment/index.ts`, a barrel import that the audit accepts. It does not
go through `automation-studio/index.ts`, because `runtime/index.ts` is outside this brief.

### 5. Fixture adapter (unit tests only)

- **`environment/tests/fixture-client.ts`**: `FixtureGatewayClient`, a plain `ClientGatewaySocket` attached with
  `attachScopedSession`.
  - It answers each `server.execute_action` on a microtask through `gateway.receive(sessionId, client.action_result)`.
  - Answers are looked up by action type, canonical parameters (keys sorted recursively) and occurrence. They are
    never looked up by node id.
  - An unmatched call is answered as a non-retryable `fixture.unmatched_call` failure that did nothing.
  - Nothing in the client uses a web word.
- **`environment/tests/fixture-run.test.ts`** drives one `builtin.policy.action` node (`fixture.tally.add`, domain
  `fixture`). The path is `automationStudioRunGraphOptions` → `RuntimeService` → `ClientGatewayRuntimeTransport` →
  gateway, inside `environment.within`. The environment's `now`, `delay` and `random` are set on the options in the
  test; `graph-options.ts` is not edited. The tests assert that:
  - the result came from the fixture (`outputs.result = { total: 5 }`), parameters in a different key order matched
    the same call, the local IO dispatch was never reached, and `trace.startedAt` equals the virtual start;
  - a live session paired outside the scope, with the same capability, received no command;
  - a repeated call is answered by occurrence (a retryable failure, then success). The executor's 250 ms backoff
    advanced the virtual clock by at least 250 ms, and the wall time was less than that advance;
  - inside the scope, a command to the live session is refused as `channel_scope.outside_scope`, unsent, and the live
    session is absent from `snapshot()` (T20 at unit level);
  - outside the scope, the scoped session is absent from `snapshot()`, a command to it is refused as
    `channel_scope.scoped_session`, and the fixture received nothing;
  - `delay(10 min)` advances the virtual clock by exactly that much, with less than 1 s of wall time.

### Other new tests

- `client-gateway/service/channel-scope/tests/admission.test.ts`: the rule, the codes and the refusal shape.
- `client-gateway/tests/channel-scope.test.ts`, 9 tests:
  - attach makes the session ready, gives it a minted id even when the hello claims a live client's id, strips the
    token, never calls the store's `save`, and emits no events;
  - an empty scope is refused;
  - the snapshot, the summary listing and the counts follow the rule;
  - an in-scope send works and its answer comes back through `receive`;
  - every crossing is refused unsent, with the code and the audit entry;
  - `captureSnapshot` refusals throw the classified error;
  - a durable refusal throws before `resolveCommandLedger` is called;
  - with no scope source wired, scoped sessions are hidden and unreachable.
- `programs/automation-studio/client-gateway/tests/bridge-scoped-session.test.ts`, 4 tests:
  - six kinds of client message from a scoped session open no recording, write nothing and send nothing back;
  - `startRecording` on a scoped session is refused;
  - an in-scope answer is returned without being appended;
  - outside the scope, the call gets the gateway's refusal and nothing is appended.
- `environment/tests/environment.test.ts`, 8 tests:
  - the live fallbacks, including a real 20 ms wait and an abort ending a 60 s wait;
  - the virtual clock;
  - `within`, read through `gatewaySource` across a `setTimeout`, with the scope gone afterwards;
  - two interleaved environments keep separate scopes;
  - injected `random` and `newRunId` are used;
  - an empty scope id is refused.

## Commands run and observed results

1. `pnpm exec vitest run src/client-gateway/tests/channel-scope.test.ts src/client-gateway/service/channel-scope`
   → `Test Files 2 passed (2)`, `Tests 12 passed (12)`.
2. `pnpm exec vitest run src/programs/automation-studio/client-gateway` → `Test Files 5 passed (5)`,
   `Tests 40 passed (40)`.
3. `pnpm exec vitest run src/programs/automation-studio/runtime/environment` → `Test Files 2 passed (2)`,
   `Tests 13 passed (13)`. It passed on the first run, and again after the statement-packing fix.
4. The definition-of-done set, from `packages/fluxiq`:
   `pnpm exec vitest run src/client-gateway src/programs/automation-studio/runtime/environment src/programs/automation-studio/client-gateway src/runtime/tests/client-gateway-transport.test.ts`
   → `Test Files 37 passed (37)`, `Tests 263 passed (263)`, `Duration 217.70s`.
   - The set includes the other worker's `client-gateway/trace/tests/*`, which also passed.
   - It ran before the final formatting-only edit to `fixture-run.test.ts`; item 3's rerun covers that edit.
5. `pnpm --filter fluxiq check` → `EXIT=0`. The build cache printed
   `{"build-cache":"reuse","step":"fluxiq:check","reason":"inputs and outputs match the stamp",...}`, so tsc did not
   actually run. I therefore also ran item 6.
6. From `packages/fluxiq`, uncached: `pnpm exec tsc --noEmit` → `EXIT=0` with no output. The tsconfig includes
   `src/**/*.ts`, which covers the tests.
7. `node scripts/structure-audit.mjs`:
   - first run: `EXIT=1`, `FAIL [statement-packing] .../environment/tests/fixture-run.test.ts ... line 58`;
   - I split that line, then reran: `EXIT=0`, `structure-audit: passed (407 warning(s), 1152 baselined).`

## Not verified

- **Downstream, browser and Lab**: none of this was run. No scope is entered in production, so live behaviour is
  unchanged by construction. This was not exercised live.
- **The durable path inside a scope on a scoped session**: only refusals are tested. The success path for a scoped
  session was not tested.
- **Gateway events from scoped sessions** (U2b #8, `inbound.ts`, outside this brief) are still emitted to global
  listeners:
  - The bridge now ignores them.
  - `ClientGatewayRuntimeTransport.forwardGatewayEvent` would still forward a scoped session's `state_update`,
    `snapshot`, `recording_event`, `error` and `session.disconnected` as runtime events.
  - `ClientGatewayActivityPublisher` would push `server.activity` to a scoped session that declared the activity
    capability.
  - `startRecording`, `stopRecording`, `sendPing`, `sendError`, `markActiveRecording` and `reconcileAction` have no
    scope admission. The brief named only `executeAction`, `executeDurable` and `captureSnapshot`.
- **The commit-time check**: the brief's vitest set and the uncached tsc ran on the final source (the formatting-only
  test edit aside). I did not rerun the build-cached `pnpm --filter fluxiq check` after that edit; tsc covers it.

## Remaining call sites from U2b's table, untouched

- **#8**: `client-gateway/service/inbound.ts:78-112`. Events from scoped sessions are not tagged or suppressed for
  global listeners (see Not verified).
- **#10**: `AS/service/runtime-session/graph-options.ts:26-58`. There is no `environment` input; the test sets
  `options.now`, `delay` and `random` by hand.
- **#11**: `AS/service.ts:1585-1586` (trial `trialEnvironment`) and `AS/service.ts:2501` (normal run). The live
  environment is not passed yet.
- **#12**: `AS/service/candidate-trial/contracts.ts:100-136`. Not changed.
- **#13**: `AS/service/candidate-trial/run.ts:92`, `100`, `111-117`. Not changed.
- **#14**: `AS/service/subflow-trial/types.ts:36-60`. Not changed.
- **#15**: `AS/service/subflow-trial/run.ts:118`, `139`, `147-163` (L1). Not changed.
- **#16**: `AS/flow-bootstrap/candidate/trial-gate.ts:412-415` (L1). The reset skip for `kind !== "live"` is not
  done.
- **#17**: `AS/service/project-build/brief-ports.ts:220-252` and `whole-trials.ts` (L1). Not changed.
- **#18**: `AS/flow-bootstrap/candidate/authoring-loop.ts` and `candidate/contracts.ts` (L1; P6). Not changed.

## Open questions or contradictions found

1. **Two facade methods, not one.** The brief allowed one facade method, to attach a scoped session. I also added
   `isScopedSession(sessionId)`, for three reasons:
   - the bridge has to recognise a scoped session's events and results;
   - the public `ClientGatewaySession` has no field for it, and `packages/contracts` is outside this brief;
   - the async context is not reliable for this, because a fixture socket calls `receive` from inside the scope.
   Both methods change the facade contract. Please clear them, or name the alternative you want, such as a scope
   field on the public session in contracts.
2. **Refusal codes live in Core's kernel.** They are in `client-gateway/service/channel-scope/codes.ts`, not in
   `@fluxiq/contracts/client-gateway`, where the host-lease codes live, because contracts was outside this brief.
   Moving them there would match the precedent.
3. **The fixture's unmatched-call failure** uses category `blocked_by_capability_or_policy` and code
   `fixture.unmatched_call`. U5 owns the evidence-gap code; the P4 trace matcher should use U5's code instead.
4. **`newRunId(prefix)` versus the trial ports.** The trial ports' `newRunId` is `() => string`, with no prefix.
   Wiring #12 and #13 needs an adapter, for example `() => environment.newRunId("trial")`, which reproduces today's
   `trial.<uuid>` fallback.
5. **Headroom warnings.**
   - `bridge.ts` is now 793 lines, 7 short of the 800-line hard limit, so the next addition there must split it.
   - `ClientGatewayService` has 34 methods; the advisory threshold is 25 and the hard limit 40.
6. **Not my changes.** `client-gateway/index.ts` and `client-gateway/trace/` show as modified or untracked in the
   worktree. They belong to the other worker.
