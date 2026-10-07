# t352: downstream check build order, four extension failures, test-runner tests

Worker: t352-downstream (worker-high). Tree: `C:\Users\osrs_\FluxStuff\fxwork\t352-downstream-check-and-tests`,
branch `task/t352-downstream-check-and-tests`, base `fe30f0ba`. Nothing committed.

## Outcome

Done. All three items are fixed. Every cause was traced to a commit, and none was a product regression:

- `pnpm check` now passes from a tree with no `packages/test-evidence/dist`.
- The four extension failures were test defects. All 2588 extension tests pass.
- The test-runner suite had 32 failures in four files, all stale tests. It now runs 2108 tests: 2103 pass, 0 fail, 5 skipped.

## What changed and why

| Item | Failure | First bad commit | Cause | Fix |
| --- | --- | --- | --- | --- |
| 1 | `pnpm check`: test-runner typecheck, 32 errors (TS2307, then TS7006) | Present since test-evidence pointed `types` at `dist` | `packages/test-evidence/package.json` exported `types: ./dist/index.d.ts`. Nothing in `pnpm check` builds that dist, because `pnpm -r check` runs only `--noEmit` checks. | `types` now points at `./src/index.ts`, the way `packages/test-contracts` does it. test-evidence's sources already use `.js` specifiers and the same strict options. The runtime `import` stays on `dist`. With this, `pnpm check` builds nothing extra and typechecks against current source, not a possibly stale dist. |
| 2a | Extension `content/tests/landmark-role.test.ts`, 3 tests (`nodeType`/`querySelectorAll` of undefined) | `fda691a2` (t306, 2026-10-07). It exposed a fragile pattern that existed since `ee25ac9e`. | All extension test bundles run in one Node process. All imports finish first, then the tests run in file order. landmark-role installed its stub DOM at import time. t306 added two tests in earlier files that `delete globalThis.document` when they finish: `action-runtime/tests/assertion-evaluation.test.ts` and the new `wait-conditions.test.ts`. Proof: full-order run with the old landmark file and the pre-t306 versions of those two files gives 0 failures. With either t306 file present, the same 3 failures appear. | The stub DOM is now installed inside each test through `withStubDom`, which saves the previous property descriptors and restores them in `finally`. Globals are set with `defineProperty`, because an earlier file can leave `document` read-only. Each test file run alone still passes. Run next to each of the files that broke it (assertion-evaluation, page-identity, page-render, load-retry, list-reader), it now passes too. |
| 2b | Extension `content/actions/tests/execute.test.ts`, "a target that never appears…", error `attempts were unbounded or absent: 1` | No regression. The test and the post-pause deadline check in `recovery/attempt.ts` both came in `36daa680`. | The test depended on timing. It needed a second attempt inside a 400 ms timeout, which works only if the 250 ms pause wakes before 400 ms. If the event loop stalls for 150 ms or more, the product correctly returns the last result instead of starting an attempt after the deadline. I reproduced the exact sweep error by stalling the event loop from 100 to 450 ms. It passed in my full runs, so in the sweep it was a load flake. | Only this row now runs on `t.mock.timers` (`setTimeout` and `Date`), using the product's own default pause and clock. A small helper ticks the clock 10 ms at a time. The assertion is now exact: `calls === 2` (attempt at 0 ms, attempt at 250 ms, second rung clipped to 150 ms, no attempt at 400 ms). With the same stall injected, it passes. |
| 3a | test-runner `flow-lane/tests/run-flow-lane.test.ts` (17), `flow-lane/tests/live-repair-lane.test.ts` (4), `flow-lane/repair/tests/run-repair-lane.test.ts` (10): "Scenario Lab reset producer could not be confirmed" / "Replay 1 … could not be run (fixture.invalid)" | `d7ee6595` (t336) | t336 made `resetScenarioLab` require the producer's reset packet plus a matching health read. These three tests replaced global `fetch` with `{ ok: true }` and no body. The creation lane's harness was updated to the new shape (`lane-harness.ts`); these tests were not. | New test support file `flow-lane/tests/reset-producer-response.ts` (one export) answers in the producer's shape. The three stubs use it and count only the POST as a reset, so existing assertions such as `resetCalls`, `fake.sequence` and `reset: [1, 2]` hold unchanged. |
| 3b | test-runner `run-evaluation/tests/runner-wiring.test.ts`, "the runner closes every other fixture tab before playback…" | `d9e06d86` (2026-10-07, "Every Lab Flow run starts on the Flow's own tab") | That commit moved the inline playback close into `run-scenario/browser-session/present-flow-tab.ts`, called after the start page is decided. Its behaviour is tested beside it. The source-text test still looked for the removed line. | The test now pins one `presentFlowTab(...)` call with `moment` and `extensionControl`, no runner-local `other.close()`, and the order flowStartPage → blanking → presentFlowTab. The comment explains the move. |

Files changed (all in the t352 tree):

- `packages/test-evidence/package.json`: `types` points at source.
- `apps/extension/src/content/tests/landmark-role.test.ts`
- `apps/extension/src/content/actions/tests/execute.test.ts`
- `packages/test-runner/src/flow-lane/tests/reset-producer-response.ts` (new)
- `packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts`
- `packages/test-runner/src/flow-lane/tests/live-repair-lane.test.ts`
- `packages/test-runner/src/flow-lane/repair/tests/run-repair-lane.test.ts`
- `packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`
- `docs/architecture/repository-layout.md`: one paragraph on test-evidence taking its types from source and on what still needs its dist. This is the documentation-maintenance rule for a build-layout change. It is outside the brief's listed ownership, so revert it if unwanted.

No product source changed. No `as never` casts were added. Core, the panel chat and overlay files, and `docs/working/*.md` (other than this report) were not touched.

## Commands run and observed results

- **Getting the no-dist state.** I moved `packages/test-evidence/dist` into my scratchpad, which leaves the package with only README, node_modules, package.json, src, tests and tsconfig.json. Before the fix, `pnpm check` in packages/test-runner gave the 32 TS2307/TS7006 errors and `exit code 2`, which reproduces the sweep.
- **Root `pnpm check` after the fix, in the same state.** Exit 0. Script tests: 602, 601 pass, 0 fail. `structure-audit: passed (176 warning(s), 182 baselined)`. Every `pnpm -r check` step passed: domain, scenario-lab, extension, test-evidence and test-runner. test-evidence still had no dist afterwards.
  - In that run, test-runner:check reused its stamp from the passing run just before it, in the same state. So I also ran `npx tsc -p tsconfig.json --noEmit` in packages/test-runner with no dist: exit 0.
  - After the test-runner test edits I moved the dist away again and ran `pnpm check` in packages/test-runner. It rebuilt (`"build-cache":"build","step":"test-runner:check"`) and passed. Then I put the dist back.
- **Extension, before the fix.** `EXTENSION_TEST_BUILD_LABEL=t352 node scripts/test-extension.mjs`: 2588 tests, 2585 pass, 3 fail (the landmark-role three). execute.test passed in that run.
- **Extension, after the fix.** `EXTENSION_TEST_BUILD_LABEL=t352 pnpm test` in apps/extension: exit 0, 2588 tests, 2588 pass, 0 fail.
- **Extension, single files.** With a scratch runner that bundles chosen test files the way `test-extension.mjs` does:
  - landmark-role alone: 4/4.
  - landmark-role paired with each polluting file: 0 fail. Before the fix the same pairs failed 3 or 4.
  - execute.test: 7/7.
  - execute.test with an injected 350 ms event-loop stall: 0 fail. With the old row and the same stall: `attempts were unbounded or absent: 1`.
- **Extension check.** `extension:check` ran inside root `pnpm check` and passed. It typechecks tsconfig.test.json, which covers both edited tests.
- **Extension build.** `pnpm --filter @fluxiq-web-extension/extension build`: exit 0. The firefox and e2e-chromium targets each reported "verified 22 files", with the existing gecko.id placeholder warning. `apps/extension/dist` holds `chrome`, `e2e-chromium` and `firefox`.
- **Test-runner, before the fix.** I first ran `pnpm --filter @fluxiq-web-extension/test-evidence build`, because test-runner's tests import its dist at runtime. Then `pnpm test` in packages/test-runner: 2108 tests, 2071 pass, 32 fail, 5 skipped. All 32 are listed above.
- **Test-runner, the four failing files after the fix.** `pnpm build` then `node --test` on those four files: 63/63 pass.
- **Test-runner, full suite after the fix.** `pnpm test` in packages/test-runner: exit 0, 2108 tests, 2103 pass, 0 fail, 5 skipped.
- **Structure audit after all edits.** `node scripts/structure-audit.mjs`: `passed (176 warning(s), 182 baselined)`.

## Not verified

- **A truly fresh clone.** In my no-dist state, `packages/test-contracts/dist` and `domain/dist` were present. test-runner reads test-contracts types from source and builds `domain/dist` through `domain-dist.mjs`, so neither should matter for `pnpm check`, but I did not test a clone with every dist missing.
- **Root `pnpm test` and `pnpm build`.** Not run, per the twice-a-day rule. I ran the extension and test-runner suites by package.
- No browser or Lab runs, as the brief requires.
- **No commit bisect.** I placed first-bad commits by `git log -S` and by full-order runs that swapped old versions of single files back in. I did not build each historical commit.

## Open questions or contradictions found

- **t306's tests still delete `document`.** `action-runtime/tests/assertion-evaluation.test.ts` and `wait-conditions.test.ts` delete `globalThis.document` instead of restoring the previous descriptor. landmark-role no longer depends on them, but any other test that installs globals at import time would break the same way. `action-runtime/**` was outside my ownership, so I left them. A one-line restore in each, or a structure rule against import-time global installs in extension tests, would close the class.
- **Standalone test-runner runs still need test-evidence's dist.** `pnpm --filter test-runner test` or `build` in a fresh tree now compiles, but fails at runtime without that dist (test-contracts has the same gap). `pnpm -r test`/`build` and the Lab prelude (`buildOrder`) produce it first. If standalone runs matter, test-runner's `test` script could run the `test-evidence:build` and `test-contracts:build` steps the way it runs `domain-dist.mjs`.
- **A stale doc paragraph.** In `docs/architecture/repository-layout.md`, the `domain:dist` text ("if present it does nothing", "`pnpm check` does not refresh `domain/dist`") no longer matches `packages/test-runner/scripts/domain-dist.mjs`, which now rebuilds through the build cache whenever inputs change. I did not rewrite it.
- **Recursive runs bail on the first failure.** The sweep's other open question remains: downstream recursive runs stop at the first failing package, unlike Core's `--no-bail`. Not changed here.
