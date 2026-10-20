# Sweep 2026-10-20 (Brief sweep-1020)

## Outcome

Done. All eight commands ran to the end. Three failed: the Core tests, the downstream check and the downstream tests. Nothing was fixed. No log contains a V8 "out of memory" error.

Commits swept, each at `origin/dev` in a fresh detached worktree under `C:/Users/osrs_/FluxStuff/fxwork/sweep-1020/`:
- Core `ca23a8ba` (Merge task t734); downstream `6dd2d724`.

The logs are in `fxwork/sweep-1020/logs/<name>.log`, the exit codes are in `logs/exit.txt`, and the runner script is `logs/run.sh`. The worktrees are left in place.

## What changed and why

No repository files changed. This report is the only new file.

## Commands run and observed results

| Command | Exit | Totals |
| --- | --- | --- |
| Core `pnpm install --frozen-lockfile` | 0 | |
| Downstream `pnpm install --frozen-lockfile` | 0 | |
| Core `pnpm build` | 0 | |
| Core `pnpm check` | 0 | |
| Core `pnpm test` | 1 | contracts: 19 files, 250/250 tests. client-gateway-websocket: 27 files, 179/179 tests. packages/fluxiq: 1510 files (4 failed, 1503 passed, 3 skipped); 13321 tests (4 failed, 13310 passed, 7 skipped). apps/web: 390/390 files, 3129/3129 tests. |
| Downstream `pnpm check` | 1 | The script `node --test` step ran 677 tests: 675 passed, 1 failed, 1 skipped. The `&&` chain stopped there, so `structure-audit.mjs` and `pnpm -r check` did not run. |
| Downstream `pnpm test` | 1 | boundary-audit 6/6, real-site-policy 7/7, test-contracts 170/170, test-matrix 23/23, domain 2212/2212, test-evidence 19/19. scenario-lab: 998 tests, 996 passed, 2 failed. apps/extension printed `ok` through test 3107 and no failures, but no totals: it was still running when pnpm aborted on the scenario-lab failure. agent-orchestrator does not appear in the log, so it was not run or finished. |
| Downstream `pnpm build` | 0 | |

### Core packages/fluxiq failures (4)

Every failure is `Test timed out in 15000ms`. None is an assertion failure. Paths are under `packages/fluxiq/src/programs/automation-studio/runtime/`.

- `service/command-context/tests/controller.test.ts`: "uses production resolver and real SQL claim before socket and commits exact receipt before public result/event". **New.**
- `service/command-execution/tests/service.test.ts`: "runtime: real service, framework resolver, gateway and SQL admit two captured effects". **New.**
- `tests/service-bootstrap/tests/provider-unavailable.test.ts`: "carries on to a proposed Flow when an unanswered request is followed by an answer". **New.**
- `tests/service-flows/tests/flow-index-read.test.ts`: "fails when the flow index cannot be read, instead of listing no Flows". **New.**

### Downstream check failure (1)

- `scripts/build-cache/tests/registry.test.mjs:55`: "every tsconfig path a step's projects name is inside that step's fingerprint". The error is `git check-ignore --stdin --no-index` -> `fatal: empty string is not a valid pathspec`, which means an empty path was passed to git. **New.** The check passed in 1019b.

### Downstream test failures (2, both photo-social)

- `scenarios/photo-social/tests/breadth-paths.test.ts`, "breadth honest paths" > "newest-likes": this is an assertion failure (`deepStrictEqual`) on final state `newest-likes-account`. The test expected `liked` to be `[D1OKDvAEHfa, DPIEH3I491a, DgYZxS8LJOe]`, but the actual value did not include `DPIEH3I491a`. **New.**
- `scenarios/photo-social/tests/honest-and-naive-paths.test.ts`, "honest paths" > "the collection workflow builds Glaze ideas without touching Studio inspo": `step close-dialog (click) failed: locator.click: Timeout 5000ms exceeded.` **New.**

## Compared with sweep 1019b

These 1019b failures do not appear in this sweep:
- Core: creation, promotion-tier, cancel-parked-run (2), whole-operation (4), whole-sql, scale-graph-store (EBUSY), database-manager SQLiteRepository.
- Downstream: crossborder-marketplace "in a browser" traffic-check timeout.

Still failing: none.

New: the 4 Core timeouts, the build-cache registry check test, and the 2 photo-social tests. One of the photo-social failures is a real assertion failure.

Other agents were running on the machine at the same time. The timeouts may depend on load, but I did not confirm that.

## Not verified

- I did not rerun any failing test on its own, so I do not know which are flaky.
- I have no extension totals and no agent-orchestrator result, because pnpm aborted.
- The downstream structure audit and the per-package `pnpm -r check` did not run in this sweep, because the check stopped at the failing test before them.
- I did not diagnose any failure.

## Open questions or contradictions found

- The downstream check failed at the registry test even though 1019b passed it. It could be specific to this sweep's worktree (an empty pathspec from git), but I did not establish that.
