# Sweep 2026-10-20 b (Brief sweep-1020b)

## Outcome

Done. All eight commands ran to the end. Two failed: the Core tests (one assertion failure) and the downstream tests (one browser-path timeout). Nothing was fixed. No log contains a V8 "out of memory" error. No `15000ms` timeout appears in any log.

Commits swept (detached worktrees under `C:/Users/osrs_/FluxStuff/fxwork/sweep-1020b/`, left in place):
- Core `3b13e39418d816f48846505f813d0cf1f9e7c1fb`; downstream `72b7fab39488c57fefcb99f4b88f9415b5c50d78`.

Logs: the worker's scratchpad `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/sw/<name>.log` (session-local; not copied into the worktree).

## What changed and why

No repository files changed. This report is the only new file.

## Commands run and observed results

| Command | Exit | Seconds | Totals |
| --- | --- | --- | --- |
| Core `pnpm install --frozen-lockfile` | 0 | 73 | |
| Downstream `pnpm install --frozen-lockfile` | 0 | 3 | |
| Core `pnpm build` | 0 | 219 | |
| Core `pnpm check` | 0 | 207 | |
| Core `pnpm test` | 1 | 2129 | contracts 19 files, 250/250. client-gateway-websocket 27 files, 182/182. packages/fluxiq group 1 (parallel): 1311 passed + 3 skipped files of 1314; 12115 passed, 6 skipped of 12121 tests; vitest duration 952.43 s. Group 2 (real-SQL, 3 workers): 237 passed, 1 failed of 238 files; 1531 passed, 1 failed, 1 skipped of 1533 tests; vitest duration 942.70 s. apps/web 392/392 files, 3142/3142 tests, 217.48 s. |
| Downstream `pnpm check` | 0 | 233 | script `node --test`: 678 tests, 677 pass (the remaining one not failing; check exited 0). Structure audit and `pnpm -r check` ran (the chain completed). |
| Downstream `pnpm test` | 1 | 468 | boundary-audit 6/6, real-site-policy 7/7, test-contracts 170/170, test-matrix 23/23, domain 2244/2244, test-evidence 19/19. scenario-lab 1000 tests: 999 pass, 1 fail. apps/extension printed `ok` through at least test 1077 with no failures but no totals: pnpm aborted on the scenario-lab failure (first-fail). agent-orchestrator not reached. |
| Downstream `pnpm build` | 0 | 19 | |

### Core failure (1, group 2)

- `packages/fluxiq/src/programs/automation-studio/runtime/tests/deepseek-bootstrap/tests/exploration.test.ts` > "creating a Flow through an exploration, with no grant" > "records a build's token totals past one request's ceiling when its budget allows them". AssertionError: expected undefined, received a failure `flow_bootstrap.pre_provider_request_total_exceeded` (stage `pre_provider_validation`, `totalProviderCallCount: 2`, `estimatedInputTokens: 20035`). **New**; a real assertion, not a timeout.

### Downstream test failure (1)

- `apps/scenario-lab` `scenarios/crossborder-marketplace/tests/browser-paths.test.ts:224` > "crossborder-marketplace in a browser" > subtest 11 "flash-deal-on-arrival: the promotion is over the home page as it loads, before any step, and closing it is enough": `locator.waitFor: Timeout 1000ms exceeded`. **New vs 1020** (a crossborder "in a browser" timeout last appeared in 1019b, as a traffic-check one).

## Compared with sweep 1020 (this morning)

Gone:
- All 4 Core `15000ms` timeouts (command-context controller, command-execution service, provider-unavailable, flow-index-read).
- Downstream check: `scripts/build-cache/tests/registry.test.mjs` empty-pathspec failure; the check now passes and the structure audit and `pnpm -r check` ran.
- Both photo-social failures (newest-likes assertion, collection workflow close-dialog timeout).

New:
- Core deepseek-bootstrap exploration token-ceiling assertion.
- Scenario-lab crossborder flash-deal-on-arrival waitFor timeout.

Still failing: none. 15 s timeouts remaining: none.

## Not verified

- No failing test was rerun alone, so flakiness is unknown (the crossborder one is a 1 s waitFor and may be load-sensitive; other agents may have been running).
- No apps/extension totals and no agent-orchestrator result, because pnpm aborted on scenario-lab.
- The one non-passing downstream-check script test was not identified (it is not a failure; likely skipped).
- No failure was diagnosed.

## Open questions or contradictions found

- The Core failure suggests the pre-provider request-total guard now rejects a build that the test expects its budget to allow; whether the test or the guard is stale was not established.
