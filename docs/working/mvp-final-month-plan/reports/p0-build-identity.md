# P0 running build identity — t297

Status: Done

## Current State

Source frozen for supervisor integration. Immutable identities are embedded into each built target; the authenticated background diagnostic requests the active top-frame content identity. The Lab records a closed non-secret projection and refuses absent/mismatched background/content before recording/chat/build dispatch. Narrow checks and the real production browser proof passed. No paid runs, Core edits, git mutations, user-panel management or full suites were performed.

## Scope and limitations

Identity records target, version, diagnostic protocol version and exact esbuild/copied-source input digest. `coreInputsDigest` and `domainInputsDigest` cover only contracts/source reached by the browser bundle; they do not certify the running Core server. The existing run manifest separately records intended facility/Core repository revisions. Starting intended pair: downstream dd3aa44f plus Core e9b7d691 (shared Core read-only). Running Core handshake remains pending as agreed with supervisor. No iframe identity, Firefox live behaviour or paid A-D behaviour was claimed.

## Implementation and owned files

- `apps/extension/scripts/release/build-identity.mjs`, its test and release barrel: deterministic exact input hashes plus reached Core/domain subsets.
- `apps/extension/scripts/build-extension.mjs`, `release/build-info.mjs`: unique valid-JSON placeholder embedded by esbuild, replaced per target with immutable identity; identical disk identity written to build-info.json. Existing schema-1 freshness checking remains compatible; legacy builds lacking identity refuse Lab admission.
- `apps/extension/src/shared/build-identity/`: message, type, immutable reader and barrel. An unembedded harness bundle reports unavailable.
- `apps/extension/src/background/diagnostics/build-identity.ts`, diagnostic barrel/test, background index: exact control-page authorization, safe numeric tab id, frame-zero query before gateway setup.
- `apps/extension/src/content/message-handler.ts`: only active top frame responds.
- `packages/test-runner/src/run-scenario/browser-session/build-identity/`: strict screened projection, comparison, preflight, mismatch/ordering tests and opt-in production-browser probe; browser-session barrel and run-scenario wiring.
- `docs/architecture/testing-facility.md`, `extension-client.md`: diagnostic/preflight contracts and precise limitations.

## Validation observed

- `pnpm.cmd exec tsc -p packages/test-runner/tsconfig.json`: exit 0 (builds tests for the named narrow node invocations).
- `pnpm.cmd exec tsc -p apps/extension/tsconfig.json --noEmit`: exit 0 after final source freeze.
- `node --test apps/extension/scripts/release/tests/build-identity.test.mjs apps/extension/scripts/release/tests/release.test.mjs`: 10/10 passed.
- Isolated esbuild bundle of `src/background/diagnostics/tests/build-identity.test.ts` followed by node --test: 1/1 authorization/frame-zero test passed.
- Final combined `identity.test.js` + opt-in `browser-probe.test.js`: 22/22 passed. Unit cases independently reject background/content/disk changes to target, version, protocol and each input digest; missing/legacy/malformed identity refuses; additional token/page fields are dropped. Source ordering guard proves initial content loading precedes identity preflight and chat/recording follow it.
- `guarded-browser/tests/launch-containment.test.js`: 3/3 passed. `run-evaluation/tests/runner-wiring.test.js`: 23/23 passed after restoring LF in the touched run-scenario source (a Windows newline write initially broke its literal source assertion).
- `node scripts/structure-audit.mjs`: exit 0, 176 advisory warnings / 118 baselined. `git diff --check`: exit 0.
- Extension target build: Chrome, Firefox, E2E target validation passed. Existing Firefox permanent add-on id placeholder warning persists.

## Real provider-free browser proof

Browser: Chrome/134.0.6998.35, Playwright bundled Chromium, full production E2E extension target. Fixture: a generated isolated loopback HTML button page; no Core server or provider. One owned persistent temporary profile was used across four launches and removed afterwards.

1. Matching disk/background/content identities: admitted the simulated dispatch and reported verified=true.
2. Background digest deliberately changed without changing disk/content: refused, dispatch count 0.
3. Content digest deliberately changed without changing disk/background: refused, dispatch count 0.
4. Disk digest deliberately changed without changing background/content: refused, dispatch count 0.

Final tested bundle digest: `e30c95a02edb5b279e1088b6f12ec2759d60c4995c7945ee6981389297560881`. The tested artifact lives at `apps/extension/dist/e2e-chromium` in t297 and contains 149 reached Core inputs / 100 reached domain inputs. No recorded page data, browser storage or credentials were logged. Supervisor separately reported an independent corrected-build browser probe pass.

Reproduce from repository root (PowerShell; no provider calls):

```powershell
node apps/extension/scripts/build-extension.mjs
pnpm.cmd exec tsc -p packages/test-runner/tsconfig.json
$env:FLUXIQ_IDENTITY_BROWSER_PROBE='1'
node --test packages/test-runner/dist/run-scenario/browser-session/build-identity/tests/browser-probe.test.js packages/test-runner/dist/run-scenario/browser-session/build-identity/tests/identity.test.js
```

The probe defaults to this checkout's generated E2E target. For a Lab-owned alternate build root, explicitly set `FLUXIQ_IDENTITY_EXTENSION_PATH` to its E2E target. The browser probe skips ordinary package suites unless `FLUXIQ_IDENTITY_BROWSER_PROBE=1` is set.

## Work ledger / corrections

- Read main Current State/brief, revised P0 plan, consultant browser/Lab audit; inspected build stamp, content/background message owners and launch preflight.
- Held source edits until supervisor confirmed provisioning completion.
- Added generator, authenticated diagnostic, strict Lab gate and negative tests; initial extension TS2559 and two non-barrel import audit failures were corrected.
- Real production match/mismatch proof initially passed. A refinement to make an unembedded placeholder valid JSON exposed esbuild choosing a different quote style, so replacement failed and the real match probe correctly refused. Replaced it with a unique valid JSON numeric placeholder, rebuilt and reran; corrected final proof passed.
- Restored LF after Windows text-writing changed touched source newlines; literal runner wiring regression then passed.
- Updated authored architecture notes and recorded final validation above; source frozen before supervisor integration.

## Next / supervisor integration

Integrate only authored files; keep build/test output ignored. Rebuild against the final merged repository pair before paid A-D qualification. Running Core server identity is not covered by this slice. No commit or push was made by the worker.
