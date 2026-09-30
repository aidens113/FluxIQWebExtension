# t174-w7: why the extension start failed, the fix, and 10/10 clean starts

## Outcome

Done. The start failure has one cause, and it is ours: the Lab's network guard itself. Before the fix, 1 of 10 starts was clean and 9 of 10 failed. After it, 10 of 10 were clean. Every start was provider-free, headed, and on crossborder-marketplace.

The cause is not CPU, memory or load. The machine was running only this probe.

## Cause, with evidence

**The Lab's network guard `fetch()`es into the extension's service worker before the worker's global scope exists, and that crashes the whole extension renderer.**

1. `installDeterministicNetworkGuard` (`packages/test-runner/src/network-guard.ts`, `proveWorker`) sends a canary into every service worker as soon as Playwright announces it. The canary is a `worker.evaluate(fetch(canaryUrl, { signal: AbortSignal.timeout(...) }))`.
2. In Chromium 134, Playwright announces the worker before its global scope is set up. An evaluate at that moment sees `ReferenceError: setTimeout is not defined` (observed in the probe).
3. A `fetch()` evaluated there kills the extension's renderer process with `STATUS_BREAKPOINT` (CDP `Target.targetCrashed`, errorCode `-2147483645` = `0x80000003`). The crash comes 180–273 ms after the worker starts.
4. The worker and every extension page live in that process, so all of them go:
   - A side panel that is loading reports `Page crashed` (runs 3, 5), or `net::ERR_ABORTED; maybe frame was detached?` (run 12).
   - The Lab's `renderer_crash` retry then opens a fresh side panel that loads fine.
5. **The worker is never started again** in this browser. No new `service_worker` target appears, and `context.serviceWorkers()` stays empty. Runtime messages from the new page do not wake it. So the first `fluxiq.connect` is never answered. Nothing throws until pairing times out 15 s later with `connectionState: unreported`: runs 8, 9 and 11.

**Evidence: the isolation matrix.** Every row is 3 starts, except the gated row, which is 5. All rows use the same builds, one variable changed at a time. Probe: `scratchpad/t174w7-probe.mjs`; logs: `scratchpad/t174w7-x-<variant>.log`.

| Variant | Clean | Crash |
| --- | --- | --- |
| Real guard, no probe attach to the worker | 0/3 | 2 (the third failed without a crash signal) |
| No guard at all | **3/3** | 0 |
| Guard, worker network interception off | 0/3 | 3 |
| Guard, control page opened 3 s later | 0/3 | worker died with no page open, then was not restarted (`extension.worker` timeout 30 s) |
| Only `context.route` and `routeWebSocket`, no canary | **3/3** | 0 |
| **Only the canary** `worker.evaluate(fetch + AbortSignal.timeout)` | 0/3 | **3** |
| Only `worker.evaluate(fetch)` | 0/3 | **3** |
| Only `worker.evaluate(AbortSignal.timeout + setTimeout)` | 3/3 | 0 (the evaluate itself failed: `setTimeout is not defined`) |
| Only `worker.evaluate(() => 1)` | 3/3 | 0 |
| The canary 3 s after the worker appears | **3/3** | 0 |
| Canary gated on scope readiness (first draft; its gate threw, so no canary was sent) | 5/5 | 0 |

The **delayed-page** row shows the extension page is a victim, not the cause. The worker's process died about 145 ms after the worker started, with no extension page open at all.

**Hypotheses from the brief:**
- **(1) Killed.** The socket never began opening: the connect message never reached a live worker. The Core gateway was listening; start 1 and every start after the fix pair in under 90 ms.
- **(2) Confirmed in mechanism, but not a restart or reload.** The worker's process is killed by our own evaluate, and the worker is not restarted.
- **(3) Killed.** Ordering is not the issue: the connect was sent only after the worker and the gateway were up.

**Runs 3, 5, 8, 9, 11 and 12 are this one failure.** That is inferred from the matching shape, not re-observed on their builds. The debugs for runs 8, 9 and 11 infer machine load and CPU starvation as the cause. That was wrong and should be corrected.

## The fix

**Root cause, `packages/test-runner/src/network-guard.ts`.**
- `proveWorker` now waits for the worker's scope before the canary. It polls from Node, every 50 ms for up to 10 s, with an evaluate that touches only `typeof setTimeout === "function" && typeof fetch === "function"`.
- A worker whose scope never becomes ready is recorded as a `service-worker` violation, never fetched into.
- A worker that closes while being asked is not a finding, as before.
- `installDeterministicNetworkGuard` takes an optional third argument, `{ workerScopeTimeoutMs, workerScopeIntervalMs }`, used only by tests.
- Every launcher that installs this guard benefits: the run lane, `launch-guarded-context`, the interactive session, and saved-Flow replay.

**The hang can no longer be silent (the brief's (d)):**
- **Core `packages/client-gateway-websocket/src/`:**
  - `transport.ts`: `connect()` waits at most `CLIENT_GATEWAY_OPEN_TIMEOUT_MS` (10 000 ms), or the new option `openTimeoutMs`.
  - Its `waitForOpen` now also listens for `close`. It settles on open, error, close or the deadline, and rejects with the new `FluxIQClientGatewayOpenError` carrying `code` `open_timeout`, `open_failed` or `closed_before_open`.
  - On the deadline it rejects first, then closes the socket.
  - A socket that never opened is dropped from the client, so a later `connect()` opens a new one instead of returning early.
  - A non-positive or NaN `openTimeoutMs` throws in the constructor.
  - New files `open-error.ts` and `tests/transport.test.ts`; `types.ts` and `index.ts` export them.
- **Extension `apps/extension/src/background/connection/gateway-session.ts`:**
  - A failed open now sets `lastError` to a sentence that names the code. For example: `FluxIQ did not open the connection within 10 s (open_timeout).`
  - The `fluxiq.connect` reply carries it in `status.lastError`.
  - An attempt superseded by a newer `connect()` no longer marks the live attempt failed or schedules a reconnect that would close its socket. This was a real race, found while writing the test.
  - Optional dep `openTimeoutMs`, used by tests.
- **Lab `run-lifecycle/pair-extension.ts` and `pairing-status-wait.ts`:** a pre-approval timeout's details gain `connectFailure`. It holds one closed code parsed from `lastError`, or `null`, and is passed through for publication only when it is one of those values. The extension's sentence is never published.
- **Lab `run-scenario/extension-control-page.ts`:**
  - After any retried control page, the worker is woken with one `fluxiq.getStatus` from the new page, and must then be present again.
  - Otherwise the start fails at once as `extension.worker`: "The extension's service worker did not come back after its control page was retried (renderer_crash): …". Its details are `extensionStage: "worker"` and `afterRetried`.
  - Before, that case surfaced as a silent 15 s pairing timeout.

**Instrumentation (the brief's (a)): new `run-scenario/extension-start-trace/`.**
- `ExtensionStartTrace` records, in ms from launch:
  - `cdp`: Chrome's target lifecycle for the worker and extension pages (created, changed, destroyed, crashed with its exit code).
  - `worker`: the worker's console, exceptions and log lines, through a second non-flattened DevTools session.
  - `page`: the control page's console, errors, crash and close.
  - `lab`: the Lab's own steps. `connect` and `approve` are timed, and connect's answer records its state and `lastError`.
- Every string is screened:
  - the run's secrets and the evidence redactor's patterns;
  - six-digit reference codes;
  - opaque strings of 32 or more characters;
  - URLs cut to their origin, or to `chrome-extension://<extension>/<path>`.
  - Strings are capped at 300 characters, and at most 500 entries are kept.
- `writeExtensionStartSidecar` writes `extension-start.local.json` after `finalize`, like `provider-failures.local.json`. It refuses a staging directory, and replaces the whole file with a `withheld` stub if the final text fails `assertNoSensitiveText`.
- It is wired into `run-scenario.ts` line-neutrally: still 702 lines, all edits in place, and `node scripts/structure-audit.mjs` passes.
- **Core gateway connection logs are not covered.** Core's gateway server logs nothing per connection, and that code is outside my ownership. The Lab-side `connect.done` / `connect.failed` marks stand in for them.

## Commands run and observed results

**Failing first, then passing:**
- Core, `npx vitest run src/tests/transport.test.ts`:
  - Before the fix: 5 failed | 1 passed. The never-open and closed-before-open cases hung to the 5 s test timeout.
  - After: `Tests 9 passed (9)` across both test files.
- Guard, `node --test tests/network-guard.test.js` (scratch compile of the unfixed guard):
  - Before: 12 pass, 2 fail. Test 13's actual sequence contained `'canary-before-ready'`: the unfixed guard sent the canary into the unready scope.
  - After (`dist`): 14/14.
- Extension `gateway-session.test.ts`, through a scratch runner that bundles exactly as `scripts/test-extension.mjs` does:
  - Before: tests 4 and 5 failed with `Promise resolution is still pending but the event loop has already resolved`. That is the hang itself.
  - After: 5/5.
  - With the superseded-attempt guard line removed, test 5 fails again. It was restored and re-verified present.
- Lab `run-scenario/tests/extension-control-page` 10/10 (2 new). `extension-start-trace` 4/4 (new). `pair-extension` 18/18 (1 new). `pairing-status-wait` 9/9 (1 new). `launch-containment` 3/3.

**Suites, through `heavy.sh`:**
- Core, `pnpm --filter @fluxiq/client-gateway-websocket build && check && test`: passed, 9/9.
- Core `node scripts/structure-audit.mjs`: **1 violation, not mine**. `packages/fluxiq/src/programs/automation-studio/runtime/service.ts` has 4536 lines against a baseline of 4535; the file is unmodified in the tree, so the overage is in committed Core `HEAD`. My files raised nothing.
- DS `pnpm --filter @fluxiq-web-extension/extension test`: tests 1155, pass 1155, fail 0.
- DS `pnpm --filter @fluxiq-web-extension/test-runner test`: tests 1603, pass 1600, fail 3, none from my changes:
  - 881 `runner-wiring` "the redaction attestation scans…": the stale pin w6 already reported.
  - 1184 `clone-cache` "serializes simultaneous…": lock timeout under the full suite. 6/6 when run alone.
  - 1352 `demo-workspace` "resolves one reusable demo directory…": fails alone too. It is in files I did not touch.
- DS `node scripts/structure-audit.mjs`: `passed (120 warning(s), 120 baselined)`.
- Instance builds (extension `test:e2e:build`, scenario-lab, `domain host:build`, `test-runner...`) through heavy.sh: exit 0. The extension build includes `tsc --noEmit`.

**Live starts.** Slot-1 was claimed and released per batch, headed Chromium 134, provider-free, crossborder-marketplace only, instance `t174-w7`.

The probe repeats the real start path in the Lab's order, using the Lab's own modules:
`startTopology` → `launchBrowser` → `installRunNetworkGuard` → `extensionControlPage` → `browserVersionFromCdp` → scenario page → `pairExtensionWithColdEpochRecovery` → `activateScenarioTab`.

Before (`scratchpad/t174w7-before.ndjson`). Times are ms; "connect answered" and "paired" are counted from the connect being sent.

| # | Run | Outcome | Topology | Launch→control | Control→connect | Connect answered | Paired | Cause |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-munjwmhs-c13a78db | clean | 9957 | 218 | 233 | 47 | 187 | — |
| 2 | run-munjwvat-802dfb6b | failed | 9910 | 475 | 217 | none in 15 s | — | renderer crash 0x80000003 +254 ms after worker start; worker gone, not restarted |
| 3 | run-munjxji4-7b12c340 | failed | 9442 | 496 | 203 | none | — | same, +222 ms |
| 4 | run-munjy7aj-dbe2cabe | failed | 8632 | 424 | 193 | none | — | same, +204 ms |
| 5 | run-munjyucn-e68a6197 | failed | 8699 | 405 | 195 | none | — | same, +180 ms |
| 6 | run-munjzhj1-140dc64e | failed | 9525 | 491 | 259 | none | — | same, +226 ms |
| 7 | run-munk05h6-f631e492 | failed | 10982 | 543 | 275 | none | — | same, +273 ms |
| 8 | run-munk0uj9-c7f50759 | failed | 9044 | 458 | 223 | none | — | same, +224 ms |
| 9 | run-munk1hyp-29dff4bb | failed | 9534 | 500 | 246 | none | — | same, +221 ms |
| 10 | run-munk25zr-946114c5 | failed | 9813 | 469 | 213 | none | — | same, +212 ms |

After (`scratchpad/t174w7-x-after.ndjson`):

| # | Run | Outcome | Topology | Launch→control | Control→connect | Connect answered | Paired |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | run-munlagx0-90d58cae | clean | 100116 (Core web rebuild) | 292 | 259 | 51 | 200 |
| 2 | run-munlcnm0-c33abd24 | clean | 9894 | 254 | 239 | 85 | 228 |
| 3 | run-munlcwua-3b9bf4b5 | clean | 9073 | 262 | 222 | 49 | 200 |
| 4 | run-munld4xt-b58f279d | clean | 9980 | 184 | 236 | 44 | 190 |
| 5 | run-munlddpj-fb5c8804 | clean | 9318 | 256 | 228 | 46 | 203 |
| 6 | run-munldm0q-738d8747 | clean | 10244 | 274 | 222 | 48 | 203 |
| 7 | run-munldv1g-a5ee427e | clean | 9375 | 234 | 235 | 48 | 201 |
| 8 | run-munle3g5-7aab0f4b | clean | 9280 | 302 | 246 | 61 | 198 |
| 9 | run-munlebpn-a90b3757 | clean | 8718 | 247 | 239 | 43 | 199 |
| 10 | run-munlejjl-6df70a51 | clean | 8545 | 267 | 210 | 42 | 187 |

No `Target.targetCrashed` and no worker close occurred in any after start.

**A real `lab run crossborder-marketplace`**, with the recording lane and no `--live-llm`:
- `node packages/test-runner/dist/cli.js run crossborder-marketplace` with instance t174-w7 → `run-munlfe08-71789ccf`, **verdict passed**. The guard proved the worker, so it reported no violation.
- `extension-start.local.json` was written: `published: false`, 71 entries, none dropped. It is absent from `artifact-index.json`. `connect.done` came in 37 ms (`pairing`) and `approve.done` in 41 ms.
- The worker's console arrived as message labels only, with `Object` in place of object contents.

## Not verified

- **A live `--live-llm` run.** That is the lane's next run; my runs were provider-free by the brief.
- **Why Chromium never restarts the worker after its renderer crashes.** Observed on Chromium 134 under Playwright 1.51.1. Chrome's own stderr log shows nothing from the sandboxed renderer. The Lab now fails fast and by name if it happens; the product cannot act while its worker is gone.
- **Whether `typeof setTimeout/fetch` is the exact readiness invariant** inside Chromium. It is the observable one: 10/10 after starts plus the real run, against 9/10 crashes before. A worker restart that occurs while a run is already going was not exercised.
- **The extension's named `open_timeout` in a real browser.** It is covered by unit tests against Core's real transport only; no live gateway that never answers was staged.
- **Runs 3, 5, 12 re-run on their own builds.** They are attributed to this cause by shape only.
- **The rest of DS.** Not run: DS `pnpm check`/`pnpm build` whole-repository, Core `pnpm check`/`test` whole-repository, and Firefox.

## Open questions or contradictions found

1. **The debugs for runs 8, 9 and 11, and the lane report, attribute these failures to machine load.** That is contradicted here, and should be corrected by their owner; I did not edit shared documents. The w6 change that adds `machine: sampleMachineLoad(500)` to every failure event invites the same wrong reading. That is the supervisor's call.
2. **Docs outside my ownership should mention the new contract:**
   - Core `docs/integrations/client-gateway-websocket.md` and the package README: `openTimeoutMs`, `CLIENT_GATEWAY_OPEN_TIMEOUT_MS`, `FluxIQClientGatewayOpenError`.
   - DS `docs/architecture`, if it describes the network guard's worker proof or the start diagnostics.
3. **Core's structure audit already fails on `HEAD`** (`automation-studio/runtime/service.ts`, 4536 > 4535). This is independent of this work, but Core `pnpm check` will fail until someone fixes it.
4. **The `extension-start.local.json` trace attaches a second DevTools session to the worker for its console.** All after starts and the real run were clean with it attached. If any later start regresses, turn it off first to rule it out.
5. **Stale or failing runner tests seen in the full suite:** 881 (known), 1352 (`demo-workspace`, fails alone), and 1184 (`clone-cache`, flaky under the full run).
6. **Scratch artifacts:**
   - Lab instance `t174-w7` builds are under each package's `.lab-instances/t174-w7/`.
   - The real run's bundle is `test-runs/instances/t174-w7/run-munlfe08-71789ccf`.
   - Probe records are `t174w7-*` in the session scratchpad.
   - All of these are git-ignored.
