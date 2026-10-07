# P0 running Core runtime identity — t302

Status: Complete (worker claim; independent integration verification pending)
Owner: p0-core-runtime-identity worker

## Current State

Source frozen. Immutable build payload is captured by the actual Automation Studio service instance; the existing authenticated read route and early Lab gate are implemented. Owning negative and actual retained-service Chromium proofs pass. No providers, user panel management or git mutations.

## Decisions and limits

Build identity hashes executing fluxiq/contracts JavaScript. Only the embedded reader payload literal is normalized to avoid a circular digest; surrounding reader semantics are hashed. The disk stamp additionally records source freshness. Service construction captures the immutable executing payload, so retained Next global instances cannot attest newer disk or route code. Reached extension inputs are matched for fluxiq/contracts; separately built client-gateway-websocket adapter is covered by the extension handshake and is not certified as loaded server code.

## Ledger

- Read bounded brief, required Current State/P0/report, Core instructions/structure, build cache and authenticated program route owners.
- Approved file owners received before writes. Began focused generator and reader modules; existing Core build/cache commands will stay synchronized.

- Generator/cache registry owning tests pass 9/9. Core source reader + restricted handler tests pass 3/3. Initial Core check/build caught a relative import and overly broad error-code literal, both corrected before successful artifact evidence. No success is inferred from those failed builds.
- Added actual service snapshot, read-only authenticated route/allowlist and early Lab gate. Closed projection strips arbitrary fields. Source and executed artifact freshness are checked separately from the reached extension contracts.

- Core audit initially caught new handler directory/prefix limits, a swallowed malformed reader failure and one added service line. Only the new handler/test moved into diagnostics with a barrel; malformed JSON now fails explicitly and service baseline remains unchanged. Owning malformed-payload test initially used a VM-incompatible dynamic import harness; switched to compiled CJS evaluation, then reader/handler 4/4 passed. Core audit passed afterward.
- Cache discovery showed nested generator imports were not automatically fingerprinted; added a narrowly named generator directory input and required output stamp. Generator/cache registry tests now 10/10.
- Existing runner's literal source assertion failed after a Windows newline write; restored existing LF and touched runner wiring + Lab negatives passed 34/34. Core/Web package checks passed. Final Core build/check passed after structure corrections; extension Chrome/Firefox/E2E targets each verified22 files.
- Supervisor approved exemption solely for pure recording with no live/Flow capability and no authenticated control. All live/Flow lanes lacking control fail before chat; any authenticated topology still verifies. Added explicit owning admission negative. No identity best-effort fallback.


## Final source owners

Core:
- `packages/fluxiq/src/runtime/build-identity/{types,read,index}.ts`, owning `tests/read.test.ts`.
- `scripts/runtime-build-identity.mjs`, `scripts/runtime-build-identity/{build,normalize,index}.mjs`, owning `tests/build.test.mjs`; synchronized `packages/fluxiq/package.json` and `scripts/build-cache/steps.mjs`.
- `packages/fluxiq/src/programs/automation-studio/api/handlers/diagnostics/{runtime-identity,index}.ts`, owning `tests/runtime-identity.test.ts`; narrow `handlers/register.ts`, `api/contracts/endpoints.ts`, runtime `service.ts` import/readonly snapshot. Service baseline did not grow.
- `apps/web/src/lib/program-route.ts`, its owning test and `apps/web/src/app/api/programs/[programId]/[endpoint]/tests/route.test.ts`.
- Authored `docs/architecture/automation-studio.md` paragraph.

Downstream:
- `packages/test-runner/src/run-scenario/browser-session/core-identity/{types,screen,normalize-reader,expected,inventory,assert-match,verify,required,index}.ts`; owning `tests/identity.test.ts` and opt-in `tests/server-probe.test.ts`.
- Narrow early gate in `packages/test-runner/src/run-scenario.ts`, browser-session barrel, authenticated read method in `packages/test-runner/src/http-control/index.ts`.
- Authored `docs/architecture/testing-facility.md` paragraph and this own report.

## Final validation receipts

- Core generator + existing build-cache registry: 10/10.
- Core embedded reader + identity handler: 4/4, including malformed JSON explicit failure and bounded paths/unavailable identity refusal.
- Real Next restricted paired-client route and program-route owners: 54/54. Core/web package typechecks exit0; Core check was repeated after final runtime changes.
- Runner `pnpm.cmd exec tsc -p packages/test-runner/tsconfig.json`: exit0 after final admission/probe changes.
- Combined new Lab negatives, existing extension identity, runner wiring and actual child-server Chromium proof: 57/57, zero skips (60.2s total; server proof59.0s). HTTP control owning directory: 15/15.
- Core + downstream structure audits exit0 (279/349 and176/118 warnings/baseline); diff checks exit0.
- Owning Core package build exit0. Final extension Chrome/Firefox/E2E Chromium targets each verified22 files; preexisting Firefox permanent-addon-id warning remains unrelated.
- Current t302 Core normalized artifact digest `3762caac9b0146313209573f97e8cf9b76085b40fa7d8bdc290c1627bdc3b398`, matching107 reached service/contracts JS inputs from the rebuilt extension. This is a local pre-integration receipt, not a paid lane qualification.

## Provider-free real server/browser receipt

Headed Chromium134.0.6998.35 reached an owned loopback child server holding an actual built AutomationStudioService and real runtime identity handler. First match admitted a simulated dispatch. A changed copied source refused stale expected build. Changed executable reader semantics were regenerated through TypeScript and the owning identity generator in the isolated copy. The retained old service and newly imported route still returned the old executing identity, so the gate refused. A new child process matched the regenerated artifact and admitted a second simulated dispatch. Actual build/run dispatch counters stayed0; no chat/provider calls occurred. The browser, children and owned copied-tree resources were closed/removed by test cleanup. Regenerated fixture digest `f62f6f74c90fc262c657227938e66f9826fa4800f19aa8070ba8fe19d79ad6cf` belongs only to the disposable changed-code fixture.

Authentication and HTTP hosting in this browser proof are synthetic loopback transport, not a running Next panel. The real existing Next bearer allowlist/classification/role/domain behavior is independently covered by the54 route-owner tests. No user panel was managed. Actual paid-provider A-D behavior, Firefox live, server host-module identity, separately built gateway-adapter server identity, and iframe identity remain outside this claim.

## Independently runnable proof

From the paired t302 Core root, regenerate the owning package (not a whole suite):

```powershell
pnpm.cmd --filter fluxiq build
```

From the paired downstream root, after Core build completes:

```powershell
node apps/extension/scripts/build-extension.mjs
pnpm.cmd exec tsc -p packages/test-runner/tsconfig.json
$env:FLUXIQ_CORE_IDENTITY_PROBE='1'
node --test packages/test-runner/dist/run-scenario/browser-session/core-identity/tests/server-probe.test.js packages/test-runner/dist/run-scenario/browser-session/core-identity/tests/identity.test.js packages/test-runner/dist/run-scenario/browser-session/build-identity/tests/identity.test.js packages/test-runner/dist/run-evaluation/tests/runner-wiring.test.js
```

The probe defaults to sibling Core and the E2E extension target in that paired tree. Alternate intended artifacts may be explicitly supplied with `FLUXIQ_IDENTITY_CORE_ROOT` and `FLUXIQ_IDENTITY_EXTENSION_PATH`. Normal suites skip this owned headed probe unless the opt-in environment variable equals1.

## Integration boundary

No checks remain active and product source is frozen. Supervisor integrates t299 first, then merges current dev into t302, regenerates Core and extension stamps, and independently repeats key identity negatives/proof. Any source/artifact change invalidates these local receipts until rebuilt and rechecked. No worker commits, pushes, git mutations, providers, full suites or user-panel management occurred.


## Supervisor review correction: complete inventory freshness

Root review found the first expected-build implementation checked only stamp-listed inputs, so additions and omitted source keys could escape its claimed complete freshness check. Owning synthetic negatives reproduced all three failures before the correction: added source, added artifact, and omitted source key each reported missing expected rejection.

Added only downstream `core-identity/inventory.ts` and its barrel export, wired exact source/artifact key-set comparison into `expected.ts`, and expanded its owning test fixture. Enumeration matches the owning Core generator: all contracts/fluxiq `src` `.ts` and `dist` `.js` inputs, excluding directories named `tests`, plus both package.json files. Both key sets must match before any hashes or server request. Existing source/content/self-reader checks remain afterward. These negatives construct synthetic malformed receipts in owned temporary fixtures; no actual generated stamp was hand-edited and no Core source changed.

After correction, the three inventory negatives pass; all current `core-identity/tests/identity.test.ts` tests pass16/16 (13 top-level plus3 subtests). Runner package typecheck, downstream structure audit and diff check exit0. Read-only admission against the actual current paired artifact still succeeds with digest `3762caac9b0146313209573f97e8cf9b76085b40fa7d8bdc290c1627bdc3b398` and107 reached inputs. No browser rerun or new paid claim is made after this correction. Root will rerun its independent retained-server proof after integration/rebuilding. Product source is frozen again; all checks stopped.
