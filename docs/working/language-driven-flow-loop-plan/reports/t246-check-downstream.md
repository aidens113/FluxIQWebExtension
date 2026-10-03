# t246-check: downstream domain tests against t246 Core

## Outcome
Done. All three files pass against t246's Core. No EBUSY.

## What changed and why
No repository file was edited. `domain/scripts/test-domain.mjs` cannot select files: it builds and runs every entry. So a scratch script (in the session scratchpad, outside the repo) used the runner's esbuild settings (bundle, node22, esm, the same fluxiq externals) to build only the three entries into `domain/.test-build-scratch/t246-check/`. The shared `.test-build` was not touched.

## Commands run and observed results
- Core: `heavy.sh "t246-check core libs" pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` -> all three Done (fluxiq rebuilt in 32 s, the other two restored from the cache).
- Domain build (scratch esbuild, via heavy.sh) -> printed "built"; it produced 3 bundles.
- `node tests/core-gateway-recording-order.test.mjs` -> exit 0, tests 1 / pass 1 / fail 0.
- `node tests/domain.test.mjs` -> exit 0, printed "Web automation domain smoke test passed." This is a top-level script with no node:test cases, so there are no counts.
- `node tests/web-panel-host.test.mjs` -> exit 0, tests 10 / pass 10 / fail 0.

## Close-before-remove audit
- core-gateway-recording-order.test.ts:153-155: `finally { await service.close(); await rm(dataDir, {maxRetries:10}) }`. Closes first.
- domain.test.ts:124-126: same pattern for proposalService. Closes first. Line 23 creates `new AutomationStudioService({ seedFixture: false })` with no dataDir and never removes a directory, so it is not at risk. Line 328 calls `createWebAutomationFluxIQ` and removes no directory.
- web-panel-host.test.ts:102-104: closes first.
- I grepped domain/src, packages/*/src and apps/*/src for in-process service creation (`new AutomationStudioService`, `createWebAutomationFluxIQ`, and similar). Apart from the three tests, the only matches are domain/src/host.ts and domain/src/setup.ts. Both are product code and neither removes a directory. No other at-risk site was found.

## Not verified
- I did not use the official runner, so its entry-load loop is not reproduced exactly. The other domain test files were not run.
- The grep matched names only. A service created through some other factory name would be missed.

## Open questions or contradictions found
None.
