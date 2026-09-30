# Run debug: `run-muni3pdr-80225d3f`

## Header

- Run id: `run-muni3pdr-80225d3f` (t174 run 12), the re-run of run 11 (`run-munhpy2m-036e9572`) on
  the same builds.
- Scenario / task: crossborder-marketplace / `crossborder-marketplace-hub-to-cart`. Headed
  Chromium 134, launched by the lane's slot-1 launcher. The full Lab stdout was kept for the first time,
  in the lane's scratchpad as `live-run-12.full.log`.
- Instance `t174-slot-1`. Started 2026-09-30 02:43:28.195 UTC. Failed 02:43:39.124 (`events.ndjson`
  seq 1). Finished 02:43:40.099 (`summary.json`): 11 s from start to failure.
- Builds: the same facility and Core commits as run 11 (`b1a82a21` / `9d3cdf9b`, both dirty with
  the lane's Fix 2). Extension sha256 `4cb3a5bd…`, identical to run 11 (`run.json` `extension`).
  The Core web build was reused: `processExits` has no `core-web-build`.
- Machine at launch, measured at 02:40 just before: 3,895 MB of RAM free, 16,345 MB of commit
  free, CPU 100%, and build slot b1 held by `t187 bench | C.test p2 | pnpm test`.
- Provider calls: 0.
- **Stage reached:** none. This is a facility or extension failure, before pairing.

## What happened

- Core was ready in 1,362 ms, with its gateway bound at `ws://127.0.0.1:53594/client` (`logs/core.log`).
  The scenario server was ready at port 53592 (`logs/scenario-lab.log`).
- Event 1 (`events.ndjson`, 02:43:39.124Z) is `page.goto: net::ERR_ABORTED; maybe frame was detached?`
  while navigating to `chrome-extension://ohopmogionjhhhihncamjlajnppdpgee/sidepanel/index.html`,
  `failureCategory: unknown`, with no screenshot (`capture-unavailable`).
- The Lab's code path: `run-scenario.ts:680` `extensionControlPage` awaits the extension's
  service worker, then `openExtensionControlPage` (`run-scenario/extension-control-page.ts`)
  opens a new tab and navigates it to the side panel. It retries once only on
  `Page crashed` / `Target crashed`. `ERR_ABORTED` is not retried, so the run ended.
- An aborted navigation to the extension's own page means the extension, or the tab, went away
  during the load. The bundle does not show which.

## Cause

| # | Cause, precisely | Repo and file | Fix | Status |
| --- | --- | --- | --- | --- |
| 1 | The extension's control page could not be loaded: the navigation was aborted 11 s into the run. This is the second failure in a row at the extension's start on this build (run 11 got no answer to its first `fluxiq.connect` in 15 s). Before these two, the same stage produced 2 renderer crashes (runs 3, 5) and 2 connect timeouts (runs 8, 9) out of 7 launches, all while other lanes' heavy commands were running. Not shown: why the navigation aborted. **Candidates, not yet tested:** (a) the extension or its worker restarting while the page loads, since the t182 background changes (`apps/extension/src/background/index.ts`, `38acbc05`) are new in these two runs; (b) renderer instability under CPU and memory pressure, as in runs 3 and 5. | Extension start, or the Lab's control-page opener | None yet. Next, in the order that costs no provider call: reproduce the extension start with Playwright on this extension build without a run, and time `awaitExtensionWorker`, the control-page load and the first `fluxiq.connect`; then make the opener and the connect both say *why* they failed. | Open (t174). |
| 2 | A `fluxiq.connect` whose WebSocket never opens never answers. The extension's handler awaits `GatewaySession.connect` (`apps/extension/src/background/connection/gateway-session.ts:108`). That awaits Core's `FluxIQClientGatewayWebSocketClient.connect`, whose `waitForOpen` has no deadline (`!FluxIQ/packages/client-gateway-websocket/src/transport.ts:151`). A person's Connect can therefore hang indefinitely, and this is one reading of run 11. | Core `client-gateway-websocket` and the extension | None yet: a bounded open that ends in `error` with a reason. Crosses into Core. | Open (t174); to confirm against run 11's shape before changing. |
