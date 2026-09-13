# g-core-dispatch-deadline — Core hears a client's own timeout before giving up on it

Worker: `g-core-dispatch-deadline`. Core read at `F:\!FluxIQ` `604d0d3` (clean,
`dev`); this repository at `cfa1bfb`. No file was changed in either repository.

## Outcome

**Blocked.** As briefed, the fix would be inert on the path W25 actually takes,
so I did not ship it. Every gate would pass, and W25 `too-slow` would still report
`output_dispatch.timed_out`.

`i-w25-timeout-code` traced Core's generic `ClientGatewayRuntimeTransport` path.
A Flow action from this domain never takes that path. It goes through the web
domain's own **direct runtime adapter**, which:
- is bounded by the runtime's *adapter* deadline, not the transport one;
- sends the client **no `timeoutMs` at all**.

So the extension waits its own 10,000 ms default, not the node's 5,000 ms. Even a
correct margin on both Core timers would still fire first.

These are code-read findings from one trace. No test, Lab run or bundle
confirmed them (see Not verified).

## What changed and why

Nothing. The binding rule on inert changes (wave-3 rules, lines 60-64) says to
report instead of shipping a change nothing invokes. This section is the
evidence, then a proposed redesign for the supervisor.

### 1. The path a Flow action really takes (web-automation domain registered)

1. **Core builds the command with the node's timeout.**
   `createRuntimePolicyEffectDispatcher` calls `runtime.dispatch` with
   `outputId`, `actionType: outputId` and `timeoutMs: payload.timeoutMs`, 5,000 by
   default (Core `programs/automation-studio/runtime/io-policy.ts:88-95`,
   `nodes/policy/action.ts:40`). `policyActionFromPayload` does not copy
   `timeoutMs` into `parameters` (`io-policy.ts:306-315`).
2. **The runtime picks the web adapter, never the gateway transport.**
   - `selectTarget` tries adapters first (Core `runtime/service.ts:250-259`).
   - The domain registers `web-automation.gateway` as a `transport: "direct"`
     adapter. That happens in `registerWebAutomationRuntime`
     (`domain/src/runtime/service.ts:7-19`), called from `domain/src/host.ts:17`
     and `domain/src/web-panel-host.ts:96`.
   - Its capability `web.actions` is `kind: "action"`, domain `web-automation`,
     with `outputIds: WEB_AUTOMATION_ACTION_TYPES`
     (`domain/src/runtime/capabilities.ts:13-21`), so it matches.
   - The transport could not match anyway. `capabilityMatchesCommand` returns
     false when a command has an `outputId` and the capability lists no
     `outputIds` (`runtime/service.ts:334,337`), and
     `runtimeCapabilityFromGatewayCapability` never copies `outputIds`
     (`runtime/client-gateway-transport.ts:145-158`).
3. **Core timer one is the runtime bound, for an *adapter* target.**
   `withRuntimeBounds` arms `command.timeoutMs` (5,000 ms) before
   `adapter.execute` runs (`runtime/service.ts:270-274,361-371`). This is the
   timer that fired at 5,004-5,011 ms in `l-stage2c` run 3.
4. **The adapter drops the timeout.** `executeWebAutomationRuntimeCommand` builds
   `{ domainId, outputId, payload: command.parameters, metadata }`
   (`domain/src/runtime/adapter.ts:76-84`). `OutputDispatchRequest` has no timeout
   field (Core `io/index.ts:24-29`). `dispatchWebAutomationOutput` then sends
   `{ actionType, parameters, target }` to
   `automationStudioClientGateway.executeAction`
   (`domain/src/io/gateway-output-dispatcher.ts:14-22`).
5. **Core timer two, the gateway's pending command, is therefore 30,000 ms.**
   `command.timeoutMs ?? this.config.commandTimeoutMs`
   (`client-gateway/service/commands.ts:65`), whose default is 30,000
   (`service/config.ts:21`). On this path it never decides anything, because the
   runtime bound fires first.
6. **The extension waits 10,000 ms.** `timeoutMs` is read as
   `command.timeoutMs ?? parameters.timeoutMs` (`domain/src/client/gateway-mapping.ts:175`),
   and both are absent. The proposed wait's parameters are
   `{ selector, wait: { condition: "present" } }` (`late-target-wait.ts:90`), and
   `waitRequestValue` lifts no timeout. `wait-for-selector.ts:26` then passes
   `action.timeoutMs` (undefined) to `wait-conditions.ts:44`, which uses
   `DEFAULT_WAIT_TIMEOUT_MS = 10_000` (`waits.ts:17`).

**Result.**
- **The extension's own timeout record** would leave it about 11,000 ms after
  Core armed its bound: the tab settle of 1,000-1,250 ms
  (`automation-tab.ts:107,137`), then 10,000 ms of waiting, then transit.
- **As briefed,** the transport-only margin and the gateway timer that applies
  only when a timeout is sent never engage.
- **With a 3,000 ms margin on every target,** Core would give up at 8,000 ms, still
  about 3 s before the extension answers.

### 2. What the brief's premises get wrong

- **"Core … sends the same value to the extension as the action's own timeout."**
  On this path Core sends nothing. The extension's timeout is its 10,000 ms
  default.
- **"The client is still sent the node's `timeoutMs`, unchanged."** It is not sent
  today. Making that true needs a downstream change the brief does not own (see
  §3 B).
- **`i-w25-timeout-code` steps 6-8 and its first Open question** follow
  `client-gateway-transport.ts:172`, which this domain's Flow actions never reach.
  Its measured timings and its conclusion that Core fires first still hold.
- **Two of the three downstream comments are correct at HEAD.**
  `delayed-ui/scenario.ts:16-19` and `late-target-wait.ts:15` say the content
  script's 10,000 ms default applies, and on the Flow lane it does. Rewriting them
  to "5,000 ms" would make them wrong. They become wrong only once §3 B lands, so
  they belong in the same unit as B.
- **The third comment is wrong at HEAD, but its wording depends on the redesign.**
  `action-runner.ts:197-198` says "Nothing upstream puts a deadline on a web
  action", yet Core's runtime bound (the node's `timeoutMs`, 5,000 ms by default)
  already bounds every Flow action. I left it, so all three comments can be
  written once against the final design.

### 3. Proposed redesign (the supervisor decides; ownership needed in brackets)

All three pieces are needed together for W25 `too-slow` to report `web.action.timeout`.

- **A. The runtime bound covers the target's own timeout plus the margin, for a
  target that forwards to a remote client.**
  [Core `runtime/service.ts`, and possibly `runtime/contracts.ts`]
  The runtime cannot tell that a `direct` adapter forwards to a remote client.
  There are two options:
  - **A1: apply the margin to every target.** This is the simplest. An in-process
    adapter that hangs is abandoned `margin` ms later, and
    `runtime/tests/service.test.ts:194-213` waits `1 + margin` ms unless it moves
    to fake timers.
  - **A2: an adapter declares it.** Add an optional `FluxIQRuntimeAdapter` field,
    for example `remoteClient: true` or `deadlineMarginMs`, set by the web adapter.
    That adds `runtime/contracts.ts` and `domain/src/runtime/adapter.ts`. The
    transport target always gets the margin.
- **B. The web adapter sends the command's `timeoutMs` to the client.**
  [`domain/src/runtime/adapter.ts`, `domain/src/io/gateway-output-dispatcher.ts`; possibly Core `io/index.ts`]
  - **How.** `OutputDispatchRequest` carries no timeout. Either give the domain
    dispatcher an extra argument, or add an optional `timeoutMs` to Core's
    `OutputDispatchRequest`, which is additive.
  - **Effect.** The gateway command then carries `timeoutMs: 5000`.
    `gateway-mapping.ts:175` already adopts it, so the extension gives up after
    about 1,000-1,250 ms of settling plus 5,000 ms.
  - **Alternative.** Without B, the margin must exceed 10,000 ms plus the settle.
    A silent client would then take 18 s or more to time out, which I do not
    recommend.
- **C. The gateway timer waits `timeoutMs + margin` when a timeout is sent,**
  exactly as briefed. [Core `client-gateway/service/commands.ts`] It engages once
  B sends one.
- **D. The margin: 3,000 ms, as one named constant.**
  - **Placement.** One module, for example
    `client-gateway/service/client-deadline-margin.ts`, plus a line in that
    directory's barrel, which the brief does not list. `runtime/` already imports
    `../client-gateway/index.ts`, and client-gateway does not import runtime, so
    the dependency direction holds.
  - **Settle bound.** `waitForTabReady` resolves when the tab is `complete` and its
    URL has not changed for 1,000 ms. It checks at once and then every 250 ms
    (`automation-tab.ts:107,124,137`), so on a tab that is not navigating it ends
    1,000-1,250 ms after starting, plus `chrome.tabs.get` latency. It measured
    1,007-1,011 ms end to end in 3 of 3 unarmed runs.
  - **Why 3,000 ms.** That covers the settle bound more than twice, plus transport
    both ways and attaching the tab for recording (`action-runner.ts:76-77`).
  - **What no fixed margin covers.** The settle's 20,000 ms cap for a tab that
    keeps navigating (`automation-tab.ts:108`). Such a client is correctly reported
    as not answering unless the extension counts its settle against its own budget.
    That is a separate downstream follow-up, not needed for W25.
- **E. Timing after A+B+C with a 3,000 ms margin.**
  - **Client that times out:** it answers about 6,050-6,300 ms after Core arms,
    and Core's deadline is 8,000 ms, so the answer arrives about 1.7 s early.
  - **Silent client:** `output_dispatch.timed_out` at 8,000 ms.
    `io-policy.ts:136,141-142` is unchanged.
- **F. Tests the redispatch needs,** each with a mutation that restores the old
  deadline.
  - **Core rows,** through `RuntimeService` with an adapter that answers
    `timed_out` plus a `web.action.timeout` record just after `timeoutMs`, and the
    same through the gateway transport: the record is kept.
  - **Silent client:** `timed_out` with no record, and not before
    `timeoutMs + margin`.
  - **Downstream row** in `domain/src/runtime/tests/` or `domain/src/io/tests/`:
    the gateway command carries the runtime command's `timeoutMs`. Today no domain
    test in those folders mentions `timeoutMs` or `executeAction`.
  - **Composing with the policy layer.** The Core policy mapping already has pins:
    a valid host record wins (`io-policy.test.ts:39-45`) and `timed_out` without
    one becomes `output_dispatch.timed_out` (`:21-31`). A full-chain row through
    `createRuntimePolicyEffectDispatcher` would live in
    `programs/automation-studio/runtime/tests/`, which the brief also does not own.

**Compatibility effect of the redesign, for the 0.4.0 entry.**
- **Always visible.** A command with a timeout is abandoned `margin` ms later
  than before, for a transport target and, under A1, for every adapter.
- **Unchanged.** A gateway command without a timeout keeps the 30,000 ms default.
- **What hosts see.** No type is removed. A2 or the `OutputDispatchRequest` field
  is additive. A host that gates on a command's exact timeout duration sees it
  move.

## Commands run and observed results

- **Core state:**
  `git -C F:\!FluxIQ status --short; git -C F:\!FluxIQ log --oneline -3; git -C F:\!FluxIQ branch --show-current`
  - no status lines;
  - log `604d0d3`, `6621d66`, `949fbb4`;
  - branch `dev`.
- **Final check of both trees:**
  `git -C F:\!FluxIQ status --short` (no lines), `rev-parse` `604d0d3`;
  `git -C F:\!FluxIQWebExtension status --short -- <the three comment paths>`
  (no lines), `rev-parse` `cfa1bfb`.
- **Everything else was a file read or search.** No vitest, `pnpm check`, docs
  check or structure audit ran, because nothing was changed for them to check.

## Not verified

- **The path is traced from code, once.** I did not observe which target a live
  W25 wait attempt selected. A Lab bundle's Core workspace
  `command-attempts/<id>/attempt.json` for the wait would show
  `adapterId: "web-automation.gateway"` and `transport: "direct"` if this trace is
  right. I did not read it: it is outside the brief, and a run directory holds
  recorded page data.
- **The extension's 10,000 ms wait on the Flow lane was not observed.** The bundle
  has no client-side timing, as `i-w25-timeout-code` noted.
- **No test was written or run,** and no mutation was performed.
- **What a Lab run must show once A+B+C land:** W25
  `delayed-ui --flow --variant too-slow` reports
  `{"category":"timeout","code":"web.action.timeout"}` in 3 of 3, with a wait
  duration of about 6.1-6.4 s rather than 5.0 s. W25 unarmed stays passed in 3 of 3.

## Open questions or contradictions found

- **Which option for the runtime bound, A1 or A2?** A1 changes every host's adapter
  deadline. A2 needs `runtime/contracts.ts` and the domain adapter.
- **Should B go through Core's `OutputDispatchRequest`** (additive, Core
  `io/index.ts`), or through the domain dispatcher alone? The IO fallback path,
  `dispatchPolicyOutput` (`io-policy.ts:21-40`), sends no timeout either, so the
  Core field would fix both paths.
- **Some findings need correcting in the working record.**
  `i-w25-timeout-code` §1 steps 6-8, §3 "Where, all in Core", and its first Open
  question rest on the transport path. `delayed-ui/scenario.ts:16-19` and
  `late-target-wait.ts:15` are accurate today.
- **The brief's ownership does not include files the working fix needs:**
  `domain/src/runtime/adapter.ts`, `domain/src/io/gateway-output-dispatcher.ts`,
  the `client-gateway/service/index.ts` barrel, and possibly Core
  `runtime/contracts.ts` and `io/index.ts`.
- **The brief is internally inconsistent about the Lab.** It says a Lab campaign is
  running under `F:\fxlab\`, but the dispatch message says none is. I ran no Lab
  command either way.
