# P4 requests policy foundation (t324)

## Current state

SOURCE AND REPORT FROZEN for supervisor integration/review. Isolated downstream `fxwork/requests-policy/t324-requests-policy-foundation`; private sibling Core ad232818 detached/read-only. Provision87762 exit0 is infrastructure only. Foundation implemented within approved owners: validated immutable domain policy, unavailable Settings control and forced-OFF persistence. Owning Settings22/22 and domain/policy/adapter/host45/45 passed; actual isolated Chromium1/1 passed, same-source screened evidence repeat1/1 passed. Final source/e2e types and owning extension build exit0. Structure audit has ONLY shared generated working README drift; root owns regeneration and independent integration gates. No Core, manifest, executable request/capability or script changes, provider, user panel, real profile or full suite.

## Approved contract and scope

Domain defaults: enabled false; allowedOrigins empty; credentials omit; redirects reject; timeoutMs 10000; maxResponseBytes 262144. Integer timeout bounds 1000..30000 ms; response bounds 1024..1048576 bytes. At most32 unique canonical exact HTTPS origins; reject path/query/fragment/userinfo/wildcard/noncanonical forms and duplicate origins. Sort origins for stable comparison. Enabled true requires at leastone origin, but this foundation never executes or advertises requests.

Validate plain own data and reject unknown/symbol/accessor/provided-undefined fields. Clone/freeze before registration; equal normalized registration is idempotent, conflicting registration refuses without replacing the original policy. Preserve ordinary domain/native actions. No browser fields in generic Core configuration.

Extension requestsEnabled defaults and remains false in this foundation, including stored, save and draft attempts to set true. Settings displays a disabled unchecked `Allow direct requests` switch and visible `Unavailable in this version.` Server policy and browser preference are prerequisites, neither an execution grant. No network capture or script capability is introduced.

## Approved owners

Extension shared protocol/browser; background saved-state; background/panel/settings-save; panel/settings form-fields/address-form/draft-store and owning tests. Domain host and runtime service/adapter; narrow requests/policy contracts/validation/index and required barrels/owning tests. Architecture: scoped extension-client paragraph. Browser proof: e2e/runtime/tests/requests-settings.spec.ts using existing isolated fixture. No shared working document edits.

## Validation plan

Behavioral fail-first settings read/save/draft and domain policy/rebind negatives; narrow owning tests. Domain source/test and extension source/e2e types; owning extension build and structure audit. Actual isolated unpacked Chromium Settings proof: disabled/unavailable control, forced-OFF persisted default, existing Settings save remains functional, request capability absent. No user panel, real browser profile or full suite.

## Outstanding execution prerequisites

Executable requests require a separate broker and exact preexecution approval bound to trusted project/run/attempt/effect/client/session/request/resource/policy identities, with durable unknown/no-retry joins on both native and recorded-policy paths. Credentials/authenticated site sessions and redirects are unsupported initially. Arbitrary DOM scripts remain held: prototype CSP permitted image/navigation egress and established neither hard interruption nor rollback.

## Measured validation ledger

- Initial command had wrong working-directory prefixes and pnpm.ps1 execution-policy rejection; no behavioral tests ran. Corrected to extension-relative paths and pnpm.cmd.
- Real Settings behavioral fail-first:14 tests,11 passed/3 failed; merge retained true, missing saved flag was undefined, absent UI field. After implementation21/21 passed.
- Actual draft-write negative then exposed direct write persisting true:7/8 passed/1 failed; fixed approved draft-store write path to clamp false. Final Settings22/22 zero skips,259.674ms test duration;1.134s command wall.
- Domain policy9/9 zero skips; host entrypoints tested against a framework collaborator fixture, not actual Core server. Extended owning regressions include existing adapter and host-runtime:45/45 zero skips,4.827s test duration/7.239s command wall.
- Direct extension source, domain source/test and extension source/e2e type commands exit0. Final extension source/e2e repeat after first browser fixture correction exit0. No whole package suite.
- Owning extension builds exit0:25.148s initial;12.289s after draft-write fix;17.842s after tab-target fixture correction. Chrome, Firefox and e2e Chromium each22 verified files. Firefox permanent add-on ID remains existing placeholder warning. No generated artifact edited manually.
- Structure audit initially found test barrel import (fixed) and shared generated working index drift. Repeat has only README drift; supervisor owns regeneration after final report. No baseline increase.
- Actual isolated browser command: `pnpm.cmd exec playwright test -c e2e/playwright.config.ts e2e/runtime/tests/requests-settings.spec.ts --workers=1 --reporter=list` from apps/extension. First failed4.1s because diagnostic request omitted required tabId (harness); corrected owned static loopback page/tab, identity matched background/content. Second failed2.2s because ordinary Reconnect UI remained initially true while test expected an earlier background-only setting change; fixture now explicitly unchecks the UI control before Save. Both attempts observed request OFF; neither is product fail-first evidence. Final rebuild/repeat pending.

## Final additional exact owners

Approved background/storage.ts write normalization and new background/tests/storage-settings.test.ts; panel/settings/address-form.ts disabled control and draft-store.ts forced-OFF read/write, settings-draft.test.ts. Six typed fixtures receive only additive requestsEnabled:false: background/tests/connection-status.test.ts; background/diagnostics/tests/problem-report.test.ts; background/panel/tests/panel-control.test.ts; panel/chat/tests/owner-context.test.ts and chat-owner-recovery.test.ts; panel/automations/tests/controller-owner-recovery.test.ts.

- Third actual browser attempt reached repair assertion and failed7.1s: panel reload preserved the running worker's cached settings, so bypass-written storage true had not been read/repaired. This was a fixture lifecycle error, not proof that readSettings repair failed. Corrected to restart the owned MV3 worker using existing restartServiceWorker helper before reopening Settings, matching the actual saved-state ownership. Final browser/build/type repeat pending; final pre-correction build17.017s exit0 and e2e type repeat0.

## Final validation receipt

Production/test source froze after the final owning fixture correctly restarts the owned worker. Final extension build exit0,22.348s: Chrome/Firefox/e2e Chromium22 files each. Final extension source/e2e `tsc -p tsconfig.test.json --noEmit` exit0 after the final fixture change; domain source/test exit0 and extension source exit0 as recorded above. Source-only package checks did not substitute for the actual browser.

Actual same-source browser success1/1 zero skips:4.1s fixture/6.4s total. Evidence-only JSON repeat completed before root's subsequent request not to repeat:1/1 expected,zero skipped/unexpected/flaky;JSONstats3355.664ms,commandwall5.400s. No further worker runs afterward. Screened attachment: actual UA Chrome/134.0.0.0 on Windows, Playwright bundled Chromium; e2e-chromium version0.1.0, identity protocol fluxiq.build-identity.v1. Actual background and content matched expected inputsDigest `fe2208c16acc700b6220d604d43f6efbe4ed5e9fa0368944645d427fff2db334`, coreInputsDigest `2079970af3bbedb532763bef559d975ab79eae4937b2b36087567950866b531b`, domainInputsDigest `0be6326dd122f1943deb2a099fa4597c08a2dfe0dbac61045dd634a9304ae0d1`.

Observed disabled unchecked control/visible unavailable hint; ordinary Reconnect checkbox Save; injected checked request preference still persists false; bypass-written saved true repairs to false on actual MV3 worker restart and reopened Settings. Existing fixture closes its isolated browser/profile; owning loopback static HTTP fixture closes all connections and bounds close to2000ms. No FluxIQ panel was started. Browser outputs are ignored, not committed. JSON evidence path `apps/extension/e2e/test-results/t324-settings-proof.json`.

## Independently runnable exact commands

Run from this task root for types/build/audit:

```powershell
pnpm.cmd exec tsc -p apps/extension/tsconfig.json --noEmit
pnpm.cmd exec tsc -p apps/extension/tsconfig.test.json --noEmit
pnpm.cmd exec tsc -p domain/tsconfig.json --noEmit
pnpm.cmd exec tsc -p domain/tsconfig.test.json --noEmit
pnpm.cmd --filter @fluxiq-web-extension/extension build
node scripts/structure-audit.mjs
```

Run from apps/extension for exact owning Settings bundles/tests:

```powershell
pnpm.cmd exec esbuild src/background/tests/saved-state.test.ts src/background/tests/storage-settings.test.ts src/background/panel/tests/settings-save.test.ts src/panel/settings/tests/connection-settings.test.ts src/panel/settings/tests/settings-draft.test.ts --bundle --platform=node --format=esm --outbase=src --outdir=.test-build-scratch/t324-own --out-extension:.js=.mjs --external:fluxiq --external:fluxiq/* --external:@fluxiq/client-gateway-websocket --log-level=error
node --test .test-build-scratch/t324-own/background/tests/saved-state.test.mjs .test-build-scratch/t324-own/background/tests/storage-settings.test.mjs .test-build-scratch/t324-own/background/panel/tests/settings-save.test.mjs .test-build-scratch/t324-own/panel/settings/tests/connection-settings.test.mjs .test-build-scratch/t324-own/panel/settings/tests/settings-draft.test.mjs
pnpm.cmd exec playwright test -c e2e/playwright.config.ts e2e/runtime/tests/requests-settings.spec.ts --workers=1 --reporter=list
```

Run from domain for exact policy and existing adapter/host regression bundles:

```powershell
pnpm.cmd exec esbuild src/requests/policy/tests/validation.test.ts src/requests/policy/tests/registration.test.ts src/runtime/tests/adapter.test.ts src/runtime/tests/host-runtime.test.ts --bundle --platform=node --format=esm --outbase=src --outdir=.test-build-scratch/t324-own --out-extension:.js=.mjs --external:fluxiq --external:fluxiq/* --external:@fluxiq/client-gateway-websocket --log-level=error
node --test .test-build-scratch/t324-own/requests/policy/tests/validation.test.mjs .test-build-scratch/t324-own/requests/policy/tests/registration.test.mjs .test-build-scratch/t324-own/runtime/tests/adapter.test.mjs .test-build-scratch/t324-own/runtime/tests/host-runtime.test.mjs
```

## Exact changed owner inventory (32 files including this report)

- apps/extension/src/shared/protocol.ts
- apps/extension/src/shared/browser.ts
- apps/extension/src/background/saved-state.ts
- apps/extension/src/background/storage.ts
- apps/extension/src/background/panel/settings-save.ts
- apps/extension/src/panel/settings/form-fields.ts
- apps/extension/src/panel/settings/address-form.ts
- apps/extension/src/panel/settings/draft-store.ts
- apps/extension/src/background/tests/saved-state.test.ts
- apps/extension/src/background/tests/storage-settings.test.ts (new)
- apps/extension/src/background/panel/tests/settings-save.test.ts (new)
- apps/extension/src/panel/settings/tests/connection-settings.test.ts
- apps/extension/src/panel/settings/tests/settings-draft.test.ts
- apps/extension/src/background/tests/connection-status.test.ts (fixture-only)
- apps/extension/src/background/diagnostics/tests/problem-report.test.ts (fixture-only)
- apps/extension/src/background/panel/tests/panel-control.test.ts (fixture-only)
- apps/extension/src/panel/chat/tests/owner-context.test.ts (fixture-only)
- apps/extension/src/panel/chat/tests/chat-owner-recovery.test.ts (fixture-only)
- apps/extension/src/panel/automations/tests/controller-owner-recovery.test.ts (fixture-only)
- domain/src/host.ts
- domain/src/runtime/service.ts
- domain/src/runtime/adapter.ts
- domain/src/index.ts (additive barrel)
- domain/src/requests/index.ts (new barrel)
- domain/src/requests/policy/contracts.ts (new)
- domain/src/requests/policy/validation.ts (new)
- domain/src/requests/policy/index.ts (new barrel)
- domain/src/requests/policy/tests/validation.test.ts (new)
- domain/src/requests/policy/tests/registration.test.ts (new)
- apps/extension/e2e/runtime/tests/requests-settings.spec.ts (new)
- docs/architecture/extension-client.md (scoped paragraph)
- docs/working/mvp-final-month-plan/reports/p4-requests-policy-foundation.md (this report)

## Limits and remaining gates

Root independent source review/merged-dev checks and shared working README regeneration remain. No P4 executable request, authenticated site session, redirect, network capture, arbitrary script, grant UI or production durable command join is implemented. Policy controls are not a security sandbox or execution grant. Canonical HTTPS origins validate configuration spelling; this unit performs no DNS/IP confinement proof. Actual browser result covers bundled Chromium only, not installed Chrome/Edge or Firefox parity. Host registration tests use a framework collaborator fixture, not a running Core/Next instance. Reloaded validation-module ownership and release qualification are not claimed. No commits/pushes/shared docs/Core source changes by this worker.
