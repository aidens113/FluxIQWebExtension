# Sweep 2026-10-19 b (Brief sweep-1019b)

## Outcome

Done. All eight commands ran to the end. Two failed: the Core tests and the downstream tests. Nothing was fixed.

Commits swept, each at `origin/dev` in a fresh detached worktree under `C:/Users/osrs_/FluxStuff/fxwork/sweep-1019b/`:
- Core `4077d0a0`; downstream `cedd46af`.

The logs are in `fxwork/sweep-1019b/logs/<name>.log`, the exit codes are in `logs/summary.txt`, and the runner script is `run.sh`. The worktrees are left in place.

## What changed and why

No repository files changed. This report is the only new file.

## Commands run and observed results

| Command | Exit | Totals |
| --- | --- | --- |
| Core `pnpm install` | 0 | |
| Downstream `pnpm install` | 0 | |
| Core `pnpm build` | 0 | |
| Core `pnpm check` | 0 | |
| Core `pnpm test` | 1 | contracts 178/178. client-gateway-websocket 10/10. packages/fluxiq: 1454 files (7 failed, 1444 passed, 3 skipped); 12883 tests (10 failed, 12852 passed, 21 skipped). apps/web: 389/389 files, 3123/3123 tests. |
| Downstream `pnpm check` | 0 | |
| Downstream `pnpm test` | 1 | boundary-audit 6/6, real-site-policy 7/7, test-contracts 170/170, test-matrix 17/17, domain 2177/2177, agent-orchestrator 16/16, test-evidence 19/19, extension 3271/3271. scenario-lab: 874 tests, 873 passed, 1 failed. pnpm stopped at scenario-lab, so any packages after it did not run. |
| Downstream `pnpm build` | 0 | |

### Core packages/fluxiq failures (10)

Paths are under `packages/fluxiq/src/programs/`. The log shows only three distinct error messages: `Test timed out in 15000ms`, `Hook timed out in 15000ms`, and one `EBUSY: resource busy or locked, unlink ...project.sqlite-shm` from scale-graph-store. Vitest groups identical errors, so I could not tell which timeout message belongs to which test. There are no assertion failures.

- `automation-studio/runtime/service/flows/tests/creation.test.ts`: "creates and saves through all actual file effects under one parent". **New.**
- `automation-studio/runtime/tests/service-adaptation/tests/promotion-tier.test.ts`: "sends a change whose latest replay failed to a person". **New.**
- `automation-studio/runtime/tests/service-flows/tests/cancel-parked-run.test.ts`: "says no resolution for a run that was not parked" and "settles a parked run's wait as cancelled, once, under the parked ask's ref". **New.**
- `automation-studio/storage/canonical-authority/tests/whole-operation.test.ts`:
  - "has one sql writer admission ..." and "has one file writer admission ...". **Also failed in S1.**
  - "holds actual sql partial writer effects across a fresh authority reopen" and "rereads the actual global receipt after project completion and retains a corrupted partial join". **New.**
- `automation-studio/storage/canonical-authority/tests/whole-sql.test.ts`: the whole file failed, most likely the hook timeout. **New.**
- `automation-studio/testing/tests/scale-graph-store.test.ts`: "exercises the SQL graph viewport and patch path with bounded responses" (EBUSY). **New.**
- `database-manager/tests/index.test.ts`: "SQLiteRepository > filters, sorts, counts, and pages records in SQLite". **New.**

### Downstream test failure (1)

- `apps/scenario-lab` "crossborder-marketplace in a browser" (`scenarios/crossborder-marketplace/tests/browser-paths.test.ts`, compiled line 138): `Step traffic-check (waitForState) failed: locator.waitFor: Timeout 6000ms exceeded.` **New.** scenario-lab never ran in S1 because pnpm stopped earlier.

## Compared with sweep S1

These S1 failures do not appear in this sweep:
- Core: ask-activity (6), site-reset-build, site-reset-calls, whole-process (6), entry-removal-command, context-history-reads, subflow-index-read, extraction-vocabulary, issue-feedback, deepseek system-prompt (4), kept-condition-advice (2), failed-step-reauthor.
- Core apps/web: all 56 (architecture-contract, core-contract, coverage).
- Downstream check: the 2 TS7006 errors in `installed-project.spec.ts`.
- Downstream domain: the `adapter.test.ts` "promotes the client's message" failure.

Still failing: 2 tests in whole-operation, both timeouts.

New: the 8 Core tests flagged above and the 1 scenario-lab test.

Every new failure is a timeout, a hook timeout or a locked file. None is an assertion failure. They may depend on machine load, because lane worktrees t724 to t729 may have been running work at the same time, but I did not confirm that.

## Not verified

- I did not rerun any failing test on its own to check whether it is flaky.
- I could not tell which tests were in packages after scenario-lab, because pnpm stopped at the first failure there. Compare the package list with `pnpm -r` order if it matters.
- I did not diagnose any failure, as the brief asked.

## Open questions or contradictions found

None.
