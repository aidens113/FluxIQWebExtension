# t289 — Downstream freshness recovery

Status: **Complete — GO for downstream freshness**

## Outcome

The minimal t287 repair closure succeeded. Test-evidence was rebuilt after the final Scenario Lab/test-contracts write, then test-runner was rebuilt after test-evidence. The unchanged t263 dependency comparisons subsequently proved all six downstream outputs fresh against their tracked inputs and built dependencies.

This result closes t284's stale test-evidence finding. It is an implementation/build freshness result only; no dry-run or live authorization is implied.

## Recovery commands

Run serially from `F:\!FluxIQWebExtension`:

| Command | Result | Observed duration |
| --- | --- | --- |
| `pnpm --filter @fluxiq-web-extension/test-evidence build` | PASS, exit 0 | 1.62 s |
| `pnpm --filter @fluxiq-web-extension/test-runner build` | PASS, exit 0 | 10.61 s |

The runner's `domain:dist` guard found the existing domain declarations and did not rebuild domain. Neither Scenario Lab nor test-contracts was rebuilt after test-evidence.

## Exact freshness results

All timestamps are UTC. Every comparison used strict `output > newest input/dependency` semantics.

| Owner | Output timestamp | Newest input/dependency | Newest timestamp | Result |
| --- | --- | --- | --- | --- |
| test-contracts | `packages/test-contracts/dist/index.js` — `2026-09-27T04:34:27.5817816Z` | Core `packages/contracts/dist/index.js` | `2026-09-27T04:31:56.8327575Z` | PASS |
| test-evidence | `packages/test-evidence/dist/index.js` — `2026-09-27T04:40:58.1776017Z` | `packages/test-contracts/dist/index.js` | `2026-09-27T04:34:27.5817816Z` | PASS |
| domain | `domain/dist/index.js` — `2026-09-27T04:34:04.5339326Z` | Core `packages/client-gateway-websocket/dist/index.js` | `2026-09-27T04:32:09.2821662Z` | PASS |
| extension | `apps/extension/dist/e2e-chromium/content/index.js` — `2026-09-27T04:34:21.3613545Z` | `domain/dist/index.js` | `2026-09-27T04:34:04.5339326Z` | PASS |
| Scenario Lab | `apps/scenario-lab/dist/server.js` — `2026-09-27T04:34:34.3926137Z` | `packages/test-contracts/dist/index.js` | `2026-09-27T04:34:27.5817816Z` | PASS |
| test runner | `packages/test-runner/dist/cli.js` — `2026-09-27T04:41:09.6160474Z` | `packages/test-evidence/dist/index.js` | `2026-09-27T04:40:58.1776017Z` | PASS |

The E2E Chromium manifest exists at `apps/extension/dist/e2e-chromium/manifest.json`. Its timestamp is `2026-09-12T00:10:16.7076473Z`; as required by t263, the copied manifest is existence-only and the generated content bundle is the extension freshness marker.

## Boundary confirmation

- Generated outputs changed only through their owning build commands.
- No authored source or shared working document was edited.
- No run artifact was read or changed.
- No Lab, browser, dry-run, provider, or live command was started.
- No commit or push was made.
