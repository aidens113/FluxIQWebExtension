# t737 unit 4b: identity probes without Chromium

## Outcome

Partial. All three probes now use Node's own client instead of Chromium. The
package typecheck passes, the realistic-scenario guard scan passes 9/9 (it had
flagged these three files before), and the structure audit passes. The single
allowed run of the core-identity probe failed: its child server did not start
inside the probe's existing 20 s startup timer. That happened before any request
was sent, so the Node client code was never reached. The cause is cold imports
from a freshly copied Core tree, which take about 73 s on this machine. The
cause is measured below.

## What changed and why

The changes are in three files under
`packages/test-runner/src/run-scenario/browser-session/`:
`core-identity/tests/server-probe.test.ts`,
`host-identity/tests/server-probe.test.ts` and
`server-adapter-identity/tests/server-probe.test.ts`.

- Removed the `@playwright/test` `chromium` import, the launch, `newPage`,
  every `page.goto` and `browser.close`.
- `page.evaluate(fetch ...)` became Node's global `fetch` with the same method,
  headers (`authorization: Bearer isolated-public-test-token`,
  `content-type: application/json`) and body (`JSON.stringify({ reachedInputs })`),
  then `.json()`.
- The unauthenticated `page.request.post(url, { data: {} })` became
  `fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })`.
  This is the same JSON body Playwright sends for `data: {}`. The check is still
  `status === 401`.
- `page.request.get(url, { headers })` became `fetch(url, { headers })` with
  `.json()`, cast to the counts shape.
- In the server-adapter probe, the in-page WebSocket became Node 22's global
  `WebSocket`, which has the same browser-style API. The URL
  (`ws://127.0.0.1:<socketPort>/client`), the 5 s timeout and the
  `Actual socket timeout` / `Actual socket failed` rejections are unchanged.
- The synthetic servers' `/` HTML route is gone from all three, because nothing
  requests it now.
- The `request` return types are explicit in the host and server-adapter
  probes (`payload.loadedModules` and `payload.serverTransportIdentity`),
  because `fetch().json()` is not `any` the way `page.evaluate` was.
- `t.diagnostic` now starts with `Node ${process.version} fetch client`
  (`fetch/WebSocket client` in the adapter probe) instead of claiming Chromium.
  The core probe's test title "fresh Chromium-reached server" became "fresh
  Node-client-reached server".
- Every assertion, refusal check, dispatch, admission and count check, and the
  order of steps, is unchanged.
- `FLUXIQ_IDENTITY_EXTENSION_PATH`'s default `apps/extension/dist/e2e-chromium`
  stays. It is a build path the verifier hashes, not a browser launch.

## Commands run and observed results

- `npx tsc -p tsconfig.json --noEmit` in packages/test-runner gave exit 0 with no output.
- `npx playwright test -c e2e/playwright.config.ts e2e/realistic-scenario-guard --reporter=list --workers=1 --output <scratchpad>/u4b` in apps/scenario-lab: `9 passed (22.3s)`, including "no browser test in the repository opens a synthetic scenario or serves its own page".
- `node scripts/structure-audit.mjs` at the repo root: `structure-audit: passed (212 warning(s), 618 baselined)`, exit 0. It also printed "2 baseline entries can be lowered". These entries were not identified, and this unit does not own the baseline.
- `node ../../scripts/build-cache/cli.mjs test-runner:build -- "node scripts/clean-dist.mjs && tsc -p tsconfig.json"` built successfully in 75 s.
- `FLUXIQ_CORE_IDENTITY_PROBE=1 node --test dist/run-scenario/browser-session/core-identity/tests/server-probe.test.js` gave `not ok 1`, `error: 'Owned Core identity child did not start'`, duration 89.7 s. That is the copy time plus the 20 s startup timer. Prerequisites were all present: `apps/extension/dist/e2e-chromium`, Core `packages/fluxiq/dist` and Core `scripts/runtime-build-identity/index.mjs`.
- Diagnosis, with scratch scripts `t737u4b_child.mjs` and `t737u4b_copy.mjs` in the scratchpad:
  - The child's imports, AutomationStudioService and the route registration, take 6.7 s against `fxwork/t737/!FluxIQ` directly.
  - Copying `packages/{fluxiq,contracts}/{src,dist}` the way the probe does took 88.7 s, and the same child imports from that copy took 72.8 s. Every step succeeded, with no error.
  - So the child is healthy but slow on freshly written files, probably from on-access scanning, and the probe's 20 s `launch` timer expires first.

## Not verified

- The swapped Node client path end to end. No probe got past child startup.
- The host and server-adapter probes were not run. They copy similar trees and
  build with esbuild, so they would hit the same cold-copy cost.
- Live browser behaviour is not applicable, because these are no longer browser tests.

## Open questions or contradictions found

- The core probe's startup timer (`Owned Core identity child did not start`, 20 s)
  is too short for a cold copied Core on this machine. The host and adapter
  probes use the same 20 s timer. I left the timers alone because that is
  outside this brief. Raising them, for example to 120 s, or making the copy
  cheaper would let the probes run. Whether the probe ever passed on this
  machine with Chromium is unknown, since the failure comes before the client.
- `git status` in `fxwork/t737/!FluxIQ` shows uncommitted Core edits from
  another unit (trial-gate and step-log). I did not touch them. The probe
  copies Core's dist as it stands.
