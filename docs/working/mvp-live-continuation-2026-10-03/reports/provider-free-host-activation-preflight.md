# Provider-free host activation preflight

Status: read-only preflight COMPLETE. Worker resume-cd. Frozen A7/B6 source downstream2ef458a1/Coree8c89bbd was not changed. No tests, builds, runtime, provider, browser, panel, state, environment, key, shared-document or git operations. This is an uncompiled design, not provider-free reuse acceptance.

## Confirmed construction order

1. Core Next.js `apps/web/src/instrumentation.ts` register runs only in nodejs and awaits initializeFluxIQWebRuntime before requests.
2. `apps/web/src/lib/fluxiq.ts` loads the configured host module, then getWebRuntimeState creates createFluxIQWebInstance. Module LOADING precedes construction; its registration callback does not.
3. createFluxIQWebInstance resolves root and calls public FluxIQ.create({rootDir}), then applies the host registration callback to the constructed instance. If no explicit/active domain and the host registers exactly one domain, it constructs a SECOND instance through FluxIQ.create({rootDir,domainId}) and reapplies the same host. Both paths need admission forwarding. Reload also returns through this factory.
4. Public FluxIQ.create forwards its FluxIQOptions to the constructor. Constructor loads environment files, resolves existing storage paths, synchronously calls createGlobalProgramRuntime(this.paths), binds original IO/runtime/gateway, and registers optional domains/IO. Its current options contain no provider admission setting.
5. `programs/_shared/runtime.ts` creates SecretKeysService first, constructs the original AutomationStudioService with a standing result-check resolver, creates identity/gateway/runtime/API owners, binds a session-key execution resolver, and binds the panel chat model with the Secret Keys resolveKey callback. It also keeps the ordinary unlocked-session resolver. All three provider paths are installed BEFORE downstream host registration.
6. Web initialization sets up fresh storage or validates existing v2, then starts the shared gateway. Authentication/API routes subsequently use this same runtime/service. No replacement service is necessary or appropriate.

No inspected existing all-role admission override exists. Current host-module override supplies a registration callback on an already constructed FluxIQ; it cannot activate a construction-time disable option unchanged. Disabling recovery alone does not stop standing result checks, as the prior preservation report proved. Clearing provider environment secrets does not prevent persisted Secret Keys from being revealed.

## Smallest coherent proposed activation

Add a generic OPTIONAL construction admission option to public FluxIQOptions, forwarded unchanged into createGlobalProgramRuntime. Illustrative name/type only: `modelProviderAdmission?: "enabled" | "disabled"`; omitted stays enabled. This is PROPOSED, not an existing public API/env. A focused contract owner/barrel can carry its type rather than duplicating it.

The global factory must consult admission BEFORE creating/installing any provider resolver/model:

- Disabled: omit the standing result-check resolver at AutomationStudioService construction; do not bind the session-key resolver; do not bind the panel model/key resolver. Thus none of those factory paths can call getKeySummary/createSessionRevealAuthorization/revealKeyWithAuthorization or send a request. Keep unlocked-session resolution, original SecretKeysService, identity/authentication, storage, gateway/API registrations, native/domain runtimes and result-check schedules/policies intact.
- Enabled/default: retain the exact current three bindings and behavior. No key deletion, revoke/lock, Flow setting change, service replacement or permission widening.

This is admission for factory-installed model paths. If the selected contract promises lifetime immutability even against a trusted host subsequently binding a NEW provider/model, the corresponding service/conversation bind seams need a further bounded design and release; no such stronger guarantee is established by omitting factory bindings alone. The existing downstream host, inspected in the prerequisite report, binds web evidence/native/domain support rather than those provider overrides. Do not claim a session-only rebinding solves the standing/chat paths.

Core web needs an explicit generic server activation parser that supplies the proposed option before either FluxIQ.create call. A server-owned environment setting may be introduced there, strict closed enabled/disabled values, absent enabled; neither its name nor availability is currently established. Use one resolved options object in BOTH constructions and on reload. Passing a typed explicit option is the actual public boundary; reading a variable in downstream registerFluxIQHost would be too late.

Illustrative future code, NOT runnable today:

```ts
const construction = { rootDir, modelProviderAdmission: requestedAdmission };
const initial = applyFluxIQHostModule(FluxIQ.create(construction));
// Preserve the existing checks for explicit/active domain and domain count.
return applyFluxIQHostModule(FluxIQ.create({ ...construction, domainId: soleDomainId }));
```

Lab explicit opt-in belongs in TopologyOptions → TopologyPaths → buildFluxIQEnvironment → owning Core child, before startup/authentication. Only saved provider-free replay sets disabled. Drop any inherited admission value before deriving the child setting: ordinary live creation must remain enabled. `environment.ts` already does this for logical-call admission and model/step-log settings, but has no provider-free setting now. `coordinator.ts` forwards options into the environment immediately before spawning Core production server. Existing host module and persistent workspace remain unchanged.

## Exact minimal source/test partition

Core construction unit: `packages/fluxiq/src/framework/index.ts` public options and forwarding; `packages/fluxiq/src/programs/_shared/runtime.ts` three factory wiring guards; focused generic admission contract/barrel only if needed for shared typing. No AutomationStudioService replacement or result-check schedule edit.

Core web activation unit: `apps/web/src/lib/fluxiq.ts` resolve/forward before BOTH create paths and reload; one focused parser owner/barrel if needed. `apps/web/src/lib/tests/fluxiq.test.ts` already exercises host loading, sole-domain reconstruction, initialization and reload; add disabled/default/invalid activation assertions there. Instrumentation requires no implementation change. Framework nearest `framework/tests/index.test.ts` plus nearest global-runtime tests should prove actual public construction, not merely parser output.

Downstream activation unit: `packages/test-runner/src/coordinator.ts` and `environment.ts` explicit child option/forwarding; their nearest tests. Saved-flow replay owner sets disabled only for owning isolated/persistent-isolated topology, removes its destructive key-deletion caller and requires private key-set preservation plus strict public runtime accounting, as defined in provider-free-reuse-preserving-keys.md. Exact intermediate replay/option files remain supervisor partition work; they were not re-read in this bootstrap unit.

Meaningful fail-first contracts: with keys/standing authorization present, disabled public construction causes ZERO session, standing and chat key-release/request spies; storage/key identities/auth/native execution unchanged; default enabled still reaches original resolver contracts. Web initial AND inferred-domain instance, reload, and lazy getFluxIQ share disabled activation. Invalid explicit activation refuses before provider wiring. Lab replay opts out; ordinary creation/absent option strips inherited disabled values and stays enabled. No spend/count may be fabricated from configuration: acceptance still requires known actual zero provider accounting and zero calls/interventions/harness, unchanged Flow topology/hashes/key set, correct terminal/oracles and TWO unchanged saved reuses after both creation lanes stop and accepted usable Flow exists.

## Compatibility and remaining proof

Optional enabled-by-default construction is additive for existing FluxIQ consumers. Disabled hosts retain authentication/storage/API ownership but intentionally cannot build/repair/chat through model providers; existing offline chat/no-provider behavior applies, not new capability forcing. Result-check authorization remains stored and unchanged; its authorized provider is simply unavailable in this disabled host. Exact disabled result-check ending/accounting behavior must be tested, never assumed successful or zero from missing fields. Public runtime admission observability/accounting is a separate supervisor integration requirement already recorded in the preservation report.

All proposals remain uncompiled/unexecuted and require root source release after live freezes. No actual key snapshot, reveal, request, runtime or reuse occurred.

## Bounded read inventory

Initial six bootstrap owners: Core framework/index.ts (options/constructor/create/setup); programs/_shared/runtime.ts (factory wiring); apps/web/src/lib/fluxiq.ts; packages/fluxiq/src/index.ts public reexports; downstream test-runner environment.ts and coordinator.ts (options/environment/spawn contexts). Approved final two: Core apps/web/src/instrumentation.ts and apps/web/src/lib/tests/fluxiq.test.ts. Bounded rg filename/content discovery located these owners; no other source file read. Two coordinator reads accidentally used Core cwd and failed path lookup, then were correctly read downstream. No mutation resulted.
