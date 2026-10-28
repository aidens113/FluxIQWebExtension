# t769 / B12: production installs the offline-trial host

## Outcome

Done. When client gateway tracing is on, the production runtime now installs
`AutomationStudioOfflineTrialInstallation` with three things: the runtime's
client gateway, the trace host's own `storeFor`, and a `sessionViewFor` that
picks the project's one live action session and maps it the same way a
recorded `session.claimed` is mapped. No reevaluator is installed (tier 1).
With tracing off nothing is installed, and `FLUXIQ_OFFLINE_TRIALS=0` makes
`current()` return undefined (B9's switch). All tests were written first and
seen failing.

UNIT READY: packages/fluxiq/src/programs/_shared/runtime.ts,
packages/fluxiq/src/programs/_shared/tests/offline-trial-installation.test.ts,
AS runtime/gateway-trace/wiring/{host.ts, types.ts, index.ts, offline-trial-session-view.ts},
AS runtime/gateway-trace/wiring/tests/{host.test.ts, offline-trial-session-view.test.ts}

## What changed and why

- `wiring/types.ts`: `AutomationStudioGatewayTraceHost` gains `storeFor` (the
  store the episodes write through; undefined when tracing is off) and
  `installOfflineTrials(gateway)`. It also gains two new types:
  `AutomationStudioGatewayTraceSessionGateway`
  (`Pick<ClientGatewayService, "snapshot" | "isScopedSession">`) and
  `AutomationStudioGatewayTraceOfflineTrialGateway` (B9's
  `AutomationStudioOfflineTrialGateway` combined with that session gateway).
- `wiring/host.ts`:
  - `storeFor` is now exposed on the host.
  - `installOfflineTrials` installs `{ gateway, storeFor, sessionViewFor }`. A
    second call replaces the earlier installation.
  - The host's existing `uninstall()` now removes the offline trials as well as
    the episodes, so one shutdown call removes both ("uninstall like the trace
    host").
  - When tracing is off, `installOfflineTrials` does nothing.
  - The installation is imported from `service/offline-first/installation.ts`
    directly, not from its barrel. The barrel leads back to `wiring/` through
    the candidate and subflow trial runners and would create an import cycle.
- `wiring/offline-trial-session-view.ts` (new, one export):
  `automationStudioOfflineTrialSessionView(gateway, projectId)`.
  - A session qualifies when all of these hold:
    - its status is `ready` and it has no `disconnectedAt`;
    - `projectId` equals the build's project;
    - it has at least one capability of kind `action`;
    - `!gateway.isScopedSession(sessionId)`.
  - If exactly one session qualifies, it returns
    `readClientGatewayTraceHello(clientGatewayTraceSessionView(session))`.
  - If none or several qualify, it returns undefined.
  - It is exported from `wiring/index.ts`. The wiring directory now has 17
    entries.
- `_shared/runtime.ts`: one call, `gatewayTrace.installOfflineTrials(clientGateway);`,
  placed right after the client gateway is built.
- `clientGatewayTraceSessionView` is not exported from `client-gateway/index.ts`.
  It is imported from its sub-barrel `client-gateway/service/trace-tap/index.ts`,
  the same way the bridge imports from `client-gateway/service/command-ledger/`.
  No trace-replay barrel edit was needed, because `readClientGatewayTraceHello`
  is already public.

## Commands run and observed results

2026-10-27, from `packages/fluxiq` unless noted.

1. Red, before implementing:
   `pnpm test .../wiring/tests/host.test.ts .../wiring/tests/offline-trial-session-view.test.ts src/programs/_shared/tests/offline-trial-installation.test.ts`
   - Output: `Test Files 3 failed (3)`, `Tests 1 failed | 2 passed (3)`.
   - The two wiring files failed to load (the module did not exist yet).
   - In the runtime test, "installs offline-first trials ... when tracing is on"
     failed.
2. After the first implementation, the same command gave `Tests 4 failed | 10 passed (14)`
   with `TypeError: clientGatewayTraceSessionView is not a function`. The
   function was not on the public client-gateway barrel. I fixed this with the
   sub-barrel import described above.
3. The same three files: `Test Files 3 passed (3)`, `Tests 14 passed (14)`,
   `[vitest-groups] all groups passed: parallel, real-sql`.
4. `pnpm test src/programs/automation-studio/runtime/gateway-trace/wiring/tests src/programs/_shared/tests`
   - Output: parallel `Test Files 10 passed (10)`, `Tests 46 passed (46)`;
     real-sql `Test Files 7 passed (7)`, `Tests 25 passed (25)`;
     `[vitest-groups] all groups passed: parallel, real-sql`.
   - I ran this both before and after the audit fix in step 6. The result was
     the same both times.
5. `node --max-old-space-size=4096 node_modules/typescript/bin/tsc --noEmit -p .`
   - Exit 2. No errors in my files. All the errors are in files owned by other
     workers or tasks:
     - 13 in `src/programs/automation-studio/runtime/service/project-build/subflow-trials.ts` (B10);
     - 1 in `src/ui/activity-status/tests/truthful-test-labels.test.ts`
       (`"not_shown"` not assignable).
   - A first run also showed `automationStudioActivityRecordedCheck` missing in
     `activity/step/tests/recorded-check.test.ts` and
     `llm/step-log/tests/offline-trial-step.test.ts`. That error was gone on the
     rerun, so it came from concurrent work.
6. Core root: `node scripts/structure-audit.mjs | grep -E "FAIL|structure-audit:"`
   - First run: 3 violations. Two were mine, both in the runtime test: an
     `as never` cast and a packed statement line. I fixed both.
   - Final run:
     `FAIL [as-never] packages/fluxiq/src/programs/automation-studio/runtime/project-agents/dispatch/tests/trial-port-check-rows.test.ts ... line 81`,
     then `structure-audit: 1 violation(s) across 1 rule(s).` This one is in
     project-agents (B11), not mine.

## What the tests prove

- `offline-trial-session-view.test.ts`:
  - **Real path:** a real `ClientGatewayService` traced through the real trace
    host, with a client paired to the project, runs one action inside a `test`
    episode. The trace is read back from `host.storeFor(project)` through
    `readClientGatewayTraceSessions`. This yields exactly one `claimedView`, and
    `automationStudioOfflineTrialSessionView(gateway, project)` equals it, with
    no `clientId` and no `token`.
  - **Filtering:** these stubbed sessions are ignored: another project, an
    unbound project (`null`), no action capability, pairing_required,
    connected-but-unpaired, disconnected, and scoped.
  - **Counts:** zero matching sessions gives undefined; two gives undefined; a
    lone scoped session gives undefined.
- `host.test.ts`:
  - With tracing on, `current()` is set, with `gateway` being the port passed in
    and `storeFor === host.storeFor` (the same store instance per project).
  - `sessionViewFor` matches the selection module, and there is no reevaluator.
  - `uninstall()` clears both the offline-trial installation and the episodes.
  - The newest runtime serves: an abandoned host's `uninstall` leaves the
    serving host's installation in place.
  - With tracing off, nothing is installed.
  - With `FLUXIQ_OFFLINE_TRIALS=0`, `current()` is undefined even though a
    host is installed.
- `_shared/tests/offline-trial-installation.test.ts`, through
  `createGlobalProgramRuntime`:
  - Tracing off: nothing is installed.
  - `FLUXIQ_CLIENT_GATEWAY_TRACE=1`: `current().gateway === runtime.clientGateway`,
    there is no reevaluator, and `sessionViewFor` is undefined with no session
    connected.
  - Tracing on with `FLUXIQ_OFFLINE_TRIALS=0`: undefined.

## Not verified

- No live, Lab or browser run. Nothing shows a real build calling
  `current()` and using `sessionViewFor`. That depends on B10 attaching the
  factory.
- Shutdown in production is not wired: nothing calls the trace host's
  `uninstall()`, before or after this change. `framework/index.ts` `close()`
  closes the gateway and the service but never uninstalls, and `runtime.ts`
  does not keep the host. Because the newest installation wins, a reload still
  serves the right runtime. A real shutdown uninstall would need either
  `GlobalProgramRuntime` to expose the host or `framework/index.ts` to call it.
  Neither file is in my scope.
- I compared views with `toEqual`. A capability field set to `undefined` would
  be present on the live view but dropped after the recorded JSON round trip,
  and `toEqual` treats those as equal. In practice, gateway sessions come from
  parsed JSON hellos, so this should not occur.

## Open questions or contradictions found

- **Matching the project.** The session's `projectId` must equal the build's
  project exactly. A live extension session paired without a project
  (`projectId` null or unset) does not qualify, so the fallback gives undefined
  and the trial runs live. I have not checked whether the Lab's extension
  session carries the project id. If it does not, this fallback never fires,
  though P3's recorded `session.claimed` makes it rarely needed. The activity
  publisher treats a null project as "all projects"; that is a possible looser
  rule.
- **"Connected".** I read this as status `ready` (paired and connected). A
  `connected` or `pairing_required` session cannot take commands (see
  `sessions.ts:58` `requireReady`).
- **"Action capability".** I read this as capability kind `action` only.
  `runtime/service.ts:354` also lets `runtime` or `custom` capabilities execute
  actions.
- **Where the install lives.** The brief put the installation inline in
  `runtime.ts`. I put it behind a trace-host method so that the host's one
  `uninstall` removes it. `runtime.ts` still installs it, at the place the brief
  named.
