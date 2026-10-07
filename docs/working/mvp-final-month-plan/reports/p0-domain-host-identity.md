# P0 loaded domain host identity ? t305

Status: worker implementation complete; source frozen, pending supervisor integration/verification; paired source is isolated in `fxwork/t305`. No integration, commits, providers, user panel, or full suites by this worker.

## Changes and decisions

- Core optional native-runtime provenance is domain-neutral and held in a WeakMap keyed by the actual service. A frozen original anchor prevents changed instrumented code from replacing a retained owner. Legacy binding clears active attestation without erasing that anchor; ordinary legacy use stays usable.
- The diagnostic endpoint projects active loaded-module descriptors from that retained service. Existing authentication/read restrictions remain the same.
- The domain host binds embedded identity before registering domain, recording, or IO. Its owning esbuild generator stamps only one self-containing base64 payload literal; all surrounding executed bytes are hashed. This is a normalized executable digest, not a raw whole-file hash.
- Source inputs cover complete domain `src/*.ts`, domain generator `scripts/*.mjs`, downstream build-cache `*.mjs`, and domain package manifest, recursively excluding directories named `tests`. Source-input digest is embedded as well as normalized executable digest. Lab compares exact inventory keys before hashes, catches additions/omissions, and checks the actual per-run intended host and companion stamp. The launcher copies that companion with each host.
- Authenticated live/Flow Lab setup verifies both Core identity and loaded host identity before project preparation, browser launch, chat, or provider dispatch. Pure offline recording without control retains its existing exemption.

## Validation as work progresses

- Fail-first Core binding probe failed to import the absent owning module; after implementation, binding/diagnostic tests passed 6/6. Tests cover frozen capture, same identity rebind, legacy clearing, retained original anchor, changed replacement refusal, malformed descriptor, and endpoint active-only projection.
- Core package typecheck passed. Core structure audit passed (279 existing warnings, 349 baselined); Core build regenerated successfully. Final Core typecheck passed after all owning test changes.
- Host generator focused tests passed 2/2: malformed/missing/multiple slots, surrounding executed semantics, complete generator/cache inputs and independently changed source digest.
- Runner host identity focused tests passed 15/15 (5 top-level plus 10 freshness defects). Runner TypeScript passed. They verify absent/stale/duplicate/malformed loaded module refusal, full source additions/changes/omissions, stale artifact/reader, missing companion, and gates before dispatch.
- Domain source/test typecheck passed; existing domain mapper tests passed 10/10 using a single owning bundled test file. Downstream structure audit passed (176 existing warnings, 117 baselined). Chrome, Firefox and E2E Chromium extension builds regenerated; each verified 22 files (existing Firefox permanent-id warning remains).
- Generator + build-cache registry + Lab instance/lock tests passed 21/21; runner/Core/host identity and existing runner wiring final combined run passed 55/55, with no skipped proof. The actual built-host test is included in that count.
- Headed Chromium **134.0.6998.35** reached a child process that constructed actual built `FluxIQ` with `modelProvidersEnabled:false`, imported actual separately bundled host, and registered the actual Core identity handler. Initial match admitted only a simulated dispatch counter. Changed source without rebuild refused before identity request/dispatch. The copied owning esbuild driver rebuilt executable + companion; a query-suffixed native import reloaded the **actual diagnostic handler** and registered it against the same retained service; that service still refused. Importing changed host into that retained owner rejected with **zero** domain/recording/adapter/host-IO mutation calls. Legacy native binding then cleared active identity; re-importing changed host still rejected (anchor retained). Fresh child process loaded rebuilt host and matched. Actual fetch/chat/runtime/build invocation counter remained **0**; simulated admission count was **2**. No user panel process was started or stopped.
- Proof transport is an owned loopback HTTP server with a public fixture bearer; Chromium performs the actual HTTP fetch. This is not a production Next/pairing/gateway-server transport proof. Existing restricted route tests were preserved; narrow Core diagnostic tests verify active-only provenance under the existing permission/classification.
- Final proof-only hardening passed the same 55/55 combined checks: startup/IPC waits capped at 20 seconds; copied owning build capped at 20 seconds; graceful child close capped at 3 seconds, then owned-child kill and 5-second exit wait; cleanup also handles an outstanding copied build. Stderr diagnostics cap at 4096 bytes and 4096 text characters. Spawn uses `windowsHide:true`; installed Node `ForkOptions` does not expose that option, so fork uses pipes/IPC without a cast. Source replacement and actual rebuilt reader semantics are asserted. Browser/fixture authentication remains public test data only.
- Exact final intended host stamp: version `0.1.0`, normalized artifact digest `9fa557357cd61d7b8cdd3995f9b65a5bbeb60bdaef56d44da05cfb86886394d0`, source-input digest `d07c1e11465e7c61df900c4a224b53f8500e73b260fd6cd1eede33f88c7255e1`, **370** source inventory keys. Proof generates a different copied artifact after intentionally changing reader implementation; owning esbuild source-location comments also depend on the copied path, so its test diagnostic digest is specific to that proof run.

## Failures found and corrected

- The first domain typecheck rejected unchecked regex capture access; added the justified non-null assertion after a successful match, then rebuilt host and passed source/test typecheck.
- First actual-host process proof failed in the test wrapper before host loading: it assumed `registerRuntimeAdapter` existed on Automation Studio. Corrected the fixture to instrument actual `fluxiq.runtime.registerAdapter` and service `bindRuntimeService`; actual proof then passed.
- A Python write changed the runner source to CRLF and broke an existing literal LF wiring assertion (54/55 combined). Restored the runner's original LF bytes; 54/54 focused regression checks and the final actual-proof combined 55/55 passed.
- No paid run, full suite, route/panel management, provider configuration, git mutation, or generated stamp hand-edit was used.

## Independently runnable focused proof

Run from the paired Core tree first, while source is frozen:

```powershell
pnpm.cmd --filter fluxiq build
pnpm.cmd --filter fluxiq check
pnpm.cmd exec vitest run packages/fluxiq/src/runtime/build-identity/modules/tests/binding.test.ts packages/fluxiq/src/programs/automation-studio/api/handlers/diagnostics/tests/runtime-identity.test.ts
```

Then from the paired downstream tree (each step sequential after Core build completes):

```powershell
node domain/scripts/build-web-panel-host.mjs
node apps/extension/scripts/build-extension.mjs
pnpm.cmd --filter @fluxiq-web-extension/domain check
pnpm.cmd exec tsc -p packages/test-runner/tsconfig.json
$env:FLUXIQ_HOST_IDENTITY_PROBE='1'
node --test packages/test-runner/dist/run-scenario/browser-session/host-identity/tests/server-probe.test.js packages/test-runner/dist/run-scenario/browser-session/host-identity/tests/identity.test.js packages/test-runner/dist/run-scenario/browser-session/core-identity/tests/identity.test.js packages/test-runner/dist/run-evaluation/tests/runner-wiring.test.js
node --test domain/scripts/host-build-identity/tests/build.test.mjs scripts/build-cache/tests/registry.test.mjs scripts/lab/tests/lab-instance.test.mjs
```

Proof-only overrides are `FLUXIQ_HOST_IDENTITY_DOWNSTREAM_ROOT` and `FLUXIQ_HOST_IDENTITY_CORE_ROOT`; defaults resolve the paired sibling trees. Each proof owns a temporary copied domain tree, companion receipt, built host, state and child server, and removes them afterward. It uses no browser profile/recording/user data. The original current host/stamp is not changed by the proof.

## Source owners for integration

Core:

- New `packages/fluxiq/src/runtime/build-identity/modules/{types,registry,screen,bind,read,index}.ts` and `tests/binding.test.ts`.
- `packages/fluxiq/src/runtime/index.ts`: public optional descriptor type export.
- `packages/fluxiq/src/programs/automation-studio/runtime/service.ts`: optional binding argument/helper before assignment, no added service method or generation/body changes; file line count stays unchanged.
- `packages/fluxiq/src/programs/automation-studio/api/handlers/diagnostics/runtime-identity.ts` and owning `tests/runtime-identity.test.ts`: additive active loaded module projection.

Downstream:

- New `domain/src/host-build-identity/{read,index}.ts`; `domain/src/web-panel-host.ts` early identity/native binding.
- New `domain/scripts/host-build-identity/{inventory,normalize,build,index}.mjs`, `tests/build.test.mjs`; `domain/scripts/build-web-panel-host.mjs` owning stamp generation.
- `scripts/build-cache/steps.mjs` required companion output (existing cache fingerprints include build-cache sources); `scripts/lab/run-lab.mjs` companion copy.
- New `packages/test-runner/src/run-scenario/browser-session/host-identity/{types,screen,inventory,normalize,expected,assert-match,verify,index}.ts`, owning `tests/{identity,server-probe}.test.ts`.
- `packages/test-runner/src/run-scenario/browser-session/index.ts` barrel; `packages/test-runner/src/run-scenario.ts` mandatory early host verification beside Core gate, preserving the existing condition/offline exemption and original LF bytes.
- This own report. No shared working/architecture document edits; supervisor must reconcile current state/architecture and regenerate all stamps after integration before considering paid Lab admission.

## Scope limits

This proves separately bundled downstream domain-host provenance through a trusted local Core binding. It does not attest to the actually loaded external gateway-websocket server adapter. Existing extension adapter/contract digest remains a separate reached-artifact scope; no raw server adapter identity or paid success is claimed.

## Supervisor merged-source verification

Core source00987b83 and downstream59a32016 were merged with current dev before root checks. Independent Core binding/diagnostic6/6; Core source check27.8s and owning build39.9s passed. Sequential host generation, three22-file extension builds and runner compilation passed; domain source/test check18.9s and generator/cache/Lab21/21 passed. Root reran actual built-host headed Chromium134.0.6998.35 plus host/Core identity and runner wiring:55/55 zero skips9.27s, actual fixture7.89s. Real handler route reload remained bound to old host, changed rebinding caused zero IO mutation, fresh child matched; actual chat/provider calls0. Root Core audit0; downstream task integration audit follows. Intended regenerated host normalized artifact45182cdfd031ad946e3562604b88e609ac7e80516b569df7088da8a298cc2dd9; merged dependency inputs differ from worker's earlier stamp. Synthetic authenticated transport is explicitly not production Next/gateway pairing. External server adapter attestation remains pending. Authored Core/downstream architecture updated.
