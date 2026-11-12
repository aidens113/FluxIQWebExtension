# t907 Managed Browser Host: Design

Lane t907, Core plan P5 (`!FluxIQ/docs/working/fluxnode-plan.md`, K6/K8 "Managed browsers", N10).
Worker design report, 2026-11-11. Design only: no source file was edited.

## What exists today (read, with paths)

- **`fluxiq dev`.** The SDK's `packages/sdk/src/cli/dev-command.ts` spawns the engine's own bin (`packages/fluxiq/src/server/cli/main.ts` -> `run-command.ts` -> `run-dev.ts`). `runDev` opens the instance with `FLUXIQ_HOST_MODULE`, starts `startHeadlessServer` (gateway at `ws://127.0.0.1:<gw>/client`, API on `127.0.0.1`), and serves the FluxNode API through the `createFluxNodes` seam. SIGINT and SIGTERM call `dev.stop()`. On Windows a parent cannot deliver either one gracefully: `child.kill()` is TerminateProcess.
- **Gateway trust.** In `client-gateway/service/lifecycle.ts`, `handleHello` resumes on `hello.token` (`resumeTrustedSession`) or falls back to `pairing_required`. Trust is created only by `pairing-flow.ts` `complete()` after `approvePairing` by an operator, using `trustedClients.register` (`trusted-clients.ts`), `custody.issued`, and `server.session_ready {token}`. Headless has no cookie sessions, so nobody can approve. The loopback gateway admits every Origin (`server/client-gateway-websocket/origin-policy.ts`).
- **Extension connect.** `apps/extension/src/background/index.ts` takes `fluxiq.connect` only from a control page (`control-page.ts`: `sidepanel/index.html` or `popup/index.html`). It persists the settings, calls `manager.connect()`, and stores the token in the session record (`connection/gateway-session.ts` `sessionTokenStorage`, `chrome.storage.local` at `TRUSTED_CONTEXTS`). Hellos are sent by Core's `packages/client-gateway-websocket/src/transport.ts`, which spreads `options.client` plus the stored token.
- **The Lab** launches Chromium with `launchPersistentContext` and `--load-extension` (`test-runner/.../launch-browser.ts`). It sends `fluxiq.connect` from a control page and approves the pairing through a signed-in web panel (`live/attempt/session.ts`, `run-lifecycle/pair-extension.ts`). It finds a browser by `--user-data-dir` (`run-scenario/window-capture/find-browser-process.ts`).
- **One browser per engine (blocking for N hosts).** The web domain picks "exactly one eligible session" everywhere:
  - `domain/src/runtime/web-sessions/pick-web-session.ts`;
  - `llm-evidence/capture.ts` `selectSession` throws on two;
  - `host-resources/port.ts` has capacity 1 and answers `at_capacity` when it sees two browsers.

  Core's `AutomationStudioHostLeaseScope` (`runtime/project-agents/host-resources/lease-scope.ts`, exported from `fluxiq/automation`) already holds a lease, including its `sessionId`, in an AsyncLocalStorage frame. The gateway stamps that lease on each command, and the extension's ledger judges commands by epoch for each resource (no key prefix). Answer-first attempts take no lease: `service.ts:1570` branches to answer-first before the project-build path, which leases.
- **FluxNode runs** (`fluxnode/create-fluxnode-service.ts`, `run-fluxnode.ts`) call `generateFlowBootstrapAdaptation(answer-first)` with model caller `fluxnode.owner`/`fluxnode.open-mode`. They all live in one owner project, "FluxNodes" (`owner-flows.ts`).

## A. Enrolment

**Decision: an in-process, one-time ticket, redeemed in the hello. No HTTP endpoint.** Only code inside the engine process can mint a ticket, because no route exposes minting. The engine loads the launcher module into its own process and hands the launcher a `takeEnrolmentTicket()` function. A ticket never exists in a URL, argv, env, a file or a log.

**Core additions**
1. `packages/contracts/src/client-gateway.ts` (additive; contracts minor bump):
   - `ClientGatewayClientHello.enrolmentTicket?: string`;
   - `ClientGatewaySession.managedHostId?: string`;
   - `ClientGatewayTrustedClient.managedHost?: { hostId: string; profile: "fresh" | "named" }`.
2. `packages/client-gateway-websocket/src/types.ts` and `transport.ts` (minor bump): a new option `enrolment?: { take(): string | undefined }`. The hello carries `enrolmentTicket: take()` only when the connection has no token. `take()` is called at most once for each hello, so a reconnect never resends a ticket.
3. New `packages/fluxiq/src/client-gateway/service/enrolment/`:
   - `host-enrolment-tickets.ts`, class `ClientGatewayHostEnrolmentTickets`:
     - `issue({hostId, domainId, profile, ttlMs = 60_000})` returns `{ticket, expiresAt}`. The ticket is `fxet_` plus 32 random bytes in base64url, and only its SHA-256 is kept. Issuing revokes any earlier live ticket for the same `hostId`, so each host has one live ticket.
     - `redeem(ticket)` returns the binding or a refusal. A ticket is consumed when first presented, whatever the outcome.
     - `revokeForHost(hostId)`.
   - `enrolment-refusal.ts`: codes `enrolment.unknown`, `enrolment.expired`, `enrolment.used`, `enrolment.domain_mismatch`.
   - `index.ts`, plus `tests/`.
4. New `client-gateway/service/trust-grant.ts`. It holds the trust-granting tail of `pairing-flow.ts` `complete()`: register the trust, check the session is still the one waiting, `custody.issued`, `sentCredentialHash`, `server.session_ready`, the audit entry and `session.ready`. `pairing-flow.ts` and enrolment both call it, so there is one code path, not a copy.
5. `lifecycle.ts` `handleHello`, before the token branch: when `hello.enrolmentTicket` is present, redeem it.
   - **Success.** The binding's domain must equal `declaredDomainId(metadata)`. The trust is granted with `approvedByUserId: FLUXIQ_MANAGED_HOST_PRINCIPAL` (`"fluxnode.owner"`, the principal open-mode FluxNode runs act as) and `managedHost` set.
   - **Failure.** Audit `enrolment.refused` (code only), send `server.error {code}`, then disconnect. There is **no fallback to pairing**: a managed host never pairs.
   - `connect()`'s trace redaction list gains `["hello","enrolmentTicket"]`.
6. `trusted-clients.ts`: `register` accepts `managedHost?`, which is persisted. `sessions.ts`: `attachTrustedClient` copies `managedHostId`, and `toPublic` exposes it.
7. `trace-tap/credential-fields.ts`: the `client.hello` field list gains `["payload","enrolmentTicket"]`.
8. `client-gateway/service.ts` (the gateway facade; not automation-service's `service.ts`) gains:
   - `issueHostEnrolment(input)`;
   - `revokeManagedHost(hostId, reason)`, which revokes the trust and any ticket;
   - `revokeStaleManagedHosts()`, run at start, which revokes every active trust whose `managedHost.profile === "fresh"`.

**Extension (redeeming during connect)**
- `background/index.ts`: the `fluxiq.connect` message may carry `enrolment: { ticket }`. The ticket is never written to settings or storage. It passes to `manager.connect({ enrolmentTicket })`.
- `background/connection.ts`: `connect(options)` holds the ticket in memory.
- `background/connection/gateway-session.ts`: passes `enrolment: { take }`, where `take()` returns the held ticket once and clears it. `server.session_ready` stores the token exactly as pairing does. `server.error enrolment.*` sets status `error` with the code and does not start pairing.
- `shared/protocol.ts`: the connect message type.
- The connect message stays control-page-only.
- The hello keeps `clientType: "extension"` (see Open Questions, item 2).

**Who may call:** in-process callers only (`start-managed-hosts.ts` and tests). There is no program endpoint, so neither the SDK, a web page nor a local program can mint a ticket.

**How the ticket reaches the extension:** the launcher calls `takeEnrolmentTicket()` only after the extension worker is up. It runs `page.evaluate(chrome.runtime.sendMessage({type:"fluxiq.connect", settings, enrolment:{ticket}}))` on `chrome-extension://<id>/sidepanel/index.html`, over Playwright's `--remote-debugging-pipe`. That pipe uses inherited anonymous handles with no TCP port.

**Threats and mitigations**
- **Replay.** A ticket is single-use: consumed on first presentation, success or not. It lasts 60 s and only one is live per host. It is bound to `hostId` and domain. The trust it mints is bound to the session's `clientId`, and the existing rotation and reuse detection (`refuseReuse`) covers the token afterwards.
- **Theft by a page.**
  - Pages cannot reach extension pages or the worker's memory, and `fluxiq.connect` is control-page-only.
  - The ticket lives only in background memory until the hello.
  - The token goes to `TRUSTED_CONTEXTS` storage.
  - A page that opens its own socket to the gateway still needs the ticket.
- **Other local users.**
  - The ticket is not in argv, env, files or URLs, and there is no CDP port: the pipe handles are inherited only by Chromium.
  - Fresh profiles are made under the user's own temp directory with `mkdtemp` (per-user ACL on Windows). Named profiles go under the engine's data directory.
  - The gateway is loopback-only, and a racing redeemer needs the ticket.
- **Logging.**
  - Nothing prints the ticket. Audit entries carry `hostId` and the code only, and trace taps redact the field.
  - `fxet_` plus a 43-character body matches the existing redaction of opaque strings of 32 or more characters.
  - The extension's problem log keeps its token withholding, and the ticket never enters status.
  - Playwright protocol logging (`DEBUG` naming `pw:protocol`, `pw:*` or `*`) would print `evaluate` arguments, so browser-host refuses to enrol with `browser_host.protocol_logging_on` while it is set.
- **Crash or abandon.** An unredeemed ticket expires. Fresh-profile trust is revoked on close and again at the next engine start.

**Must-not-touch check:** none of the files above is in the Core or extension must-not-touch lists.

## B. `packages/browser-host` (EXT, new, product)

- **Dependencies.** `playwright-core` pinned to the workspace's Playwright, which is 1.51.1. A type-only import from `fluxiq/server` (the launcher types). Node built-ins. Never `test-runner`: `scripts/structure-audit/config.mjs` gains a rule that `packages/browser-host` must not import `packages/test-runner`.
- **Files.**
  - `src/index.ts` (barrel)
  - `src/launcher.ts`: the default export `createBrowserHostLauncher(options): FluxIQHostLauncher`, which is what `fluxiq dev` loads
  - `src/launch-host.ts`
  - `src/launch-hosts.ts`
  - `src/profile/{fresh-profile,named-profile,index}.ts`
  - `src/enrol/{control-page,enrol-extension,index}.ts`
  - `src/reaper/{reaper-main,reaper-client,find-profile-processes,kill-process-tree,index}.ts`
  - `src/guards/protocol-logging.ts`
  - each directory's `tests/`
- **API.**

```ts
type BrowserHostOptions = { extensionPath: string; headless?: boolean /* default false: visible */; browserArgs?: string[];
  executablePath?: string; onContext?: (context: BrowserContext) => Promise<void> /* before any page */; };
launchHost(request: FluxIQHostLaunchRequest, options: BrowserHostOptions): Promise<FluxIQLaunchedHost>;
launchHosts(requests: FluxIQHostLaunchRequest[], options): Promise<FluxIQLaunchedHost[]>; // parallel; one fails => the others close, error names the host
```

- **`launchHost` steps.**
  1. Guard protocol logging.
  2. Make the profile:
     - fresh: `mkdtemp(os.tmpdir()/fluxiq-host-<hostId>-)`, removed on close;
     - named: `<dataDir>/browser-hosts/<name>/<hostId>`, kept. Chromium locks a profile, so each host gets its own.
  3. Register the profile directory with the reaper.
  4. `chromium.launchPersistentContext(profile, {headless, args: ["--disable-extensions-except=…","--load-extension=…","--no-first-run","--disable-default-apps",...browserArgs], env: provider secrets removed})`.
  5. Call `onContext`.
  6. Wait for the extension's service worker.
  7. Open the control page.
  8. A named profile first tries `fluxiq.connect` without a ticket, since its stored token resumes. Otherwise, or if the status is not `connected` within the connect wait, take a ticket and connect with it.
  9. Poll `fluxiq.getStatus` until `connected` (a `sessionId` is present).
  10. Close the control tab.

  A connect that fails before redemption (transport, a socket dropped before `session_ready`) is retried with a new ticket: the first attempt plus 3 retries, each recorded with its cause. An `enrolment.*` refusal is reported as is.
- **Lease.** The host holds no lease itself. Core leases the host's gateway session for each run (section C). `FluxIQLaunchedHost` exposes `hostId`, `close()`, and `closed`, a promise that settles when the browser goes away for any reason.
- **`close()`.**
  1. `context.close()`.
  2. Find any process still holding this profile and kill it (`taskkill /PID <pid> /T /F` on Windows, `kill -TERM` and then `-KILL` on POSIX), then check that none is left.
  3. Remove a fresh profile, with retries for Windows file locks.
  4. Tell the reaper to forget the profile.
- **Engine stopping.**
  - In-process: Core aborts `request.signal`, then awaits `close()`.
  - Hard death of the engine (TerminateProcess, SIGKILL, a crash): the **reaper**. One per engine process, spawned on the first launch with `detached: true`, `windowsHide`, and `stdio: ["ignore","ignore","ignore","ipc"]`. It keeps the list of profile directories it was given. On the IPC `disconnect` event, which fires on any parent death, it finds processes by `--user-data-dir=<dir>` (Windows: `Get-CimInstance Win32_Process`, matching the three quoting forms `find-browser-process.ts` already handles; POSIX: `ps -ax -o pid=,args=`), kills their trees, removes the fresh profiles, and exits. It also exits once the parent disconnects with an empty list.
  - `find-profile-processes.ts` becomes the single owner of `--user-data-dir` matching. `test-runner`'s `find-browser-process.ts` re-exports it, with no copy left behind; that is part of build brief B6.

## C. The CLI boundary

- **The interface lives in Core**, in new `packages/fluxiq/src/server/managed-hosts/host-launcher.ts`, as type-only exports from `fluxiq/server`:

```ts
export type FluxIQHostLaunchRequest = { hostId: string; gatewayUrl: string; coreApiUrl: string; dataDir: string;
  profile: { kind: "fresh" } | { kind: "named"; name: string }; headless: boolean;
  takeEnrolmentTicket(): string /* mints on call; a second call revokes the first */; signal: AbortSignal };
export type FluxIQLaunchedHost = { hostId: string; close(): Promise<void>; closed: Promise<void> };
export type FluxIQHostLauncher = { launch(request: FluxIQHostLaunchRequest): Promise<FluxIQLaunchedHost> };
```

- **Finding the launcher.**
  - New `managed-hosts/load-host-launcher.ts` checks `--browser-host <module>` first, then `FLUXIQ_BROWSER_HOST`. There is no default, because Core never names an extension package.
  - A path resolves against the current directory. A bare specifier resolves through `createRequire(<cwd>/package.json)`, for example `@fluxiq-web-extension/browser-host/launcher`.
  - The module must export `default` or `createFluxIQHostLauncher`, either a launcher or a factory `(env) => launcher`. This mirrors `FLUXIQ_HOST_MODULE` (`host-module/load-registration.ts`).
  - `--browsers N` with neither set is refused with exit 2, and the message names the flag and the variable.
  - The extension's `src/launcher.ts` reads `FLUXIQ_BROWSER_EXTENSION_PATH`, defaulting to `apps/extension/dist/chrome` resolved from the package.
- **Flags.** `server/cli/dev-arguments.ts` gains:
  - `--browsers <0-16>` (default 0);
  - `--browser-host <module>`;
  - `--headless` (the default is visible);
  - `--browser-profile <name>` (default fresh).
- **Lifecycle.**
  - `server/cli/run-dev.ts`, after `startHeadlessServer`: `revokeStaleManagedHosts()`, then `startManagedHosts(...)` from new `managed-hosts/start-managed-hosts.ts`. That function:
    - mints ticket functions bound to `hostId` = `host-1`..`host-N` and the active domain;
    - launches all hosts in parallel;
    - waits for each launcher to resolve **and** for the gateway `session.ready` with that `managedHostId`;
    - prints one line per host, with no secrets.
  - `stop()` aborts the signal, closes the hosts (with `revokeManagedHost` for fresh ones), then the listeners, then the instance.
  - A host whose `closed` settles while the engine still runs is reported and relaunched with a new ticket. This applies only to fresh profiles; a named one is reported and not relaunched.
- **Signals and supervision.** `server/cli/run-command.ts` adds `SIGHUP` and `SIGBREAK` (the Windows console closing, Ctrl+Break), plus `process.on("disconnect")` when the process has an IPC channel. `packages/sdk/src/cli/dev-command.ts` spawns the engine with `stdio: ["inherit","inherit","inherit","ipc"]`, so the engine stops gracefully when the `fluxiq` wrapper dies. That covers Windows, where a parent cannot signal its child.
- **FluxNode runs on a host.** New `framework/automation-service/service/fluxnode/hosts/`:
  - `managed-host-port.ts` implements an `AutomationStudioHostResourcePort` over `clientGateway.snapshot().sessions`, filtered to ready sessions with `managedHostId` on the run's domain. The resource key is `fluxnode.host:<hostId>`, epochs rise strictly, and each port has one lease per host.
  - `fluxnode-host-pool.ts`: `FluxNodeHostPool.run(runId, signal, work)`:
    - with no managed hosts enrolled, it runs `work` directly, which is today's behaviour;
    - otherwise it calls `new AutomationStudioHostLeaseScope(scheduler).run({role:"fluxnode-run", briefId: runId}, work, {signal})`, which is strict;
    - it calls `retryWaiting()` on gateway `session.ready`.
  - `create-fluxnode-service.ts` gains the option `hosts?: FluxNodeHostPool`. `run-fluxnode.ts` wraps the `generateFlowBootstrapAdaptation` call in `hosts.run`, and a Stop aborts the wait.
  - `run-command.ts` passes the pool.
- **The domain drives the leased browser.** New `domain/src/runtime/web-sessions/leased-web-session.ts`: `leasedWebSessionId()` returns `AutomationStudioHostLeaseScope.current()?.sessionId`.
  - `pick-web-session.ts` uses it when no session was requested.
  - `llm-evidence/tools.ts` `eligibleWebSessionIds` narrows to it.

  With no lease, both behave exactly as now.

## D. Proof plan (provider-free, scripted model)

- **Scenario and task:** `company-website`, task `company-website-apprentices`. It is read-only, so replays need no reset and `scope.acts: []` holds. Its script is `COMPANY_WEBSITE_APPRENTICES_SCRIPT` (`attempt-lane/scripted-model/scripts/company-website-apprentices.ts`), reused unchanged. Its `panel_command` reply is never asked. The two-FluxNode explore wraps it as `{...SCRIPT, replies: {...SCRIPT.replies, loop_verification: [r, r]}}`, which leaves the file untouched.
- **Where the proof lives:** new `packages/test-runner/src/fluxnode-host-proof/`:
  - `run-fluxnode-host-proof.ts`;
  - `proof-host-module.ts`: wraps the web host module and binds the scripted provider; it depends on Open Questions item 1;
  - `proof-launcher.ts`: `createBrowserHostLauncher` with `onContext` installing the run network guard and `browserArgs` from `networkContainmentArgs`;
  - `tests/` for the pure parts.

  `commands.ts` gains `fluxnode-host`. `assertRealisticScenarios` gates it. Browsers are visible.
- **Sequence.**
  1. Build the extension, then start the scenario lab and the scripted model server.
  2. Spawn `fluxiq dev --browsers 2 --browser-host <proof-launcher> --port 0 --gateway-port 0` with an IPC channel, `FLUXIQ_HOST_MODULE=<proof-host-module>`, and `scriptedModelChildEnvironment`.
  3. Connect the SDK with `FluxIQ.connect({url})`.
- **Proof P1, explore then replay at $0.** FluxNode `company.apprentices`: `runtime` = the web domain id, `goal` = the task's instruction, `start` = the lab origin plus the start path, no inputs.
  - Attempt 1 explores: `achieved`, with rows equal to the task's expected dataset.
  - Attempt 2 replays: `path` is replayed and `cost.calls == 0`, and the scripted server records no new call.
- **Proof P2, two hosts in parallel.**
  - Explore FluxNode `company.apprentices-b`, on the same goal, by itself first.
  - Then start attempts 3 and 4 together: replays of `company.apprentices` and `-b`.
  - Pass when:
    - both are achieved with 0 calls;
    - their gateway commands went to two different sessions, read from the trace tap's `sessionId`;
    - there is no `host_lease.missing`.
  - This gives four deterministic attempts, as the 2026-11-10 rule requires.
- **Proof P3, engine stopped means no browser left.**
  - (a) `child.disconnect()`, a graceful stop: the child exits, no process holds the hosts' profile directories, and the temp profiles are gone.
  - (b) A relaunch, then `child.kill()`, which is TerminateProcess on Windows: within the reaper's run, no process and no fresh profile remain.
- **Commands.**
  - Core:
    - `pnpm --filter @fluxiq/contracts test`
    - `pnpm --filter @fluxiq/client-gateway-websocket test`
    - `pnpm --filter fluxiq exec vitest run src/client-gateway/service src/server/managed-hosts src/server/cli src/framework/automation-service/service/fluxnode`
    - `pnpm --filter @fluxiq/sdk test`
    - the fluxiq typecheck, with `NODE_OPTIONS=--max-old-space-size=6144` as P2a needed
    - `node scripts/structure-audit.mjs`
  - Extension:
    - `pnpm --filter @fluxiq-web-extension/browser-host test` (its tests run `--test` on `src/**/tests`, and one headed-Chromium test runs against a fake gateway)
    - `pnpm --filter @fluxiq-web-extension/extension test`
    - `pnpm --filter @fluxiq-web-extension/domain test`
    - `pnpm --filter @fluxiq-web-extension/extension build`
    - the proof: `pnpm lab fluxnode-host --scenario company-website --task company-website-apprentices --hosts 2 --scripted-model`
    - `node scripts/structure-audit.mjs`

## E. Build briefs (partitioned by file, in dependency order)

| Brief | Tier | Owns | Needs |
| --- | --- | --- | --- |
| B1 Core gateway enrolment | worker-heavy | contracts `client-gateway.ts`; client-gateway-websocket `types.ts`, `transport.ts`; fluxiq `client-gateway/service.ts`, `service/{lifecycle,pairing-flow,trust-grant,trusted-clients,sessions}.ts`, `service/enrolment/**`, `service/trace-tap/credential-fields.ts`, and the tests beside them | none |
| B2 Core CLI and launcher | worker | `server/managed-hosts/**`, `server/cli/{dev-arguments,run-dev,run-command}.ts` and their tests, the `server/index.ts` type exports, sdk `cli/dev-command.ts` | the section A facade signature, frozen here (B2 tests use a fake gateway) |
| B3 Core FluxNode host pool | worker-heavy | `fluxnode/hosts/**`, `fluxnode/create-fluxnode-service.ts`, `fluxnode/run-fluxnode.ts`, their tests; plus a probe on the library lane: two concurrent runs of two FluxNodes in the one owner project | B1 (`managedHostId`) |
| B4 Extension enrolment | worker | `apps/extension/src/background/{index,connection}.ts`, `background/connection/gateway-session.ts`, `shared/protocol.ts`, the tests beside them | B1 (the transport option) |
| B5 Domain leased session | worker | `domain/src/runtime/web-sessions/{leased-web-session,pick-web-session}.ts`, `llm-evidence/tools.ts` (`eligibleWebSessionIds` only), the tests beside them | none |
| B6 browser-host package | worker-heavy | `packages/browser-host/**`, `scripts/structure-audit/config.mjs` (the no-test-runner rule), `test-runner/.../window-capture/find-browser-process.ts` (re-export) | B2 types; B4 for live enrolment |
| B7 Proofs | worker-heavy | `packages/test-runner/src/fluxnode-host-proof/**`, `test-runner/src/commands.ts` | B1-B6, plus Open Questions item 1 resolved |

B1, B2 and B5 run in parallel. B3, B4 and B6 follow B1. B7 runs last. The Core side gets a nested Core worktree on `task/t907-browser-host`. Both `dev` branches are pushed together.

---

## Report

**Outcome:** Partial. The design is complete. Two decisions need the lead (Open Questions items 1 and 3), and one deviation from the lead's wording is made and recorded (item 2).

**What changed and why:** only this file. Sections A-E above record the decisions.

**Commands run and observed results:** read-only only. I used Grep, Glob and Read over the files named above, and Bash `sed`/`grep`/`ls`, which listed and printed source with no errors. I ran no build, test or git command.

**Not verified:**
- Whether the extension's program-API calls after connect (`askCoreForFirstProject`) succeed for the `fluxnode.owner` approver under IAM. `platform/iam/**` and `server/program-route/**` are must-not-touch; B4 must check this.
- Whether AsyncLocalStorage lease frames reach the engine's saved-Flow replay dispatch (`dispatchWebAutomationOutput`). Proof P2 detects it through a `host_lease.missing` refusal or a session that is wrong.
- Whether `dist/chrome`'s `minimum_chrome_version` admits Playwright 1.51's Chromium.
- Whether Chromium exits by itself when the pipe closes. The reaper does not rely on it.

**Open questions or contradictions:**
1. **No model can be used headless.**
   - Problem: FluxNode runs call models as `fluxnode.owner`, whose key is sealed under a person's password (K8). A CLI engine therefore waits on a key forever, scripted or not, and P2b proved FluxNode runs only in-process with a mock provider.
   - Recommendation: one Core re-export of `createAutomationStudioAnthropicProvider` from `framework/automation-service/index.ts`. This touches no file under `runtime/llm/`, only that barrel. `proof-host-module.ts` then binds `bindLlmExecutionProvider` to it, with the scripted key and `routedFetch`.
   - Alternative: wait for P3b's `key` custody holder.
2. **`worker` client type.** The hello stays `clientType: "extension"`, because Core's session criteria are a single type and every web path selects `"extension"`. A `"worker"` hello would make managed browsers invisible to the web domain. The worker role is held by Core, from the redeemed ticket (`managedHostId`), never claimed by the client.
3. **Parallel runs in one owner project.** Runtime-session admission allows one adaptive run for each project (`runtime-session/admission.ts`, must-not-touch), and every FluxNode shares the project "FluxNodes". B3's probe decides:
   - if parallel replays are refused, the lead chooses between one project per FluxNode (`owner-flows.ts`, P2b's O2 decision) and a change to admission;
   - same-Flow concurrency is avoided by design: P2 uses two FluxNodes.
4. **The web domain's own port** (capacity 1) stays as it is. With `--browsers 1`, a person's project build could lease the same browser under a different key. This is noted, not fixed.
