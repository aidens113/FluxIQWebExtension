# core-scan-needed (t940)

## Outcome
Done. The Core build scan now covers only the Core packages this workspace depends on.

## What changed and why
- New `scripts/lab/core/build/needed.mjs`: `neededCorePackageNames(downstreamRoot, coreManifests)` reads dependencies, devDependencies, peerDependencies and optionalDependencies from the downstream root, `apps/*`, `packages/*` and `domain` manifests. It keeps names that match a Core package, then follows those Core packages' own manifests transitively. No hand-kept list. It also exports `DOWNSTREAM_ROOT`, the workspace this module sits in.
- `entries.mjs`: `scanCoreBuildEntries(coreRoot, { downstreamRoot = DOWNSTREAM_ROOT })` only returns packages that have a build script and are needed. The missing-files message and rebuild command are unchanged. `index.mjs` re-exports the new module.
- `freshness.mjs` and `run-lab.mjs:149` needed no edit. Both call the default, which resolves the downstream root itself.
- Tests in `tests/unbuilt.test.mjs`: fixtures now build a downstream workspace. New cases: an unbuilt unused package passes; an unbuilt package used directly fails and names `./dist/cli.js`; an unbuilt package reached only through another Core package's devDependency fails.

## Commands run and observed results
- `node --test scripts/lab/core/build/tests/*.test.mjs scripts/check/core-build/tests/*.test.mjs` -> 37 tests, 36 pass, 0 fail, 1 skipped (the real-Core probe, which skips when no Core is found under the worktree). The Lab entry-point refusal test also passed.
- `node scripts/structure-audit.mjs` -> "structure-audit: passed (253 warning(s), 551 baselined)".
- `FLUXIQ_CORE_ROOT=C:/Users/osrs_/FluxStuff/fxwork/!FluxIQ node scripts/check/core-build.mjs` -> "FluxIQ Core's build at ...!FluxIQ is current with its source." It passes with packages/cloud unbuilt.

## Not verified
- The Lab on a real run, and the other downstream builds that call this guard. Only the guard itself was run live.

## Open questions or contradictions found
- Derived set versus CORE_PACKAGES: no disagreement that matters. Downstream directly names contracts, client-gateway-websocket, ui-components and fluxiq. `fluxiq` pulls in `@fluxiq/sdk` through a devDependency, which is why the SDK is covered. That matches CORE_PACKAGES (contracts, sdk, fluxiq, client-gateway-websocket, ui-components). `@fluxiq/cloud` and `@fluxiq/web` are not downstream dependencies, so neither is required.
- The transitive closure includes devDependencies on purpose. This matches the existing SDK comment in `core-build.mjs`: Core's build cache counts the SDK, so it has to be built.
