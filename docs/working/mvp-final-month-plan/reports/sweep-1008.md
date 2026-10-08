# sweep-1008: second full validation sweep (2026-10-07)

## Outcome
Partial. Seven of the eight commands passed. Core `pnpm test` failed: 12 tests failed, all in one file of `packages/fluxiq`. None were timeouts. Nothing was edited, fixed or committed. No Lab, browser or Playwright runs.

Trees: downstream `fxwork/sweep-1008/!FluxIQWebExtension` at `22d5f7d5`, Core `fxwork/sweep-1008/!FluxIQ` at `feb476d2`.

## What changed and why
Nothing in either tree. The only file written is this report.

## Commands run and observed results
| # | Tree | Command | Exit | Time | Result |
|---|---|---|---|---|---|
| 1 | Core | `pnpm install --frozen-lockfile` | 0 | 16s | ok |
| 2 | Downstream | `pnpm install --frozen-lockfile` | 0 | 2s | ok |
| 3 | Core | `pnpm build` | 0 | 113s | ok |
| 4 | Core | `pnpm check` | 0 | 102s | ok |
| 5 | Core | `pnpm test` (`pnpm -r --no-bail test`) | 1 | 797s | 12 failed |
| 6 | Downstream | `pnpm check` | 0 | 197s | ok |
| 7 | Downstream | `pnpm test` | 0 | 520s | all pass |
| 8 | Downstream | `pnpm build` | 0 | 37s | ok |

### Core `pnpm test` totals by package
- packages/contracts: 127 passed in 12 files
- packages/client-gateway-websocket: 10 passed in 2 files
- packages/fluxiq: **12 failed**, 8756 passed, 7 skipped (8775 tests). By file: 1 failed, 899 passed, 3 skipped (903 files).
- apps/web: 2933 passed in 359 files

Core's test command uses `--no-bail`, so every package ran and none had to be re-run by hand.

### Core failures (packages/fluxiq), all in one file
File: `src/programs/automation-studio/api/handlers/tests/runtime-execution.test.ts`. All 12 fail with the same first error. None are timeouts:
`TypeError: automationStudioFlowBootstrapFailedBuilds is not a function`, thrown at `api/handlers/llm-generation.ts:16:24` (`registerLlmGenerationEndpoints`). It is called from `register.ts:50` and reached from the test at line 46.

Tests in "the run endpoint and a run's model intent":
1. makes the run's llmExecution from runIntent and the signed-in actor, with nothing held first
2. runs a paired client's model run under the person's unlocked session, paying only for repair checks
3. lets a person's own session ask to pay only for repair checks
4. refuses any other choice of which result checks the caller pays for, and runs nothing
5. asks nothing of the result checks of a run the model takes no part in
6. runs a paired client's Flow deterministically, without a model, when the person has no unlocked session
7. still refuses an intent Core does not support from a paired client, and runs nothing
8. refuses a run intent with no signed-in person, and runs nothing
9. runs a plain run, without a model intent, with no llmExecution

Tests in "the run endpoint's answer":
10. reports the run's summary, adaptations and durable change from its detail
11. says whether a re-authored Flow was kept, from the re-author's own marker, in a closed word
12. fails, naming the ended run, when the run's detail cannot be read, instead of reporting no change

### Downstream `pnpm test` totals (0 failures)
boundary-audit 6, real-site-policy 7, test-contracts 168, test-matrix 17, domain 1637, agent-orchestrator 16, test-evidence 17, scenario-lab 685, extension 2647, test-runner 2112 (2107 passed, 5 skipped). No `not ok` lines in the log.

## Not verified
- I did not confirm the root cause of the Core failure. The function is exported from `runtime/flow-bootstrap/generation-failure/failed-builds.ts:21` and imported through `runtime/index.ts`. The test file has no `vi.mock`. That points to a module-load-order (import cycle) problem, where the barrel binding is still undefined when the code runs. This is a guess, not a finding.
- I did not exercise live browser behavior.

## Open questions or contradictions found
- Core `pnpm check` passes, but its tests fail at runtime. The typecheck cannot catch this kind of load-order failure. It most likely arrived with the merge at `feb476d2` (t368) or shortly before it. That is not bisected.
