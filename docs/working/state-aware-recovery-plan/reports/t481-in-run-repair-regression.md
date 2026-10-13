# t481: in-run repair "regression" (Core)

Worktree: `C:/Users/osrs_/FluxStuff/fxwork/t481/!FluxIQ`, branch `task/t481-in-run-repair-regression` at `cbc73a6d`. Not committed.

## Outcome

Done. **No commit broke it.** The two failures are a clock dependency in the test, not a code regression. These tests pass outside DeepSeek's weekday peak windows (01:00-04:00 and 06:00-10:00 UTC) and fail inside them, at every commit back to t438's own merge. The fix pins the clock in the test file to an off-peak instant. Every assertion is unchanged, and no production code changed.

## What changed and why

### Bisect

The test file fails at today's tip `cbc73a6d`, at today's base `aca9f088`, at `b31142ce` (t470), at `1dbb1081` (t380) and at `ada50919`, which is t438's own merge, the one that added the Lab-scoped test. All of these runs were at about 02:20 UTC on a Tuesday, which is peak time.

### Why the repair answers `none`

A scratch probe printed the cause directly. Receipt: `outcome: "none", code: "no_fix"`. The diagnosis passed validation. The `runtime_patch` intervention carried this issue:

`llm_budget.run_cost_limit: The per-run LLM estimated-cost budget cannot reserve this request.`

The diagnosis was `charged: { estimatedCostUsd: 0.0168, cost: "reserved" }`.

1. The fixture's mock diagnosis reply reports no usage, so the ledger charges the call what it reserved.
2. Since t254, `recovery/annotation/run-budget.ts` (`worstCaseCallCostUsd`) reserves each call at its worst case at the rate in force now. For the fixture's limits (40,000 input, 4,000 output) on deepseek-flash, that is $0.012 + $0.0048 = **$0.0168 at peak** and $0.0084 off-peak.
3. With a $0.02 purse:
   - At peak, the diagnosis plus the patch reservation come to $0.0336, which is more than $0.02. The patch is refused before the provider, the plan finds no fix, and the repair answers `none`. That is the line 86 failure.
   - In the Lab-scoped test, the Flow has $0.04 - $0.02 = $0.02 left, so the same arithmetic gives the line 226 failure.
   - Off-peak, the two reservations come to $0.0168, which is at most $0.02, so the overlay is made.

### Proof

I made two scratch copies of the unchanged test file that differed only in a pinned `Date`:
- At 2026-10-12T12:00Z (off-peak): 12/12 passed.
- At 2026-10-13T02:30Z (peak): the same 2 failed.

Today's sweep evidently ran in a peak window. The scratch files are deleted.

### Fix

The only change is to `packages/fluxiq/src/programs/automation-studio/runtime/service/runtime-session/tests/in-run-repair.test.ts`:
- `beforeEach` calls `vi.useFakeTimers({ toFake: ["Date"] })` and `vi.setSystemTime(OFF_PEAK_MS)`, with `OFF_PEAK_MS = Date.UTC(2026, 9, 12, 12)`, a Monday at 12:00 UTC.
- `afterEach` calls `vi.useRealTimers()`.
- A comment states the arithmetic above.

Only `Date` is faked; timers still run normally. This follows the existing convention in `recovery/annotation/tests/run-budget.test.ts` (`OFF_PEAK_MS`), and that file already covers the peak-versus-off-peak reservation itself.

### Why not a production clock seam

- The run session never passes `now` to `bindAutomationStudioInRunRepair`.
- The binding's own `now` only stamps patch ids.
- `annotate.ts` builds the recovery budget without a clock.

Threading a clock through `in-run.ts`, `annotate.ts` and `in-run-repair.ts` would add production surface that only tests would use.

### R4b shape

Product behaviour is unchanged. A real provider reports usage, so the diagnosis is charged what it actually cost, not its reservation. The patch still reserves its worst case at the current rate. Effect on a Lab-scoped Flow's $0.10 purse: at peak the in-run repair needs about one peak worst-case reservation left, which is $0.024 at the live 48,000/8,000 limits. Off-peak it needs half that. This is the t254 design, not a regression.

## Commands run and observed results

Working directory: `C:/Users/osrs_/FluxStuff/fxwork/t481/!FluxIQ`.

- **Before the fix**, `packages/fluxiq`: `npx vitest run src/programs/automation-studio/runtime/service/runtime-session/tests/in-run-repair.test.ts` printed `Tests 2 failed | 10 passed (12)`. The same two failed at lines 86 and 226.
- **Bisect.** The script checked out each commit detached, ran only this file, and returned to the branch. `aca9f088`, `b31142ce`, `ada50919` and `1dbb1081` each printed `Tests 2 failed | 10 passed (12)`.
- **Clock probe** (scratch copies, since deleted):
  - `t481-scratch-clock-12` printed `✓ (12 tests)`.
  - `t481-scratch-clock-02` printed `2 failed`, the same two tests.
  - Combined total: `Tests 2 failed | 22 passed (24)`.
- **After the fix**, run at `Tue Oct 13 02:23:04 UTC 2026`, inside the peak window: the same file printed `Test Files 1 passed (1)`, `Tests 12 passed (12)`.
- `npx vitest run src/programs/automation-studio/runtime/service/runtime-session src/programs/automation-studio/runtime/flow-bootstrap/candidate src/programs/automation-studio/runtime/result-verification` printed `Test Files 82 passed (82)`, `Tests 716 passed (716)`.
- `npm run check` in `packages/fluxiq` (tsc --noEmit through build-cache) exited 0 with no errors.
- `node scripts/structure-audit.mjs` printed `structure-audit: passed (337 warning(s), 1159 baselined).` It also printed `2 baseline entries can be lowered`, which predates this change and has nothing to do with it. The changed test file is 275 lines and has no audit entry.
- `git status --short` shows only the one test file modified, and I am on branch `task/t481-in-run-repair-regression`.

## Not verified

- The fixed file has only been run at a peak hour in real time. Because `Date` is pinned, the result should not depend on the hour, and the off-peak scratch probe of the original file passed.
- I did not look for other tests in the package that depend on the wall clock through the recovery budget's peak pricing. Only the three named directories were run, and they pass now, in a peak window.
- There was no live or paid run for R4b; the brief did not call for one.

## Open questions or contradictions found

- The brief's premise that "it last passed before today's merges" does not hold. The file fails at t438's own merge whenever it runs at a peak hour. Any test whose ceiling is close to two worst-case reservations at peak, and whose mock reports no usage, has the same hazard.
- A sweep of the package for peak-hour sensitivity, for example the whole suite run once with `Date` pinned to 02:30 UTC on a weekday, would find any others.
