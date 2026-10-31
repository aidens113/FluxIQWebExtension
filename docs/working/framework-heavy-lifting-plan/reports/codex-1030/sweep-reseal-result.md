# Sweep 2 re-seal timeout investigation

Outcome: Partial — narrow reproductions passed; the original timeout's exact awaited stage is not recorded and remains unproven. No source fix is justified.

## Evidence

- Sweep log `test-runs/2026-10-30-sweep-2/core-test.log:4080` records the first two interruption tests passing in 1,370/1,406ms and the racing writer timing out at 15,000ms (15,535ms including cleanup). The final failure at line 5869 has no SQL stage, pending-operation trace, or associated SQLite error. It does not establish how far the original test body progressed.
- Owning source files in frozen t818 and authoring Core t820 were byte-identical: race test, content store, database pool, statement cache, and database scrub.
- The writer's `beforeWriterCommit` seam runs before `holdObject` starts its `BEGIN IMMEDIATE` transaction. It awaits a re-seal using a separate pool. Neither the writer transaction nor a schema migration queue is held across this seam; no application-level circular wait was found.
- Sustained waits could occur in native SQLite callbacks (configured busy timeout 10,000ms), including transaction start, VACUUM, or checkpoint. The log cannot identify one, and no such wait reproduced. Cached `get` statements are not retained; cached `all` reads step to completion. A retained read lock has not been demonstrated.

## Narrow validation

Both runs used `pnpm.cmd --filter fluxiq exec vitest run src/programs/automation-studio/storage/project/content-reseal/tests/reseal-interruption.test.ts --maxWorkers=1 --minWorkers=1 --reporter=verbose` in `C:/Users/osrs_/FluxStuff/!FluxIQ`, with inherited provider/FluxIQ variables stripped and fresh ignored runtime/temp roots. The timeout stayed 15,000ms; no API, browser, panel, or whole suite ran.

- Untouched source: **1 file / 3 tests passed**, race 798ms, total 5.41s. Evidence: Core `.fluxiq/reseal-debug-5c48811d/vitest.log`.
- One temporary probed rerun: **1 file / 3 tests passed**, race 1,949ms, total 15.33s. Evidence: Core `.fluxiq/reseal-probed-0a0ce1fc/vitest.log`. The race reached fixture ready at 1,277ms, writer open at 1,319ms, re-seal start/return at 1,341/1,863ms, writer commit at 1,875ms, read after deleting k1 at 1,880ms, and both references verified at 1,913ms. Across 183 observed database operations, the slowest was 89ms; final re-seal VACUUM/checkpoint took 38/45ms.
- Temporary probes were confined to the owned race-test file and removed. The test's original bytes were restored and hash equality observed. Frozen t818 was never changed.

## Fix and remaining validation

No permanent fix paths: the original failure is not reproduced and does not prove an erroneous barrier or lock. Do not extend the timeout, weaken assertions, alter persistence semantics, or attribute this to the machine. The next eligible corrected-source sweep should exercise the actual three-worker real-SQL group; capture the pending SQL operation/stage if this failure returns. This investigation did not reproduce that original group concurrency, and no broad repetition/stress loop ran.

Changed: this report only; no net Core source changes.
Validation: named command above -> 3/3 passed twice; temporary probes removed -> restored-byte hash equality `True`.
Not verified: original awaited stage/cause; original three-worker SQL-group behavior; whole suites.
Report: `docs/working/framework-heavy-lifting-plan/reports/codex-1030/sweep-reseal-result.md`
Notes: No timeout-only patch or concurrency/persistence guarantee changes. Initial `pnpm` invocation hit PowerShell script policy before test launch; `pnpm.cmd` launched both recorded runs.
