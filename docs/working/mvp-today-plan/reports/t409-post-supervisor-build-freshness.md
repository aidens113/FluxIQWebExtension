# t409 — post-supervisor-build output freshness

## Verdict

**GO — corrected-order downstream output closure is fresh and identity-bound.** The exact t385
post-root-build output sequence completed with exit 0 throughout. All six strict freshness
comparisons pass, all 12 required markers exist (including the web-panel host), the E2E manifest is
byte-identical to its authored source, and the downstream domain resolves byte-identical runtime
outputs through the intended Core junctions.

This is provider-free generated-output validation only. I did not rerun any test or check command,
start Lab/browser/panel/live work, inspect provider or run artifacts, or stage, commit, or push.

## Exact corrected-order rebuild

Run serially from `F:\!FluxIQWebExtension` after the supervisor's root `pnpm build`:

```powershell
pnpm --filter @fluxiq-web-extension/domain build
pnpm fluxiq:host:build
pnpm --filter @fluxiq-web-extension/test-contracts build
pnpm --filter @fluxiq-web-extension/scenario-lab build
pnpm --filter @fluxiq-web-extension/test-evidence build
pnpm --filter @fluxiq-web-extension/extension build
pnpm --filter @fluxiq-web-extension/test-runner build
```

Every command exited 0. Scenario Lab's build invoked its owning test-contracts build internally,
so that internal write at `07:03:48Z` is the final test-contracts write; test-evidence and
test-runner were correctly rebuilt after it. Domain's host build followed domain build and the
host remained present through every later build.

## Six strict freshness comparisons

The check used t263/t385 semantics: each output had to satisfy
`output.LastWriteTimeUtc > max(newest tracked source/config, named built dependencies)`; equality
would fail. Tracked owners were resolved with `git ls-files` over the exact t263 pathspecs.

| Owner | Output UTC | Newest tracked input / built dependency | Newest UTC | Result |
| --- | --- | --- | --- | --- |
| test-contracts | `2026-09-27T07:03:48.7169209Z` | Core contracts `packages/contracts/dist/index.js` | `2026-09-27T06:30:37.5423475Z` | PASS |
| test-evidence | `2026-09-27T07:03:54.9667377Z` | test-contracts `dist/index.js` | `2026-09-27T07:03:48.7169209Z` | PASS |
| domain | `2026-09-27T07:03:43.6072142Z` | Core gateway `packages/client-gateway-websocket/dist/index.js` | `2026-09-27T06:30:49.9570561Z` | PASS |
| extension E2E Chromium content | `2026-09-27T07:03:59.4577054Z` | domain `dist/index.js` | `2026-09-27T07:03:43.6072142Z` | PASS |
| Scenario Lab | `2026-09-27T07:03:53.1120122Z` | test-contracts `dist/index.js` | `2026-09-27T07:03:48.7169209Z` | PASS |
| test-runner | `2026-09-27T07:04:09.7991803Z` | test-evidence `dist/index.js` | `2026-09-27T07:03:54.9667377Z` | PASS |

Result: **6/6 strict PASS**.

## Required output markers and manifest identity

All required leaf markers exist: **12/12**.

| Marker | Last write UTC |
| --- | --- |
| Core contracts `packages/contracts/dist/index.js` | `2026-09-27T06:30:37.5423475Z` |
| Core FluxIQ `packages/fluxiq/dist/index.js` | `2026-09-27T06:30:47.7428727Z` |
| Core websocket gateway `packages/client-gateway-websocket/dist/index.js` | `2026-09-27T06:30:49.9570561Z` |
| Core web `apps/web/.next/BUILD_ID` | `2026-09-27T06:31:27.7419078Z` |
| test-contracts `packages/test-contracts/dist/index.js` | `2026-09-27T07:03:48.7169209Z` |
| test-evidence `packages/test-evidence/dist/index.js` | `2026-09-27T07:03:54.9667377Z` |
| domain `domain/dist/index.js` | `2026-09-27T07:03:43.6072142Z` |
| web-panel host `domain/dist/host/web-panel-host.mjs` | `2026-09-27T07:03:44.9051509Z` |
| extension content `apps/extension/dist/e2e-chromium/content/index.js` | `2026-09-27T07:03:59.4577054Z` |
| extension manifest `apps/extension/dist/e2e-chromium/manifest.json` | `2026-09-12T00:10:16.7076473Z` |
| Scenario Lab `apps/scenario-lab/dist/server.js` | `2026-09-27T07:03:53.1120122Z` |
| test-runner `packages/test-runner/dist/cli.js` | `2026-09-27T07:04:09.7991803Z` |

The host is 403,435 bytes. The manifest timestamp remains existence-only. SHA-256 for both
`apps/extension/manifest.e2e.json` and the output manifest is
`FE5879977F106BFA0A6C3145D6F2D3060B8C6098121B36D3D76ABFB3C0BCD420`; a direct byte sequence
comparison also returned `true`.

## Core junction, runtime, and source identity

Both dependency links are Windows junctions with the exact intended targets and resolved real
paths:

- `domain/node_modules/fluxiq` → `F:\!FluxIQ\packages\fluxiq\` (real path without trailing slash);
- `domain/node_modules/@fluxiq/client-gateway-websocket` →
  `F:\!FluxIQ\packages\client-gateway-websocket\`.

`import.meta.resolve` executed from `domain` returned exactly:

```text
fluxiq -> file:///F:/!FluxIQ/packages/fluxiq/dist/index.js
fluxiq/core -> file:///F:/!FluxIQ/packages/fluxiq/dist/core/index.js
@fluxiq/client-gateway-websocket -> file:///F:/!FluxIQ/packages/client-gateway-websocket/dist/index.js
```

Direct Core and through-junction SHA-256 identities match:

| Runtime output | SHA-256 | Result |
| --- | --- | --- |
| FluxIQ root `dist/index.js` | `9AF59262D86D20704F76E63E6A835642B9FCE0E19A14DFB746F18AD9450F75AF` | identical |
| FluxIQ Core `dist/core/index.js` | `414B586CC9F614806D76B590917ECEE8E07B50400269D961516EF7DE0B4BE0F6` | identical |
| websocket gateway `dist/index.js` | `4C0295D4B2E3ACD4C5C60428BA923ECC60E421912323829A4A1AE0A17CAEFF1D` | identical |

The read-only validation command surface was:

```powershell
# Freshness input ownership and timestamps
git -C F:\!FluxIQWebExtension ls-files -- <the exact six t263 owner pathspec sets>
Get-Item -LiteralPath <each tracked input, built dependency, and output>

# Required markers and byte identity
Test-Path -LiteralPath <each of the 12 paths above> -PathType Leaf
Get-FileHash -Algorithm SHA256 -LiteralPath apps/extension/manifest.e2e.json
Get-FileHash -Algorithm SHA256 -LiteralPath apps/extension/dist/e2e-chromium/manifest.json
[System.Linq.Enumerable]::SequenceEqual([byte[]]<source bytes>, [byte[]]<output bytes>)

# Junction, runtime, and direct-source identity
Get-Item -Force domain/node_modules/fluxiq
Get-Item -Force domain/node_modules/@fluxiq/client-gateway-websocket
node -e "console.log(require('node:fs').realpathSync(process.argv[1]))" <junction>
node --input-type=module -e "for (const s of ['fluxiq','fluxiq/core','@fluxiq/client-gateway-websocket']) console.log(JSON.stringify({specifier:s,resolved:import.meta.resolve(s)}))"
Get-FileHash -Algorithm SHA256 -LiteralPath <each direct Core and through-junction output>

# Repository revision/status/diff identity
git -C <repository> branch --show-current
git -C <repository> rev-parse HEAD
git -C <repository> status --porcelain=v1
git -C <repository> status --porcelain=v1 -uall
git -C <repository> diff --cached --name-status
git -C <repository> diff --name-only --diff-filter=U
git -C <repository> diff --check
```

## Repository identity and diff checks

Final values are recorded below after this report was created.

| Repository | Branch | HEAD | Collapsed status | Full `-uall` status | Index / unmerged |
| --- | --- | --- | ---: | --- | --- |
| downstream | `task/t170-mvp-today-integration` | `5b8429c543fdc27eb892c225641717aed43c5dc4` | 95 | 379: 76 ` M`, 303 `??` | 0 / 0 |
| Core | `task/t170-mvp-today-integration` | `d035e1b7d17977951a2a2ec6b5e51570e3f2c537` | 179 | 222: 128 ` M`, 92 `??`, 1 `D `, 1 `RM` | 2 / 0 |

Downstream's full status includes this newly authored worker report. Core retains the known
two-entry partial index; this worker did not alter it. `git diff --check` exited 0 in both
repositories: downstream emitted three CRLF-to-LF advisories and Core emitted 97 LF-to-CRLF
advisories, with no whitespace error. The dirty trees remain the understood uncommitted MVP unit;
the revisions alone are not clean-tree proof.

## Commands not run

Per brief, I did not rerun `pnpm check`, `pnpm test`, any package test, or any additional root/package
build beyond the exact seven-command corrected output sequence above.
