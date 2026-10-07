# P0 executing server adapter identity ? t310

Status: native registered-owner implementation independently verified; integration pending, actual production Next proof held for explicit user authorization. Work occurs only in paired fxwork/t310 trees. No git, providers, user panel, or actual Next process started.

## Ownership and behavior

Core ClientGatewayService has a separate transport provenance collaborator and immutable original anchor. Binding happens before listener/socket IO; only the current lease may activate at listening or clear on close/error. Missing, inactive, released, and legacy uninstrumented bindings attest null. Legacy clearing preserves the original anchor; changed identity refuses before listener creation. The existing authenticated runtime diagnostic reads the actual gateway-owned descriptor in serverTransportIdentity, independently of native domain loadedModules.

The actual server adapter is Core apps/web/src/server/client-gateway-websocket.ts, compiled by the owning driver into apps/web/.server-runtime/client-gateway-server.mjs. The reader's executed semantics remain in the normalized artifact hash; only its single self-containing payload literal is normalized. The complete server/script/build-cache inventory, web startup, manifests, and lockfile contribute to sourceInputsDigest. Core web startup preloads the native factory and invokes it with the actual retained ClientGatewayService. No imported second module registry is used to project identity onto that owner.

Lab generates the canonical artifact before build-key collection, copies artifact and companion with the staged workspace, validates canonical and copied freshness before Next build or reuse, and requires the running gateway identity before project/browser/chat work. This supported startup contract does not establish that an arbitrary out-of-band listener or individual remote socket belongs to the registered gateway.

## Observed validation so far

- Fail-first: four actual source ClientGatewayService regressions failed because the new API did not exist; then passed after implementation.
- Core focused owner/diagnostic/embedded-reader tests passed; native loader fixture initially exposed a negative import cache issue in the fixture, corrected by using separate missing/wrong/valid URLs. The corrected loader test passed.
- Owning generator plus build-cache registry tests: 9 passed.
- Runner TypeScript emit: passed.
- Runner staging/input/identity tests: 31 passed, including added/omitted inventory keys, executed framing/reader mutations, stale copied artifact, missing control, separate host field, and gate order before dispatch.

## Remaining work and limits

Actual generated native socket/retained-owner/route-and-factory-reload/fresh-owner proof passed in Chromium 134.0.6998.35. The actual retained service refused the regenerated intended artifact after a real handler import reload. A changed actual factory import refused before creating a new listener. Legacy binding reported null without resetting its anchor; a fresh child process matched. The proof recorded zero chat/provider calls, one real socket connection, and used only an owned synthetic authenticated HTTP diagnostic wrapper. Copied generator inputs/artifact were isolated and deleted after bounded owned-child cleanup. Actual production Next startup is explicitly unexercised: repository instructions require current-session panel-management authorization and the user has not provided it. An opt-in fixture/command will be prepared for supervisor review; it must not be run by this worker. Full suites and paid/live provider work are outside this brief.

## Final owning checks and commands

Observed against frozen t310 source before supervisor dev integration:

- `pnpm --filter fluxiq build`: passed; generated Core stamp through owning build, no manual stamp edits.
- `pnpm --filter fluxiq exec tsc --noEmit -p tsconfig.json`: passed.
- `node apps/web/scripts/build-client-gateway-server.mjs`: passed; canonical native artifact and companion regenerated through the driver.
- `pnpm --filter @fluxiq/web exec tsc --noEmit`: passed.
- `pnpm --filter fluxiq exec vitest run src/client-gateway/service/transport-build-identity/tests/owner.test.ts src/programs/automation-studio/api/handlers/diagnostics/tests/runtime-identity.test.ts`: 8 passed.
- `pnpm --filter @fluxiq/web exec vitest run src/server/tests/client-gateway-websocket.test.ts src/server/gateway-runtime/tests/load.test.ts src/server/build-identity/tests/read.test.ts src/lib/tests/fluxiq.test.ts`: 27 passed.
- `node --test apps/web/scripts/gateway-server-identity/tests/*.test.mjs scripts/build-cache/tests/registry.test.mjs`: 9 passed.
- Existing actual Next route and program-route restrictions tests: 55 passed (unit route invocation, not a running Next process).
- `pnpm exec tsc -p packages/test-runner/tsconfig.json`: passed.
- Runner owning Core-web-build directory, server identity, Core/host identity, and runner-wiring tests: 101 passed, 1 skipped (production Next fixture). Includes actual workspace copy of artifact and companion and build-key invalidation by either file.
- Core and downstream structure audits passed with advisory/baselined warnings; no baseline changes. Core gateway facade now has 27 methods (two additive provenance delegates), while state lives in its narrow collaborator.

From the paired downstream tree, independently runnable actual proof:

```powershell
$env:FLUXIQ_SERVER_ADAPTER_PROBE='1'
node --test packages/test-runner/dist/run-scenario/browser-session/server-adapter-identity/tests/server-probe.test.js
Remove-Item Env:FLUXIQ_SERVER_ADAPTER_PROBE
```

Build prerequisites are current Core fluxiq dist, the generated canonical native artifact/companion, and runner TypeScript emit. Optional root overrides: `FLUXIQ_SERVER_ADAPTER_CORE_ROOT` and `FLUXIQ_SERVER_ADAPTER_DOWNSTREAM_ROOT`. The executed proof's fresh normalized artifact digest was `877af66c9a43ae0738934317d2cd642851cc1f9849ff6be2d5801b1bd83eb85a`; this was the isolated changed-reader fixture, not the canonical repository artifact. Child startup/IPC/build waits are bounded, stderr retains at most 4096 bytes, and fallback cleanup kills only owned children. Node fork has no typed windowsHide option; build spawn uses windowsHide true.

Prepared production Next fixture, **not executed** and requiring root-recorded explicit user authorization before the command:

```powershell
$env:FLUXIQ_SERVER_ADAPTER_NEXT_PROBE='1'
node --test packages/test-runner/dist/run-scenario/browser-session/server-adapter-identity/tests/next-probe.test.js
Remove-Item Env:FLUXIQ_SERVER_ADAPTER_NEXT_PROBE
```

This fixture uses existing production build preparation and supervised `next start`, short isolated state/cache paths, an isolated viewer session, unique local ports, provider-disabled configuration, and an outbound-fetch trap. It checks unauthenticated refusal and the actual restricted diagnostic against the staged copied artifact. Its code compiled and default skip was observed; readiness/authentication/module-loading/cleanup behavior under actual production Next remains unverified. The full authorization condition is the repository's explicit current-session panel-management requirement, not merely the environment flag.

## Exact source ownership delivered

Core changed existing `packages/fluxiq/src/client-gateway/service.ts`, existing diagnostic `programs/automation-studio/api/handlers/diagnostics/runtime-identity.ts` and its test; added `client-gateway/service/transport-build-identity/{owner,lease,index}.ts` and owning test. Web changed `src/server/client-gateway-websocket.ts` and its owning test, `src/lib/fluxiq.ts`, web package scripts, Core cache `scripts/build-cache/steps.mjs`, and `.gitignore`; added `src/server/{build-identity,gateway-runtime}/` modules/barrels/owning tests and `apps/web/scripts/build-client-gateway-server.mjs` plus `gateway-server-identity/` generator/barrel/tests. Scoped architecture: `docs/architecture/automation-studio/client-gateway.md`.

Downstream changed `packages/test-runner/src/core-web-build/{prepare,publication,index}.ts` and owning prepare/input tests; added `core-web-build/server-adapter.ts` and test-only fixture. Added `run-scenario/browser-session/server-adapter-identity/` modules/barrel/identity/native-probe/opt-in-Next tests; changed its parent barrel and the additive `run-scenario.ts` gate. Scoped architecture: `docs/architecture/testing-facility.md`; own report only. No native host slot, Core generation service, provider policy, instrumentation, shared working document, or git mutation changed.

After latest dev integration, the supervisor must regenerate Core and native stamps through owning drivers and independently rerun affected checks and the native proof. The unexecuted production Next limitation remains a prerequisite to claiming actual panel transport provenance; no paid/live readiness claim is made here.

## Focused fixture correction after supervisor integration

Only `server-adapter-identity/tests/next-probe.test.ts` changed: it resolves the intended worktree parent through `realpath`, creates a random immediate-child `np-*` root, and re-resolves/verifies the absolute cleanup target, parent, owned name, and lack of redirection before recursive removal. Its spawn environment now explicitly uses `withoutProviderSecrets(process.env)` while retaining disabled providers and the outbound-fetch trap. The fixture/report are frozen again. No tests, builds, runtime, providers, panel, or git actions were run for this correction because the supervisor is running frozen-source checks. Production Next remains unexecuted and unauthorized.

## Supervisor independent merged-source verification

Root merged current downstream1115c14a/Core595daf8d (with t309/t311), reviewed actual gateway lease/native loader/generator/cache/staging/early gate and repeated owner+diagnostic8/8, web factory/loader/reader/startup27/27, actual route invocation55/55, generator/cache9/9. Owning fluxiqcheck0 actual40.002s/build0 actual57.261s; native generator0; web source typecheck0; runner emit0. Root runner selected directories78 passed/four opt-in probes skipped, not a101-test claim. Separately actual native socket proof1/1 zero skips7.059s wall (fixture5.873s) in Chromium134.0.6998.35: original retained gateway/real socket, changed source+generator+actual handler reload refused, changed factory refused before IO, legacy clear retained anchor and fresh child matched; provider/chat0.

Core audit first found the paired working index stale after merged ledger updates; regenerated through its owning rule, then Coreaudit0. Downstreamaudit0. Prepared Next fixture additionally strips inherited provider secrets and checks resolved owned immediate-child cleanup. Actual production Next still unexecuted: root sent an explicit authorization question under AGENTS current-session panel rule; no answer yet, no permission inferred. These narrow receipts support native registered-owner provenance, not P0 completion or production Next/paired action qualification. No full suite/provider/user-panel action.

## Integration scope

Supervisor will integrate the coherent native registered-owner identity and Lab early gate after observed narrow checks. Actual Next opt-in probe remains prepared but unexecuted because the explicit current-session panel-management question is unanswered. Its native/socket/actual-handler evidence above is not substituted for production Next startup/authentication evidence; P0 and paid qualification remain open. Latest downstream dev43837638 merged with no changed t310 product source; final downstream structure audit0,176 warnings/117baseline.
