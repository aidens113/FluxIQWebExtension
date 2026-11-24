# t1005 report: pnpm check from a fresh tree

## Outcome
Done. `pnpm check` passes in a fresh worktree with no prior build.

## What changed and why
Cause (confirmed): only `@fluxiq-web-extension/domain/node` (-> `domain/dist`) and `@fluxiq-web-extension/browser-host` (+ `/launcher`, `/reaper` -> `packages/browser-host/dist`) resolve through built declarations; test-contracts and test-evidence expose `types` from src. The test-runner check prelude built only the domain dist (`scripts/domain-dist.mjs`); the extension check built nothing, and its e2e project compiles test-runner sources that import browser-host.
- `packages/test-runner/package.json`: `build`, `check`, `test` now run the registry steps `domain:build browser-host:build` through `scripts/build-cache/cli.mjs` (stamped, locked, restored from the shared store). `domain:dist` script replaced by `workspace-dists` (same command).
- `apps/extension/package.json`: `check` runs `cli.mjs domain:build browser-host:build` before `extension:check`.
- Deleted `packages/test-runner/scripts/domain-dist.mjs` (superseded; no other referrers outside historical reports).
- `docs/architecture/repository-layout.md`: replaced the stale "guard builds only when absent" text with the current mechanism.
No new mechanism, no type-ignore, no skipLibCheck change.

## Commands run and observed results
- Reproduce (before fix, fresh): `pnpm --filter @fluxiq-web-extension/test-runner check` -> 9 `error TS` (TS2307 browser-host/reaper at engine.ts:7 plus follow-ons), matching the sweep. The extension check was not run before the fix; the sweep log showed 22.
- After fix, dists deleted (`domain/dist`, `packages/browser-host/dist`) before each run:
  - test-runner check -> 0 `error TS`; domain and browser-host restored from the store, test-runner:check built, exit 0.
  - extension check, first attempt with only `domain:build` -> 1 `error TS` (TS2307 browser-host/reaper from `packages/test-runner/src/run-scenario/window-capture/find-browser-process.ts`), which showed the extension also needs browser-host; added it.
  - extension check, second attempt -> 0 `error TS`, exit 0.
  - root `pnpm check` (dists deleted first, via heavy-slot) -> exit 0, 0 `error TS` in the log, node tests `# fail 0`, `structure-audit: passed (259 warning(s), 551 baselined)`, every package check Done.

## Not verified
- `pnpm build` / `pnpm test` from fresh (test-runner build/test preludes were changed the same way but only `check` was run).
- No tests exist for the package.json preludes; none added. No `scripts/**` file changed, so no script tests were affected (the root check's node tests passed).
- Shared-store restores supplied the dists; a build with an empty store was seen only in the initial reproduction (domain built from scratch).

## Open questions or contradictions found
- The repository-layout doc had described an older absent-only guard, already stale before this change.

## Addendum: runtime dists for tests (lead's follow-up)
Gap: test-runner's compiled tests import `test-evidence/dist` and `test-contracts/dist` at runtime (types come from src), and its `test` prelude built neither.
- Full set of workspace packages test-runner imports at runtime (from src): browser-host, domain/node, test-contracts, test-evidence. All four are now built by the `test` prelude (`domain:build browser-host:build test-contracts:build test-evidence:build`, in dependency order). `build` is unchanged: compiling needs only the declarations (domain, browser-host).
- Same gap elsewhere: `packages/test-evidence` `test` built only itself while it imports test-contracts; it now builds `test-contracts:build test-evidence:build`. Other package `test` scripts were read: boundary-audit, real-site-policy, test-matrix, browser-host, scenario-lab, test-contracts have no uncovered workspace dist imports (test-matrix/scenario-lab already build test-contracts); extension, product, domain and website-stand-in tests do not run through a built workspace dist (not exercised from fresh).
- Fresh proof: deleted test-evidence/dist, test-contracts/dist and test-runner/dist. `pnpm --filter test-evidence test` -> contracts restored, evidence built, its node tests ran, no ERR_MODULE_NOT_FOUND. Then the test-runner prelude steps plus `node --test dist/attempt-lane/tests/lab-attempt-command.test.js dist/tests/commands.test.js` -> `# tests 46 # pass 46 # fail 0` (the package script itself cannot be narrowed, so the steps were run by hand in its order). `node scripts/structure-audit.mjs` -> passed (259 warnings, 551 baselined).
- Not verified: the full test-runner test suite.
