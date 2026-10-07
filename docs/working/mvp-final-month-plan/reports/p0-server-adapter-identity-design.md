# P0 executing server adapter identity ? design only

Status: proposed for supervisor approval. Source inspection only; no builds, processes, providers, git, runtime-state reads or source edits. Own report is the only authored change. Main Current State and t305 scope limits were read; t305 remains under supervisor integration, so its frozen paired source was consulted for the additive descriptor/anchor contracts.

## Finding: the client package is not the server adapter

`Core/packages/client-gateway-websocket/package.json` describes a browser-safe client. Its `src/transport.ts` owns `FluxIQClientGatewayWebSocketClient`, and `src/automation-studio.ts` delegates recording messages to that client. Its dist digest is relevant to the extension client, not proof of a loaded server transport.

The actual web-panel server is `Core/apps/web/src/server/client-gateway-websocket.ts`:

- `startClientGatewayWebSocketServer(options)` creates the HTTP server, installs its upgrade handler and calls `server.listen`.
- `acceptClientGatewaySocket` constructs `NativeWebSocketConnection` and calls the actual `options.gateway.connect({socket})`; text reaches `gateway.receiveRaw(sessionId,message)`; close reaches `gateway.disconnect`.
- Frame parsing, masking, fragmentation, ping/close handling and writes are implemented locally in that same file. Node HTTP/stream/crypto are the platform dependencies; `fluxiq/client-gateway` supplies the generic service/protocol contract.
- `Core/apps/web/src/lib/fluxiq.ts` statically imports the server factory. `startSharedClientGateway` passes `state.instance.programs.clientGateway`; its result is retained at `globalThis.__fluxiqWebRuntime.clientGatewayServer` alongside the retained FluxIQ instance. An existing handle short-circuits subsequent starts. `reloadFluxIQWebInstance` closes the old server/instance and creates a new owner; ordinary route reload does not.
- Next/Turbopack currently bundles this source into executing server chunks. `packages/fluxiq/dist` identity does not contain these web-app transport implementation bytes. Neither the client package nor a latest disk diagnostic closes this scope gap.

The authenticated Core diagnostic dependency record already includes the actual `clientGateway` object (`AutomationStudioApiDependencies`; `registerAutomationStudioApi`). No new program endpoint, permission, bearer, pairing field or public health identity response is required.

## Recommended bounded seam

Use the existing t305 `TrustedModuleBuildIdentity` descriptor schema, with module id `fluxiq/web-client-gateway-server`, version from the web manifest, normalization `module-payload-v1`, normalized executing artifact digest and source-input digest. Capture through a separate binding owned by the actual **ClientGatewayService instance**. Never use Automation Studio's native-runtime identity slot.

Add a small transport-provenance collaborator and two additive service delegates: `bindTransportBuildIdentity(identity?)` returns a binding lease; `readTransportBuildIdentity()` returns the current frozen descriptor or null. There are currently 25 non-constructor service methods; these two stay below the 40-method hard budget. Keep the original anchor through legacy replacements and release. A malformed or changed descriptor rejects before any transport IO. A lease-specific `release()` clears active provenance only if that lease is still current, so closing an older same-build handle cannot erase a newer handle's attestation. This remains generic framework transport/module provenance: no DOM, browser UI, URL, WebSocket or downstream domain types in the collaborator.

Use t305's validated descriptor and original-anchor helper inside the collaborator, keyed by its own stable owner object; maintain the current lease separately. Binding/read are invoked through the retained gateway service's actual methods. Do **not** have a native adapter call a freshly imported public WeakMap helper directly: Next's `transpilePackages:["fluxiq"]` can create a different executing Core module instance. Calling the actual service object preserves the same capturing collaborator across native imports and route reloads.

Extend the existing authenticated diagnostic with a separate closed field such as `serverTransportIdentity: descriptor|null`, read from its actual `clientGateway` dependency. Leave t305 `loadedModules` unchanged so host verification cannot accidentally accept the gateway in the native slot. Do not read a receipt, module file or web status disk path in the handler.

## Executable artifact and loading

Build one focused ESM artifact, proposed `apps/web/.server-runtime/client-gateway-server.mjs`, by bundling the existing server source plus its embedded identity reader with esbuild, Node target 22, all `fluxiq` public imports external. It contains the real server factory, framing and connection implementations, not merely a descriptor wrapper. Preserve the existing source helper exports/tests and avoid moving server functionality into the browser-client package.

The owning generator inserts exactly one quoted/base64 identity payload literal after bundling. Normalize only that self-containing literal when hashing; every other artifact byte, including the executing reader and framing/connection implementation, remains hashed. Missing/multiple/malformed slots must reject generation and expected-build reading. The executing reader rejects malformed payloads and returns null only for the explicit unbuilt placeholder. This is a normalized single executing artifact digest, not a raw whole-Next/server-chunk digest. A companion `.mjs.identity.json` records the descriptor and complete source inventory. No generated output is tracked or manually edited.

Add a small native loader under the web server owner. `initializeFluxIQWebRuntime` preloads this artifact before calling synchronous `startSharedClientGateway`; use native import with the existing webpack/turbopack ignore policy. The retained factory comes from that loaded artifact. `getFluxIQ` stays synchronous and refuses to start an enabled gateway before preload instead of silently using the statically bundled source factory. Gateway-disabled callers remain usable. Cache the loaded factory by the resolved artifact path; unchanged-path reload is deliberately retained old code, which Lab must detect after a changed disk build.

Keep source `parseAllowedOrigins` / type imports usable without starting a server; they are not the executing factory identity claim. Production `startSharedClientGateway` must obtain its start function exclusively from the loaded native module.

Registration/lifetime ordering:

1. Validate non-IO options and obtain the actual gateway owner.
2. Every supported web-controller start/replacement clears **active** transport provenance before invoking any factory, retaining its original anchor. A legacy factory that never stamps then stays unattested.
3. Inside the actual native factory, read embedded identity and bind it through that gateway owner **before `createServer`, upgrade registration, connection acceptance or listen**. Changed identity on a retained owner rejects here; no listener/session side effect has happened.
4. The handle retains its binding lease. Close, unexpected server close, or listen failure releases active provenance without deleting the anchor. Inactive/disabled/failed transport must not attest as a running adapter. A new same-build handle cannot be cleared by an old lease's late close.
5. Explicit whole-instance reload obtains a new gateway owner and may accept a new build. Ordinary route/factory reload into the retained owner cannot.

A generic gateway service cannot observe an arbitrary out-of-band legacy listener created directly without this registration seam. The bounded implementation must claim the supported web runtime's registered transport only. If the product must attest arbitrary transports or which of several listeners handled a particular paired session, that requires a separate generic per-connection lease/session association and a post-pairing check; it must not be implied by this owner-level claim. The provider-free proof below must use the actual registered listener and socket path, not a synthetic substitute for the adapter.

## Complete freshness and build/cache wiring

Proposed exact source inventory (sorted exact keys, directories named `tests` excluded):

- All `apps/web/src/server/**/*.ts` including the new executing reader/loader contracts.
- The specific registration/preload owners `apps/web/src/lib/fluxiq.ts` and `apps/web/src/instrumentation.ts`.
- All `apps/web/scripts/**/*.mjs` (owning driver/generator helpers included), all Core `scripts/build-cache/**/*.mjs`, web/root package manifests and Core `pnpm-lock.yaml`.

The registration/preload owners are source-provenance inputs; their Next-compiled executable bodies are outside the single transport artifact claim. Include any newly reached non-external source found by the esbuild metafile in the declared complete input inventory or fail generation. External Core service/contracts are attested by the separate Core gate; Node builtins are platform dependencies. Never include the self-containing companion or generated artifact in the source-input map.

Lab must compare the exact current source key set with the receipt, then hashes/source digest, then the normalized intended artifact digest, then the actual descriptor from the authenticated retained gateway owner. Added source/generator/cache files and omitted receipt keys refuse; checking only stamp-listed files repeats the t302 freshness defect.

Core dev/build commands must generate the native artifact before Next startup/build. Synchronize `apps/web/package.json` with `scripts/build-cache/steps.mjs`; web build outputs/required files include native artifact and companion, not only `.next/BUILD_ID`. Add the generated directory to the owning ignore rule. Avoid a full Next rebuild merely to exercise a native-generator regression.

The Lab production staging path needs explicit handling: `core-web-build/workspace.ts` copies apps/web and `prepare.ts` invokes the Next CLI directly, bypassing web package scripts. Generate/validate the canonical native artifact through a supervised owning step **before `collectCoreWebBuildInputs`**, then stage its artifact+companion together. `collectCoreWebBuildInputs` currently hashes the copied web tree, so the staged build key must follow those generated bytes. Assert that `workspace.ts` includes the native artifact/companion, publication checks require both, and loader resolution uses the staged app's copied artifact rather than a newer canonical disk file. The expected Lab gate can compare the current intended canonical descriptor with the actual copied/loaded descriptor; no server-reported disk path is trusted.

Add a separate early `verifyRunningServerAdapterIdentity` beside Core/host checks under the existing live/Flow/authenticated-control condition. It must finish before project preparation, browser launch and provider/chat dispatch. Preserve the pure offline recording exemption. Missing capture, disabled gateway, legacy/unbuilt adapter, missing receipt or stale source/artifact all refuse provider admission.

## Exact proposed implementation ownership

Core existing files:

- `packages/fluxiq/src/client-gateway/service.ts`: one focused collaborator field and two small delegates; no pairing/session/wire behavior edits.
- `packages/fluxiq/src/client-gateway/service/index.ts`: collaborator/type exports if needed by the facade.
- `packages/fluxiq/src/programs/automation-studio/api/handlers/diagnostics/runtime-identity.ts` and its owning test: separate actual gateway identity projection using existing dependency.
- `apps/web/src/server/client-gateway-websocket.ts` and `apps/web/src/server/tests/client-gateway-websocket.test.ts`: bind-before-IO, lease release and actual socket proof; preserve frame/origin contracts.
- `apps/web/src/lib/fluxiq.ts`, `apps/web/src/lib/tests/fluxiq.test.ts`: preload, supported-start clearing, retained factory/global handle lifecycle; no host/native slot changes.
- `apps/web/src/instrumentation.ts` only if preload cannot remain entirely inside existing `initializeFluxIQWebRuntime`.
- `apps/web/package.json`, `scripts/build-cache/steps.mjs`, Core `.gitignore`; owning registry/cache tests.

Core new focused modules:

- `packages/fluxiq/src/client-gateway/service/transport-build-identity/{owner,lease,index}.ts`, owning `tests/owner.test.ts`; reuse t305 immutable descriptor/anchor code through its barrel, no edits to t305 binder needed.
- `apps/web/src/server/gateway-runtime/{types,load,index}.ts`, `build-identity/{read,index}.ts`, owning tests. No server/client package promotion or broad server-file split required.
- `apps/web/scripts/build-client-gateway-server.mjs`; `apps/web/scripts/gateway-server-identity/{build,inventory,normalize,index}.mjs` and owning tests.

Downstream existing files:

- `packages/test-runner/src/core-web-build/{prepare,types,required-paths,publication,workspace}.ts` only those needed for supervised generation/required paired copy; owning `tests/{prepare,inputs,server-process}.test.ts` and a new native-artifact staging test.
- `packages/test-runner/src/core-web-build/index.ts` new focused preparation export; `packages/test-runner/src/run-scenario/browser-session/index.ts`, `packages/test-runner/src/run-scenario.ts` additive early server gate (preserve literal LF).

Downstream new modules:

- `packages/test-runner/src/core-web-build/server-adapter.ts` owning supervised canonical build/preparation, with owning tests.
- `packages/test-runner/src/run-scenario/browser-session/server-adapter-identity/{types,screen,inventory,normalize,expected,assert-match,verify,index}.ts`, owning `tests/{identity,server-probe}.test.ts`.
- Own implementation report plus supervisor-owned architecture/current-state updates. No `packages/client-gateway-websocket` source changes, Automation Studio generation/service changes, native binding slot changes, provider/config/key changes, or gateway wire-protocol changes.

The supervisor should approve/trim final existing filenames before dispatch once the staged-copy design is chosen; functions above define the exact responsibilities. Core and downstream use paired isolation and integrate serially after t305. Generated artifact/cache source must freeze while proofs run.

## Required focused evidence before implementation is considered complete

- Fail-first binding tests: same-build capture immutable, changed module/source digest rejects before IO, malformed capture rejects, legacy clears active but not anchor, close/failure releases, old lease cannot clear a new handle, actual diagnostic reads the retained gateway even after handler re-import. Native host identity remains separately present.
- Generator/expected negatives: added/omitted source/artifact inventory, changed framing/connection/reader implementation, changed generator/cache source, malformed/missing/multiple payload slots, missing companion, stale per-run copy. Both sorted source digests and normalized artifact digests validated independently.
- Provider-free owned child actually imports the built native server factory, constructs actual Core gateway/service, starts the real loopback listener on a dynamically allocated port and exercises real HTTP Upgrade/WebSocket hello/frame/ping/close behavior against the gateway. Preserve origins/pairing rules; public fixture credentials only. Verify actual registered adapter through the real authenticated diagnostic handler over owned transport.
- Retained negative sequence: initial loaded match; source-only edit refuses; owning regeneration changes executing adapter; re-import actual diagnostic handler under a query suffix against the retained gateway; mismatch still refuses; changed factory reload into that owner refuses before listener/connect/session mutation; legacy replacement clears attestation and cannot reset anchor; fresh child loads new artifact and matches. Count provider/chat invocations at zero. Bound startup, IPC, stderr, close and owned cleanup.
- Separate real Next route restriction tests remain required; the child proof's synthetic authenticated diagnostic transport is not a Next/pairing server proof. At integration, a current production Next process must load the copied native artifact and expose that actual gateway descriptor through the real route without public health disclosure. This can use isolated owned test state; no user's panel is authorized.
- Narrow Core/web/runner typechecks, affected directory tests, generator/cache/staging tests, both audits and owning native/Core/extension regeneration. No full-suite or paid-run claim from compilation.

## Architecture compatibility and remaining scope

This is additive trusted-local transport provenance. Existing client protocol, pairing, extension adapter, domain host and socket/session behavior stay compatible. Legacy consumers remain usable but cannot satisfy strict paid Lab identity admission. Web enabled-start now has an explicit native-module preparation prerequisite; dev/build and Lab staging must implement it together. The service methods prevent native-vs-Next module duplication from losing the ownership capture. The route returns bounded hashes/descriptors only.

The design closes the actual supported web server adapter gap; it does not attest all Next application chunks, Node platform implementation, arbitrary third-party transport listeners, installed Firefox/Edge behavior or paid A-D success. No actual executing identity has been measured during this read-only design task.
